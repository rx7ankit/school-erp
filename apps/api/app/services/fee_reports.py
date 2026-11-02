"""Dues (defaulters), collection summary, reminders and their Excel exports. All sums are integer paise from SQL."""

import logging
import uuid
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import Date, Integer, case, cast, func, literal, null, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError
from app.models.academic import SchoolClass
from app.models.enums import AuditCategory, FeeItemKind, PaymentStatus, StudentStatus
from app.models.fees import FeeInvoice, FeeInvoiceItem, FeePayment, FeeReminder, OpeningBalance
from app.models.student import Enrollment, Student
from app.schemas.fees import CollectionReport, CollectionRow, DueRow, DuesReport, ReminderRow, ReminderSendOut
from app.services import fees as base
from app.services.audit import Actor, log_audit
from app.services.email import Mail, get_sender
from app.services.fee_notify import _notify_reminder
from app.services.sheets import build_xlsx
from app.services.students import class_label, full_name, guardian_summary_map

REMIND_EVERY_DAYS = 3


# ------------------------------------------------------------------ dues
def _dues_per_student(as_of: date):
    """Per student: balance of open invoices, the overdue part, count and oldest due date, plus the opening
    balance that is not on an invoice yet."""
    m = base.invoice_money().where(FeeInvoice.closed_at.is_(None)).subquery()
    bal = m.c.total - m.c.paid
    inv_part = select(
        m.c.student_id.label("student_id"),
        case((bal > 0, bal), else_=0).label("balance"),
        case(((bal > 0) & (m.c.due_on < as_of), bal), else_=0).label("overdue"),
        case((bal > 0, 1), else_=0).label("open_n"),
        case((bal > 0, m.c.due_on), else_=None).label("due_on"),
        literal(0).label("opening"),
    )
    ob_part = select(
        OpeningBalance.student_id.label("student_id"),
        literal(0).label("balance"),
        literal(0).label("overdue"),
        literal(0).label("open_n"),
        cast(null(), m.c.due_on.type).label("due_on"),
        OpeningBalance.amount_paise.label("opening"),
    ).where(OpeningBalance.used_invoice_id.is_(None))
    u = union_all(inv_part, ob_part).subquery()
    return (
        select(
            u.c.student_id,
            func.sum(u.c.balance).label("balance"),
            func.sum(u.c.overdue).label("overdue"),
            func.sum(u.c.open_n).cast(Integer).label("open_n"),
            func.min(u.c.due_on).label("oldest"),
            func.sum(u.c.opening).label("opening"),
        )
        .group_by(u.c.student_id)
        .having(func.sum(u.c.balance) + func.sum(u.c.opening) > 0)
        .subquery()
    )


async def dues(
    db: AsyncSession,
    *,
    as_of: date | None = None,
    class_id: uuid.UUID | None = None,
    year_id: uuid.UUID | None = None,
    overdue_only: bool = False,
    min_due_paise: int = 0,
    active_only: bool = False,
    q: str | None = None,
    limit: int | None = 50,
    offset: int = 0,
) -> DuesReport:
    as_of = as_of or today_ist()
    year = await base.year_or_current(db, year_id)
    d = _dues_per_student(as_of)
    stmt = (
        select(d, Student, SchoolClass)
        .join(Student, Student.id == d.c.student_id)
        .join(
            Enrollment, (Enrollment.student_id == Student.id) & (Enrollment.academic_year_id == year.id), isouter=True
        )
        .join(SchoolClass, SchoolClass.id == Enrollment.class_id, isouter=True)
    )
    if class_id:
        stmt = stmt.where(Enrollment.class_id == class_id)
    if overdue_only:
        stmt = stmt.where(d.c.overdue > 0)
    if min_due_paise:
        stmt = stmt.where(d.c.balance + d.c.opening >= min_due_paise)
    if active_only:
        stmt = stmt.where(Student.status == StudentStatus.active.value)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            Student.scholar_no.ilike(like) | func.concat(Student.first_name, " ", Student.last_name).ilike(like)
        )
    sq = stmt.subquery()
    agg = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(sq.c.balance + sq.c.opening), 0),
                func.coalesce(func.sum(sq.c.overdue), 0),
            )
        )
    ).one()
    stmt = stmt.order_by((d.c.balance + d.c.opening).desc(), Student.first_name)
    if limit is not None:
        stmt = stmt.limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()
    guards = await guardian_summary_map(db, [r.student_id for r in rows])
    items = []
    for r in rows:
        stu, cls = r[-2], r[-1]
        g = guards.get(stu.id)
        items.append(
            DueRow(
                student_id=stu.id,
                student_name=full_name(stu),
                scholar_no=stu.scholar_no,
                class_label=class_label(cls) if cls else None,
                status=stu.status,
                guardian_name=g.name if g else None,
                guardian_phone=g.phone if g else None,
                invoices_open=r.open_n or 0,
                oldest_due_on=r.oldest,
                balance_paise=int(r.balance or 0),
                overdue_paise=int(r.overdue or 0),
                opening_balance_paise=int(r.opening or 0),
                due_paise=int((r.balance or 0) + (r.opening or 0)),
            )
        )
    return DuesReport(
        as_of=as_of,
        total_due_paise=int(agg[1]),
        total_overdue_paise=int(agg[2]),
        students=agg[0],
        items=items,
        total=agg[0],
    )


