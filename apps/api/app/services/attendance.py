"""Class attendance: the daily sheet, saving and editing it, and the computed statistics.

Rules (docs/erd.md, v2): one `attendance_days` row per class per school day, one `attendance_records` row per
enrolled student with a mark for each half. A day is worth (present halves) / 2. `leave` counts as not present
but is shown separately. Working days = days marked, minus holidays (`holidays.kind = holiday`). Statistics are
computed here, never stored. A student who left gets no new records; old ones stay.

Helpers other modules should use: `student_stats`, `class_stats`, `period_stats_for_enrollment` (report cards),
`holiday_exists`, `Units`, `to_stats`, `not_holiday`, `resolve_period`.
"""

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import Integer, case, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.config import settings
from app.core.errors import AppError, Conflict, Forbidden
from app.core.principal import Principal
from app.models.academic import AcademicYear, SchoolClass
from app.models.attendance import AttendanceDay, AttendanceRecord, Holiday, LeaveRequest
from app.models.enums import (
    AttendanceMark,
    AuditCategory,
    EnrollmentStatus,
    HolidayKind,
    LeaveStatus,
    Permission,
    StudentStatus,
    YearStatus,
)
from app.models.student import Enrollment, Student
from app.models.user import User
from app.schemas.attendance import (
    Calendar,
    CalendarDay,
    ClassStats,
    DaySummary,
    HolidayOut,
    RecordIn,
    Sheet,
    SheetStudent,
    Stats,
    StudentStats,
)
from app.services.audit import Actor, change, log_audit
from app.services.students import class_label, full_name, get_class_or_404, visible_class_ids

PRESENT, ABSENT, LEAVE = (m.value for m in AttendanceMark)
MAX_PERIOD_DAYS = 800


# ------------------------------------------------------------------ notification hooks (wired later)
async def _notify_attendance_saved(
    db: AsyncSession, school_class: SchoolClass, day_on: date, outcomes: list[tuple[Student, str]]
) -> None:
    """NOTIFY: attendance saved. One notification per parent of each student in `outcomes`.
    outcome is "present", "absent" (both halves not present), "first_half_only" or "second_half_only".
    Texts (erd v5): "{Name} is present today", "{Name} is absent today", "{Name} attended the first half only",
    "{Name} attended the second half only". A re-save the same day must REPLACE the earlier notifications
    instead of sending twice. Called only when day_on is today. Skip children who have left (the outcomes only
    hold active students already). Does nothing until the notifications service is wired."""
    return None


# ------------------------------------------------------------------ computed statistics
@dataclass
class Units:
    """Raw counts for a set of marked student-days. Half marks are counted in halves ('units')."""

    days: int = 0
    present: int = 0  # present halves
    absent: int = 0  # absent halves
    leave: int = 0  # leave halves
    full: int = 0
    half: int = 0
    late: int = 0

    def __add__(self, o: "Units") -> "Units":
        return Units(*(a + b for a, b in zip(self.__dict__.values(), o.__dict__.values(), strict=True)))


def pct(present_halves: int, days: int) -> float | None:
    return round(present_halves * 100 / (2 * days), 2) if days else None


def to_stats(u: Units) -> Stats:
    return Stats(
        working_days=u.days,
        present_days=u.present / 2,
        absent_days=u.absent / 2,
        leave_days=u.leave / 2,
        full_days=u.full,
        half_days=u.half,
        late_days=u.late,
        percentage=pct(u.present, u.days),
    )


def _halves(kind: str):
    R = AttendanceRecord
    return case((R.first_half == kind, 1), else_=0) + case((R.second_half == kind, 1), else_=0)


def unit_columns() -> list:
    """Aggregate columns over attendance_records: n, present, absent, leave, full, half, late."""
    R = AttendanceRecord
    present = _halves(PRESENT)
    return [
        func.count(R.id).label("n"),
        func.coalesce(func.sum(present), 0).label("present"),
        func.coalesce(func.sum(_halves(ABSENT)), 0).label("absent"),
        func.coalesce(func.sum(_halves(LEAVE)), 0).label("leave"),
        func.coalesce(func.sum(case((present == 2, 1), else_=0)), 0).label("full"),
        func.coalesce(func.sum(case((present == 1, 1), else_=0)), 0).label("half"),
        func.coalesce(func.sum(case((R.late.is_(True), 1), else_=0).cast(Integer)), 0).label("late"),
    ]


