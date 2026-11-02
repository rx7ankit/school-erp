"""Exam date sheet: academic managers build and publish it, staff read it, parents of the classes see published ones."""

import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, request_actor, require_parent, require_permission, require_staff
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.enums import Permission
from app.models.results import ExamSchedule
from app.models.student import Student
from app.schemas.results import (
    ParentSchedule,
    ScheduleDetail,
    ScheduleIn,
    ScheduleOut,
    SchedulePapersIn,
)
from app.services import datesheet as svc

router = APIRouter(prefix="/exam-schedules", tags=["exam date sheet"])
parent_router = APIRouter(prefix="/parent", tags=["parent"])
manage = require_permission(Permission.academic.value)


async def _out(db: AsyncSession, s: ExamSchedule) -> ScheduleOut:
    return ScheduleOut(
        id=s.id, name=s.name, exam_id=s.exam_id, published_at=s.published_at, papers=await svc.paper_count(db, s.id)
    )


async def _detail(db: AsyncSession, s: ExamSchedule) -> ScheduleDetail:
    return ScheduleDetail(**(await _out(db, s)).model_dump(), items=await svc.items(db, s.id))


async def _visible(db: AsyncSession, p: Principal, schedule_id: uuid.UUID) -> ExamSchedule:
    """Managers see drafts, other staff only published sheets."""
    s = await svc.get_schedule_or_404(db, schedule_id)
    if s.published_at is None and not p.has(Permission.academic.value):
        raise NotFound("Date sheet not found.")
    return s


@router.get("", response_model=list[ScheduleOut])
async def list_schedules(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    q = select(ExamSchedule).order_by(ExamSchedule.created_at.desc())
    if not p.has(Permission.academic.value):
        q = q.where(ExamSchedule.published_at.is_not(None))
    return [await _out(db, s) for s in (await db.scalars(q)).all()]


@router.post("", response_model=ScheduleOut, status_code=201)
async def add_schedule(
    body: ScheduleIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await _out(db, await svc.create_schedule(db, request_actor(p, request), body.name, body.exam_id))


@router.get("/{schedule_id}", response_model=ScheduleDetail)
async def get_schedule(
    schedule_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    return await _detail(db, await _visible(db, p, schedule_id))


@router.put("/{schedule_id}/papers", response_model=ScheduleDetail)
async def set_papers(
    schedule_id: uuid.UUID,
    body: SchedulePapersIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Replaces every paper (class, subject, IST date and start time) of the sheet."""
    s = await svc.get_schedule_or_404(db, schedule_id)
    await svc.set_papers(db, request_actor(p, request), s, body.papers)
    return await _detail(db, s)


@router.post("/{schedule_id}/publish", response_model=ScheduleOut)
async def publish(
    schedule_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    s = await svc.get_schedule_or_404(db, schedule_id)
    await svc.publish(db, request_actor(p, request), s)
    return await _out(db, s)


@router.post("/{schedule_id}/unpublish", response_model=ScheduleOut)
async def unpublish(
    schedule_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    s = await svc.get_schedule_or_404(db, schedule_id)
    await svc.unpublish(db, request_actor(p, request), s)
    return await _out(db, s)


@router.delete("/{schedule_id}", status_code=204)
async def delete(
    schedule_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    await svc.delete_schedule(db, request_actor(p, request), await svc.get_schedule_or_404(db, schedule_id))
    return Response(status_code=204)


@parent_router.get("/children/{student_id}/date-sheet", response_model=list[ParentSchedule])
async def child_date_sheet(
    s: Student = Depends(parent_child), p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    """Published exam date sheets, only the papers of the child's class."""
    return await svc.for_child(db, s.id)
