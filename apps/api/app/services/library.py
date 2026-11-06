"""School library: books, copies with accession numbers, loans to students and staff, fines.

Rules worth knowing
* Accession numbers are `LIB-00001`...: one counter row per school bumped by an atomic upsert, so two people adding
  copies at once never share a number; a number is unique per school and never reused.
* A copy has at most one open loan (partial unique index) and the copy row is locked while issuing or returning.
* Calendar dates are IST school days. Fine = days past `due_on` (IST) x the school's per-day fine, in paise,
  fixed at the moment of return. A fine can be waived with a reason; both amounts are kept on the loan.
* A fine on a student's loan becomes a one-line fee invoice (head 'Library fine') created in the return transaction,
  so it is collected, receipted, reported and shown to parents like any fee. A staff borrower's fine is only
  recorded (fine_status 'manual'). A waived fine creates no invoice. The invoice is never edited by the library.
* Issue, return, fine waive/charge, lost/damaged are audited in the same transaction.
"""

import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.clock import IST, today_ist, utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.core.money import rupees
from app.models.enums import AuditCategory, CopyStatus, LoanOutcome, StudentStatus, UserKind
from app.models.fees import FeeInvoice
from app.models.library import LibraryBook, LibraryCopy, LibraryCounter, LibraryLoan, LibrarySettings
from app.models.student import Student
from app.models.user import User
from app.schemas.library import (
    BookIn,
    BookOut,
    BookPatch,
    CopyOut,
    IssueIn,
    LibrarySummary,
    LoanOut,
    ParentFine,
    ParentLibrary,
    ParentLoan,
    ReturnIn,
    SettingsIn,
)
from app.services import fee_invoices
from app.services import fees as fee_base
from app.services.audit import Actor, change, log_audit
from app.services.messages_i18n import render
from app.services.notifications import notify_guardians_of_student
from app.services.students import full_name

DEFAULT_LOAN_DAYS = 14
MAX_RENEWALS = 2
REMIND_EVERY_DAYS = 3


# ------------------------------------------------------------------ settings
async def get_settings(db: AsyncSession) -> SettingsIn:
    row = await db.scalar(select(LibrarySettings))
    return SettingsIn(
        loan_days=row.loan_days if row else DEFAULT_LOAN_DAYS, fine_per_day_paise=row.fine_per_day_paise if row else 0
    )


async def save_settings(db: AsyncSession, actor: Actor, body: SettingsIn) -> SettingsIn:
    before = await get_settings(db)
    stmt = (
        pg_insert(LibrarySettings)
        .values(school_id=actor.school_id, loan_days=body.loan_days, fine_per_day_paise=body.fine_per_day_paise)
        .on_conflict_do_update(
            index_elements=[LibrarySettings.school_id],
            set_={"loan_days": body.loan_days, "fine_per_day_paise": body.fine_per_day_paise, "updated_at": func.now()},
        )
    )
    await db.execute(stmt)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "library.settings_updated",
        "Changed library loan days and fine",
        entity_type="library_settings",
        entity_label="Library settings",
        changes=[
            change("loan_days", before.loan_days, body.loan_days),
            change("fine_per_day_paise", before.fine_per_day_paise, body.fine_per_day_paise),
        ],
    )
    return body


# ------------------------------------------------------------------ books and copies
def _counts():
    return (
        select(
            LibraryCopy.book_id.label("book_id"),
            func.count().label("total"),
            func.count().filter(LibraryCopy.status == "available").label("available"),
            func.count().filter(LibraryCopy.status == "issued").label("issued"),
            func.count().filter(LibraryCopy.status == "lost").label("lost"),
            func.count().filter(LibraryCopy.status == "damaged").label("damaged"),
        )
        .group_by(LibraryCopy.book_id)
        .subquery()
    )


def books_query(q: str | None, category: str | None, available_only: bool) -> Select:
    c = _counts()
    stmt = select(LibraryBook, c).outerjoin(c, c.c.book_id == LibraryBook.id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                LibraryBook.title.ilike(like),
                LibraryBook.author.ilike(like),
                LibraryBook.isbn.ilike(like),
                LibraryBook.category.ilike(like),
            )
        )
    if category:
        stmt = stmt.where(func.lower(LibraryBook.category) == category.strip().lower())
    if available_only:
        stmt = stmt.where(func.coalesce(c.c.available, 0) > 0)
    return stmt.order_by(func.lower(LibraryBook.title), LibraryBook.id)


