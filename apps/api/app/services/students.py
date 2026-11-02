"""Students: lookups, who may see whom, the lifecycle (left, rejoin, transfer) and the history timeline.

Helpers other modules should use: `get_student_or_404`, `class_of_student`, `current_enrollment`,
`assert_can_view_student`, `visible_class_ids`, `add_student_event`, `mark_tc_issued`, `mark_passed_out`.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.principal import Principal
from app.models.academic import AcademicYear, SchoolClass
from app.models.enums import AuditCategory, EnrollmentStatus, Permission, StudentStatus, YearStatus
from app.models.student import Enrollment, Guardian, Student, StudentEvent, StudentGuardian
from app.services.audit import Actor, change, log_audit


def full_name(s: Student) -> str:
    return f"{s.first_name} {s.last_name}".strip()


def class_label(c: SchoolClass) -> str:
    return f"{c.grade}-{c.section}"


def student_label(s: Student) -> str:
    return f"{full_name(s)} ({s.scholar_no})"


# ------------------------------------------------------------------ lookups
async def get_student_or_404(db: AsyncSession, student_id: uuid.UUID) -> Student:
    s = await db.get(Student, student_id)
    if s is None:
        raise NotFound("Student not found.")
    return s


async def get_class_or_404(db: AsyncSession, class_id: uuid.UUID) -> SchoolClass:
    c = await db.get(SchoolClass, class_id)
    if c is None:
        raise NotFound("Class not found.")
    return c


async def current_year_or_none(db: AsyncSession) -> AcademicYear | None:
    return await db.scalar(select(AcademicYear).where(AcademicYear.status == YearStatus.current.value))


async def current_enrollment(db: AsyncSession, student_id: uuid.UUID, *, active_only: bool = True) -> Enrollment | None:
    """The student's enrollment in the current academic year (the active one unless `active_only` is False)."""
    stmt = (
        select(Enrollment)
        .join(AcademicYear, AcademicYear.id == Enrollment.academic_year_id)
        .where(Enrollment.student_id == student_id, AcademicYear.status == YearStatus.current.value)
    )
    if active_only:
        stmt = stmt.where(Enrollment.status == EnrollmentStatus.active.value)
    return await db.scalar(stmt)


async def class_of_student(db: AsyncSession, student_id: uuid.UUID, *, active_only: bool = True) -> SchoolClass | None:
    """The class a student is in this year, or None (left, passed out, or not yet placed)."""
    e = await current_enrollment(db, student_id, active_only=active_only)
    return await db.get(SchoolClass, e.class_id) if e else None


# ------------------------------------------------------------------ who may see which student
def can_read_all_students(p: Principal) -> bool:
    """Admin, academic managers and fees staff see every student. Teachers see their own classes."""
    return p.is_staff and (p.has(Permission.academic.value) or p.has(Permission.fees.value))


def visible_class_ids(p: Principal) -> set[uuid.UUID] | None:
    """None means every class. Otherwise the classes this staff member is assigned to (class or subject teacher)."""
    if can_read_all_students(p):
        return None
    return {a.class_id for a in p.assignments}


async def assert_can_view_student(db: AsyncSession, p: Principal, student: Student) -> None:
    """Staff: all students if allowed, else students of an assigned class. Parents: see `assert_parent_child`."""
    if not p.is_staff:
        raise Forbidden("This is for school staff.", code="staff_only")
    ids = visible_class_ids(p)
    if ids is None:
        return
    e = await current_enrollment(db, student.id, active_only=False)
    if e is None or e.class_id not in ids:
        raise NotFound("Student not found.")  # not 403: do not reveal that the child exists


# ------------------------------------------------------------------ history
def add_student_event(
    db: AsyncSession,
    actor: Actor,
    student: Student,
    kind: str,
    *,
    from_class_id: uuid.UUID | None = None,
    to_class_id: uuid.UUID | None = None,
    academic_year_id: uuid.UUID | None = None,
    effective_on: date | None = None,
    reason: str | None = None,
) -> StudentEvent:
    """kind: admitted, promoted, detained, class_changed, left, tc_issued, rejoined, passed_out."""
    ev = StudentEvent(
        school_id=student.school_id,
        student_id=student.id,
        kind=kind,
        from_class_id=from_class_id,
        to_class_id=to_class_id,
        academic_year_id=academic_year_id,
        effective_on=effective_on or today_ist(),
        reason=reason,
        recorded_by=actor.id,
        recorded_at=utcnow(),
    )
    db.add(ev)
    return ev