def dues_xlsx(rep: DuesReport) -> bytes:
    head = [
        "Scholar No",
        "Student",
        "Class",
        "Status",
        "Guardian",
        "Mobile",
        "Open invoices",
        "Oldest due date",
        "Balance (Rs)",
        "Overdue (Rs)",
        "Opening balance (Rs)",
        "Total due (Rs)",
    ]
    rows = [
        [
            r.scholar_no,
            r.student_name,
            r.class_label or "",
            r.status,
            r.guardian_name or "",
            r.guardian_phone or "",
            r.invoices_open,
            r.oldest_due_on,
            r.balance_paise / 100,
            r.overdue_paise / 100,
            r.opening_balance_paise / 100,
            r.due_paise / 100,
        ]
        for r in rep.items
    ]
    rows.append(["", "Total", "", "", "", "", "", "", "", rep.total_overdue_paise / 100, "", rep.total_due_paise / 100])
    return build_xlsx([("Dues", head, rows)])


# ------------------------------------------------------------------ collection
def allocate_to_heads(items: list[tuple[str, uuid.UUID | None, str, int]], payments: list[int]) -> list[dict[str, int]]:
    """Splits each payment, in order, over the invoice's buckets: previous dues first, then the fee heads, then
    the late fee. A head's own concession lowers that head; a whole-invoice concession lowers the heads in order.
    `items` is (kind, head_id, description, amount) in line order. Returns one {bucket label: paise} per payment."""
    heads: dict[str, int] = {}
    prev = late = general = 0
    by_id: dict[uuid.UUID, str] = {h: d for k, h, d, _ in items if k == FeeItemKind.fee.value and h}
    for kind, _head_id, desc, amt in items:
        if kind == FeeItemKind.previous_dues.value:
            prev += amt
        elif kind == FeeItemKind.late_fee.value:
            late += amt
        elif kind == FeeItemKind.fee.value:
            heads[desc] = heads.get(desc, 0) + amt
    for kind, head_id, _, amt in items:
        if kind == FeeItemKind.concession.value:
            label = by_id.get(head_id) if head_id else None
            if label:
                heads[label] += amt  # amt is negative
            else:
                general += -amt
    order: list[tuple[str, int]] = [("Previous dues", prev)] + list(heads.items()) + [("Late fee", late)]
    buckets = [[n, v] for n, v in order]
    for b in buckets[1:-1]:  # whole-invoice concession comes off the heads
        take = min(b[1], general)
        b[1] -= take
        general -= take
    out = []
    for pay in payments:
        left, split = pay, {}
        for b in buckets:
            if left <= 0:
                break
            take = min(b[1], left)
            if take > 0:
                split[b[0]] = split.get(b[0], 0) + take
                b[1] -= take
                left -= take
        if left:
            split["Other"] = left
        out.append(split)
    return out


