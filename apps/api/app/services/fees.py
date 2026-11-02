"""Fees: shared helpers (money maths in SQL, numbering) and the setup rules (heads, structure, routes,
optional fees per student, concessions, late rule, settings)."""

import uuid
from datetime import date

from sqlalchemy import BigInteger, Select, case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.academic import AcademicYear, SchoolClass
from app.models.enums import AuditCategory, ConcessionKind, FeeScope, PaymentStatus, StudentStatus
from app.models.fees import (
    FeeConcession,
    FeeHead,
    FeeInvoice,
    FeeInvoiceItem,
    FeeLateRule,
    FeePayment,
    FeeSettings,
    FeeStructure,
    StudentConcession,
    StudentFeeOption,
    TransportRoute,
)
from app.models.student import Student
from app.models.user import User
from app.schemas.fees import (
    ConcessionIn,
    HeadIn,
    HeadPatch,
    LateRuleIn,
    OptionIn,
    RouteIn,
    RoutePatch,
    SettingsIn,
    StructureIn,
)
from app.services.audit import Actor, change, log_audit
from app.services.students import class_label, current_year_or_none, full_name, student_label


# ------------------------------------------------------------------ money in SQL
def total_expr():
    """Sum of an invoice's lines (fees + previous dues + late fee - concessions)."""
    return (
        select(func.coalesce(func.sum(FeeInvoiceItem.amount_paise), 0).cast(BigInteger))
        .where(FeeInvoiceItem.invoice_id == FeeInvoice.id)
        .correlate(FeeInvoice)
        .scalar_subquery()
    )


def paid_expr():
    """Sum of non-cancelled payments."""
    return (
        select(func.coalesce(func.sum(FeePayment.amount_paise), 0).cast(BigInteger))
        .where(FeePayment.invoice_id == FeeInvoice.id, FeePayment.status == PaymentStatus.active.value)
        .correlate(FeeInvoice)
        .scalar_subquery()
    )


def status_expr(total, paid):
    return case(
        (FeeInvoice.closed_at.is_not(None), "closed"),
        (total - paid <= 0, "paid"),
        (paid > 0, "partial"),
        else_="unpaid",
    )


def status_of(closed: bool, total: int, paid: int) -> str:
    if closed:
        return "closed"
    if total - paid <= 0:
        return "paid"
    return "partial" if paid > 0 else "unpaid"


def invoice_money() -> Select:
    """One row per invoice with its computed money. Use `.subquery()` and aggregate over it."""
    t, p = total_expr(), paid_expr()
    return select(
        FeeInvoice.id.label("id"),
        FeeInvoice.student_id.label("student_id"),
        FeeInvoice.enrollment_id.label("enrollment_id"),
        FeeInvoice.academic_year_id.label("academic_year_id"),
        FeeInvoice.due_on.label("due_on"),
        FeeInvoice.closed_at.label("closed_at"),
        t.label("total"),
        p.label("paid"),
    )


def rupees(paise: int) -> str:
    r, ps = divmod(paise, 100)
    return f"{r:,}" if ps == 0 else f"{r:,}.{ps:02d}"


# ------------------------------------------------------------------ numbering
async def next_numbers(db: AsyncSession, school_id: uuid.UUID, kind: str, n: int = 1) -> list[int]:
    """The next `n` numbers of a school-wide sequence. One atomic upsert: a second cashier waits for the first
    transaction instead of getting the same number. Rolls back together with the transaction (no gaps)."""
    last = (
        await db.execute(
            text(
                "insert into fee_counters (school_id, kind, last_seq) values (:s, :k, :n) "
                "on conflict (school_id, kind) do update set last_seq = fee_counters.last_seq + :n "
                "returning last_seq"
            ),
            {"s": school_id, "k": kind, "n": n},
        )
    ).scalar_one()
    return list(range(last - n + 1, last + 1))


def invoice_no(seq: int) -> str:
    return f"INV-{seq:06d}"


def receipt_no(seq: int) -> str:
    return f"RCP-{seq:06d}"


