"""Year-end rollover, part 2: Apply (one transaction), the students step, the checklist and the history.

Apply does, in this order, inside the caller's transaction (any error rolls everything back):
  lock -> build the plan -> new year (draft) -> new classes -> leaving and passed-out students (while the old year is
  still current) -> promoted and staying students -> subjects, teachers, timetable, fee structure, concessions and
  optional fees -> old year completed and new year current -> dues (write off) and first invoices -> parent
  notifications -> one audit summary, the batch and its items, and the draft is removed.
"""

import uuid
from collections import defaultdict

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.academic import AcademicYear, ClassStaff, ClassSubject, SchoolClass
from app.models.enums import (
    AuditCategory,
    ClassRole,
    EnrollmentStatus,
    PromotionBatchStatus,
    PromotionDecision,
    StudentStatus,
    YearStatus,
)
from app.models.fees import (
    FeeCarryForward,
    FeeConcession,
    FeeHead,
    FeeInvoice,
    FeeStructure,
    StudentConcession,
    StudentFeeOption,
)
from app.models.results import Exam, ExamSubject
from app.models.rollover import PromotionBatch, PromotionItem
from app.models.student import Admission, Enrollment, Student
from app.models.timetable import TimetableSlot
from app.schemas.rollover import (
    ApplyOut,
    BatchDetail,
    BatchItemOut,
    BatchOut,
    ChecklistItem,
    ClassPanel,
    RolloverPlan,
    StudentHint,
)
from app.services import fees as fee_base
from app.services import rollover_plan as rp
from app.services.attendance import class_stats
from app.services.audit import Actor, change, log_audit
from app.services.fee_invoices import generate_invoices
from app.services.messages_i18n import render
from app.services.notifications import notify_guardians_of_student
from app.services.results import class_sheet
from app.services.students import (
    add_student_event,
    class_label,
    full_name,
    mark_left,
    mark_passed_out,
)


def _event_reason(old: SchoolClass, new: SchoolClass, year: str, verb: str) -> str:
    return f"{verb} from {class_label(old)} to {class_label(new)}, {year}"


async def _notify(db: AsyncSession, b: rp.Built, new_by_key: dict, to_year: AcademicYear) -> int:
    """'Congratulations! Aarav is now in Class 9-A for 2027-28.' to every parent login. Leaving gets nothing."""
    sent = 0
    for it in b.items:
        name = full_name(it.student)
        dest = f"{it.dest[0]}-{it.dest[1]}" if it.dest else ""
        if it.decision == PromotionDecision.promote.value and it.dest:
            kind = "promotion_promoted"
        elif it.decision == PromotionDecision.repeat.value and it.dest:
            kind = "promotion_stayed"
        elif it.decision == PromotionDecision.passed_out.value:
            kind = "promotion_completed"
        else:
            continue
        m = render(kind, name=name, dest=dest, year=to_year.name, old=class_label(it.old))
        ids = await notify_guardians_of_student(
            db,
            it.student.id,
            kind=kind,
            **m.kw(),
            data={
                "student_id": str(it.student.id),
                "year": to_year.name,
                "class": f"{it.dest[0]}-{it.dest[1]}" if it.dest else None,
            },
            dedupe_key=f"rollover:{to_year.id}",
            skip_if_left=False,
        )
        sent += len(ids)
    return sent