def book_out(row) -> BookOut:
    b = row[0]
    m = row._mapping
    return BookOut(
        id=b.id,
        title=b.title,
        author=b.author,
        isbn=b.isbn,
        category=b.category,
        copies_total=m["total"] or 0,
        available=m["available"] or 0,
        issued=m["issued"] or 0,
        lost=m["lost"] or 0,
        damaged=m["damaged"] or 0,
    )


async def get_book_or_404(db: AsyncSession, book_id: uuid.UUID) -> LibraryBook:
    b = await db.get(LibraryBook, book_id)
    if b is None:
        raise NotFound("Book not found.")
    return b


async def book_with_counts(db: AsyncSession, book_id: uuid.UUID) -> BookOut:
    c = _counts()
    row = (
        await db.execute(
            select(LibraryBook, c).outerjoin(c, c.c.book_id == LibraryBook.id).where(LibraryBook.id == book_id)
        )
    ).first()
    if row is None:
        raise NotFound("Book not found.")
    return book_out(row)


async def create_book(db: AsyncSession, actor: Actor, body: BookIn) -> LibraryBook:
    book = LibraryBook(
        school_id=actor.school_id,
        title=body.title,
        author=body.author,
        isbn=body.isbn or None,
        category=body.category or None,
    )
    db.add(book)
    await db.flush()
    if body.copies:
        await add_copies(db, actor, book, body.copies)
    return book


async def update_book(db: AsyncSession, book: LibraryBook, body: BookPatch) -> LibraryBook:
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "title" and v is None:
            continue
        setattr(book, k, (v.strip() or None) if isinstance(v, str) and k in ("isbn", "category") else v)
    await db.flush()
    return book


async def delete_book(db: AsyncSession, book: LibraryBook) -> None:
    if await db.scalar(select(func.count()).select_from(LibraryCopy).where(LibraryCopy.book_id == book.id)):
        raise Conflict("This book still has copies. Books with copies cannot be deleted.", code="has_copies")
    await db.delete(book)


async def add_copies(
    db: AsyncSession, actor: Actor, book: LibraryBook, count: int, accession_no: str | None = None
) -> list[LibraryCopy]:
    if accession_no is not None:
        if count != 1:
            raise AppError("A fixed accession number needs count 1.", code="accession_count", status=422)
        numbers = [accession_no.strip()]
    else:
        # one atomic upsert reserves `count` numbers; concurrent callers queue on the counter row
        last = (
            await db.execute(
                pg_insert(LibraryCounter)
                .values(school_id=actor.school_id, last=count)
                .on_conflict_do_update(
                    index_elements=[LibraryCounter.school_id], set_={"last": LibraryCounter.last + count}
                )
                .returning(LibraryCounter.last)
            )
        ).scalar_one()
        numbers = [f"LIB-{n:05d}" for n in range(last - count + 1, last + 1)]
    copies = [LibraryCopy(school_id=actor.school_id, book_id=book.id, accession_no=n) for n in numbers]
    try:
        async with db.begin_nested():
            db.add_all(copies)
            await db.flush()
    except IntegrityError:
        raise Conflict("That accession number is already used.", code="accession_taken") from None
    return copies


async def book_copies(db: AsyncSession, book_id: uuid.UUID) -> list[CopyOut]:
    rows = (
        await db.execute(
            select(LibraryCopy, LibraryBook.title, LibraryLoan.id)
            .join(LibraryBook, LibraryBook.id == LibraryCopy.book_id)
            .outerjoin(LibraryLoan, and_(LibraryLoan.copy_id == LibraryCopy.id, LibraryLoan.returned_at.is_(None)))
            .where(LibraryCopy.book_id == book_id)
            .order_by(LibraryCopy.accession_no)
        )
    ).all()
    return [
        CopyOut(
            id=c.id,
            book_id=c.book_id,
            accession_no=c.accession_no,
            status=c.status,
            book_title=title,
            current_loan_id=loan_id,
        )
        for c, title, loan_id in rows
    ]


async def copy_out(db: AsyncSession, copy_id: uuid.UUID) -> CopyOut:
    c = await get_copy_or_404(db, copy_id)
    return next(x for x in await book_copies(db, c.book_id) if x.id == c.id)


