"""Year-end rollover, part 1: readiness, the shared draft, and turning a plan into a concrete, checkable result.

`build()` reads the school and a `RolloverPlan` and returns a `Built` object: who goes where, which new classes are
needed, subjects, teachers, timetable and fees for each, plus problems (block Apply) and warnings (do not block).
`preview()` shows it, `rollover.apply()` executes it. Nothing here writes except the draft.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import Conflict
from app.models.academic import AcademicYear, ClassStaff, ClassSubject, SchoolClass
from app.models.attendance import LeaveRequest
from app.models.enums import (
    ClassRole,
    EnrollmentStatus,
    FeeScope,
    LeaveStatus,
    PromotionDecision,
    StudentStatus,
    UserKind,
    YearStatus,
)
from app.models.fees import FeeHead, FeeStructure
from app.models.results import Exam, ExamPublication, ExamSubject
from app.models.rollover import PromotionBatch, RolloverDraft
from app.models.student import Enrollment, Guardian, Student, StudentGuardian
from app.models.timetable import TimetableSlot
from app.models.user import User
from app.schemas.rollover import (
    DraftOut,
    DuesOut,
    NewClassOut,
    PlanProblem,
    Readiness,
    ReadinessItem,
    RolloverPlan,
    RolloverPreview,
    RolloverStatus,
)
from app.services import fees as fee_base
from app.services.students import class_label, current_year_or_none, full_name

BANNER_DAYS = 45
DEFAULT_CAPACITY = 40
TOP_GRADE = 12

Key = tuple[str, str]  # (grade, section) of a class in the new year


# ------------------------------------------------------------------ the new year's name and dates
def _plus_year(d: date) -> date:
    try:
        return d.replace(year=d.year + 1)
    except ValueError:  # 29 Feb
        return d.replace(year=d.year + 1, day=28)


def suggest_next_year(year: AcademicYear) -> tuple[str, date, date]:
    """'2026-27' becomes '2027-28'; dates move one year on."""
    name = f"{year.starts_on.year + 1}-{str(year.starts_on.year + 2)[-2:]}"
    return name, _plus_year(year.starts_on), _plus_year(year.ends_on)


# ------------------------------------------------------------------ status and readiness
async def status(db: AsyncSession) -> RolloverStatus:
    year = await current_year_or_none(db)
    if year is None:
        return RolloverStatus(
            current_year_id=None,
            current_year=None,
            ends_on=None,
            days_left=None,
            show_banner=False,
            suggested_name=None,
            suggested_starts_on=None,
            suggested_ends_on=None,
            has_draft=False,
            already_applied=False,
            last_batch_id=None,
        )
    name, starts, ends = suggest_next_year(year)
    days_left = (year.ends_on - today_ist()).days
    batch = await db.scalar(select(PromotionBatch).order_by(PromotionBatch.created_at.desc()))
    return RolloverStatus(
        current_year_id=year.id,
        current_year=year.name,
        ends_on=year.ends_on,
        days_left=days_left,
        show_banner=days_left <= BANNER_DAYS,
        suggested_name=name,
        suggested_starts_on=starts,
        suggested_ends_on=ends,
        has_draft=bool(await db.scalar(select(func.count()).select_from(RolloverDraft))),
        already_applied=batch is not None and batch.from_year_id == year.id and batch.status == "applied",
        last_batch_id=batch.id if batch else None,
    )


async def readiness(db: AsyncSession) -> Readiness:
    """A card, not a blocker: each item says what is open and where to fix it."""
    year = await current_year_or_none(db)
    if year is None:
        raise Conflict("There is no current academic year.", code="no_current_year")
    classes = {c.id: c for c in (await db.scalars(select(SchoolClass).where(SchoolClass.academic_year_id == year.id)))}
    items: list[ReadinessItem] = []

    # results not published: every (exam, class) that has papers but no publication
    rows = (
        await db.execute(
            select(Exam.name, ExamSubject.class_id)
            .join(ExamSubject, ExamSubject.exam_id == Exam.id)
            .where(
                Exam.academic_year_id == year.id,
                ~exists().where(ExamPublication.exam_id == Exam.id, ExamPublication.class_id == ExamSubject.class_id),
            )
            .distinct()
            .order_by(Exam.name)
        )
    ).all()
    by_exam: dict[str, list[str]] = defaultdict(list)
    for name, cid in rows:
        if cid in classes:
            by_exam[name].append(class_label(classes[cid]))
    unpublished = [f"{n}: {', '.join(sorted(v))}" for n, v in by_exam.items()]
    items.append(
        ReadinessItem(
            key="results_unpublished",
            label="Results not published",
            count=sum(len(v) for v in by_exam.values()),
            ok=not unpublished,
            link="/results",
            details=unpublished,
        )
    )

    pending = (
        await db.scalar(
            select(func.count()).select_from(LeaveRequest).where(LeaveRequest.status == LeaveStatus.pending.value)
        )
        or 0
    )
    items.append(
        ReadinessItem(
            key="leave_pending", label="Pending leave requests", count=pending, ok=pending == 0, link="/leave"
        )
    )

    m = fee_base.invoice_money().where(fee_base.FeeInvoice.closed_at.is_(None)).subquery()
    bal = m.c.total - m.c.paid
    unpaid = (
        await db.execute(
            select(func.count(func.distinct(m.c.student_id)), func.coalesce(func.sum(bal), 0)).where(bal > 0)
        )
    ).one()
    items.append(
        ReadinessItem(
            key="fees_unpaid",
            label="Unpaid fees (can be carried forward)",
            count=int(unpaid[0]),
            ok=int(unpaid[0]) == 0,
            amount_paise=int(unpaid[1]),
            link="/fees/dues",
        )
    )

    with_teacher = set(
        (await db.scalars(select(ClassStaff.class_id).where(ClassStaff.role == ClassRole.class_teacher.value))).all()
    )
    no_teacher = sorted(class_label(c) for c in classes.values() if c.id not in with_teacher)
    items.append(
        ReadinessItem(
            key="classes_without_class_teacher",
            label="Classes without a class teacher",
            count=len(no_teacher),
            ok=not no_teacher,
            link="/classes",
            details=no_teacher,
        )
    )

    missing = (
        await db.scalar(
            select(func.count())
            .select_from(Student)
            .where(
                Student.status == StudentStatus.active.value,
                func.coalesce(Student.emergency_phone, "") == "",
                ~exists().where(StudentGuardian.student_id == Student.id, StudentGuardian.is_emergency.is_(True)),
            )
        )
        or 0
    )
    items.append(
        ReadinessItem(
            key="emergency_contact_missing",
            label="Students without an emergency contact",
            count=missing,
            ok=missing == 0,
            link="/students?missing=emergency_contact",
        )
    )
    return Readiness(items=items, all_ok=all(i.ok for i in items))


# ------------------------------------------------------------------ the shared draft
async def get_draft(db: AsyncSession) -> tuple[RolloverPlan, RolloverDraft | None]:
    row = await db.scalar(select(RolloverDraft))
    if row is None:
        return RolloverPlan(), None
    return RolloverPlan.model_validate(row.payload), row


async def draft_out(db: AsyncSession) -> DraftOut:
    plan, row = await get_draft(db)
    who = await db.get(User, row.updated_by) if row and row.updated_by else None
    return DraftOut(plan=plan, updated_at=row.updated_at if row else None, updated_by=who.name if who else None)


async def save_draft(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID, plan: RolloverPlan) -> DraftOut:
    row = await db.scalar(select(RolloverDraft).with_for_update())
    payload = plan.model_dump(mode="json")
    if row is None:
        db.add(RolloverDraft(school_id=school_id, payload=payload, updated_by=user_id, updated_at=utcnow()))
    else:
        row.payload, row.updated_by, row.updated_at = payload, user_id, utcnow()
    await db.flush()
    return await draft_out(db)


async def delete_draft(db: AsyncSession) -> None:
    row = await db.scalar(select(RolloverDraft))
    if row:
        await db.delete(row)
        await db.flush()


# ------------------------------------------------------------------ building a plan
@dataclass
class Item:
    enrollment: Enrollment
    student: Student
    old: SchoolClass
    decision: str
    dest: Key | None = None
    roll_no: int | None = None


@dataclass
class NewClass:
    grade: str
    section: str
    capacity: int = DEFAULT_CAPACITY
    is_custom: bool = False
    display_order: int = 99
    existing: SchoolClass | None = None
    feeders: list[SchoolClass] = field(default_factory=list)
    items: list[Item] = field(default_factory=list)
    grade_src: SchoolClass | None = None  # last year's class with this grade (same section first)
    subject_ids: list[uuid.UUID] = field(default_factory=list)
    fill_subjects: bool = True
    class_teacher: uuid.UUID | None = None
    subject_teachers: dict[uuid.UUID, uuid.UUID] = field(default_factory=dict)
    fill_teachers: bool = True
    existing_slots_filled: int = 0
    fees: dict[uuid.UUID, tuple[int, str]] = field(default_factory=dict)  # head -> (amount, frequency)
    fill_fees: bool = True
    timetable_src: SchoolClass | None = None
    timetable_slots: int = 0

    @property
    def key(self) -> Key:
        return self.grade, self.section

    @property
    def label(self) -> str:
        return f"{self.grade}-{self.section}"

    @property
    def slots(self) -> int:
        return 1 + len(self.subject_ids)

    @property
    def slots_filled(self) -> int:
        if not self.fill_teachers:
            return self.existing_slots_filled
        return (1 if self.class_teacher else 0) + len(self.subject_teachers)


@dataclass
class Built:
    from_year: AcademicYear
    to_name: str
    to_starts: date
    to_ends: date
    to_year: AcademicYear | None
    old_classes: list[SchoolClass]
    items: list[Item]
    new_classes: dict[Key, NewClass]
    plan: RolloverPlan
    problems: list[PlanProblem] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    dues_students: int = 0
    dues_paise: int = 0
    parents: int = 0

    def count(self, decision: str) -> int:
        return sum(1 for i in self.items if i.decision == decision)


def _norm(grade: str, section: str) -> Key:
    return grade.strip(), section.strip()


def _class_default(c: SchoolClass, by_id: dict[uuid.UUID, SchoolClass]) -> tuple[str, Key | None]:
    """('to', key) | ('pass', None) | ('missing', None) for where a class goes by default."""
    nxt = by_id.get(c.next_class_id) if c.next_class_id else None
    if nxt is not None:
        return "to", (nxt.grade, nxt.section)
    if c.grade.isdigit():
        g = int(c.grade)
        return ("pass", None) if g >= TOP_GRADE else ("to", (str(g + 1), c.section))
    return "missing", None


def _round_fee(amount: int, percent: int, round_to: int) -> int:
    out = (amount * (100 + percent) + 50) // 100
    if round_to > 0:
        out = ((out + round_to // 2) // round_to) * round_to
    return max(out, 1)


async def build(db: AsyncSession, plan: RolloverPlan) -> Built:
    year = await current_year_or_none(db)
    if year is None:
        raise Conflict("There is no current academic year.", code="no_current_year")
    s_name, s_start, s_end = suggest_next_year(year)
    to_name = (plan.new_year_name or s_name).strip()
    to_start, to_end = plan.starts_on or s_start, plan.ends_on or s_end
    to_year = await db.scalar(select(AcademicYear).where(AcademicYear.name == to_name))
    b = Built(year, to_name, to_start, to_end, to_year, [], [], {}, plan)
    problems = b.problems

    if to_year is not None:
        if to_year.id == year.id or to_year.status != YearStatus.draft.value:
            problems.append(
                PlanProblem(code="new_year_not_draft", message=f"{to_name} already exists and is not a draft.")
            )
        else:
            b.to_starts, b.to_ends = to_year.starts_on, to_year.ends_on
    if b.to_starts <= year.starts_on or b.to_ends <= b.to_starts:
        problems.append(PlanProblem(code="bad_dates", message="The new year must start after the old year started."))

    old_classes = list(
        (
            await db.scalars(
                select(SchoolClass)
                .where(SchoolClass.academic_year_id == year.id)
                .order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section)
            )
        ).all()
    )
    b.old_classes = old_classes
    by_id = {c.id: c for c in old_classes}
    by_key = {(c.grade, c.section): c for c in old_classes}

    # class destinations
    moves = {m.from_class_id: _norm(m.to_class.grade, m.to_class.section) for m in plan.class_moves}
    for cid in moves:
        if cid not in by_id:
            problems.append(
                PlanProblem(code="unknown_class", message="A class in the plan is not in the current year.")
            )
    defaults: dict[uuid.UUID, tuple[str, Key | None]] = {
        c.id: ("to", moves[c.id]) if c.id in moves else _class_default(c, by_id) for c in old_classes
    }

    # students: everyone active with an active enrollment this year
    people = (
        await db.execute(
            select(Enrollment, Student)
            .join(Student, Student.id == Enrollment.student_id)
            .where(
                Enrollment.academic_year_id == year.id,
                Enrollment.status == EnrollmentStatus.active.value,
                Student.status == StudentStatus.active.value,
            )
            .order_by(Student.first_name, Student.last_name, Student.scholar_no)
        )
    ).all()
    overrides = {}
    for d in plan.decisions:
        if d.student_id in overrides:
            problems.append(PlanProblem(code="duplicate_decision", message="A student has two decisions."))
        overrides[d.student_id] = d
    known = {s.id for _, s in people}
    if any(sid not in known for sid in overrides):
        problems.append(
            PlanProblem(code="unknown_student", message="A decision is for a student who is not in this rollover.")
        )

    missing: dict[str, int] = defaultdict(int)
    for enr, stu in people:
        old = by_id.get(enr.class_id)
        if old is None:
            continue
        ov = overrides.get(stu.id)
        kind, dest = defaults[old.id]
        decision = ov.decision if ov else (PromotionDecision.promote.value if kind != "pass" else "passed_out")
        item_dest: Key | None = None
        if decision == PromotionDecision.promote.value:
            if ov and ov.to_class:
                item_dest = _norm(ov.to_class.grade, ov.to_class.section)
            elif kind == "to":
                item_dest = dest
            else:
                missing[class_label(old)] += 1
        elif decision == PromotionDecision.repeat.value:
            item_dest = (
                _norm(ov.to_class.grade, ov.to_class.section) if ov and ov.to_class else (old.grade, old.section)
            )
        b.items.append(Item(enr, stu, old, decision, item_dest))
    for label, n in missing.items():
        problems.append(
            PlanProblem(
                code="no_destination",
                message=f"Class {label} has no next class ({n} students). Set where it goes or mark them passed out.",
            )
        )

    # which new classes are needed: every class's destination (even an empty class), every student's, extras
    needed: dict[Key, NewClass] = {}

    def need(key: Key) -> NewClass:
        nc = needed.get(key)
        if nc is None:
            nc = needed[key] = NewClass(grade=key[0], section=key[1])
        return nc

    for c in old_classes:
        kind, dest = defaults[c.id]
        if kind == "to" and dest:
            nc = need(dest)
            if c not in nc.feeders:
                nc.feeders.append(c)
    for it in b.items:
        if it.dest:
            nc = need(it.dest)
            nc.items.append(it)
            if it.old not in nc.feeders:
                nc.feeders.append(it.old)
    for ex in plan.extra_classes:
        nc = need(_norm(ex.grade, ex.section))
        if ex.capacity:
            nc.capacity = ex.capacity

    existing_new = {}
    if to_year is not None and to_year.status == YearStatus.draft.value:
        existing_new = {
            (c.grade, c.section): c
            for c in (await db.scalars(select(SchoolClass).where(SchoolClass.academic_year_id == to_year.id)))
        }
    extra_cap = {_norm(e.grade, e.section): e.capacity for e in plan.extra_classes if e.capacity}

    # per old class data used to fill new classes
    ids = [c.id for c in old_classes]
    subj_of: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for cid, sid in (await db.execute(select(ClassSubject.class_id, ClassSubject.subject_id))).all():
        if cid in by_id:
            subj_of[cid].append(sid)
    active_staff = {
        u.id
        for u in await db.scalars(
            select(User).where(User.kind == UserKind.staff.value, User.is_active.is_(True), User.deleted_at.is_(None))
        )
    }
    teach_of: dict[uuid.UUID, list[ClassStaff]] = defaultdict(list)
    for cs in await db.scalars(select(ClassStaff).where(ClassStaff.class_id.in_(ids) if ids else False)):
        if cs.staff_id in active_staff:
            teach_of[cs.class_id].append(cs)
    structure_of: dict[uuid.UUID, list[FeeStructure]] = defaultdict(list)
    for fs in await db.scalars(select(FeeStructure).where(FeeStructure.class_id.in_(ids) if ids else False)):
        structure_of[fs.class_id].append(fs)
    heads = {h.id: h for h in await db.scalars(select(FeeHead))}
    slot_counts = dict(
        (
            await db.execute(
                select(TimetableSlot.class_id, func.count())
                .where(TimetableSlot.class_id.in_(ids) if ids else False)
                .group_by(TimetableSlot.class_id)
            )
        ).all()
    )
    sub_override = {_norm(s.grade, s.section): list(dict.fromkeys(s.subject_ids)) for s in plan.subjects}
    asg_override: dict[Key, list] = defaultdict(list)
    for a in plan.assignments:
        asg_override[_norm(a.grade, a.section)].append(a)
    for a in plan.assignments:
        if a.staff_id and a.staff_id not in active_staff:
            problems.append(
                PlanProblem(code="bad_teacher", message="A teacher in the plan is not an active staff member.")
            )
            break

    new_existing_setup: dict[uuid.UUID, tuple[bool, bool, bool, int]] = {}
    if existing_new:
        nids = [c.id for c in existing_new.values()]
        has_sub = set((await db.scalars(select(ClassSubject.class_id).where(ClassSubject.class_id.in_(nids)))).all())
        staff_n = dict(
            (
                await db.execute(
                    select(ClassStaff.class_id, func.count())
                    .where(ClassStaff.class_id.in_(nids))
                    .group_by(ClassStaff.class_id)
                )
            ).all()
        )
        has_fee = set((await db.scalars(select(FeeStructure.class_id).where(FeeStructure.class_id.in_(nids)))).all())
        for c in existing_new.values():
            new_existing_setup[c.id] = (c.id in has_sub, c.id in staff_n, c.id in has_fee, int(staff_n.get(c.id, 0)))

    for key, nc in needed.items():
        nc.existing = existing_new.get(key)
        nc.grade_src = by_key.get(key) or next((c for c in old_classes if c.grade == key[0]), None)
        feeder = nc.feeders[0] if nc.feeders else None
        tmpl = by_key.get(key) or feeder
        nc.capacity = extra_cap.get(key) or (tmpl.capacity if tmpl else DEFAULT_CAPACITY)
        nc.is_custom = (not key[0].isdigit()) if not (by_key.get(key)) else by_key[key].is_custom
        nc.display_order = (
            by_key[key].display_order
            if key in by_key
            else int(key[0])
            if key[0].isdigit()
            else (feeder.display_order + 1 if feeder else 99)
        )
        if nc.existing:
            nc.capacity, nc.is_custom, nc.display_order = (
                nc.existing.capacity,
                nc.existing.is_custom,
                nc.existing.display_order,
            )
            has_sub, has_staff, has_fee, n_staff = new_existing_setup[nc.existing.id]
            nc.fill_subjects, nc.fill_teachers, nc.fill_fees = not has_sub, not has_staff, not has_fee
            nc.existing_slots_filled = n_staff

        src_fallback = nc.grade_src or feeder
        # subjects: the plan, else the same grade last year, else the class the students come from
        if key in sub_override:
            nc.subject_ids = sub_override[key]
        elif src_fallback:
            nc.subject_ids = list(subj_of.get(src_fallback.id, []))
        # teachers
        t_src = nc.grade_src if plan.teachers == "same" else feeder if plan.teachers == "move_up" else None
        if t_src is not None:
            for cs in teach_of.get(t_src.id, []):
                if cs.role == ClassRole.class_teacher.value:
                    nc.class_teacher = cs.staff_id
                elif cs.subject_id in nc.subject_ids:
                    nc.subject_teachers[cs.subject_id] = cs.staff_id
        for a in asg_override.get(key, []):
            if a.role == ClassRole.class_teacher.value:
                nc.class_teacher = a.staff_id
            elif a.subject_id not in nc.subject_ids:
                problems.append(
                    PlanProblem(
                        code="bad_assignment", message=f"Class {nc.label} does not study the subject you assigned."
                    )
                )
            elif a.staff_id is None:
                nc.subject_teachers.pop(a.subject_id, None)
            else:
                nc.subject_teachers[a.subject_id] = a.staff_id
        # timetable: copied from the class the teachers came from (or the same grade last year)
        if plan.timetable == "copy":
            nc.timetable_src = t_src or nc.grade_src
            nc.timetable_slots = int(slot_counts.get(nc.timetable_src.id, 0)) if nc.timetable_src else 0
        # fees: the same grade's amounts last year, raised and rounded; then the plan's cells
        fee_src = nc.grade_src or feeder
        lines: dict[uuid.UUID, tuple[int, str]] = {}
        for fs in structure_of.get(fee_src.id, []) if fee_src else []:
            lines[fs.fee_head_id] = (
                _round_fee(fs.amount_paise, plan.fees.increase_percent, plan.fees.round_to_paise),
                fs.frequency,
            )
        for cell in plan.fees.cells:
            if cell.grade.strip() != key[0] or (cell.section and cell.section.strip() != key[1]):
                continue
            h = heads.get(cell.fee_head_id)
            if h is None or h.scope != FeeScope.class_.value:
                problems.append(
                    PlanProblem(code="bad_fee_head", message="A fee head in the plan is not a class fee head.")
                )
            elif cell.amount_paise == 0:
                lines.pop(cell.fee_head_id, None)
            else:
                lines[cell.fee_head_id] = (
                    cell.amount_paise,
                    cell.frequency or lines.get(cell.fee_head_id, (0, "term"))[1],
                )
        nc.fees = lines

    # roll numbers restart in the new class
    for nc in needed.values():
        if plan.roll_order == "keep":
            order = sorted(
                nc.items,
                key=lambda i: (
                    i.old.display_order,
                    i.old.grade,
                    i.old.section,
                    i.enrollment.roll_no or 10**6,
                    i.student.first_name,
                ),
            )
        else:
            order = sorted(
                nc.items,
                key=lambda i: (i.student.first_name.lower(), i.student.last_name.lower(), i.student.scholar_no),
            )
        for n, it in enumerate(order, 1):
            it.roll_no = n
        if len(nc.items) > nc.capacity:
            b.warnings.append(
                f"Class {nc.label} will have {len(nc.items)} students (capacity {nc.capacity}); the capacity is raised."
            )
    b.new_classes = dict(sorted(needed.items(), key=lambda kv: (kv[1].display_order, kv[0][0], kv[0][1])))

    # dues and parents (one query each)
    sids = [i.student.id for i in b.items]
    if sids:
        m = (
            fee_base.invoice_money()
            .where(fee_base.FeeInvoice.closed_at.is_(None), fee_base.FeeInvoice.student_id.in_(sids))
            .subquery()
        )
        bal = m.c.total - m.c.paid
        counted = [i.student.id for i in b.items if plan.fees.dues == "carry" or i.decision != "leave"]
        dues = (
            await db.execute(
                select(func.count(func.distinct(m.c.student_id)), func.coalesce(func.sum(bal), 0)).where(
                    bal > 0, m.c.student_id.in_(counted)
                )
            )
        ).one()
        b.dues_students, b.dues_paise = int(dues[0]), int(dues[1])
        notified = [i.student.id for i in b.items if i.decision != "leave"]
        b.parents = (
            (
                await db.scalar(
                    select(func.count(func.distinct(Guardian.user_id)))
                    .join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id)
                    .where(StudentGuardian.student_id.in_(notified), Guardian.user_id.is_not(None))
                )
                or 0
            )
            if notified
            else 0
        )
        if b.dues_students and plan.fees.dues == "carry":
            b.warnings.append(f"{b.dues_students} students have unpaid dues; they follow the student to the new year.")
    if not b.items:
        b.warnings.append("There are no active students to roll over.")
    return b


# ------------------------------------------------------------------ preview
def to_preview(b: Built) -> RolloverPreview:
    classes = [
        NewClassOut(
            label=nc.label,
            grade=nc.grade,
            section=nc.section,
            capacity=max(nc.capacity, len(nc.items)),
            students=len(nc.items),
            exists=nc.existing is not None,
            from_classes=sorted(class_label(c) for c in nc.feeders),
            subjects=len(nc.subject_ids) if nc.fill_subjects else 0,
            teacher_slots=nc.slots,
            teacher_slots_filled=nc.slots_filled,
            timetable_slots=nc.timetable_slots,
            fee_total_paise=sum(a for a, _ in nc.fees.values()) if nc.fill_fees else 0,
        )
        for nc in b.new_classes.values()
    ]
    fi = b.plan.fees.first_invoice
    return RolloverPreview(
        from_year=b.from_year.name,
        to_year=b.to_name,
        to_year_exists=b.to_year is not None,
        starts_on=b.to_starts,
        ends_on=b.to_ends,
        promoted=b.count("promote"),
        staying=b.count("repeat"),
        leaving=b.count("leave"),
        passed_out=b.count("passed_out"),
        new_classes=classes,
        teacher_slots=sum(c.teacher_slots for c in classes),
        teacher_slots_filled=sum(c.teacher_slots_filled for c in classes),
        fee_total_paise=sum(c.fee_total_paise for c in classes),
        dues=DuesOut(mode=b.plan.fees.dues, students=b.dues_students, total_paise=b.dues_paise),
        first_invoices=fi is not None,
        parents_notified=b.parents,
        problems=b.problems,
        warnings=b.warnings,
        can_apply=not b.problems,
    )


def label_of(it: Item) -> str:
    return f"{full_name(it.student)} ({class_label(it.old)})"
