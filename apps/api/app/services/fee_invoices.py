"""Invoice generation (bulk, idempotent), late fees, invoice views, and the enrolment hook."""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

from pydantic import ValidationError
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.core.ids import uuid7
from app.models.academic import AcademicYear, SchoolClass
from app.models.enums import (
    AuditCategory,
    ConcessionKind,
    EnrollmentStatus,
    FeeFrequency,
    FeeItemKind,
    LateFeePer,
    StudentStatus,
    YearStatus,
)
from app.models.fees import (
    FeeCarryForward,
    FeeConcession,
    FeeHead,
    FeeInvoice,
    FeeInvoiceItem,
    FeeInvoiceRun,
    FeeLateRule,
    FeePayment,
    FeeStructure,
    OpeningBalance,
    StudentConcession,
    StudentFeeOption,
)
from app.models.student import Enrollment, Student
from app.schemas.fees import ALL_FREQUENCIES, InvoiceDetail, InvoiceRow, ItemOut, OptionIn, PaymentOut
from app.services import fees as base
from app.services.audit import Actor, change, log_audit
from app.services.enrolment import EnrolContext, register_enrol_hook
from app.services.fee_notify import _notify_invoice_issued
from app.services.students import class_label, full_name, student_label


# ------------------------------------------------------------------ generation
@dataclass
class GenResult:
    created: list[FeeInvoice] = field(default_factory=list)
    skipped_existing: int = 0
    skipped_no_fees: int = 0


def concession_amount(kind: str, value: int, base_paise: int) -> int:
    """Integer maths: a percent rounds down. Never more than the amount it applies to."""
    amt = base_paise * value // 100 if kind == ConcessionKind.percent.value else value
    return max(0, min(amt, base_paise))