async def get_copy_or_404(db: AsyncSession, copy_id: uuid.UUID, *, lock: bool = False) -> LibraryCopy:
    stmt = select(LibraryCopy).where(LibraryCopy.id == copy_id)
    c = await db.scalar(stmt.with_for_update() if lock else stmt)
    if c is None:
        raise NotFound("Copy not found.")
    return c


async def set_copy_status(db: AsyncSession, actor: Actor, copy: LibraryCopy, status: str) -> LibraryCopy:
    """Shelf-side marking: available / lost / damaged. A copy that is out on loan is handled by returning it."""
    copy = await get_copy_or_404(db, copy.id, lock=True)
    if copy.status == CopyStatus.issued.value:
        raise Conflict("This copy is out on loan. Return it (as lost or damaged) instead.", code="copy_issued")
    if copy.status != status:
        book = await db.get(LibraryBook, copy.book_id)
        before, copy.status = copy.status, status
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            f"library.copy_{status}",
            f"Library copy {copy.accession_no} ({book.title if book else ''}) marked {status}",
            entity_type="library_copy",
            entity_id=copy.id,
            entity_label=copy.accession_no,
            changes=[change("status", before, status)],
        )
        await db.flush()
    return copy


# ------------------------------------------------------------------ loans
def fine_for(due_on: date, on: date, per_day_paise: int) -> tuple[int, int]:
    """(days overdue, fine in paise) when settled on `on` (IST date)."""
    days = max(0, (on - due_on).days)
    return days, days * per_day_paise


def _loan_base() -> Select:
    staff = aliased(User)
    return (
        select(LibraryLoan, LibraryCopy.accession_no, LibraryBook, Student, staff.name)
        .join(LibraryCopy, LibraryCopy.id == LibraryLoan.copy_id)
        .join(LibraryBook, LibraryBook.id == LibraryCopy.book_id)
        .outerjoin(Student, Student.id == LibraryLoan.student_id)
        .outerjoin(staff, staff.id == LibraryLoan.staff_id)
    ), staff


def loans_query(
    *,
    status: str = "all",
    student_id: uuid.UUID | None = None,
    staff_id: uuid.UUID | None = None,
    book_id: uuid.UUID | None = None,
    q: str | None = None,
    today: date | None = None,
) -> Select:
    stmt, staff = _loan_base()
    today = today or today_ist()
    if status == "open":
        stmt = stmt.where(LibraryLoan.returned_at.is_(None))
    elif status == "overdue":
        stmt = stmt.where(LibraryLoan.returned_at.is_(None), LibraryLoan.due_on < today)
    elif status in ("returned", "damaged", "lost"):
        stmt = stmt.where(LibraryLoan.outcome == status)
    if student_id:
        stmt = stmt.where(LibraryLoan.student_id == student_id)
    if staff_id:
        stmt = stmt.where(LibraryLoan.staff_id == staff_id)
    if book_id:
        stmt = stmt.where(LibraryBook.id == book_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                LibraryBook.title.ilike(like),
                LibraryBook.author.ilike(like),
                LibraryCopy.accession_no.ilike(like),
                Student.first_name.ilike(like),
                Student.last_name.ilike(like),
                func.concat(Student.first_name, " ", Student.last_name).ilike(like),
                Student.scholar_no.ilike(like),
                staff.name.ilike(like),
            )
        )
    if status in ("open", "overdue"):
        return stmt.order_by(LibraryLoan.due_on, LibraryLoan.id)
    return stmt.order_by(LibraryLoan.issued_at.desc(), LibraryLoan.id)


async def fine_states(db: AsyncSession, loans: list[LibraryLoan]) -> dict[uuid.UUID, tuple[str, str, int]]:
    """loan id -> (fine_status, invoice no, balance) for loans whose fine was billed."""
    ids = {x.fine_invoice_id for x in loans if x.fine_invoice_id}
    if not ids:
        return {}
    nos = dict((await db.execute(select(FeeInvoice.id, FeeInvoice.invoice_no).where(FeeInvoice.id.in_(ids)))).all())
    money = {r.id: r for r in (await db.execute(fee_base.invoice_money().where(FeeInvoice.id.in_(ids)))).all()}
    out = {}
    for x in loans:
        m = money.get(x.fine_invoice_id) if x.fine_invoice_id else None
        if m is None:
            continue
        status = fee_base.status_of(m.closed_at is not None, m.total, m.paid)
        out[x.id] = (status, nos[x.fine_invoice_id], 0 if status == "closed" else max(m.total - m.paid, 0))
    return out