def units_of(row) -> Units:
    return Units(
        int(row.n or 0),
        int(row.present or 0),
        int(row.absent or 0),
        int(row.leave or 0),
        int(row.full or 0),
        int(row.half or 0),
        int(row.late or 0),
    )


def not_holiday():
    """SQL condition: the attendance day is not a holiday (exam and event days still count as school days)."""
    return ~exists().where(
        Holiday.kind == HolidayKind.holiday.value,
        Holiday.from_on <= AttendanceDay.day_on,
        Holiday.to_on >= AttendanceDay.day_on,
    )


async def holiday_exists(db: AsyncSession, day_on: date) -> Holiday | None:
    return await db.scalar(
        select(Holiday)
        .where(Holiday.kind == HolidayKind.holiday.value, Holiday.from_on <= day_on, Holiday.to_on >= day_on)
        .order_by(Holiday.from_on)
        .limit(1)
    )


def parse_month(month: str) -> tuple[date, date]:
    try:
        y, m = (int(x) for x in month.split("-"))
        first = date(y, m, 1)
    except (ValueError, TypeError):
        raise AppError("Month must look like 2026-11.", code="invalid_month", status=422) from None
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return first, nxt - timedelta(days=1)


async def resolve_period(
    db: AsyncSession, from_on: date | None, to_on: date | None, month: str | None = None
) -> tuple[date, date]:
    """`month` (2026-11) wins. Otherwise from/to; the default is the current academic year up to today."""
    if month:
        return parse_month(month)
    today = today_ist()
    if from_on is None:
        year = await db.scalar(select(AcademicYear).where(AcademicYear.status == YearStatus.current.value))
        from_on = year.starts_on if year else today - timedelta(days=365)
    to_on = to_on or today
    if from_on > to_on:
        raise AppError("The start date is after the end date.", code="invalid_period", status=422)
    if (to_on - from_on).days > MAX_PERIOD_DAYS:
        raise AppError("Please pick a shorter period.", code="period_too_long", status=422)
    return from_on, to_on


async def student_units(db: AsyncSession, student_id: uuid.UUID, from_on: date, to_on: date) -> Units:
    row = (
        await db.execute(
            select(*unit_columns())
            .select_from(AttendanceRecord)
            .join(AttendanceDay, AttendanceDay.id == AttendanceRecord.attendance_day_id)
            .join(Enrollment, Enrollment.id == AttendanceRecord.enrollment_id)
            .where(Enrollment.student_id == student_id, AttendanceDay.day_on.between(from_on, to_on), not_holiday())
        )
    ).one()
    return units_of(row)


async def student_stats(db: AsyncSession, student_id: uuid.UUID, from_on: date, to_on: date) -> Stats:
    """A student's statistics for a period, across all their enrollments."""
    return to_stats(await student_units(db, student_id, from_on, to_on))


async def period_stats_for_enrollment(db: AsyncSession, enrollment_id: uuid.UUID, from_on: date, to_on: date) -> Stats:
    """For report cards: attendance of one enrollment (one year in one class) over a period."""
    row = (
        await db.execute(
            select(*unit_columns())
            .select_from(AttendanceRecord)
            .join(AttendanceDay, AttendanceDay.id == AttendanceRecord.attendance_day_id)
            .where(
                AttendanceRecord.enrollment_id == enrollment_id,
                AttendanceDay.day_on.between(from_on, to_on),
                not_holiday(),
            )
        )
    ).one()
    return to_stats(units_of(row))


async def class_stats(
    db: AsyncSession, school_class: SchoolClass, from_on: date, to_on: date, threshold: float = 75.0
) -> ClassStats:
    R, D = AttendanceRecord, AttendanceDay
    per = (
        select(R.enrollment_id.label("enrollment_id"), *unit_columns())
        .join(D, D.id == R.attendance_day_id)
        .where(D.class_id == school_class.id, D.day_on.between(from_on, to_on), not_holiday())
        .group_by(R.enrollment_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Enrollment, Student, per)
            .join(Student, Student.id == Enrollment.student_id)
            .outerjoin(per, per.c.enrollment_id == Enrollment.id)
            .where(Enrollment.class_id == school_class.id)
            .order_by(Enrollment.roll_no.is_(None), Enrollment.roll_no, Student.first_name, Student.last_name)
        )
    ).all()
    out: list[StudentStats] = []
    total = Units()
    for r in rows:
        e, s = r[0], r[1]
        u = units_of(r)
        if e.status != EnrollmentStatus.active.value and u.days == 0:
            continue  # someone who left before any attendance was taken
        total = total + u
        p = pct(u.present, u.days)
        out.append(
            StudentStats(
                **to_stats(u).model_dump(),
                student_id=s.id,
                name=full_name(s),
                scholar_no=s.scholar_no,
                roll_no=e.roll_no,
                status=e.status,
                below_threshold=p is not None and p < threshold,
            )
        )
    return ClassStats(
        class_id=school_class.id,
        class_label=class_label(school_class),
        from_on=from_on,
        to_on=to_on,
        threshold=threshold,
        summary=to_stats(total),
        students=out,
    )


