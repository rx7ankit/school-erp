"""Platform billing (erd v3): what each school owes Slov.

Rs 10 (default) per active student per month. `school_usage_daily` stores each school's active student count every
day; the invoice for a month uses the count on its last day. If a day was never recorded (a job did not run) the
current count is used, which is only exact for the month that just ended. Trial schools are not billed. One invoice
per school and month: the database rejects a second one, so generating twice is safe.
"""

import calendar
from datetime import date, datetime, timedelta

from sqlalchemy import case, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import IST, today_ist, utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.billing import SchoolUsageDaily
from app.models.enums import AuditCategory, PlatformInvoiceStatus, SchoolStatus, StudentStatus
from app.models.school import PlatformInvoice, School, SchoolSubscription
from app.models.student import Student
from app.schemas.billing import (
    CountPoint,
    GenerateOut,
    MonthPoint,
    PlatformInvoiceOut,
    RevenueStats,
    SchoolBilling,
    SchoolInvoiceOut,
)
from app.services.audit import Actor, change, log_audit

DUE_DAYS = 15  # an invoice for October is due on 15 November

SYSTEM = Actor(None, "Slov billing", "System", None)


def parse_month(month: str) -> date:
    y, m = month.split("-")
    return date(int(y), int(m), 1)


def month_key(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def last_day(first: date) -> date:
    return date(first.year, first.month, calendar.monthrange(first.year, first.month)[1])


def previous_month(today: date) -> date:
    return (today.replace(day=1) - timedelta(days=1)).replace(day=1)


def amount_for(students: int, price_paise: int) -> int:
    """Integer paise, no rounding needed: students x price."""
    return students * price_paise


# ------------------------------------------------------------------ daily usage
async def record_usage(db: AsyncSession, day: date | None = None) -> int:
    """Stores today's active student count for every school (needs a session that crosses schools)."""
    d = day or today_ist()
    res = await db.execute(
        text(
            "insert into school_usage_daily (school_id, day_on, active_students) "
            "select s.id, :d, count(st.id) from schools s "
            "left join students st on st.school_id = s.id and st.status = :active group by s.id "
            "on conflict (school_id, day_on) do update set active_students = excluded.active_students"
        ),
        {"d": d, "active": StudentStatus.active.value},
    )
    return res.rowcount or 0


# ------------------------------------------------------------------ monthly invoices
async def generate_month(db: AsyncSession, month: date | None = None, actor: Actor | None = None) -> GenerateOut:
    """Creates the invoice of every billable school for `month` (default: last month). Idempotent."""
    today = today_ist()
    first = (month or previous_month(today)).replace(day=1)
    end = last_day(first)
    if end >= today:
        raise Conflict("That month has not ended yet.", code="month_not_ended")
    actor = actor or SYSTEM
    rows = (
        await db.execute(
            select(School, SchoolSubscription.price_per_student_paise)
            .join(SchoolSubscription, SchoolSubscription.school_id == School.id)
            .order_by(School.created_at)
        )
    ).all()
    usage = {
        sid: n
        for sid, n in (
            await db.execute(
                select(SchoolUsageDaily.school_id, SchoolUsageDaily.active_students).where(
                    SchoolUsageDaily.day_on == end
                )
            )
        ).all()
    }
    live = dict(
        (
            await db.execute(
                select(Student.school_id, func.count())
                .where(Student.status == StudentStatus.active.value)
                .group_by(Student.school_id)
            )
        ).all()
    )
    out = GenerateOut(
        month=month_key(first), created=0, skipped_existing=0, skipped_trial=0, skipped_empty=0, amount_paise=0
    )
    for school, price in rows:
        if school.status == SchoolStatus.trial.value:
            out.skipped_trial += 1
            continue
        n = usage.get(school.id, live.get(school.id, 0))
        amount = amount_for(n, price)
        if amount <= 0:
            out.skipped_empty += 1
            continue
        ins = (
            pg_insert(PlatformInvoice)
            .values(
                school_id=school.id,
                period_on=first,
                active_students=n,
                price_per_student_paise=price,
                amount_paise=amount,
                due_on=end + timedelta(days=DUE_DAYS),
                status=PlatformInvoiceStatus.due.value,
            )
            .on_conflict_do_nothing(index_elements=["school_id", "period_on"])
            .returning(PlatformInvoice.id)
        )
        new_id = await db.scalar(ins)
        if new_id is None:
            out.skipped_existing += 1
            continue
        out.created += 1
        out.amount_paise += amount
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "platform_invoice.created",
            f"Slov invoice for {month_key(first)}: {n} students x Rs {price / 100:g} = Rs {amount / 100:,.2f}",
            entity_type="platform_invoice",
            entity_id=new_id,
            entity_label=month_key(first),
            school_id=school.id,
            sensitive=True,
        )
    await db.flush()
    return out


