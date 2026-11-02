"""Attendance (staff side): daily sheet, saving, statistics, analytics, holidays, staff attendance."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission, require_staff
from app.core.clock import today_ist
from app.core.principal import Principal
from app.models.enums import AuditCategory, Permission
from app.schemas.attendance import (
    Analytics,
    BelowRow,
    Calendar,
    ClassStats,
    DaySummary,
    HolidayIn,
    HolidayOut,
    HolidayPatch,
    MarkIn,
    Sheet,
    StaffMarkOut,
    StaffMarksIn,
    StudentStatsOut,
    TeacherRow,
)
from app.schemas.common import Page
from app.services import attendance as svc
from app.services import attendance_analytics as an
from app.services import holidays as hol
from app.services.audit import log_audit
from app.services.sheets import XLSX, build_xlsx
from app.services.students import assert_can_view_student, get_class_or_404, get_student_or_404

router = APIRouter(tags=["attendance"])
academic = require_permission(Permission.academic.value)
staff_manage = require_permission(Permission.staff.value)
THRESHOLD = Query(75.0, ge=0, le=100, description="Students under this percentage are flagged")


# ---------------------------------------------------------------- holidays
@router.get("/holidays", response_model=list[HolidayOut])
async def holidays(
    from_on: date | None = None,
    to_on: date | None = None,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    return await hol.list_holidays(db, from_on, to_on)


@router.post("/holidays", response_model=HolidayOut, status_code=201)
async def add_holiday(
    body: HolidayIn, request: Request, p: Principal = Depends(academic), db: AsyncSession = Depends(db_session)
):
    return await hol.create_holiday(db, request_actor(p, request), body)


@router.patch("/holidays/{holiday_id}", response_model=HolidayOut)
async def edit_holiday(
    holiday_id: uuid.UUID,
    body: HolidayPatch,
    request: Request,
    p: Principal = Depends(academic),
    db: AsyncSession = Depends(db_session),
):
    return await hol.edit_holiday(db, request_actor(p, request), holiday_id, body)


@router.delete("/holidays/{holiday_id}", status_code=204)
async def remove_holiday(
    holiday_id: uuid.UUID, request: Request, p: Principal = Depends(academic), db: AsyncSession = Depends(db_session)
):
    await hol.delete_holiday(db, request_actor(p, request), holiday_id)
    return Response(status_code=204)


# ---------------------------------------------------------------- the class sheet
@router.get("/attendance/classes/{class_id}/sheet", response_model=Sheet)
async def sheet(
    class_id: uuid.UUID,
    day_on: date | None = None,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Today by default. Unsaved students are pre-filled: present, or leave where approved leave covers the day."""
    return await svc.sheet(db, p, class_id, day_on or today_ist())