async def apply(
    db: AsyncSession, actor: Actor, plan: RolloverPlan, *, from_year_id: uuid.UUID, confirm: bool
) -> ApplyOut:
    assert actor.school_id and actor.id
    if not confirm:
        raise AppError("Please confirm that you have checked the review.", code="confirm_required", status=422)
    # One rollover at a time per school; a double click or a second admin waits here and then sees `already_applied`.
    await db.execute(
        text("select pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"rollover:{actor.school_id}"}
    )
    done = await db.scalar(
        select(PromotionBatch).where(
            PromotionBatch.from_year_id == from_year_id, PromotionBatch.status == PromotionBatchStatus.applied.value
        )
    )
    if done is not None:
        raise Conflict(
            "This year has already been rolled over.", code="already_applied", details={"batch_id": str(done.id)}
        )
    b = await rp.build(db, plan)
    if b.from_year.id != from_year_id:
        raise Conflict("The current year is not the year you were rolling over.", code="year_changed")
    if b.problems:
        raise AppError(
            "The plan has problems. Fix them and try again.",
            code="plan_has_problems",
            status=422,
            details=[p.model_dump() for p in b.problems],
        )
    frm = b.from_year

    # ---- the new year (draft until the end of this function)
    to = b.to_year
    if to is None:
        to = AcademicYear(
            school_id=actor.school_id,
            name=b.to_name,
            starts_on=b.to_starts,
            ends_on=b.to_ends,
            status=YearStatus.draft.value,
        )
        db.add(to)
        await db.flush()
    already = await db.scalar(
        select(func.count())
        .select_from(Enrollment)
        .where(
            Enrollment.academic_year_id == to.id, Enrollment.student_id.in_([i.student.id for i in b.items] or [None])
        )
    )
    if already:
        raise Conflict(f"{already} students already have a place in {to.name}.", code="already_enrolled")

    # ---- new classes
    created = 0
    new_by_key: dict[tuple[str, str], SchoolClass] = {}
    for key, nc in b.new_classes.items():
        if nc.existing is not None:
            cls = nc.existing
            cls.capacity = max(cls.capacity, len(nc.items))
        else:
            cls = SchoolClass(
                school_id=actor.school_id,
                academic_year_id=to.id,
                grade=nc.grade,
                section=nc.section,
                capacity=max(nc.capacity, len(nc.items)),
                is_custom=nc.is_custom,
                display_order=nc.display_order,
            )
            db.add(cls)
            created += 1
        new_by_key[key] = cls
    await db.flush()
    for old in b.old_classes:  # custom chains (Nursery -> LKG) carry over to the new year's classes
        nxt = next((c for c in b.old_classes if c.id == old.next_class_id), None)
        here, there = new_by_key.get((old.grade, old.section)), nxt and new_by_key.get((nxt.grade, nxt.section))
        if here is not None and there is not None and here.next_class_id is None and here.id != there.id:
            here.next_class_id = there.id
    await db.flush()

    batch = PromotionBatch(
        school_id=actor.school_id,
        from_year_id=frm.id,
        to_year_id=to.id,
        status=PromotionBatchStatus.applied.value,
        created_by=actor.id,
        applied_at=utcnow(),
    )
    db.add(batch)
    await db.flush()

    # ---- students. Leaving and passed-out first: the lifecycle helpers look at the *current* year's enrollment.
    for it in b.items:
        if it.decision == PromotionDecision.leave.value:
            await mark_left(db, actor, it.student, left_on=frm.ends_on, reason=f"Left at the end of {frm.name}")
        elif it.decision == PromotionDecision.passed_out.value:
            await mark_passed_out(db, actor, it.student, effective_on=frm.ends_on, log=False)
    new_enrollment: dict[uuid.UUID, Enrollment] = {}
    for it in b.items:
        if it.decision not in (PromotionDecision.promote.value, PromotionDecision.repeat.value):
            continue
        assert it.dest and it.roll_no
        target = new_by_key[it.dest]
        staying = it.decision == PromotionDecision.repeat.value
        it.enrollment.status = EnrollmentStatus.detained.value if staying else EnrollmentStatus.promoted.value
        it.enrollment.ended_on = frm.ends_on
        new = Enrollment(
            school_id=actor.school_id,
            student_id=it.student.id,
            class_id=target.id,
            academic_year_id=to.id,
            roll_no=it.roll_no,
            status=EnrollmentStatus.active.value,
            started_on=to.starts_on,
        )
        db.add(new)
        new_enrollment[it.student.id] = new
        add_student_event(
            db,
            actor,
            it.student,
            "detained" if staying else "promoted",
            from_class_id=it.old.id,
            to_class_id=target.id,
            academic_year_id=to.id,
            effective_on=to.starts_on,
            reason=_event_reason(it.old, target, to.name, "Stays" if staying else "Promoted"),
        )
    await db.flush()

    # ---- subjects, teachers, timetable, fee structure
    slots_copied = 0
    for key, nc in b.new_classes.items():
        cls = new_by_key[key]
        if nc.fill_subjects:
            for sid in nc.subject_ids:
                db.add(ClassSubject(school_id=actor.school_id, class_id=cls.id, subject_id=sid))
        if nc.fill_teachers:
            if nc.class_teacher:
                db.add(
                    ClassStaff(
                        school_id=actor.school_id,
                        class_id=cls.id,
                        staff_id=nc.class_teacher,
                        role=ClassRole.class_teacher.value,
                    )
                )
            for sid, staff_id in nc.subject_teachers.items():
                db.add(
                    ClassStaff(
                        school_id=actor.school_id,
                        class_id=cls.id,
                        staff_id=staff_id,
                        role=ClassRole.subject_teacher.value,
                        subject_id=sid,
                    )
                )
        if nc.fill_fees:
            for head_id, (amount, freq) in nc.fees.items():
                db.add(
                    FeeStructure(
                        school_id=actor.school_id,
                        class_id=cls.id,
                        fee_head_id=head_id,
                        amount_paise=amount,
                        frequency=freq,
                    )
                )
    await db.flush()
    busy_staff: set[tuple] = set()
    for key, nc in b.new_classes.items():
        if nc.timetable_src is None or nc.existing is not None:
            continue
        cls = new_by_key[key]
        for s in await db.scalars(select(TimetableSlot).where(TimetableSlot.class_id == nc.timetable_src.id)):
            who = (s.staff_id, s.weekday, s.period_id)
            if s.subject_id not in nc.subject_ids or who in busy_staff:
                continue
            busy_staff.add(who)
            db.add(
                TimetableSlot(
                    school_id=actor.school_id,
                    class_id=cls.id,
                    academic_year_id=to.id,
                    weekday=s.weekday,
                    period_id=s.period_id,
                    subject_id=s.subject_id,
                    staff_id=s.staff_id,
                )
            )
            slots_copied += 1

    # ---- concessions and optional fees follow continuing students
    carry_ids = b.plan.fees.carry_concession_ids
    cons = {c.id for c in await db.scalars(select(FeeConcession).where(FeeConcession.is_active.is_(True)))}
    if carry_ids is not None:
        cons &= set(carry_ids)
    continuing = [i.student.id for i in b.items if i.decision in ("promote", "repeat")]
    if continuing and cons:
        for sc in await db.scalars(
            select(StudentConcession).where(
                StudentConcession.academic_year_id == frm.id,
                StudentConcession.student_id.in_(continuing),
                StudentConcession.concession_id.in_(cons),
            )
        ):
            db.add(
                StudentConcession(
                    school_id=actor.school_id,
                    student_id=sc.student_id,
                    concession_id=sc.concession_id,
                    academic_year_id=to.id,
                    approved_by=actor.id,
                    note=f"Carried over from {frm.name}",
                )
            )
    if continuing and b.plan.fees.carry_options:
        active_heads = {h.id for h in await db.scalars(select(FeeHead).where(FeeHead.is_active.is_(True)))}
        for so in await db.scalars(
            select(StudentFeeOption).where(
                StudentFeeOption.academic_year_id == frm.id, StudentFeeOption.student_id.in_(continuing)
            )
        ):
            if so.fee_head_id in active_heads:
                db.add(
                    StudentFeeOption(
                        school_id=actor.school_id,
                        student_id=so.student_id,
                        academic_year_id=to.id,
                        fee_head_id=so.fee_head_id,
                        route_id=so.route_id,
                        amount_paise=so.amount_paise,
                        frequency=so.frequency,
                        note=so.note,
                    )
                )
    await db.flush()

    # ---- the switch: the old year becomes an archive, the new year runs
    frm.status = YearStatus.completed.value
    await db.flush()  # free the "one current year" slot first
    to.status = YearStatus.current.value
    await db.flush()

    # ---- dues
    written_off = 0
    carried = 0
    invoices_created = 0
    fees = b.plan.fees
    if fees.dues == "write_off":
        written_off = await _write_off(
            db, actor, [i.student.id for i in b.items if i.decision != "leave"], fees.write_off_reason or ""
        )
    if fees.first_invoice is not None:
        fi = fees.first_invoice
        res = await generate_invoices(
            db,
            actor,
            year=to,
            period_label=fi.period_label,
            due_on=fi.due_on,
            frequencies=list(fi.frequencies),
            carry_forward=fees.dues == "carry",
        )
        invoices_created = len(res.created)
        if res.created:
            carried = (
                await db.scalar(
                    select(func.coalesce(func.sum(FeeCarryForward.amount_paise), 0)).where(
                        FeeCarryForward.to_invoice_id.in_([i.id for i in res.created])
                    )
                )
                or 0
            )
    elif fees.dues == "carry":
        carried = b.dues_paise  # stays open on the old invoices and is carried into the first invoice generated

    # ---- the record
    for it in b.items:
        nd = new_by_key.get(it.dest) if it.dest else None
        db.add(
            PromotionItem(
                school_id=actor.school_id,
                batch_id=batch.id,
                enrollment_id=it.enrollment.id,
                student_id=it.student.id,
                decision=it.decision,
                from_class_id=it.old.id,
                to_class_id=nd.id if nd else None,
                new_enrollment_id=new_enrollment[it.student.id].id if it.student.id in new_enrollment else None,
            )
        )
    notified = await _notify(db, b, new_by_key, to)
    counts = {
        "promoted": b.count("promote"),
        "staying": b.count("repeat"),
        "leaving": b.count("leave"),
        "passed_out": b.count("passed_out"),
    }
    batch.summary = {
        **counts,
        "classes_created": created,
        "timetable_slots_copied": slots_copied,
        "dues_carried_paise": int(carried),
        "dues_written_off_paise": int(written_off),
        "invoices_created": invoices_created,
        "parents_notified": notified,
    }
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "year.rolled_over",
        f"Rolled {frm.name} over to {to.name}: {counts['promoted']} promoted, {counts['staying']} staying, "
        f"{counts['leaving']} leaving, {counts['passed_out']} passed out; {created} classes created",
        entity_type="promotion_batch",
        entity_id=batch.id,
        entity_label=f"{frm.name} to {to.name}",
        sensitive=True,
        changes=[
            change("Current year", frm.name, to.name),
            change("Dues written off (paise)", 0, int(written_off)),
        ],
    )
    await rp.delete_draft(db)
    await db.flush()
    return ApplyOut(
        batch_id=batch.id,
        from_year=frm.name,
        to_year=to.name,
        **counts,
        classes_created=created,
        dues_carried_paise=int(carried),
        dues_written_off_paise=int(written_off),
        invoices_created=invoices_created,
        parents_notified=notified,
        checklist=await checklist(db),
    )