def _fine_status(loan: LibraryLoan, billed: tuple[str, str, int] | None) -> str:
    if loan.returned_at is None:
        return "none"
    if billed:
        return billed[0]
    if loan.fine_paise > 0:
        return "manual"
    return "waived" if loan.fine_waived_paise > 0 else "none"


def loan_out(row, per_day_paise: int, today: date, billed: dict | None = None) -> LoanOut:
    loan, accession, book, student, staff_name = row
    bill = (billed or {}).get(loan.id)
    status_ = _fine_status(loan, bill)
    open_ = loan.returned_at is None
    days = max(0, (today - loan.due_on).days) if open_ else None
    if open_:
        fine = days * per_day_paise
    else:
        fine = loan.fine_paise
        days = max(0, (loan.returned_at.astimezone(IST).date() - loan.due_on).days)
    return LoanOut(
        id=loan.id,
        copy_id=loan.copy_id,
        accession_no=accession,
        book_id=book.id,
        title=book.title,
        author=book.author,
        borrower_type="student" if loan.student_id else "staff",
        student_id=loan.student_id,
        student_name=full_name(student) if student else None,
        scholar_no=student.scholar_no if student else None,
        staff_id=loan.staff_id,
        staff_name=staff_name,
        issued_at=loan.issued_at,
        due_on=loan.due_on,
        returned_at=loan.returned_at,
        outcome=loan.outcome,
        status=(("overdue" if days else "open") if open_ else loan.outcome),
        overdue=bool(open_ and days),
        days_overdue=days,
        fine_paise=fine,
        fine_waived_paise=loan.fine_waived_paise,
        waive_reason=loan.waive_reason,
        renewals=loan.renewals,
        fine_status=status_,
        fine_paid=status_ == "paid",
        fine_invoice_id=loan.fine_invoice_id,
        fine_invoice_no=bill[1] if bill else None,
        fine_balance_paise=bill[2] if bill else (fine if status_ == "manual" else 0),
    )


async def loan_view(db: AsyncSession, loan_id: uuid.UUID) -> LoanOut:
    stmt, _ = _loan_base()
    row = (await db.execute(stmt.where(LibraryLoan.id == loan_id))).first()
    if row is None:
        raise NotFound("Loan not found.")
    billed = await fine_states(db, [row[0]])
    return loan_out(row, (await get_settings(db)).fine_per_day_paise, today_ist(), billed)


async def list_loans(db: AsyncSession, stmt: Select, limit: int, offset: int) -> tuple[list[LoanOut], int]:
    total = await db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = (await db.execute(stmt.limit(limit).offset(offset))).all()
    rate, today = (await get_settings(db)).fine_per_day_paise, today_ist()
    billed = await fine_states(db, [r[0] for r in rows])
    return [loan_out(r, rate, today, billed) for r in rows], total


async def _borrower(db: AsyncSession, actor: Actor, student_id: uuid.UUID | None, staff_id: uuid.UUID | None) -> str:
    """Checks the borrower and returns a label for the audit text."""
    if (student_id is None) == (staff_id is None):
        raise AppError("Give either a student or a staff member.", code="one_borrower", status=422)
    if student_id:
        s = await db.get(Student, student_id)
        if s is None:
            raise NotFound("Student not found.")
        if s.status != StudentStatus.active.value:
            raise Conflict("Books can only be issued to current students.", code="student_not_active")
        return full_name(s)
    u = await db.get(User, staff_id)
    if u is None or u.school_id != actor.school_id or u.kind != UserKind.staff.value or u.deleted_at is not None:
        raise NotFound("Staff member not found.")
    if not u.is_active:
        raise Conflict("That staff member is not active.", code="staff_not_active")
    return u.name