async def generate_invoices(
    db: AsyncSession,
    actor: Actor,
    *,
    year: AcademicYear,
    period_label: str,
    due_on: date,
    frequencies: list[str],
    class_ids: list[uuid.UUID] | None = None,
    student_ids: list[uuid.UUID] | None = None,
    carry_forward: bool = True,
    run_id: uuid.UUID | None = None,
) -> GenResult:
    """One invoice per active student of the year and period. Safe to run twice: students that already have
    an invoice for the period are skipped, and concurrent runs for a year are serialised."""
    assert actor.school_id
    period_label = period_label.strip()
    freqs = set(frequencies)
    await db.execute(text("select pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"fees:{year.id}"})

    stmt = (
        select(Enrollment, Student)
        .join(Student, Student.id == Enrollment.student_id)
        .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
        .where(
            Enrollment.academic_year_id == year.id,
            Enrollment.status == EnrollmentStatus.active.value,
            Student.status == StudentStatus.active.value,
        )
        .order_by(
            SchoolClass.display_order, SchoolClass.grade, SchoolClass.section, Enrollment.roll_no, Student.first_name
        )
    )
    if class_ids:
        stmt = stmt.where(Enrollment.class_id.in_(class_ids))
    if student_ids:
        stmt = stmt.where(Student.id.in_(student_ids))
    people = (await db.execute(stmt)).all()
    res = GenResult()
    if not people:
        return res
    sids = [s.id for _, s in people]

    have = set(
        (
            await db.scalars(
                select(FeeInvoice.student_id).where(
                    FeeInvoice.academic_year_id == year.id,
                    FeeInvoice.period_label == period_label,
                    FeeInvoice.student_id.in_(sids),
                )
            )
        ).all()
    )
    cids = {e.class_id for e, _ in people}
    heads = {h.id: h for h in (await db.scalars(select(FeeHead).where(FeeHead.is_active.is_(True)))).all()}
    structure: dict[uuid.UUID, list[FeeStructure]] = defaultdict(list)
    for row in (await db.scalars(select(FeeStructure).where(FeeStructure.class_id.in_(cids)))).all():
        if row.frequency in freqs and row.fee_head_id in heads:
            structure[row.class_id].append(row)
    for lst in structure.values():
        lst.sort(key=lambda r: (heads[r.fee_head_id].created_at, heads[r.fee_head_id].name.lower()))
    options: dict[uuid.UUID, list[StudentFeeOption]] = defaultdict(list)
    for row in (
        await db.scalars(
            select(StudentFeeOption).where(
                StudentFeeOption.academic_year_id == year.id, StudentFeeOption.student_id.in_(sids)
            )
        )
    ).all():
        if row.frequency in freqs and row.fee_head_id in heads:
            options[row.student_id].append(row)
    billed = set(
        (
            await db.execute(
                select(FeeInvoice.student_id, FeeInvoiceItem.fee_head_id)
                .join(FeeInvoiceItem, FeeInvoiceItem.invoice_id == FeeInvoice.id)
                .where(
                    FeeInvoice.academic_year_id == year.id,
                    FeeInvoice.student_id.in_(sids),
                    FeeInvoiceItem.kind == FeeItemKind.fee.value,
                )
            )
        ).all()
    )
    billed = {(r[0], r[1]) for r in billed}
    cons: dict[uuid.UUID, list[FeeConcession]] = defaultdict(list)
    for sc, c in (
        await db.execute(
            select(StudentConcession, FeeConcession)
            .join(FeeConcession, FeeConcession.id == StudentConcession.concession_id)
            .where(
                StudentConcession.academic_year_id == year.id,
                StudentConcession.student_id.in_(sids),
                FeeConcession.is_active.is_(True),
            )
            .order_by(FeeConcession.name)
        )
    ).all():
        cons[sc.student_id].append(c)
    obs = {
        o.student_id: o
        for o in (
            await db.scalars(
                select(OpeningBalance).where(
                    OpeningBalance.academic_year_id == year.id,
                    OpeningBalance.student_id.in_(sids),
                    OpeningBalance.used_invoice_id.is_(None),
                )
            )
        ).all()
    }
    open_invoices: dict[uuid.UUID, list[tuple[FeeInvoice, int]]] = defaultdict(list)
    if carry_forward:
        m = base.invoice_money().where(FeeInvoice.student_id.in_(sids), FeeInvoice.closed_at.is_(None)).subquery()
        rows = (
            await db.execute(
                select(FeeInvoice, m.c.total - m.c.paid)
                .join(m, m.c.id == FeeInvoice.id)
                .where(m.c.total - m.c.paid > 0)
                .order_by(FeeInvoice.due_on, FeeInvoice.invoice_no)
            )
        ).all()
        for inv, bal in rows:
            open_invoices[inv.student_id].append((inv, bal))

    plans = []
    for enr, stu in people:
        if stu.id in have:
            res.skipped_existing += 1
            continue
        lines: list[tuple[str, uuid.UUID | None, str, int]] = []
        for src in [*structure.get(enr.class_id, []), *options.get(stu.id, [])]:
            if (
                src.frequency in (FeeFrequency.once.value, FeeFrequency.yearly.value)
                and (
                    stu.id,
                    src.fee_head_id,
                )
                in billed
            ):
                continue
            lines.append((FeeItemKind.fee.value, src.fee_head_id, heads[src.fee_head_id].name, src.amount_paise))
        if not lines:
            res.skipped_no_fees += 1
            continue
        gross = list(lines)  # concessions are worked out on the fees, never on other concessions
        remaining = sum(a for *_, a in gross)
        for c in cons.get(stu.id, []):
            applies_to = sum(a for _, h, _, a in gross if c.fee_head_id is None or h == c.fee_head_id)
            amt = min(concession_amount(c.kind, c.value, applies_to), remaining)
            if amt > 0:
                lines.append((FeeItemKind.concession.value, c.fee_head_id, f"Concession: {c.name}", -amt))
                remaining -= amt
        ob = obs.get(stu.id)
        if ob:
            lines.append(
                (
                    FeeItemKind.previous_dues.value,
                    None,
                    f"Opening balance (as of {ob.as_of_on:%d-%m-%Y})",
                    ob.amount_paise,
                )
            )
        carried = open_invoices.get(stu.id, [])
        if carried:
            nos = ", ".join(i.invoice_no for i, _ in carried)
            lines.append(
                (FeeItemKind.previous_dues.value, None, f"Previous dues ({nos})"[:200], sum(b for _, b in carried))
            )
        plans.append((enr, stu, lines, ob, carried))

    if not plans:
        return res
    seqs = await base.next_numbers(db, actor.school_id, "invoice", len(plans))
    for (enr, stu, lines, _ob, _carried), seq in zip(plans, seqs, strict=True):
        inv = FeeInvoice(
            id=uuid7(),
            school_id=actor.school_id,
            run_id=run_id,
            student_id=stu.id,
            enrollment_id=enr.id,
            academic_year_id=year.id,
            invoice_no=base.invoice_no(seq),
            period_label=period_label,
            due_on=due_on,
        )
        db.add(inv)
        res.created.append(inv)
        for pos, (kind, head_id, desc, amt) in enumerate(lines):
            db.add(
                FeeInvoiceItem(
                    school_id=actor.school_id,
                    invoice_id=inv.id,
                    kind=kind,
                    fee_head_id=head_id,
                    description=desc,
                    amount_paise=amt,
                    position=pos,
                )
            )
    await db.flush()
    now = utcnow()
    for inv, (_, stu, _, ob, carried) in zip(res.created, plans, strict=True):
        if ob:
            ob.used_invoice_id = inv.id
        for old, bal in carried:
            await db.execute(
                update(FeeInvoice).where(FeeInvoice.id == old.id).values(closed_at=now, closed_into_id=inv.id)
            )
            db.add(
                FeeCarryForward(
                    school_id=actor.school_id,
                    student_id=stu.id,
                    from_invoice_id=old.id,
                    to_invoice_id=inv.id,
                    amount_paise=bal,
                )
            )
    await db.flush()
    await _notify_invoice_issued(
        db, [(i.student_id, i.id, sum(a for *_, a in pl[2])) for i, pl in zip(res.created, plans, strict=True)]
    )
    return res


async def run_invoices(db: AsyncSession, actor: Actor, body) -> tuple[FeeInvoiceRun, GenResult]:
    assert actor.school_id and actor.id
    year = await base.year_or_current(db, body.academic_year_id)
    if year.status == YearStatus.completed.value:
        raise Conflict("That academic year is completed.", code="year_completed")
    run = FeeInvoiceRun(
        id=uuid7(),
        school_id=actor.school_id,
        academic_year_id=year.id,
        period_label=body.period_label.strip(),
        due_on=body.due_on,
        frequencies=sorted(set(body.frequencies)),
        class_ids=[str(c) for c in body.class_ids] if body.class_ids else None,
        created_by=actor.id,
    )
    db.add(run)
    await db.flush()
    res = await generate_invoices(
        db,
        actor,
        year=year,
        period_label=body.period_label,
        due_on=body.due_on,
        frequencies=list(body.frequencies),
        class_ids=body.class_ids,
        carry_forward=body.carry_forward,
        run_id=run.id,
    )
    run.invoices_created, run.skipped_existing, run.skipped_no_fees = (
        len(res.created),
        res.skipped_existing,
        res.skipped_no_fees,
    )
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "invoice_run.created",
        f"Generated {len(res.created)} invoices for {body.period_label.strip()} ({year.name}); "
        f"{res.skipped_existing} already existed, {res.skipped_no_fees} had no fees",
        entity_type="fee_invoice_run",
        entity_id=run.id,
        entity_label=body.period_label.strip(),
        sensitive=True,
    )
    return run, res


# ------------------------------------------------------------------ enrolment hook
async def _on_enrol(db: AsyncSession, ctx: EnrolContext) -> None:
    """Runs in the enrolment transaction: optional fees and concessions chosen at admission, then the first invoice
    if the school turned that on. A bad entry raises, so the enrolment is rolled back."""
    actor, enr = ctx.actor, ctx.enrollment
    for entry in ctx.fee_options or []:
        try:
            if entry.get("concession_id"):
                await base.assign_concession(
                    db,
                    actor,
                    ctx.student.id,
                    uuid.UUID(str(entry["concession_id"])),
                    enr.academic_year_id,
                    entry.get("note"),
                )
            else:
                await base.set_option(
                    db, actor, ctx.student.id, OptionIn.model_validate(entry), year_id=enr.academic_year_id
                )
        except (ValidationError, ValueError) as e:
            raise AppError("A fee option is not valid.", code="invalid_fee_option", status=422) from e
    settings = await base.get_settings(db)
    if settings and settings.auto_first_invoice:
        year = await db.get(AcademicYear, enr.academic_year_id)
        res = await generate_invoices(
            db,
            actor,
            year=year,
            period_label="Admission",
            due_on=today_ist() + timedelta(days=settings.first_invoice_due_days),
            frequencies=list(ALL_FREQUENCIES),
            class_ids=[enr.class_id],
            student_ids=[ctx.student.id],
            carry_forward=False,
        )
        for inv in res.created:
            log_audit(
                db,
                actor,
                AuditCategory.fees,
                "invoice.created",
                f"First invoice {inv.invoice_no} for {student_label(ctx.student)}",
                entity_type="fee_invoice",
                entity_id=inv.id,
                entity_label=inv.invoice_no,
            )


register_enrol_hook(_on_enrol)


# ------------------------------------------------------------------ late fees
def late_amount(rule: FeeLateRule, due_on: date, as_of: date) -> int:
    days = (as_of - due_on).days - rule.grace_days
    if days <= 0:
        return 0
    amt = rule.amount_paise * (days if rule.per == LateFeePer.day.value else 1)
    return min(amt, rule.max_paise) if rule.max_paise else amt


async def apply_late_fees(db: AsyncSession, actor: Actor, as_of: date | None = None) -> tuple[int, int]:
    """Adds or raises the 'Late fee' line on overdue invoices that still have a balance. Idempotent: running it
    twice on the same day changes nothing. Meant to run daily (call it from a worker) or from the screen."""
    as_of = as_of or today_ist()
    rule = await db.scalar(select(FeeLateRule).where(FeeLateRule.is_active.is_(True)))
    if rule is None:
        return 0, 0
    m = (
        base.invoice_money()
        .where(
            FeeInvoice.closed_at.is_(None),
            FeeInvoice.late_waived_at.is_(None),
            FeeInvoice.due_on < as_of - timedelta(days=rule.grace_days),
        )
        .subquery()
    )
    cand = (
        (
            await db.execute(
                select(FeeInvoice).join(m, m.c.id == FeeInvoice.id).where(m.c.total - m.c.paid > 0).with_for_update()
            )
        )
        .scalars()
        .all()
    )
    if not cand:
        return 0, 0
    existing = {
        i.invoice_id: i
        for i in (
            await db.scalars(
                select(FeeInvoiceItem).where(
                    FeeInvoiceItem.invoice_id.in_([c.id for c in cand]),
                    FeeInvoiceItem.kind == FeeItemKind.late_fee.value,
                )
            )
        ).all()
    }
    updated = total = 0
    for inv in cand:
        amt = late_amount(rule, inv.due_on, as_of)
        line = existing.get(inv.id)
        if amt <= 0 or (line and line.amount_paise >= amt):
            continue
        if line:
            line.amount_paise = amt
        else:
            pos = (
                await db.scalar(
                    select(func.coalesce(func.max(FeeInvoiceItem.position), 0)).where(
                        FeeInvoiceItem.invoice_id == inv.id
                    )
                )
            ) + 1
            assert actor.school_id
            db.add(
                FeeInvoiceItem(
                    school_id=actor.school_id,
                    invoice_id=inv.id,
                    kind=FeeItemKind.late_fee.value,
                    description="Late fee",
                    amount_paise=amt,
                    position=pos,
                )
            )
        inv.late_rule_id = rule.id
        updated += 1
        total += amt
    await db.flush()
    if updated:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "late_fees.applied",
            f"Late fee added or raised on {updated} overdue invoices (as of {as_of:%d-%m-%Y})",
            entity_type="fee_late_rule",
            entity_id=rule.id,
        )
    return updated, total