async def _write_off(db: AsyncSession, actor: Actor, student_ids: list[uuid.UUID], reason: str) -> int:
    """Closes every open invoice with a balance for these students and records why (flagged sensitive)."""
    if not student_ids:
        return 0
    assert actor.school_id
    m = (
        fee_base.invoice_money()
        .where(FeeInvoice.closed_at.is_(None), FeeInvoice.student_id.in_(student_ids))
        .subquery()
    )
    rows = (
        await db.execute(
            select(FeeInvoice, m.c.total - m.c.paid)
            .join(m, m.c.id == FeeInvoice.id)
            .where(m.c.total - m.c.paid > 0)
            .with_for_update(of=FeeInvoice)
        )
    ).all()
    now, total = utcnow(), 0
    for inv, bal in rows:
        inv.closed_at = now
        db.add(
            FeeCarryForward(
                school_id=actor.school_id,
                student_id=inv.student_id,
                from_invoice_id=inv.id,
                to_invoice_id=None,
                amount_paise=bal,
                written_off=True,
                reason=reason.strip(),
            )
        )
        total += int(bal)
    if rows:
        log_audit(
            db,
            actor,
            AuditCategory.fees,
            "fees.written_off",
            f"Wrote off Rs {fee_base.rupees(total)} of dues on {len(rows)} invoices at year end: {reason.strip()}",
            entity_type="fee_invoice",
            sensitive=True,
        )
    await db.flush()
    return total