def _out(inv: PlatformInvoice, school_name: str, today: date) -> PlatformInvoiceOut:
    return PlatformInvoiceOut(
        id=inv.id,
        school_id=inv.school_id,
        school_name=school_name,
        month=month_key(inv.period_on),
        period_on=inv.period_on,
        active_students=inv.active_students,
        price_per_student_paise=inv.price_per_student_paise,
        amount_paise=inv.amount_paise,
        due_on=inv.due_on,
        status=inv.status,
        overdue=inv.status == PlatformInvoiceStatus.due.value and inv.due_on < today,
        paid_at=inv.paid_at,
        payment_mode=inv.payment_mode,
        reference=inv.reference,
    )


def invoices_query(school_id=None, month: str | None = None, status: str | None = None, overdue: bool | None = None):
    q = select(PlatformInvoice, School.name).join(School, School.id == PlatformInvoice.school_id)
    if school_id:
        q = q.where(PlatformInvoice.school_id == school_id)
    if month:
        q = q.where(PlatformInvoice.period_on == parse_month(month))
    if status:
        q = q.where(PlatformInvoice.status == status)
    if overdue:
        q = q.where(PlatformInvoice.status == PlatformInvoiceStatus.due.value, PlatformInvoice.due_on < today_ist())
    return q.order_by(PlatformInvoice.period_on.desc(), School.name)


async def list_invoices(db: AsyncSession, q, *, limit: int | None = None, offset: int = 0) -> list[PlatformInvoiceOut]:
    if limit is not None:
        q = q.limit(limit).offset(offset)
    today = today_ist()
    return [_out(i, n, today) for i, n in (await db.execute(q)).all()]


async def count_invoices(db: AsyncSession, q) -> int:
    return await db.scalar(select(func.count()).select_from(q.order_by(None).subquery())) or 0


async def mark_paid(
    db: AsyncSession, actor: Actor, invoice_id, *, mode: str, reference: str | None, paid_on: date | None
) -> PlatformInvoiceOut:
    inv = await db.scalar(select(PlatformInvoice).where(PlatformInvoice.id == invoice_id).with_for_update())
    if inv is None:
        raise NotFound("Invoice not found.")
    if inv.status == PlatformInvoiceStatus.paid.value:
        raise Conflict("This invoice is already marked as paid.", code="already_paid")
    school = await db.get(School, inv.school_id)
    on = paid_on or today_ist()
    if on > today_ist():
        raise AppError("The payment date cannot be in the future.", code="future_date", status=422)
    inv.status = PlatformInvoiceStatus.paid.value
    inv.paid_at = utcnow() if paid_on is None else _noon_ist(on)
    inv.payment_mode, inv.reference = mode, (reference or "").strip() or None
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "platform_invoice.paid",
        f"Marked Slov invoice {month_key(inv.period_on)} paid (Rs {inv.amount_paise / 100:,.2f}, {mode})",
        entity_type="platform_invoice",
        entity_id=inv.id,
        entity_label=month_key(inv.period_on),
        school_id=inv.school_id,
        sensitive=True,
        changes=[change("Status", "due", "paid"), change("Amount (paise)", "", inv.amount_paise)],
    )
    await db.flush()
    return _out(inv, school.name if school else "", today_ist())