async def class_days(db: AsyncSession, school_class: SchoolClass, from_on: date, to_on: date) -> list[DaySummary]:
    R, D = AttendanceRecord, AttendanceDay
    holiday = exists().where(
        Holiday.kind == HolidayKind.holiday.value, Holiday.from_on <= D.day_on, Holiday.to_on >= D.day_on
    )
    rows = (
        await db.execute(
            select(D.day_on, D.marked_at, User.name, holiday.label("is_holiday"), *unit_columns())
            .select_from(D)
            .join(R, R.attendance_day_id == D.id)
            .join(User, User.id == D.marked_by)
            .where(D.class_id == school_class.id, D.day_on.between(from_on, to_on))
            .group_by(D.id, User.name)
            .order_by(D.day_on.desc())
        )
    ).all()
    return [
        DaySummary(
            day_on=r.day_on,
            students=r.n,
            present_days=int(r.present) / 2,
            percentage=pct(int(r.present), r.n),
            marked_by=r.name,
            marked_at=r.marked_at,
            is_holiday=bool(r.is_holiday),
        )
        for r in rows
    ]


def day_status(first: str, second: str) -> str:
    if first == PRESENT and second == PRESENT:
        return "full"
    if PRESENT in (first, second):
        return "half"
    return "leave" if LEAVE in (first, second) and ABSENT not in (first, second) else "absent"


async def calendar(db: AsyncSession, student_id: uuid.UUID, month: str) -> Calendar:
    """One child's month: every date with the marks, the holidays, and the month's statistics."""
    first, last = parse_month(month)
    R, D = AttendanceRecord, AttendanceDay
    rows = (
        await db.execute(
            select(D.day_on, R)
            .join(R, R.attendance_day_id == D.id)
            .join(Enrollment, Enrollment.id == R.enrollment_id)
            .where(Enrollment.student_id == student_id, D.day_on.between(first, last))
        )
    ).all()
    marks = {r[0]: r[1] for r in rows}
    holidays = (
        await db.scalars(
            select(Holiday).where(Holiday.from_on <= last, Holiday.to_on >= first).order_by(Holiday.from_on)
        )
    ).all()
    days: list[CalendarDay] = []
    d = first
    while d <= last:
        rec = marks.get(d)
        h = next((x for x in holidays if x.kind == HolidayKind.holiday.value and x.from_on <= d <= x.to_on), None)
        days.append(
            CalendarDay(
                day_on=d,
                status=day_status(rec.first_half, rec.second_half) if rec else "not_marked",
                first_half=rec.first_half if rec else None,
                second_half=rec.second_half if rec else None,
                late=bool(rec and rec.late),
                note=rec.note if rec else None,
                holiday=h.title if h else None,
            )
        )
        d += timedelta(days=1)
    return Calendar(
        student_id=student_id,
        month=month,
        days=days,
        holidays=[HolidayOut.model_validate(h) for h in holidays],
        stats=await student_stats(db, student_id, first, last),
    )


# ------------------------------------------------------------------ the daily sheet
def assert_can_view_class(p: Principal, class_id: uuid.UUID) -> None:
    ids = visible_class_ids(p)
    if ids is not None and class_id not in ids:
        raise Forbidden("This is not one of your classes.", code="not_your_class")


async def _active_enrollments(db: AsyncSession, class_id: uuid.UUID, *, lock: bool = False):
    stmt = (
        select(Enrollment, Student)
        .join(Student, Student.id == Enrollment.student_id)
        .where(
            Enrollment.class_id == class_id,
            Enrollment.status == EnrollmentStatus.active.value,
            Student.status == StudentStatus.active.value,
        )
        .order_by(Enrollment.roll_no.is_(None), Enrollment.roll_no, Student.first_name, Student.last_name)
    )
    if lock:
        stmt = stmt.with_for_update(of=Enrollment)
    return (await db.execute(stmt)).all()