async def waive_late_fee(db: AsyncSession, actor: Actor, invoice_id: uuid.UUID, reason: str) -> FeeInvoice:
    assert actor.id
    inv = await db.scalar(select(FeeInvoice).where(FeeInvoice.id == invoice_id).with_for_update())
    if inv is None:
        raise NotFound("Invoice not found.")
    if inv.late_waived_at:
        raise Conflict("The late fee on this invoice is already waived.", code="late_already_waived")
    line = await db.scalar(
        select(FeeInvoiceItem).where(
            FeeInvoiceItem.invoice_id == inv.id, FeeInvoiceItem.kind == FeeItemKind.late_fee.value
        )
    )
    if line is None or line.amount_paise <= 0:
        raise Conflict("There is no late fee on this invoice.", code="no_late_fee")
    m = base.invoice_money().where(FeeInvoice.id == inv.id).subquery()
    total, paid = (await db.execute(select(m.c.total, m.c.paid))).one()
    if total - line.amount_paise < paid:
        raise Conflict(
            "The late fee is already paid. Cancel that payment first if it was a mistake.", code="late_fee_paid"
        )
    old = line.amount_paise
    line.amount_paise = 0
    inv.late_waived_at, inv.late_waived_by, inv.late_waive_reason = utcnow(), actor.id, reason.strip()
    await db.flush()
    stu = await db.get(Student, inv.student_id)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "late_fee.waived",
        f"Waived late fee of {base.rupees(old)} on {inv.invoice_no} ({student_label(stu)}): {reason.strip()}",
        entity_type="fee_invoice",
        entity_id=inv.id,
        entity_label=inv.invoice_no,
        changes=[change("Late fee (paise)", old, 0)],
        sensitive=True,
    )
    return inv