# ------------------------------------------------------------------ the students step
async def students_panels(db: AsyncSession, plan: RolloverPlan, class_id: uuid.UUID | None = None) -> list[ClassPanel]:
    """One panel per class with the default (or drafted) decision and the hints: result %, attendance %, fee balance."""
    b = await rp.build(db, plan)
    frm = b.from_year
    classes = [c for c in b.old_classes if class_id is None or c.id == class_id]
    if class_id and not classes:
        raise NotFound("Class not found.")
    sids = [i.student.id for i in b.items]
    bal: dict[uuid.UUID, int] = {}
    if sids:
        m = fee_base.invoice_money().where(FeeInvoice.closed_at.is_(None), FeeInvoice.student_id.in_(sids)).subquery()
        bal = {
            sid: int(v)
            for sid, v in (
                await db.execute(select(m.c.student_id, func.sum(m.c.total - m.c.paid)).group_by(m.c.student_id))
            ).all()
            if v and v > 0
        }
    exams = list(
        (
            await db.scalars(
                select(Exam)
                .where(Exam.academic_year_id == frm.id)
                .order_by(Exam.ends_on.desc().nulls_last(), Exam.created_at.desc())
            )
        ).all()
    )
    with_papers: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    for eid, cid in (await db.execute(select(ExamSubject.exam_id, ExamSubject.class_id).distinct())).all():
        with_papers[cid].add(eid)
    to_day = min(today_ist(), frm.ends_on)
    by_class: dict[uuid.UUID, list[rp.Item]] = defaultdict(list)
    for it in b.items:
        by_class[it.old.id].append(it)
    out = []
    for c in classes:
        exam = next((e for e in exams if e.id in with_papers.get(c.id, ())), None)
        results = {}
        if exam:
            sheet = await class_sheet(db, exam, c)
            results = {r.student_id: r for r in sheet.students}
        att = {s.student_id: s.percentage for s in (await class_stats(db, c, frm.starts_on, to_day)).students}
        _, dest = rp._class_default(c, {x.id: x for x in b.old_classes})
        kids = []
        for it in sorted(by_class.get(c.id, []), key=lambda i: (i.enrollment.roll_no or 10**6, i.student.first_name)):
            r = results.get(it.student.id)
            kids.append(
                StudentHint(
                    enrollment_id=it.enrollment.id,
                    student_id=it.student.id,
                    scholar_no=it.student.scholar_no,
                    name=full_name(it.student),
                    roll_no=it.enrollment.roll_no,
                    decision=it.decision,
                    to_class=f"{it.dest[0]}-{it.dest[1]}" if it.dest else None,
                    result_percentage=r.percentage if r else None,
                    below_pass=bool(r and r.complete and r.passed is False),
                    attendance_percentage=att.get(it.student.id),
                    fee_balance_paise=bal.get(it.student.id, 0),
                )
            )
        move = next((m for m in plan.class_moves if m.from_class_id == c.id), None)
        shown = (move.to_class.grade, move.to_class.section) if move else dest
        out.append(
            ClassPanel(
                class_id=c.id,
                class_label=class_label(c),
                destination=f"{shown[0]}-{shown[1]}" if shown else None,
                students=kids,
            )
        )
    return out