async def approved_leave_on(
    db: AsyncSession, student_ids: list[uuid.UUID], day_on: date
) -> dict[uuid.UUID, LeaveRequest]:
    if not student_ids:
        return {}
    rows = await db.scalars(
        select(LeaveRequest)
        .where(
            LeaveRequest.student_id.in_(student_ids),
            LeaveRequest.status == LeaveStatus.approved.value,
            LeaveRequest.from_on <= day_on,
            LeaveRequest.to_on >= day_on,
        )
        .order_by(LeaveRequest.created_at)
    )
    out: dict[uuid.UUID, LeaveRequest] = {}
    for lr in rows:
        out.setdefault(lr.student_id, lr)
    return out


def leave_marks(lr: LeaveRequest | None) -> tuple[str, str]:
    """What an approved leave pre-selects: the whole day, or just the half it names."""
    if lr is None:
        return PRESENT, PRESENT
    return (
        LEAVE if lr.half in ("none", "first") else PRESENT,
        LEAVE if lr.half in ("none", "second") else PRESENT,
    )


def _within_edit_window(p: Principal, day_on: date) -> bool:
    return p.has(Permission.academic.value) or (today_ist() - day_on).days <= settings.attendance_edit_window_days


def _check_markable(day_on: date) -> None:
    if day_on > today_ist():
        raise AppError("Attendance cannot be marked for a future date.", code="future_date", status=422)


async def _check_year(db: AsyncSession, school_class: SchoolClass, day_on: date) -> None:
    year = await db.get(AcademicYear, school_class.academic_year_id)
    if year is None or year.status == YearStatus.completed.value:
        raise Conflict("This class belongs to a finished academic year.", code="year_closed")
    if not (year.starts_on <= day_on <= year.ends_on):
        raise AppError("That date is outside the academic year.", code="outside_year", status=422)


async def sheet(db: AsyncSession, p: Principal, class_id: uuid.UUID, day_on: date) -> Sheet:
    c = await get_class_or_404(db, class_id)
    assert_can_view_class(p, class_id)
    day = await db.scalar(
        select(AttendanceDay).where(AttendanceDay.class_id == class_id, AttendanceDay.day_on == day_on)
    )
    pairs = await _active_enrollments(db, class_id)
    saved = {}
    marker = None
    if day is not None:
        saved = {
            r.enrollment_id: r
            for r in await db.scalars(select(AttendanceRecord).where(AttendanceRecord.attendance_day_id == day.id))
        }
        marker = await db.get(User, day.marked_by)
    leaves = await approved_leave_on(db, [s.id for _, s in pairs], day_on)
    hol = await holiday_exists(db, day_on)
    items = []
    for e, s in pairs:
        rec = saved.get(e.id)
        lr = leaves.get(s.id)
        first, second = (rec.first_half, rec.second_half) if rec else leave_marks(lr)
        items.append(
            SheetStudent(
                student_id=s.id,
                enrollment_id=e.id,
                name=full_name(s),
                scholar_no=s.scholar_no,
                roll_no=e.roll_no,
                first_half=first,
                second_half=second,
                late=bool(rec and rec.late),
                note=rec.note if rec else None,
                saved=rec is not None,
                leave_id=lr.id if lr else None,
            )
        )
    can_mark = (
        p.is_class_teacher_of(class_id) and hol is None and day_on <= today_ist() and _within_edit_window(p, day_on)
    )
    return Sheet(
        class_id=class_id,
        class_label=class_label(c),
        day_on=day_on,
        marked=day is not None,
        marked_by=marker.name if marker else None,
        marked_at=day.marked_at if day else None,
        holiday=hol.title if hol else None,
        can_mark=can_mark,
        students=items,
    )


def _outcome(first: str, second: str) -> str:
    if first == PRESENT and second == PRESENT:
        return "present"
    if first == PRESENT:
        return "first_half_only"
    if second == PRESENT:
        return "second_half_only"
    return "absent"