async def issue(db: AsyncSession, actor: Actor, body: IssueIn) -> LibraryLoan:
    if body.copy_id is None and not body.accession_no:
        raise AppError("Give copy_id or accession_no.", code="copy_required", status=422)
    if body.copy_id:
        copy = await get_copy_or_404(db, body.copy_id, lock=True)
    else:
        copy = await db.scalar(
            select(LibraryCopy).where(LibraryCopy.accession_no == body.accession_no.strip()).with_for_update()
        )
        if copy is None:
            raise NotFound("No copy with that accession number.")
    who = await _borrower(db, actor, body.student_id, body.staff_id)
    if copy.status != CopyStatus.available.value:
        raise Conflict(f"This copy is {copy.status} and cannot be issued.", code="copy_not_available")
    today = today_ist()
    due = body.due_on or today + timedelta(days=(await get_settings(db)).loan_days)
    if due < today:
        raise AppError("The due date cannot be in the past.", code="due_in_past", status=422)
    loan = LibraryLoan(
        school_id=actor.school_id,
        copy_id=copy.id,
        student_id=body.student_id,
        staff_id=body.staff_id,
        issued_at=utcnow(),
        due_on=due,
        fine_paise=0,
        fine_waived_paise=0,
        renewals=0,
        issued_by=actor.id,
    )
    copy.status = CopyStatus.issued.value
    try:
        async with db.begin_nested():
            db.add(loan)
            await db.flush()
    except IntegrityError:
        raise Conflict("This copy is already out on loan.", code="copy_not_available") from None
    book = await db.get(LibraryBook, copy.book_id)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "library.issued",
        f"Issued '{book.title if book else ''}' ({copy.accession_no}) to {who}, due {due.isoformat()}",
        entity_type="library_loan",
        entity_id=loan.id,
        entity_label=copy.accession_no,
    )
    return loan


async def _open_loan(db: AsyncSession, loan_id: uuid.UUID) -> LibraryLoan:
    loan = await db.scalar(select(LibraryLoan).where(LibraryLoan.id == loan_id).with_for_update())
    if loan is None:
        raise NotFound("Loan not found.")
    if loan.returned_at is not None:
        raise Conflict("This loan is already closed.", code="loan_closed")
    return loan


async def return_loan(db: AsyncSession, actor: Actor, loan_id: uuid.UUID, body: ReturnIn) -> LibraryLoan:
    loan = await _open_loan(db, loan_id)
    copy = await get_copy_or_404(db, loan.copy_id, lock=True)
    book = await db.get(LibraryBook, copy.book_id)
    now = utcnow()
    days, computed = fine_for(loan.due_on, today_ist(now), (await get_settings(db)).fine_per_day_paise)
    fine = body.fine_paise if body.fine_paise is not None else computed
    waived = 0
    if body.waive_fine and fine > 0:
        if not (body.waive_reason and body.waive_reason.strip()):
            raise AppError("Give a reason to waive the fine.", code="waive_reason_required", status=422)
        waived, fine = fine, 0
        loan.waive_reason = body.waive_reason.strip()
    outcome = {"good": LoanOutcome.returned, "damaged": LoanOutcome.damaged, "lost": LoanOutcome.lost}[body.condition]
    loan.returned_at, loan.returned_by, loan.outcome = now, actor.id, outcome.value
    loan.fine_paise, loan.fine_waived_paise = fine, waived
    copy.status = {
        LoanOutcome.returned: CopyStatus.available,
        LoanOutcome.damaged: CopyStatus.damaged,
        LoanOutcome.lost: CopyStatus.lost,
    }[outcome].value
    title = f"'{book.title if book else ''}' ({copy.accession_no})"
    action = {"returned": "library.returned", "damaged": "library.damaged", "lost": "library.lost"}[outcome.value]
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        action,
        f"{title} {'returned' if outcome == LoanOutcome.returned else 'marked ' + outcome.value}"
        f"{f', {days} day(s) late' if days else ''}",
        entity_type="library_loan",
        entity_id=loan.id,
        entity_label=copy.accession_no,
    )
    if waived:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "library.fine_waived",
            f"Waived library fine {rupees(waived)} on {title}: {loan.waive_reason}",
            entity_type="library_loan",
            entity_id=loan.id,
            entity_label=copy.accession_no,
            changes=[change("fine_paise", waived, 0)],
        )
    if fine:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "library.fine_charged",
            f"Library fine {rupees(fine)} recorded on {title}",
            entity_type="library_loan",
            entity_id=loan.id,
            entity_label=copy.accession_no,
            changes=[change("fine_paise", 0, fine)],
        )
    await db.flush()
    if fine > 0 and loan.student_id:
        await _bill_fine(db, actor, loan, book.title if book else "", copy.accession_no, now)
    return loan