# ------------------------------------------------------------------ after apply
async def checklist(db: AsyncSession) -> list[ChecklistItem]:
    """What is left in the new year. Counts are live, so the list shrinks as the school works through it."""
    year = await rp.current_year_or_none(db)
    if year is None:
        return []
    classes = list((await db.scalars(select(SchoolClass).where(SchoolClass.academic_year_id == year.id))).all())
    subjects = defaultdict(int)
    for cid, n in (await db.execute(select(ClassSubject.class_id, func.count()).group_by(ClassSubject.class_id))).all():
        subjects[cid] = n
    assigned = defaultdict(int)
    for cid, n in (await db.execute(select(ClassStaff.class_id, func.count()).group_by(ClassStaff.class_id))).all():
        assigned[cid] = n
    empty_slots = sum(max(0, 1 + subjects[c.id] - assigned[c.id]) for c in classes)
    with_slots = set(
        (await db.scalars(select(TimetableSlot.class_id).where(TimetableSlot.academic_year_id == year.id))).all()
    )
    no_timetable = sum(1 for c in classes if c.id not in with_slots)
    no_invoice = (
        await db.scalar(
            select(func.count())
            .select_from(Enrollment)
            .where(
                Enrollment.academic_year_id == year.id,
                Enrollment.status == EnrollmentStatus.active.value,
                ~select(FeeInvoice.id)
                .where(FeeInvoice.student_id == Enrollment.student_id, FeeInvoice.academic_year_id == year.id)
                .exists(),
            )
        )
        or 0
    )
    admissions = await db.scalar(select(func.count()).select_from(Admission).where(Admission.status == "approved")) or 0
    pending_tc = 0
    batch = await db.scalar(
        select(PromotionBatch).where(PromotionBatch.to_year_id == year.id).order_by(PromotionBatch.created_at.desc())
    )
    if batch:
        pending_tc = (
            await db.scalar(
                select(func.count())
                .select_from(PromotionItem)
                .join(Student, Student.id == PromotionItem.student_id)
                .where(
                    PromotionItem.batch_id == batch.id,
                    PromotionItem.decision == PromotionDecision.leave.value,
                    Student.status == StudentStatus.left.value,
                )
            )
            or 0
        )
    items = [
        ChecklistItem(key="teacher_slots", label="Assign teachers to empty slots", count=empty_slots, link="/classes"),
        ChecklistItem(key="timetable", label="Set or check the timetable", count=no_timetable, link="/timetable"),
        ChecklistItem(
            key="invoices", label="Generate invoices for students without one", count=no_invoice, link="/fees/invoices"
        ),
        ChecklistItem(key="admissions", label="Place approved admissions", count=admissions, link="/admissions"),
        ChecklistItem(
            key="transfer_certificates", label="Issue transfer certificates", count=pending_tc, link="/certificates"
        ),
    ]
    return [i for i in items if i.count > 0]