# ------------------------------------------------------------------ capacity and roll numbers
async def ensure_capacity(db: AsyncSession, cls: SchoolClass, *, exclude_student_id: uuid.UUID | None = None) -> None:
    """One more active student must fit. Locks the class row so two enrolments cannot both take the last seat."""
    await db.execute(select(SchoolClass.id).where(SchoolClass.id == cls.id).with_for_update())
    stmt = (
        select(func.count())
        .select_from(Enrollment)
        .where(Enrollment.class_id == cls.id, Enrollment.status == EnrollmentStatus.active.value)
    )
    if exclude_student_id:
        stmt = stmt.where(Enrollment.student_id != exclude_student_id)
    if (await db.scalar(stmt) or 0) >= cls.capacity:
        raise Conflict(
            f"Class {class_label(cls)} is full ({cls.capacity} students).",
            code="class_full",
            details={"class_id": str(cls.id), "capacity": cls.capacity},
        )


async def next_roll_no(db: AsyncSession, class_id: uuid.UUID) -> int:
    top = await db.scalar(
        select(func.max(Enrollment.roll_no)).where(
            Enrollment.class_id == class_id, Enrollment.status == EnrollmentStatus.active.value
        )
    )
    return (top or 0) + 1


async def next_scholar_no(db: AsyncSession, school_id: uuid.UUID) -> str:
    """Next number for the school: highest all-digit scholar number + 1. Serialised per school."""
    await db.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(str(school_id), 0))))
    rows = (await db.scalars(select(Student.scholar_no).where(Student.school_id == school_id))).all()
    digits = [r for r in rows if r.isdigit()]
    top = max((int(r) for r in digits), default=0)
    width = max((len(r) for r in digits), default=0)
    return str(top + 1).zfill(width)


async def scholar_no_taken(db: AsyncSession, scholar_no: str, *, except_id: uuid.UUID | None = None) -> bool:
    stmt = select(func.count()).select_from(Student).where(Student.scholar_no == scholar_no)
    if except_id:
        stmt = stmt.where(Student.id != except_id)
    return bool(await db.scalar(stmt))


# ------------------------------------------------------------------ editing
EDITABLE = (
    "scholar_no",
    "first_name",
    "last_name",
    "dob",
    "gender",
    "address",
    "blood_group",
    "category",
    "samagra_id",
    "pen",
    "previous_school",
    "medical_notes",
    "emergency_name",
    "emergency_phone",
    "admitted_on",
)


async def edit_student(db: AsyncSession, actor: Actor, student: Student, values: dict) -> None:
    changes = []
    for field in EDITABLE:
        if field not in values:
            continue
        v = values[field]
        if isinstance(v, str):
            v = v.strip()
        if field in ("first_name", "scholar_no") and not v:
            raise AppError("This cannot be empty.", code="validation_error", status=422)
        if field == "last_name":
            v = v or ""
        elif v == "":
            v = None
        old = getattr(student, field)
        if v == old:
            continue
        if field == "scholar_no" and await scholar_no_taken(db, v, except_id=student.id):
            raise Conflict(f"Scholar number {v} is already used.", code="scholar_no_taken")
        changes.append(change(field.replace("_", " ").title(), old, v))
        setattr(student, field, v)
    if changes:
        await db.flush()
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "student.edited",
            f"Updated record of {student_label(student)}",
            entity_type="student",
            entity_id=student.id,
            entity_label=full_name(student),
            changes=changes,
            sensitive=any(c["field"] == "Scholar No" for c in changes),
        )