async def _bill_fine(
    db: AsyncSession, actor: Actor, loan: LibraryLoan, book_title: str, accession_no: str, now: datetime
) -> None:
    """Creates the one-line 'Library fine' invoice of a returned loan, in the return transaction. The loan row is
    locked and `fine_invoice_id` is set once, so a repeated call can never bill twice. A student without an
    enrolment this year cannot be invoiced: the fine stays recorded (fine_status 'manual')."""
    assert loan.student_id and loan.fine_invoice_id is None
    head = await fee_invoices.system_head(db, actor, fee_invoices.LIBRARY_FINE)
    due = today_ist(now) + timedelta(days=await fee_invoices.oneoff_due_days(db))
    inv = await fee_invoices.create_oneoff_invoice(
        db,
        actor,
        student_id=loan.student_id,
        head=head,
        amount_paise=loan.fine_paise,
        period_label=f"Library fine: {book_title[:28]} ({accession_no})",
        due_on=due,
    )
    if inv is None:
        return
    loan.fine_invoice_id = inv.id
    stu = await db.get(Student, loan.student_id)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "invoice.created",
        f"Library fine invoice {inv.invoice_no} of {rupees(loan.fine_paise)} for {full_name(stu)} "
        f"('{book_title}', {accession_no})",
        entity_type="fee_invoice",
        entity_id=inv.id,
        entity_label=inv.invoice_no,
    )
    await notify_guardians_of_student(
        db,
        loan.student_id,
        kind="fee_invoice",
        **render("library_fine", name=stu.first_name, title=book_title, amount=rupees(loan.fine_paise)).kw(),
        data={"invoice_id": inv.id, "loan_id": loan.id, "amount_paise": loan.fine_paise, "due_on": inv.due_on},
        dedupe_key=f"invoice:{inv.id}",
    )


async def renew(db: AsyncSession, actor: Actor, loan_id: uuid.UUID) -> LibraryLoan:
    loan = await _open_loan(db, loan_id)
    today = today_ist()
    if loan.due_on < today:
        raise Conflict("An overdue book cannot be renewed. Return it first.", code="overdue")
    if loan.renewals >= MAX_RENEWALS:
        raise Conflict(f"A book can be renewed {MAX_RENEWALS} times at most.", code="renewal_limit")
    old = loan.due_on
    loan.due_on = old + timedelta(days=(await get_settings(db)).loan_days)
    loan.renewals += 1
    copy = await get_copy_or_404(db, loan.copy_id)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "library.renewed",
        f"Renewed {copy.accession_no} until {loan.due_on.isoformat()}",
        entity_type="library_loan",
        entity_id=loan.id,
        entity_label=copy.accession_no,
        changes=[change("due_on", old, loan.due_on)],
    )
    await db.flush()
    return loan


# ------------------------------------------------------------------ parents
async def child_library(db: AsyncSession, student_id: uuid.UUID) -> ParentLibrary:
    stmt = loans_query(status="open", student_id=student_id)
    rate, today = (await get_settings(db)).fine_per_day_paise, today_ist()
    items = [loan_out(r, rate, today) for r in (await db.execute(stmt)).all()]
    out = [
        ParentLoan(
            id=i.id,
            title=i.title,
            author=i.author,
            accession_no=i.accession_no,
            issued_at=i.issued_at,
            due_on=i.due_on,
            overdue=i.overdue,
            days_overdue=i.days_overdue,
            renewals=i.renewals,
            fine_paise=i.fine_paise,
        )
        for i in items
    ]
    closed = (
        await db.execute(
            loans_query(status="all", student_id=student_id)
            .where(LibraryLoan.returned_at.is_not(None), LibraryLoan.fine_invoice_id.is_not(None))
            .limit(20)
        )
    ).all()
    billed = await fine_states(db, [r[0] for r in closed])
    fines = []
    for r in closed:
        o = loan_out(r, rate, today, billed)
        fines.append(
            ParentFine(
                loan_id=o.id,
                title=o.title,
                returned_at=o.returned_at,
                fine_paise=o.fine_paise,
                fine_status=o.fine_status,
                fine_paid=o.fine_paid,
                invoice_id=o.fine_invoice_id,
                balance_paise=o.fine_balance_paise,
            )
        )
    return ParentLibrary(
        student_id=student_id, current=out, overdue_count=sum(1 for i in out if i.overdue), fines=fines
    )