def _noon_ist(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, 12, 0, tzinfo=IST)


# ------------------------------------------------------------------ revenue stats (computed, never stored)
async def revenue_stats(db: AsyncSession) -> RevenueStats:
    today = today_ist()
    rows = (
        await db.execute(
            select(School.id, SchoolSubscription.price_per_student_paise, func.count(Student.id))
            .join(SchoolSubscription, SchoolSubscription.school_id == School.id)
            .outerjoin(Student, (Student.school_id == School.id) & (Student.status == StudentStatus.active.value))
            .where(School.status == SchoolStatus.active.value)
            .group_by(School.id, SchoolSubscription.price_per_student_paise)
        )
    ).all()
    mrr = sum(price * n for _, price, n in rows)
    I = PlatformInvoice  # noqa: E741
    totals = (
        await db.execute(
            select(
                func.coalesce(func.sum(I.amount_paise), 0),
                func.coalesce(func.sum(case((I.status == "paid", I.amount_paise), else_=0)), 0),
                func.coalesce(func.sum(case((I.status == "due", I.amount_paise), else_=0)), 0),
                func.coalesce(func.sum(case(((I.status == "due") & (I.due_on < today), I.amount_paise), else_=0)), 0),
            )
        )
    ).one()
    months = (
        await db.execute(
            select(
                I.period_on,
                func.sum(I.amount_paise),
                func.coalesce(func.sum(case((I.status == "paid", I.amount_paise), else_=0)), 0),
            )
            .group_by(I.period_on)
            .order_by(I.period_on.desc())
            .limit(12)
        )
    ).all()
    month_of = func.to_char(func.timezone("Asia/Kolkata", School.created_at), "YYYY-MM")
    new = (
        await db.execute(select(month_of, func.count()).group_by(month_of).order_by(month_of.desc()).limit(12))
    ).all()
    return RevenueStats(
        schools_paying=len(rows),
        active_students=sum(n for _, _, n in rows),
        mrr_paise=mrr,
        arr_paise=mrr * 12,
        billed_paise=int(totals[0]),
        collected_paise=int(totals[1]),
        due_paise=int(totals[2]),
        overdue_paise=int(totals[3]),
        by_month=[
            MonthPoint(month=month_key(d), billed_paise=int(b), collected_paise=int(c)) for d, b, c in reversed(months)
        ],
        new_schools_by_month=[CountPoint(month=m, count=n) for m, n in reversed(new)],
    )


# ------------------------------------------------------------------ the school's own view
async def school_billing(db: AsyncSession, school_id) -> SchoolBilling:
    school = await db.get(School, school_id)
    sub = await db.scalar(select(SchoolSubscription).where(SchoolSubscription.school_id == school_id))
    if school is None or sub is None:
        raise NotFound("Subscription not found.")
    n = (
        await db.scalar(select(func.count()).select_from(Student).where(Student.status == StudentStatus.active.value))
        or 0
    )
    today = today_ist()
    invs = (
        await db.scalars(
            select(PlatformInvoice)
            .where(PlatformInvoice.school_id == school_id)
            .order_by(PlatformInvoice.period_on.desc())
            .limit(12)
        )
    ).all()
    billed = school.status != SchoolStatus.trial.value
    return SchoolBilling(
        school_status=school.status,
        price_per_student_paise=sub.price_per_student_paise,
        active_students=n,
        estimated_monthly_paise=amount_for(n, sub.price_per_student_paise) if billed else 0,
        billed_now=billed,
        started_on=sub.started_on,
        outstanding_paise=sum(i.amount_paise for i in invs if i.status == PlatformInvoiceStatus.due.value),
        invoices=[
            SchoolInvoiceOut(
                id=i.id,
                month=month_key(i.period_on),
                active_students=i.active_students,
                price_per_student_paise=i.price_per_student_paise,
                amount_paise=i.amount_paise,
                due_on=i.due_on,
                status=i.status,
                overdue=i.status == PlatformInvoiceStatus.due.value and i.due_on < today,
                paid_at=i.paid_at,
            )
            for i in invs
        ],
    )