async def save_day(
    db: AsyncSession, actor: Actor, p: Principal, class_id: uuid.UUID, day_on: date, records: list[RecordIn]
) -> None:
    """Class teacher saves (or corrects) a day. First save needs every active student; a correction may send
    only the students that change. Every correction is written to the audit log, student by student."""
    c = await get_class_or_404(db, class_id)
    if not p.is_class_teacher_of(class_id):
        raise Forbidden("Only the class teacher can mark attendance.", code="not_class_teacher")
    _check_markable(day_on)
    await _check_year(db, c, day_on)
    hol = await holiday_exists(db, day_on)
    if hol is not None:
        raise Conflict(f"{day_on.isoformat()} is a holiday ({hol.title}).", code="holiday")
    if not _within_edit_window(p, day_on):
        raise Forbidden(
            f"Attendance older than {settings.attendance_edit_window_days} days can only be changed by the admin.",
            code="edit_window_closed",
        )

    pairs = await _active_enrollments(db, class_id, lock=True)
    by_student = {s.id: (e, s) for e, s in pairs}
    seen: set[uuid.UUID] = set()
    for r in records:
        if r.student_id not in by_student:
            raise AppError("A student in the list is not in this class.", code="not_in_class", status=422)
        if r.student_id in seen:
            raise AppError("A student is listed twice.", code="duplicate_student", status=422)
        seen.add(r.student_id)

    day = await db.scalar(
        select(AttendanceDay)
        .where(AttendanceDay.class_id == class_id, AttendanceDay.day_on == day_on)
        .with_for_update()
    )
    now = utcnow()
    is_new = day is None
    if is_new:
        missing = [full_name(s) for sid, (_, s) in by_student.items() if sid not in seen]
        if missing:
            raise AppError(
                "Attendance must include every student in the class.",
                code="incomplete",
                status=422,
                details={"missing": missing},
            )
        day = AttendanceDay(
            class_id=class_id, day_on=day_on, school_id=actor.school_id, marked_by=actor.id, marked_at=now
        )
        try:
            async with db.begin_nested():
                db.add(day)
                await db.flush()
        except IntegrityError:
            raise Conflict("Someone else just saved this day. Reload and check.", code="already_marked") from None
    existing = {
        r.enrollment_id: r
        for r in await db.scalars(select(AttendanceRecord).where(AttendanceRecord.attendance_day_id == day.id))
    }

    changes: list[dict] = []
    for r in records:
        e, s = by_student[r.student_id]
        note = (r.note or "").strip() or None
        rec = existing.get(e.id)
        who = f"{full_name(s)} ({s.scholar_no})"
        if rec is None:
            db.add(
                AttendanceRecord(
                    attendance_day_id=day.id,
                    enrollment_id=e.id,
                    school_id=actor.school_id,
                    first_half=r.first_half,
                    second_half=r.second_half,
                    late=r.late,
                    note=note,
                )
            )
            if not is_new:
                changes.append(change(f"{who} marked", None, f"{r.first_half}/{r.second_half}"))
            continue
        for field, new in (
            ("first_half", r.first_half),
            ("second_half", r.second_half),
            ("late", r.late),
            ("note", note),
        ):
            old = getattr(rec, field)
            if old != new:
                changes.append(change(f"{who} {field}", old, new))
                setattr(rec, field, new)
    present_total = sum(_outcome(r.first_half, r.second_half) == "present" for r in records)
    if is_new:
        absent_total = sum(_outcome(r.first_half, r.second_half) == "absent" for r in records)
        log_audit(
            db,
            actor,
            AuditCategory.attendance,
            "attendance.marked",
            f"Marked attendance for {class_label(c)} on {day_on.isoformat()}: {present_total} present, "
            f"{absent_total} absent, {len(records) - present_total - absent_total} half day",
            entity_type="attendance_day",
            entity_id=day.id,
            entity_label=f"{class_label(c)} {day_on.isoformat()}",
        )
    elif changes:
        day.marked_by, day.marked_at = actor.id, now
        log_audit(
            db,
            actor,
            AuditCategory.attendance,
            "attendance.edited",
            f"Changed attendance for {class_label(c)} on {day_on.isoformat()} ({len(changes)} changes)",
            entity_type="attendance_day",
            entity_id=day.id,
            entity_label=f"{class_label(c)} {day_on.isoformat()}",
            changes=changes,
            sensitive=day_on != today_ist(),
        )
    await db.flush()
    if (is_new or changes) and day_on == today_ist():
        await _notify_attendance_saved(
            db, c, day_on, [(by_student[r.student_id][1], _outcome(r.first_half, r.second_half)) for r in records]
        )