# ------------------------------------------------------------------ views
def _row(inv: FeeInvoice, stu: Student, cls: SchoolClass | None, total: int, paid: int, today: date) -> InvoiceRow:
    closed = inv.closed_at is not None
    return InvoiceRow(
        id=inv.id,
        invoice_no=inv.invoice_no,
        student_id=stu.id,
        student_name=full_name(stu),
        scholar_no=stu.scholar_no,
        class_label=class_label(cls) if cls else None,
        academic_year_id=inv.academic_year_id,
        period_label=inv.period_label,
        due_on=inv.due_on,
        total_paise=total,
        paid_paise=paid,
        balance_paise=0 if closed else max(total - paid, 0),
        status=base.status_of(closed, total, paid),
        overdue=(not closed) and total - paid > 0 and inv.due_on < today,
    )


def invoices_query(*, student_id=None, class_id=None, year_id=None, status=None, period=None, q=None, run_id=None):
    total, paid = base.total_expr(), base.paid_expr()
    stmt = (
        select(FeeInvoice, Student, SchoolClass, total.label("total"), paid.label("paid"))
        .join(Student, Student.id == FeeInvoice.student_id)
        .join(Enrollment, Enrollment.id == FeeInvoice.enrollment_id)
        .join(SchoolClass, SchoolClass.id == Enrollment.class_id, isouter=True)
    )
    if student_id:
        stmt = stmt.where(FeeInvoice.student_id == student_id)
    if class_id:
        stmt = stmt.where(Enrollment.class_id == class_id)
    if year_id:
        stmt = stmt.where(FeeInvoice.academic_year_id == year_id)
    if period:
        stmt = stmt.where(FeeInvoice.period_label == period)
    if run_id:
        stmt = stmt.where(FeeInvoice.run_id == run_id)
    if status:
        stmt = stmt.where(base.status_expr(total, paid) == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            Student.scholar_no.ilike(like)
            | func.concat(Student.first_name, " ", Student.last_name).ilike(like)
            | FeeInvoice.invoice_no.ilike(like)
        )
    return stmt.order_by(FeeInvoice.due_on.desc(), FeeInvoice.invoice_no.desc())


