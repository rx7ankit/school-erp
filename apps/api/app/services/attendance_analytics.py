"""School-wide attendance analytics (erd v4). Computed from attendance_records, nothing stored.

Scope: admin and academic managers see the whole school; other teachers only the classes they are assigned to.
Teacher-wise numbers: admin, `academic.manage` and `staff.manage` see everyone, anyone else only their own row.
There is no per-subject attendance (it is marked once a day per class); "subject-wise" means results by subject.
"""

import uuid
from datetime import date

from sqlalchemy import Integer, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.academic import AcademicYear, ClassStaff, SchoolClass
from app.models.attendance import AttendanceDay, AttendanceRecord, StaffAttendance
from app.models.enums import ClassRole, EnrollmentStatus, Permission, UserKind, YearStatus
from app.models.student import Enrollment, Student
from app.models.user import User
from app.schemas.attendance import Analytics, BelowRow, ClassRow, TeacherRow, TrendPoint, WeekdayPoint
from app.services.attendance import not_holiday, pct, unit_columns
from app.services.students import class_label, full_name, visible_class_ids

R, D = AttendanceRecord, AttendanceDay


async def scoped_classes(db: AsyncSession, p: Principal, class_id: uuid.UUID | None = None) -> list[SchoolClass]:
    """Classes of the current year the caller may analyse (optionally just one; 404 if not allowed)."""
    stmt = (
        select(SchoolClass)
        .join(AcademicYear, AcademicYear.id == SchoolClass.academic_year_id)
        .where(AcademicYear.status == YearStatus.current.value)
        .order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section)
    )
    ids = visible_class_ids(p)
    if ids is not None:
        stmt = stmt.where(SchoolClass.id.in_(ids))
    if class_id:
        stmt = stmt.where(SchoolClass.id == class_id)
    rows = list((await db.scalars(stmt)).all())
    if class_id and not rows:
        raise NotFound("Class not found.")
    return rows


def _base(class_ids: list[uuid.UUID], from_on: date, to_on: date):
    return (D.class_id.in_(class_ids), D.day_on.between(from_on, to_on), not_holiday())


async def analytics(
    db: AsyncSession, p: Principal, from_on: date, to_on: date, class_id: uuid.UUID | None, threshold: float
) -> Analytics:
    classes = await scoped_classes(db, p, class_id)
    ids = [c.id for c in classes]
    where = _base(ids, from_on, to_on)

    tot = (
        await db.execute(select(*unit_columns()).select_from(R).join(D, D.id == R.attendance_day_id).where(*where))
    ).one()
    marked_days = await db.scalar(select(func.count(func.distinct(D.day_on))).select_from(D).where(*where)) or 0

    by_class_rows = (
        await db.execute(
            select(
                D.class_id,
                func.count(func.distinct(D.day_on)).label("days"),
                func.count(func.distinct(R.enrollment_id)).label("students"),
                *unit_columns(),
            )
            .select_from(R)
            .join(D, D.id == R.attendance_day_id)
            .where(*where)
            .group_by(D.class_id)
        )
    ).all()
    by_class = {r.class_id: r for r in by_class_rows}
    class_rows = []
    for c in classes:
        r = by_class.get(c.id)
        class_rows.append(
            ClassRow(
                class_id=c.id,
                class_label=class_label(c),
                students=int(r.students) if r else 0,
                working_days=int(r.days) if r else 0,
                percentage=pct(int(r.present), int(r.n)) if r else None,
            )
        )

    trend = (
        await db.execute(
            select(D.day_on, *unit_columns())
            .select_from(R)
            .join(D, D.id == R.attendance_day_id)
            .where(*where)
            .group_by(D.day_on)
            .order_by(D.day_on)
        )
    ).all()
    weekday = (
        await db.execute(
            select(extract("isodow", D.day_on).cast(Integer).label("wd"), *unit_columns())
            .select_from(R)
            .join(D, D.id == R.attendance_day_id)
            .where(*where)
            .group_by("wd")
            .order_by("wd")
        )
    ).all()

    return Analytics(
        from_on=from_on,
        to_on=to_on,
        overall_percentage=pct(int(tot.present), int(tot.n)),
        marked_days=marked_days,
        by_class=class_rows,
        trend=[TrendPoint(day_on=r.day_on, percentage=pct(int(r.present), int(r.n))) for r in trend],
        by_weekday=[WeekdayPoint(weekday=r.wd, percentage=pct(int(r.present), int(r.n))) for r in weekday],
        students_below_threshold=len(await _below(db, ids, from_on, to_on, threshold)),
        threshold=threshold,
    )