# ------------------------------------------------------------------ lookups
async def get_or_404(db: AsyncSession, model, id_: uuid.UUID, what: str):
    row = await db.get(model, id_)
    if row is None:
        raise NotFound(f"{what} not found.")
    return row


async def year_or_current(db: AsyncSession, year_id: uuid.UUID | None) -> AcademicYear:
    if year_id:
        return await get_or_404(db, AcademicYear, year_id, "Academic year")
    y = await current_year_or_none(db)
    if y is None:
        raise Conflict("There is no current academic year.", code="no_current_year")
    return y


async def _unique(db: AsyncSession, model, column, value: str, *, except_id: uuid.UUID | None = None) -> bool:
    stmt = select(model.id).where(func.lower(column) == value.lower())
    if except_id:
        stmt = stmt.where(model.id != except_id)
    return (await db.scalar(stmt)) is not None


# ------------------------------------------------------------------ heads
async def create_head(db: AsyncSession, actor: Actor, body: HeadIn) -> FeeHead:
    assert actor.school_id
    name = body.name.strip()
    if await _unique(db, FeeHead, FeeHead.name, name):
        raise Conflict(f"A fee head called {name} already exists.", code="head_exists")
    h = FeeHead(school_id=actor.school_id, name=name, scope=body.scope)
    db.add(h)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "fee_head.created",
        f"Created fee head {name} ({body.scope})",
        entity_type="fee_head",
        entity_id=h.id,
        entity_label=name,
    )
    return h


async def edit_head(db: AsyncSession, actor: Actor, head: FeeHead, body: HeadPatch) -> FeeHead:
    if head.is_system:
        raise Conflict(f"{head.name} is a system fee head and cannot be changed.", code="system_head")
    changes = []
    if body.name is not None and body.name.strip() != head.name:
        if await _unique(db, FeeHead, FeeHead.name, body.name.strip(), except_id=head.id):
            raise Conflict("A fee head with that name already exists.", code="head_exists")
        changes.append(change("Name", head.name, body.name.strip()))
        head.name = body.name.strip()
    if body.is_active is not None and body.is_active != head.is_active:
        changes.append(change("Active", head.is_active, body.is_active))
        head.is_active = body.is_active
    if changes:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "fee_head.updated",
            f"Updated fee head {head.name}",
            entity_type="fee_head",
            entity_id=head.id,
            entity_label=head.name,
            changes=changes,
        )
    return head


# ------------------------------------------------------------------ structure
async def set_structure(db: AsyncSession, actor: Actor, body: StructureIn) -> FeeStructure:
    assert actor.school_id
    cls = await get_or_404(db, SchoolClass, body.class_id, "Class")
    head = await get_or_404(db, FeeHead, body.fee_head_id, "Fee head")
    if head.scope != FeeScope.class_.value or head.is_system:
        raise AppError(
            f"{head.name} is an optional fee: set it per student, not per class.",
            code="head_not_class_scope",
            status=422,
        )
    row = await db.scalar(
        select(FeeStructure).where(FeeStructure.class_id == cls.id, FeeStructure.fee_head_id == head.id)
    )
    if row is None:
        row = FeeStructure(
            school_id=actor.school_id,
            class_id=cls.id,
            fee_head_id=head.id,
            amount_paise=body.amount_paise,
            frequency=body.frequency,
        )
        db.add(row)
        ch = [change("Amount", "", body.amount_paise), change("Frequency", "", body.frequency)]
    else:
        ch = []
        if row.amount_paise != body.amount_paise:
            ch.append(change("Amount (paise)", row.amount_paise, body.amount_paise))
        if row.frequency != body.frequency:
            ch.append(change("Frequency", row.frequency, body.frequency))
        row.amount_paise, row.frequency = body.amount_paise, body.frequency
    await db.flush()
    if ch:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "fee_structure.set",
            f"{head.name} for Class {class_label(cls)}: {rupees(body.amount_paise)} {body.frequency}",
            entity_type="fee_structure",
            entity_id=row.id,
            entity_label=f"{head.name} / {class_label(cls)}",
            changes=ch,
        )
    return row