async def list_rows(db: AsyncSession, stmt, *, limit: int | None = None, offset: int = 0) -> list[InvoiceRow]:
    if limit is not None:
        stmt = stmt.limit(limit).offset(offset)
    today = today_ist()
    return [_row(i, s, c, t, p, today) for i, s, c, t, p in (await db.execute(stmt)).all()]


async def payment_outs(db: AsyncSession, payments: list[FeePayment], *, for_parent: bool = False) -> list[PaymentOut]:
    if not payments:
        return []
    names = await base.user_names(db, {x for p in payments for x in (p.received_by, p.cancelled_by)})
    invs = {
        i.id: i
        for i in (await db.scalars(select(FeeInvoice).where(FeeInvoice.id.in_({p.invoice_id for p in payments})))).all()
    }
    studs = {
        s.id: s
        for s in (await db.scalars(select(Student).where(Student.id.in_({p.student_id for p in payments})))).all()
    }
    return [
        PaymentOut(
            id=p.id,
            receipt_no=p.receipt_no,
            invoice_id=p.invoice_id,
            invoice_no=invs[p.invoice_id].invoice_no,
            student_id=p.student_id,
            student_name=full_name(studs[p.student_id]),
            amount_paise=p.amount_paise,
            mode=p.mode,
            reference=p.reference,
            note=None if for_parent else p.note,
            received_at=p.received_at,
            received_by=p.received_by,
            received_by_name=names.get(p.received_by),
            status=p.status,
            cancelled_at=p.cancelled_at,
            cancelled_by_name=None if for_parent else names.get(p.cancelled_by) if p.cancelled_by else None,
            cancel_reason=None if for_parent else p.cancel_reason,
        )
        for p in payments
    ]


