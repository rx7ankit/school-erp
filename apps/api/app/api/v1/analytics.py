"""School analytics and the dashboard summary. See `app/services/analytics.py` for who sees what."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, require_staff
from app.core.clock import today_ist
from app.core.errors import AppError
from app.core.principal import Principal
from app.schemas.analytics import (
    Dashboard,
    FeesAnalytics,
    ResultsAnalytics,
    StaffAttendanceAnalytics,
    StudentsAnalytics,
    TeacherResults,
)
from app.schemas.attendance import Analytics as AttendanceAnalytics
from app.services import analytics as svc
from app.services.attendance_analytics import analytics as attendance_analytics

router = APIRouter(tags=["analytics"])


def _period(from_on: date | None, to_on: date | None) -> tuple[date, date]:
    today = today_ist()
    from_on, to_on = from_on or today.replace(day=1), to_on or today
    if from_on > to_on:
        raise AppError("The start date is after the end date.", code="invalid_period", status=422)
    if (to_on - from_on).days > 800:
        raise AppError("Please pick a shorter period.", code="period_too_long", status=422)
    return from_on, to_on


@router.get("/dashboard", response_model=Dashboard)
async def dashboard(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    """One call for the web dashboard. Blocks the caller may not see are null: fees (admin, fees.manage), staff
    (admin, staff.manage), rollover banner (admin, academic.manage). A teacher gets only their own classes."""
    return await svc.dashboard(db, p)


@router.get("/analytics/students", response_model=StudentsAnalytics)
async def students(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    return await svc.students(db, p)


@router.get("/analytics/attendance", response_model=AttendanceAnalytics)
async def attendance(
    from_on: date | None = None,
    to_on: date | None = None,
    class_id: uuid.UUID | None = None,
    threshold: float = Query(default=75.0, ge=0, le=100),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Attendance % overall, per class, per day and per weekday, and how many students are under the threshold.
    The whole school for admin, academic.manage and fees.manage; other teachers only their own classes."""
    f, t = _period(from_on, to_on)
    return await attendance_analytics(db, p, f, t, class_id, threshold)


@router.get("/analytics/fees", response_model=FeesAnalytics)
async def fees(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    """Collection and dues. Admin and fees.manage only."""
    return await svc.fees(db, p)


@router.get("/analytics/results", response_model=ResultsAnalytics)
async def results(
    exam_id: uuid.UUID | None = None, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    """Averages and pass rate overall, by subject, by class, and the grade spread, for an exam (default: the latest
    of this year). Admin and academic.manage see every class, any other teacher the classes they are assigned to."""
    return await svc.results(db, p, exam_id)


@router.get("/analytics/results/teachers", response_model=TeacherResults)
async def teacher_results(
    exam_id: uuid.UUID | None = None, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    """Teacher-wise results. Admin, academic.manage and staff.manage see everyone; a teacher only their own row."""
    return await svc.teacher_results(db, p, exam_id)


@router.get("/analytics/staff-attendance", response_model=StaffAttendanceAnalytics)
async def staff_attendance(
    from_on: date | None = None,
    to_on: date | None = None,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Staff attendance totals for a period and today's counts. Admin and staff.manage only."""
    f, t = _period(from_on, to_on)
    return await svc.staff_attendance(db, p, f, t)