async def collection(db: AsyncSession, d_from: date, d_to: date, group_by: str) -> CollectionReport:
    if d_to < d_from:
        raise AppError("The end date is before the start date.", code="invalid_range", status=422)
    if (d_to - d_from).days > 366:
        raise AppError("Choose a range of at most a year.", code="range_too_long", status=422)
    if group_by not in ("day", "head", "class", "mode"):
        raise AppError("group_by is day, head, class or mode.", code="invalid_group", status=422)
    start, end = base.ist_bounds(d_from, d_to)
    in_range = (FeePayment.received_at >= start) & (FeePayment.received_at < end)
    active = FeePayment.status == PaymentStatus.active.value
    tot = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(FeePayment.amount_paise), 0)).where(in_range, active)
        )
    ).one()
    can = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(FeePayment.amount_paise), 0)).where(in_range, ~active)
        )
    ).one()
    rows: list[CollectionRow] = []
    if group_by == "day":
        day = cast(func.timezone("Asia/Kolkata", FeePayment.received_at), Date)
        q = (
            await db.execute(
                select(day.label("k"), func.count(), func.sum(FeePayment.amount_paise))
                .where(in_range, active)
                .group_by(day)
                .order_by(day)
            )
        ).all()
        rows = [
            CollectionRow(key=k.isoformat(), label=k.strftime("%d-%m-%Y"), count=c, amount_paise=int(a))
            for k, c, a in q
        ]
    elif group_by == "mode":
        q = (
            await db.execute(
                select(FeePayment.mode, func.count(), func.sum(FeePayment.amount_paise))
                .where(in_range, active)
                .group_by(FeePayment.mode)
                .order_by(FeePayment.mode)
            )
        ).all()
        rows = [CollectionRow(key=k, label=k.replace("_", " ").title(), count=c, amount_paise=int(a)) for k, c, a in q]
    elif group_by == "class":
        q = (
            await db.execute(
                select(SchoolClass, func.count(), func.sum(FeePayment.amount_paise))
                .select_from(FeePayment)
                .join(FeeInvoice, FeeInvoice.id == FeePayment.invoice_id)
                .join(Enrollment, Enrollment.id == FeeInvoice.enrollment_id)
                .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
                .where(in_range, active)
                .group_by(SchoolClass.id)
                .order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section)
            )
        ).all()
        rows = [CollectionRow(key=str(c.id), label=class_label(c), count=n, amount_paise=int(a)) for c, n, a in q]
    else:
        rows = await _by_head(db, in_range)
    return CollectionReport(
        date_from=d_from,
        date_to=d_to,
        group_by=group_by,
        total_paise=int(tot[1]),
        payments=tot[0],
        cancelled_paise=int(can[1]),
        cancelled_count=can[0],
        rows=rows,
    )


async def _by_head(db: AsyncSession, in_range) -> list[CollectionRow]:
    """Payments in range, split over heads invoice by invoice (see allocate_to_heads)."""
    active = FeePayment.status == PaymentStatus.active.value
    inv_ids = set((await db.scalars(select(FeePayment.invoice_id).where(in_range, active))).all())
    if not inv_ids:
        return []
    items: dict[uuid.UUID, list] = defaultdict(list)
    for i in (
        await db.scalars(
            select(FeeInvoiceItem).where(FeeInvoiceItem.invoice_id.in_(inv_ids)).order_by(FeeInvoiceItem.position)
        )
    ).all():
        items[i.invoice_id].append((i.kind, i.fee_head_id, i.description, i.amount_paise))
    pays: dict[uuid.UUID, list[FeePayment]] = defaultdict(list)
    for p in (
        await db.scalars(
            select(FeePayment)
            .where(FeePayment.invoice_id.in_(inv_ids), active)
            .order_by(FeePayment.received_at, FeePayment.id)
        )
    ).all():
        pays[p.invoice_id].append(p)
    start_end = {p.id for p in (await db.scalars(select(FeePayment).where(in_range, active))).all()}
    totals: dict[str, list[int]] = {}
    for inv_id, plist in pays.items():
        split = allocate_to_heads(items[inv_id], [p.amount_paise for p in plist])
        for p, parts in zip(plist, split, strict=True):
            if p.id not in start_end:
                continue
            for label, amt in parts.items():
                t = totals.setdefault(label, [0, 0])
                t[0] += 1
                t[1] += amt
    return [CollectionRow(key=k, label=k, count=v[0], amount_paise=v[1]) for k, v in sorted(totals.items())]