async def invoice_detail(
    db: AsyncSession, invoice_id: uuid.UUID, *, student_id: uuid.UUID | None = None, for_parent: bool = False
) -> InvoiceDetail:
    stmt = invoices_query(student_id=student_id).where(FeeInvoice.id == invoice_id)
    rows = (await db.execute(stmt)).all()
    if not rows:
        raise NotFound("Invoice not found.")
    inv, stu, cls, total, paid = rows[0]
    row = _row(inv, stu, cls, total, paid, today_ist())
    items = (
        await db.scalars(
            select(FeeInvoiceItem).where(FeeInvoiceItem.invoice_id == inv.id).order_by(FeeInvoiceItem.position)
        )
    ).all()
    pays = (
        await db.scalars(
            select(FeePayment).where(FeePayment.invoice_id == inv.id).order_by(FeePayment.received_at, FeePayment.id)
        )
    ).all()
    into = await db.get(FeeInvoice, inv.closed_into_id) if inv.closed_into_id else None
    return InvoiceDetail(
        **row.model_dump(),
        items=[
            ItemOut(
                id=i.id, kind=i.kind, fee_head_id=i.fee_head_id, description=i.description, amount_paise=i.amount_paise
            )
            for i in items
        ],
        payments=await payment_outs(db, list(pays), for_parent=for_parent),
        late_waived=inv.late_waived_at is not None,
        late_waive_reason=None if for_parent else inv.late_waive_reason,
        closed_into_invoice_no=into.invoice_no if into else None,
    )