async def delete_structure(db: AsyncSession, actor: Actor, row: FeeStructure) -> None:
    head = await db.get(FeeHead, row.fee_head_id)
    cls = await db.get(SchoolClass, row.class_id)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "fee_structure.removed",
        f"Removed {head.name if head else ''} from Class {class_label(cls) if cls else ''}",
        entity_type="fee_structure",
        entity_id=row.id,
    )
    await db.delete(row)


async def copy_structure(db: AsyncSession, actor: Actor, from_id: uuid.UUID, to_id: uuid.UUID) -> int:
    """Copies every line of one class to another (new section, new year). Existing lines of the target are kept."""
    assert actor.school_id
    if from_id == to_id:
        raise AppError("Choose two different classes.", code="same_class", status=422)
    src = await get_or_404(db, SchoolClass, from_id, "Class")
    dst = await get_or_404(db, SchoolClass, to_id, "Class")
    rows = (await db.scalars(select(FeeStructure).where(FeeStructure.class_id == src.id))).all()
    have = set((await db.scalars(select(FeeStructure.fee_head_id).where(FeeStructure.class_id == dst.id))).all())
    n = 0
    for r in rows:
        if r.fee_head_id in have:
            continue
        db.add(
            FeeStructure(
                school_id=actor.school_id,
                class_id=dst.id,
                fee_head_id=r.fee_head_id,
                amount_paise=r.amount_paise,
                frequency=r.frequency,
            )
        )
        n += 1
    await db.flush()
    if n:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "fee_structure.copied",
            f"Copied {n} fee lines from Class {class_label(src)} to Class {class_label(dst)}",
            entity_type="class",
            entity_id=dst.id,
            entity_label=class_label(dst),
        )
    return n


# ------------------------------------------------------------------ routes
async def create_route(db: AsyncSession, actor: Actor, body: RouteIn) -> TransportRoute:
    assert actor.school_id
    if await _unique(db, TransportRoute, TransportRoute.name, body.name.strip()):
        raise Conflict("A route with that name already exists.", code="route_exists")
    r = TransportRoute(school_id=actor.school_id, name=body.name.strip(), amount_paise=body.amount_paise)
    db.add(r)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "route.created",
        f"Created transport route {r.name}: {rupees(r.amount_paise)}",
        entity_type="transport_route",
        entity_id=r.id,
        entity_label=r.name,
    )
    return r


async def edit_route(db: AsyncSession, actor: Actor, r: TransportRoute, body: RoutePatch) -> TransportRoute:
    ch = []
    if body.name is not None and body.name.strip() != r.name:
        if await _unique(db, TransportRoute, TransportRoute.name, body.name.strip(), except_id=r.id):
            raise Conflict("A route with that name already exists.", code="route_exists")
        ch.append(change("Name", r.name, body.name.strip()))
        r.name = body.name.strip()
    if body.amount_paise is not None and body.amount_paise != r.amount_paise:
        ch.append(change("Amount (paise)", r.amount_paise, body.amount_paise))
        r.amount_paise = body.amount_paise  # only prefills new options; existing students keep their amount
    if body.is_active is not None and body.is_active != r.is_active:
        ch.append(change("Active", r.is_active, body.is_active))
        r.is_active = body.is_active
    if ch:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "route.updated",
            f"Updated transport route {r.name}",
            entity_type="transport_route",
            entity_id=r.id,
            entity_label=r.name,
            changes=ch,
        )
    return r


# ------------------------------------------------------------------ optional fees per student
async def _active_student(db: AsyncSession, student_id: uuid.UUID) -> Student:
    s = await get_or_404(db, Student, student_id, "Student")
    if s.status != StudentStatus.active.value:
        raise Conflict(f"{full_name(s)} is not an active student.", code="student_not_active")
    return s