# ------------------------------------------------------------------ lifecycle
async def mark_left(db: AsyncSession, actor: Actor, student: Student, *, left_on: date | None, reason: str) -> None:
    if student.status != StudentStatus.active.value:
        raise Conflict("This student is not active.", code="not_active")
    on = left_on or today_ist()
    enr = await current_enrollment(db, student.id)
    if enr:
        enr.status, enr.ended_on = EnrollmentStatus.left.value, on
    student.status, student.left_on, student.leaving_reason = StudentStatus.left.value, on, reason.strip()
    add_student_event(
        db,
        actor,
        student,
        "left",
        from_class_id=enr.class_id if enr else None,
        academic_year_id=enr.academic_year_id if enr else None,
        effective_on=on,
        reason=reason,
    )
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student.left",
        f"Marked {student_label(student)} as left: {reason.strip()}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
        changes=[change("Status", StudentStatus.active.value, StudentStatus.left.value)],
    )
    await db.flush()


async def rejoin(
    db: AsyncSession, actor: Actor, student: Student, *, class_id: uuid.UUID, on: date | None, reason: str | None
) -> Enrollment:
    if student.status not in (StudentStatus.left.value, StudentStatus.tc_issued.value):
        raise Conflict("Only a student who has left can rejoin.", code="not_left")
    cls = await get_class_or_404(db, class_id)
    year = await db.get(AcademicYear, cls.academic_year_id)
    if year is None or year.status == YearStatus.completed.value:
        raise Conflict("That class belongs to a completed year.", code="year_completed")
    await ensure_capacity(db, cls, exclude_student_id=student.id)
    on = on or today_ist()
    enr = await db.scalar(
        select(Enrollment).where(Enrollment.student_id == student.id, Enrollment.academic_year_id == year.id)
    )
    if enr is None:
        enr = Enrollment(school_id=student.school_id, student_id=student.id, academic_year_id=year.id)
        db.add(enr)
    enr.class_id, enr.status, enr.started_on, enr.ended_on = cls.id, EnrollmentStatus.active.value, on, None
    enr.roll_no = await next_roll_no(db, cls.id)
    student.status, student.left_on, student.leaving_reason = StudentStatus.active.value, None, None
    add_student_event(
        db, actor, student, "rejoined", to_class_id=cls.id, academic_year_id=year.id, effective_on=on, reason=reason
    )
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student.rejoined",
        f"{student_label(student)} rejoined Class {class_label(cls)}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
        changes=[change("Status", "left", "active")],
    )
    await db.flush()
    return enr


async def transfer(
    db: AsyncSession,
    actor: Actor,
    student: Student,
    *,
    class_id: uuid.UUID,
    effective_on: date | None,
    reason: str | None,
) -> Enrollment:
    """Move an active student to another section or class within the same academic year."""
    enr = await current_enrollment(db, student.id)
    if student.status != StudentStatus.active.value or enr is None:
        raise Conflict("Only an active student with a class can be moved.", code="not_active")
    target = await get_class_or_404(db, class_id)
    if target.academic_year_id != enr.academic_year_id:
        raise Conflict("A transfer stays within the same academic year.", code="other_year")
    if target.id == enr.class_id:
        raise Conflict("The student is already in that class.", code="same_class")
    old = await db.get(SchoolClass, enr.class_id)
    await ensure_capacity(db, target, exclude_student_id=student.id)
    on = effective_on or today_ist()
    enr.class_id, enr.roll_no = target.id, await next_roll_no(db, target.id)
    add_student_event(
        db,
        actor,
        student,
        "class_changed",
        from_class_id=old.id if old else None,
        to_class_id=target.id,
        academic_year_id=enr.academic_year_id,
        effective_on=on,
        reason=reason,
    )
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student.transferred",
        f"Moved {student_label(student)} from Class {class_label(old) if old else '-'} to Class {class_label(target)}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        changes=[change("Class", class_label(old) if old else "", class_label(target))],
    )
    await db.flush()
    return enr