def collection_xlsx(rep: CollectionReport) -> bytes:
    rows = [[r.label, r.count, r.amount_paise / 100] for r in rep.rows]
    rows.append(["Total", rep.payments, rep.total_paise / 100])
    summary = [
        ["From", rep.date_from],
        ["To", rep.date_to],
        ["Collected (Rs)", rep.total_paise / 100],
        ["Payments", rep.payments],
        ["Cancelled (Rs)", rep.cancelled_paise / 100],
        ["Cancelled payments", rep.cancelled_count],
    ]
    return build_xlsx(
        [
            (f"By {rep.group_by}", [rep.group_by.title(), "Payments", "Amount (Rs)"], rows),
            ("Summary", ["Item", "Value"], summary),
        ]
    )


# ------------------------------------------------------------------ reminders
def reminder_text(name: str, balance: int, due_on: date | None) -> str:
    return f"Fee reminder: ₹{base.rupees(balance)} is due for {name}" + (f" by {due_on:%d-%m-%Y}" if due_on else "")


async def reminder_list(
    db: AsyncSession,
    *,
    overdue_only: bool = False,
    class_id: uuid.UUID | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> list[ReminderRow]:
    """Active students with a balance. A child already reminded in the last 3 days has can_remind false."""
    rep = await dues(db, overdue_only=overdue_only, class_id=class_id, active_only=True, limit=limit, offset=offset)
    ids = [r.student_id for r in rep.items]
    last = (
        dict(
            (
                await db.execute(
                    select(FeeReminder.student_id, func.max(FeeReminder.sent_at))
                    .where(FeeReminder.student_id.in_(ids))
                    .group_by(FeeReminder.student_id)
                )
            ).all()
        )
        if ids
        else {}
    )
    guards = await guardian_summary_map(db, ids)
    cutoff = utcnow() - timedelta(days=REMIND_EVERY_DAYS)
    out = []
    for r in rep.items:
        g = guards.get(r.student_id)
        seen = last.get(r.student_id)
        out.append(
            ReminderRow(
                student_id=r.student_id,
                student_name=r.student_name,
                scholar_no=r.scholar_no,
                class_label=r.class_label,
                guardian_name=g.name if g else None,
                guardian_email=g.email if g else None,
                balance_paise=r.due_paise,
                earliest_due_on=r.oldest_due_on,
                overdue=r.overdue_paise > 0,
                last_reminded_at=seen,
                can_remind=seen is None or seen < cutoff,
                message=reminder_text(r.student_name, r.due_paise, r.oldest_due_on),
            )
        )
    return out


async def send_reminders(
    db: AsyncSession, actor: Actor, *, student_ids: list[uuid.UUID] | None, overdue_only: bool, email: bool
) -> ReminderSendOut:
    assert actor.id and actor.school_id
    rows = await reminder_list(db, overdue_only=overdue_only)
    if student_ids is not None:
        wanted = set(student_ids)
        rows = [r for r in rows if r.student_id in wanted]
    ok = [r for r in rows if r.can_remind]
    skipped = len(rows) - len(ok)
    now, emailed = utcnow(), 0
    for r in ok:
        db.add(
            FeeReminder(
                school_id=actor.school_id,
                student_id=r.student_id,
                balance_paise=r.balance_paise,
                sent_at=now,
                sent_by=actor.id,
                emailed=1 if (email and r.guardian_email) else 0,
            )
        )
        await _notify_reminder(db, r.student_id, r.message)
    await db.flush()
    if ok:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "reminder.sent",
            f"Fee reminder sent for {len(ok)} students"
            + (f" ({skipped} skipped, reminded recently)" if skipped else ""),
            entity_type="fee_reminder",
            sensitive=True,
        )
    if email:
        sender = get_sender()
        for r in ok:
            if not r.guardian_email:
                continue
            try:
                await sender.send(Mail(to=r.guardian_email, subject="Fee reminder", body=r.message))
                emailed += 1
            except Exception:  # noqa: BLE001  a failed email must not undo the reminder
                logging.getLogger("scool.fees").warning("reminder email failed for student %s", r.student_id)
    return ReminderSendOut(
        reminded=len(ok), skipped_recent=skipped, emailed=emailed, student_ids=[r.student_id for r in ok]
    )