async def set_option(
    db: AsyncSession, actor: Actor, student_id: uuid.UUID, body: OptionIn, *, year_id: uuid.UUID | None = None
) -> StudentFeeOption:
    """Add or change an optional fee (transport...). Only invoices not generated yet are affected."""
    assert actor.school_id
    student = await _active_student(db, student_id)
    year = await year_or_current(db, year_id or body.academic_year_id)
    head = await get_or_404(db, FeeHead, body.fee_head_id, "Fee head")
    if head.scope != FeeScope.optional.value or not head.is_active or head.is_system:
        raise AppError(f"{head.name} is not an active optional fee head.", code="head_not_optional", status=422)
    route = None
    if body.route_id:
        route = await get_or_404(db, TransportRoute, body.route_id, "Route")
        if not route.is_active:
            raise AppError("That route is not active.", code="route_inactive", status=422)
    amount = body.amount_paise or (route.amount_paise if route else None)
    if not amount or amount <= 0:
        raise AppError("Give an amount, or choose a route that has a price.", code="amount_required", status=422)
    row = await db.scalar(
        select(StudentFeeOption).where(
            StudentFeeOption.student_id == student.id,
            StudentFeeOption.academic_year_id == year.id,
            StudentFeeOption.fee_head_id == head.id,
        )
    )
    if row is None:
        row = StudentFeeOption(
            school_id=actor.school_id,
            student_id=student.id,
            academic_year_id=year.id,
            fee_head_id=head.id,
            route_id=route.id if route else None,
            amount_paise=amount,
            frequency=body.frequency,
            note=body.note,
        )
        db.add(row)
        ch = [change("Amount (paise)", "", amount), change("Route", "", route.name if route else "")]
    else:
        ch = [change("Amount (paise)", row.amount_paise, amount)]
        if row.route_id != (route.id if route else None):
            ch.append(change("Route", row.route_id, route.id if route else None))
        row.route_id, row.amount_paise = (route.id if route else None), amount
        row.frequency, row.note = body.frequency, body.note
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "fee_option.set",
        f"{head.name} for {student_label(student)}: {rupees(amount)} {body.frequency} ({year.name})",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        changes=ch,
    )
    return row


async def remove_option(db: AsyncSession, actor: Actor, student_id: uuid.UUID, option_id: uuid.UUID) -> None:
    row = await db.scalar(
        select(StudentFeeOption).where(StudentFeeOption.id == option_id, StudentFeeOption.student_id == student_id)
    )
    if row is None:
        raise NotFound("Fee option not found.")
    student = await get_or_404(db, Student, student_id, "Student")
    head = await db.get(FeeHead, row.fee_head_id)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "fee_option.removed",
        f"Removed {head.name if head else 'optional fee'} from {student_label(student)}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        changes=[change("Amount (paise)", row.amount_paise, "")],
    )
    await db.delete(row)


# ------------------------------------------------------------------ concessions
async def create_concession(db: AsyncSession, actor: Actor, body: ConcessionIn) -> FeeConcession:
    assert actor.school_id
    if body.kind == ConcessionKind.percent.value and not 1 <= body.value <= 100:
        raise AppError("A percentage is between 1 and 100.", code="invalid_percent", status=422)
    if body.fee_head_id:
        await get_or_404(db, FeeHead, body.fee_head_id, "Fee head")
    if await _unique(db, FeeConcession, FeeConcession.name, body.name.strip()):
        raise Conflict("A concession with that name already exists.", code="concession_exists")
    c = FeeConcession(
        school_id=actor.school_id,
        name=body.name.strip(),
        kind=body.kind,
        value=body.value,
        fee_head_id=body.fee_head_id,
    )
    db.add(c)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "concession.created",
        f"Created concession {c.name} ({body.value}{'%' if body.kind == 'percent' else ' paise'})",
        entity_type="fee_concession",
        entity_id=c.id,
        entity_label=c.name,
    )
    return c