async def mark_tc_issued(db: AsyncSession, actor: Actor, student: Student, *, tc_number: str) -> None:
    """For the certificates module: a TC makes the student `tc_issued` and closes the enrollment if still open."""
    prev = student.status
    enr = await current_enrollment(db, student.id)
    if enr:
        enr.status, enr.ended_on = EnrollmentStatus.left.value, enr.ended_on or today_ist()
    student.status, student.tc_number = StudentStatus.tc_issued.value, tc_number
    student.left_on = student.left_on or today_ist()
    add_student_event(db, actor, student, "tc_issued", reason=f"TC {tc_number}")
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student.tc_issued",
        f"Transfer certificate {tc_number} issued to {student_label(student)}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
        changes=[change("Status", prev, student.status)],
    )
    await db.flush()


async def mark_passed_out(
    db: AsyncSession, actor: Actor, student: Student, *, effective_on: date | None = None, log: bool = True
) -> None:
    """For year-end rollover: the last grade finished. Closes the active enrollment as `passed_out`."""
    on = effective_on or today_ist()
    enr = await current_enrollment(db, student.id)
    if enr:
        enr.status, enr.ended_on = EnrollmentStatus.passed_out.value, on
    student.status = StudentStatus.passed_out.value
    add_student_event(
        db,
        actor,
        student,
        "passed_out",
        from_class_id=enr.class_id if enr else None,
        academic_year_id=enr.academic_year_id if enr else None,
        effective_on=on,
    )
    if log:
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "student.passed_out",
            f"{student_label(student)} passed out",
            entity_type="student",
            entity_id=student.id,
            entity_label=full_name(student),
            changes=[change("Status", "active", "passed_out")],
        )
    await db.flush()


# ------------------------------------------------------------------ the list query (also used by the export)
@dataclass
class StudentFilter:
    q: str | None = None
    class_id: uuid.UUID | None = None
    grade: str | None = None
    status: str | None = "active"  # "all" for every status
    year_id: uuid.UUID | None = None  # default: the current year


async def students_query(db: AsyncSession, p: Principal, f: StudentFilter):
    """Student + that year's enrollment + class, filtered and limited to what `p` may see."""
    year_id = f.year_id
    if year_id is None:
        y = await current_year_or_none(db)
        year_id = y.id if y else None
    stmt = (
        select(Student, Enrollment, SchoolClass)
        .outerjoin(Enrollment, and_(Enrollment.student_id == Student.id, Enrollment.academic_year_id == year_id))
        .outerjoin(SchoolClass, SchoolClass.id == Enrollment.class_id)
    )
    scope = visible_class_ids(p)
    if scope is not None:
        stmt = stmt.where(Enrollment.class_id.in_(scope))
    if f.status and f.status != "all":
        stmt = stmt.where(Student.status == f.status)
    if f.class_id:
        stmt = stmt.where(Enrollment.class_id == f.class_id)
    if f.grade:
        stmt = stmt.where(SchoolClass.grade == f.grade)
    if f.q and f.q.strip():
        like = f"%{f.q.strip()}%"
        by_guardian = (
            select(StudentGuardian.student_id)
            .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
            .where(or_(Guardian.name.ilike(like), Guardian.phone.ilike(like)))
        )
        stmt = stmt.where(
            or_(
                Student.scholar_no.ilike(like),
                func.concat(Student.first_name, " ", Student.last_name).ilike(like),
                Student.id.in_(by_guardian),
            )
        )
    return stmt.order_by(
        SchoolClass.display_order, SchoolClass.grade, SchoolClass.section, Enrollment.roll_no, Student.first_name
    )


async def guardian_summary_map(db: AsyncSession, student_ids: list[uuid.UUID]) -> dict[uuid.UUID, Guardian]:
    """student id -> primary guardian (or the first one), for lists and exports."""
    if not student_ids:
        return {}
    rows = (
        await db.execute(
            select(StudentGuardian.student_id, StudentGuardian.is_primary, Guardian)
            .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
            .where(StudentGuardian.student_id.in_(student_ids))
            .order_by(StudentGuardian.is_primary.desc(), Guardian.name)
        )
    ).all()
    out: dict[uuid.UUID, Guardian] = {}
    for sid, _, g in rows:
        out.setdefault(sid, g)
    return out