async def list_batches(db: AsyncSession) -> list[BatchOut]:
    names = {y.id: y.name for y in await db.scalars(select(AcademicYear))}
    rows = (await db.scalars(select(PromotionBatch).order_by(PromotionBatch.created_at.desc()))).all()
    return [
        BatchOut(
            id=r.id,
            from_year_id=r.from_year_id,
            to_year_id=r.to_year_id,
            from_year=names.get(r.from_year_id, ""),
            to_year=names.get(r.to_year_id, ""),
            status=r.status,
            applied_at=r.applied_at,
            created_by=r.created_by,
            summary=r.summary,
        )
        for r in rows
    ]


async def batch_detail(db: AsyncSession, batch_id: uuid.UUID) -> BatchDetail:
    r = await db.get(PromotionBatch, batch_id)
    if r is None:
        raise NotFound("Rollover not found.")
    head = next(b for b in await list_batches(db) if b.id == r.id)
    labels = {c.id: class_label(c) for c in await db.scalars(select(SchoolClass))}
    rows = (
        await db.execute(
            select(PromotionItem, Student)
            .join(Student, Student.id == PromotionItem.student_id)
            .where(PromotionItem.batch_id == r.id)
            .order_by(Student.first_name, Student.last_name)
        )
    ).all()
    items = [
        BatchItemOut(
            student_id=s.id,
            scholar_no=s.scholar_no,
            name=full_name(s),
            decision=i.decision,
            from_class=labels.get(i.from_class_id, ""),
            to_class=labels.get(i.to_class_id) if i.to_class_id else None,
        )
        for i, s in rows
    ]
    return BatchDetail(**head.model_dump(), items=items)