async def assign_concession(
    db: AsyncSession,
    actor: Actor,
    student_id: uuid.UUID,
    concession_id: uuid.UUID,
    year_id: uuid.UUID | None,
    note: str | None,
) -> StudentConcession:
    assert actor.school_id and actor.id
    student = await get_or_404(db, Student, student_id, "Student")
    con = await get_or_404(db, FeeConcession, concession_id, "Concession")
    if not con.is_active:
        raise AppError("That concession is not active.", code="concession_inactive", status=422)
    year = await year_or_current(db, year_id)
    if await db.scalar(
        select(StudentConcession.id).where(
            StudentConcession.student_id == student.id,
            StudentConcession.concession_id == con.id,
            StudentConcession.academic_year_id == year.id,
        )
    ):
        raise Conflict("This student already has that concession for the year.", code="concession_assigned")
    row = StudentConcession(
        school_id=actor.school_id,
        student_id=student.id,
        concession_id=con.id,
        academic_year_id=year.id,
        approved_by=actor.id,
        note=note,
    )
    db.add(row)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "concession.assigned",
        f"{con.name} given to {student_label(student)} for {year.name}" + (" (applies to invoices not yet generated)"),
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
    )
    return row


async def revoke_concession(db: AsyncSession, actor: Actor, student_id: uuid.UUID, row_id: uuid.UUID) -> None:
    row = await db.scalar(
        select(StudentConcession).where(StudentConcession.id == row_id, StudentConcession.student_id == student_id)
    )
    if row is None:
        raise NotFound("Concession not found.")
    student = await get_or_404(db, Student, student_id, "Student")
    con = await db.get(FeeConcession, row.concession_id)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "concession.revoked",
        f"{con.name if con else 'Concession'} removed from {student_label(student)}; "
        "invoices already generated keep it",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
    )
    await db.delete(row)


# ------------------------------------------------------------------ late fee rule and settings
async def set_late_rule(db: AsyncSession, actor: Actor, body: LateRuleIn) -> FeeLateRule:
    """A new rule replaces the active one (old rule kept for history)."""
    assert actor.school_id
    old = await db.scalar(select(FeeLateRule).where(FeeLateRule.is_active.is_(True)).with_for_update())
    if old:
        old.is_active = False
        await db.flush()
    r = FeeLateRule(
        school_id=actor.school_id,
        grace_days=body.grace_days,
        amount_paise=body.amount_paise,
        per=body.per,
        max_paise=body.max_paise,
    )
    db.add(r)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "late_rule.set",
        f"Late fee: {rupees(body.amount_paise)} {body.per}, grace {body.grace_days} days"
        + (f", max {rupees(body.max_paise)}" if body.max_paise else ""),
        entity_type="fee_late_rule",
        entity_id=r.id,
    )
    return r


async def get_settings(db: AsyncSession) -> FeeSettings | None:
    return await db.scalar(select(FeeSettings))


async def set_settings(db: AsyncSession, actor: Actor, body: SettingsIn) -> FeeSettings:
    assert actor.school_id
    s = await get_settings(db)
    if s is None:
        s = FeeSettings(school_id=actor.school_id)
        db.add(s)
        before = (False, 15)
    else:
        before = (s.auto_first_invoice, s.first_invoice_due_days)
    s.auto_first_invoice, s.first_invoice_due_days, s.updated_at = (
        body.auto_first_invoice,
        body.first_invoice_due_days,
        utcnow(),
    )
    await db.flush()
    if before != (s.auto_first_invoice, s.first_invoice_due_days):
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "fee_settings.updated",
            "Updated fee settings",
            changes=[
                change("First invoice at enrolment", before[0], s.auto_first_invoice),
                change("Due after days", before[1], s.first_invoice_due_days),
            ],
        )
    return s


async def user_names(db: AsyncSession, ids: set[uuid.UUID | None]) -> dict[uuid.UUID, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {u.id: u.name for u in (await db.scalars(select(User).where(User.id.in_(ids)))).all()}


def ist_bounds(d_from: date, d_to: date):
    """UTC instants that cover the IST days d_from..d_to inclusive."""
    from datetime import UTC, datetime, time, timedelta

    from app.core.clock import IST

    start = datetime.combine(d_from, time.min, IST).astimezone(UTC)
    end = datetime.combine(d_to + timedelta(days=1), time.min, IST).astimezone(UTC)
    return start, end