async def _below(db: AsyncSession, class_ids: list[uuid.UUID], from_on: date, to_on: date, threshold: float):
    per = (
        select(R.enrollment_id.label("eid"), D.class_id.label("cid"), *unit_columns())
        .join(D, D.id == R.attendance_day_id)
        .where(*_base(class_ids, from_on, to_on))
        .group_by(R.enrollment_id, D.class_id)
        .subquery()
    )
    ratio = per.c.present * 100.0 / (2 * per.c.n)
    rows = (
        await db.execute(
            select(Student, per.c.cid, per.c.n, per.c.present)
            .select_from(per)
            .join(Enrollment, Enrollment.id == per.c.eid)
            .join(Student, Student.id == Enrollment.student_id)
            .where(per.c.n > 0, ratio < threshold, Enrollment.status == EnrollmentStatus.active.value)
            .order_by(ratio, Student.first_name)
        )
    ).all()
    return rows


async def students_below(
    db: AsyncSession, p: Principal, from_on: date, to_on: date, class_id: uuid.UUID | None, threshold: float
) -> list[BelowRow]:
    classes = await scoped_classes(db, p, class_id)
    labels = {c.id: class_label(c) for c in classes}
    rows = await _below(db, list(labels), from_on, to_on, threshold)
    return [
        BelowRow(
            student_id=s.id,
            name=full_name(s),
            scholar_no=s.scholar_no,
            class_id=cid,
            class_label=labels[cid],
            working_days=int(n),
            percentage=pct(int(present), int(n)) or 0.0,
        )
        for s, cid, n, present in rows
    ]


async def teachers(db: AsyncSession, p: Principal, from_on: date, to_on: date) -> list[TeacherRow]:
    """Per teacher: the classes they teach, the attendance of the classes they are class teacher of, and their own
    attendance (from staff_attendance)."""
    see_all = p.has(Permission.academic.value) or p.has(Permission.staff.value)
    users = select(User).where(
        User.school_id == p.school_id,
        User.kind == UserKind.staff.value,
        User.is_active.is_(True),
        User.deleted_at.is_(None),
    )
    if not see_all:
        users = users.where(User.id == p.user_id)
    staff = list((await db.scalars(users.order_by(User.name))).all())
    ids = [u.id for u in staff]

    assigned = (
        await db.execute(
            select(ClassStaff.staff_id, ClassStaff.role, SchoolClass)
            .join(SchoolClass, SchoolClass.id == ClassStaff.class_id)
            .join(AcademicYear, AcademicYear.id == SchoolClass.academic_year_id)
            .where(AcademicYear.status == YearStatus.current.value, ClassStaff.staff_id.in_(ids))
        )
    ).all()
    taught: dict[uuid.UUID, dict[uuid.UUID, SchoolClass]] = {}
    owned: dict[uuid.UUID, dict[uuid.UUID, SchoolClass]] = {}
    for staff_id, role, c in assigned:
        taught.setdefault(staff_id, {})[c.id] = c
        if role == ClassRole.class_teacher.value:
            owned.setdefault(staff_id, {})[c.id] = c

    class_units = {
        r.class_id: r
        for r in (
            await db.execute(
                select(D.class_id, *unit_columns())
                .select_from(R)
                .join(D, D.id == R.attendance_day_id)
                .where(D.day_on.between(from_on, to_on), not_holiday())
                .group_by(D.class_id)
            )
        ).all()
    }
    own = {
        (r.staff_id, r.status): r.n
        for r in (
            await db.execute(
                select(StaffAttendance.staff_id, StaffAttendance.status, func.count().label("n"))
                .where(StaffAttendance.staff_id.in_(ids), StaffAttendance.day_on.between(from_on, to_on))
                .group_by(StaffAttendance.staff_id, StaffAttendance.status)
            )
        ).all()
    }
    out = []
    for u in staff:
        mine = owned.get(u.id, {})
        n = sum(int(class_units[c].n) for c in mine if c in class_units)
        present = sum(int(class_units[c].present) for c in mine if c in class_units)
        counts = {k: own.get((u.id, k), 0) for k in ("present", "absent", "leave")}
        out.append(
            TeacherRow(
                staff_id=u.id,
                name=u.name,
                classes=sorted(class_label(c) for c in taught.get(u.id, {}).values()),
                class_teacher_of=sorted(class_label(c) for c in mine.values()),
                class_attendance_percentage=pct(present, n),
                days_marked=sum(counts.values()),
                days_present=counts["present"],
                days_absent=counts["absent"],
                days_leave=counts["leave"],
            )
        )
    return out