@router.put("/attendance/classes/{class_id}/days/{day_on}", response_model=Sheet)
async def save_day(
    class_id: uuid.UUID,
    day_on: date,
    body: MarkIn,
    request: Request,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """The class teacher saves or corrects a day. The first save lists every student; corrections may list only
    the students that change. Each change is audited."""
    await svc.save_day(db, request_actor(p, request), p, class_id, day_on, body.records)
    return await svc.sheet(db, p, class_id, day_on)


@router.get("/attendance/classes/{class_id}/days", response_model=list[DaySummary])
async def days(
    class_id: uuid.UUID,
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    c = await get_class_or_404(db, class_id)
    svc.assert_can_view_class(p, class_id)
    a, b = await svc.resolve_period(db, from_on, to_on, month)
    return await svc.class_days(db, c, a, b)


@router.get("/attendance/classes/{class_id}/stats", response_model=ClassStats)
async def class_stats(
    class_id: uuid.UUID,
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    threshold: float = THRESHOLD,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Per student and for the class, over a month or any period (default: the academic year so far)."""
    c = await get_class_or_404(db, class_id)
    svc.assert_can_view_class(p, class_id)
    a, b = await svc.resolve_period(db, from_on, to_on, month)
    return await svc.class_stats(db, c, a, b, threshold)


@router.get("/attendance/classes/{class_id}/stats/export")
async def export_class_stats(
    class_id: uuid.UUID,
    request: Request,
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    threshold: float = THRESHOLD,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    c = await get_class_or_404(db, class_id)
    svc.assert_can_view_class(p, class_id)
    a, b = await svc.resolve_period(db, from_on, to_on, month)
    cs = await svc.class_stats(db, c, a, b, threshold)
    rows = [
        [
            s.roll_no,
            s.scholar_no,
            s.name,
            s.working_days,
            s.present_days,
            s.absent_days,
            s.leave_days,
            s.half_days,
            s.late_days,
            s.percentage,
        ]
        for s in cs.students
    ]
    head = [
        "Roll No",
        "Scholar No",
        "Name",
        "Working Days",
        "Present",
        "Absent",
        "Leave",
        "Half Days",
        "Late",
        "Attendance %",
    ]
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "attendance.exported",
        f"Exported attendance statistics of {cs.class_label} ({a.isoformat()} to {b.isoformat()})",
        entity_label=f"Attendance {cs.class_label}",
        sensitive=True,
    )
    content = build_xlsx([(f"Attendance {cs.class_label}", head, rows)])
    return Response(
        content,
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="attendance-{cs.class_label}-{a.isoformat()}.xlsx"'},
    )


# ---------------------------------------------------------------- one student
@router.get("/attendance/students/{student_id}/stats", response_model=StudentStatsOut)
async def student_stats(
    student_id: uuid.UUID,
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    s = await get_student_or_404(db, student_id)
    await assert_can_view_student(db, p, s)
    a, b = await svc.resolve_period(db, from_on, to_on, month)
    return StudentStatsOut(student_id=s.id, from_on=a, to_on=b, stats=await svc.student_stats(db, s.id, a, b))


@router.get("/attendance/students/{student_id}/calendar", response_model=Calendar)
async def student_calendar(
    student_id: uuid.UUID,
    month: str = Query(..., description="2026-11"),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    s = await get_student_or_404(db, student_id)
    await assert_can_view_student(db, p, s)
    return await svc.calendar(db, s.id, month)


# ---------------------------------------------------------------- analytics
@router.get("/attendance/analytics", response_model=Analytics)
async def analytics(
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    class_id: uuid.UUID | None = None,
    threshold: float = THRESHOLD,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Overall %, by class, trend by day, by weekday, students under the threshold. Teachers see their classes only."""
    a, b = await svc.resolve_period(db, from_on, to_on, month)
    return await an.analytics(db, p, a, b, class_id, threshold)


@router.get("/attendance/analytics/below", response_model=Page[BelowRow])
async def below(
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    class_id: uuid.UUID | None = None,
    threshold: float = THRESHOLD,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    a, b = await svc.resolve_period(db, from_on, to_on, month)
    rows = await an.students_below(db, p, a, b, class_id, threshold)
    return Page(items=rows[offset : offset + limit], total=len(rows))


@router.get("/attendance/analytics/teachers", response_model=list[TeacherRow])
async def teacher_wise(
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Admin, academic and staff managers see every teacher; anyone else only their own row."""
    a, b = await svc.resolve_period(db, from_on, to_on, month)
    return await an.teachers(db, p, a, b)


# ---------------------------------------------------------------- staff attendance
@router.get("/attendance/staff", response_model=list[StaffMarkOut])
async def staff_sheet(
    day_on: date | None = None, p: Principal = Depends(staff_manage), db: AsyncSession = Depends(db_session)
):
    return await hol.staff_sheet(db, p.school_id, day_on or today_ist())


@router.put("/attendance/staff/{day_on}", response_model=list[StaffMarkOut])
async def mark_staff(
    day_on: date,
    body: StaffMarksIn,
    request: Request,
    p: Principal = Depends(staff_manage),
    db: AsyncSession = Depends(db_session),
):
    await hol.mark_staff(db, request_actor(p, request), day_on, body.records)
    return await hol.staff_sheet(db, p.school_id, day_on)