# ------------------------------------------------------------------ reminders
async def send_overdue_reminders(db: AsyncSession, today: date | None = None) -> int:
    """One reminder per overdue loan per 3 days to the child's parents. Staff borrowers get none. Runs inside the
    caller's transaction (RLS already scoped to one school)."""
    today = today or today_ist()
    now = utcnow()
    cutoff = now - timedelta(days=REMIND_EVERY_DAYS)
    rows = (
        await db.execute(
            select(LibraryLoan, LibraryBook.title, Student.first_name)
            .join(LibraryCopy, LibraryCopy.id == LibraryLoan.copy_id)
            .join(LibraryBook, LibraryBook.id == LibraryCopy.book_id)
            .join(Student, Student.id == LibraryLoan.student_id)
            .where(
                LibraryLoan.returned_at.is_(None),
                LibraryLoan.due_on < today,
                Student.status == StudentStatus.active.value,
                or_(LibraryLoan.last_reminded_at.is_(None), LibraryLoan.last_reminded_at < cutoff),
            )
            .order_by(LibraryLoan.due_on)
            .with_for_update(of=LibraryLoan, skip_locked=True)
        )
    ).all()
    sent = 0
    for loan, title, first_name in rows:
        ids = await notify_guardians_of_student(
            db,
            loan.student_id,
            kind="library_due",
            **render("library_due", name=first_name, title=title, due=loan.due_on).kw(),
            data={"loan_id": loan.id, "due_on": loan.due_on},
        )
        if ids:
            loan.last_reminded_at = now
            sent += 1
    await db.flush()
    return sent


# ------------------------------------------------------------------ export
def _ist(dt: datetime | None) -> str:
    return dt.astimezone(IST).strftime("%Y-%m-%d %H:%M") if dt else ""


async def export_rows(db: AsyncSession, *, books: Select, loans: Select) -> tuple[list[list], list[list]]:
    book_rows = [
        [b.title, b.author, b.isbn or "", b.category or "", i.copies_total, i.available, i.issued, i.lost, i.damaged]
        for b, i in ((r[0], book_out(r)) for r in (await db.execute(books)).all())
    ]
    rate, today = (await get_settings(db)).fine_per_day_paise, today_ist()
    loan_rows = []
    all_rows = (await db.execute(loans)).all()
    billed = await fine_states(db, [r[0] for r in all_rows])
    for r in all_rows:
        o = loan_out(r, rate, today, billed)
        loan_rows.append(
            [
                o.accession_no,
                o.title,
                o.borrower_type,
                o.student_name or o.staff_name or "",
                o.scholar_no or "",
                _ist(o.issued_at),
                o.due_on,
                _ist(o.returned_at),
                o.status,
                o.days_overdue,
                o.fine_paise / 100,
                o.fine_waived_paise / 100,
                o.renewals,
                o.fine_status,
            ]
        )
    return book_rows, loan_rows


BOOK_HEADERS = ["Title", "Author", "ISBN", "Category", "Copies", "Available", "Issued", "Lost", "Damaged"]
LOAN_HEADERS = [
    "Accession No",
    "Title",
    "Borrower type",
    "Borrower",
    "Scholar No",
    "Issued (IST)",
    "Due on",
    "Returned (IST)",
    "Status",
    "Days overdue",
    "Fine (Rs)",
    "Fine waived (Rs)",
    "Renewals",
    "Fine status",
]


async def summary(db: AsyncSession) -> LibrarySummary:
    """A few counts for the Home block: titles, copies, how many are out, how many are late (IST)."""
    from app.core.clock import today_ist

    books = await db.scalar(select(func.count()).select_from(LibraryBook)) or 0
    copies = await db.scalar(select(func.count()).select_from(LibraryCopy)) or 0
    out = await db.scalar(select(func.count()).select_from(LibraryLoan).where(LibraryLoan.returned_at.is_(None))) or 0
    late = (
        await db.scalar(
            select(func.count())
            .select_from(LibraryLoan)
            .where(LibraryLoan.returned_at.is_(None), LibraryLoan.due_on < today_ist())
        )
        or 0
    )
    return LibrarySummary(books=books, copies=copies, on_loan=out, overdue=late)
