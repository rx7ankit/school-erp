"""A parent's attendance calendar and stats for their own children, and leave applications."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, request_actor, require_parent
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.enums import LeaveStatus
from app.models.student import Student
from app.schemas.attendance import Calendar, HolidayOut, StudentStatsOut
from app.schemas.common import Page
from app.schemas.file import DownloadOut, FileOut, UploadOut
from app.schemas.leave import AttachmentUploadIn, LeaveIn, LeaveOut
from app.services import attendance as att
from app.services import holidays as hol
from app.services import leave as svc
from app.services.guardians import assert_parent_child

router = APIRouter(prefix="/parent", tags=["parent"])


@router.get("/children/{student_id}/attendance/calendar", response_model=Calendar)
async def calendar(
    month: str = Query(..., description="2026-11"),
    s: Student = Depends(parent_child),
    db: AsyncSession = Depends(db_session),
):
    return await att.calendar(db, s.id, month)


@router.get("/children/{student_id}/attendance/stats", response_model=StudentStatsOut)
async def stats(
    from_on: date | None = None,
    to_on: date | None = None,
    month: str | None = None,
    s: Student = Depends(parent_child),
    db: AsyncSession = Depends(db_session),
):
    a, b = await att.resolve_period(db, from_on, to_on, month)
    return StudentStatsOut(student_id=s.id, from_on=a, to_on=b, stats=await att.student_stats(db, s.id, a, b))


@router.get("/holidays", response_model=list[HolidayOut])
async def holidays(
    from_on: date | None = None,
    to_on: date | None = None,
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    return await hol.list_holidays(db, from_on, to_on)


# ---------------------------------------------------------------- leave
@router.get("/children/{student_id}/leave", response_model=Page[LeaveOut])
async def child_leave(
    status: LeaveStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    s: Student = Depends(parent_child),
    db: AsyncSession = Depends(db_session),
):
    items, total = await svc.list_leave(
        db, student_id=s.id, status=status.value if status else None, limit=limit, offset=offset
    )
    return Page(items=items, total=total)


@router.post("/children/{student_id}/leave", response_model=LeaveOut, status_code=201)
async def apply_leave(
    student_id: uuid.UUID,
    body: LeaveIn,
    request: Request,
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """Apply for leave for one child. Refused for a child who has left (read-only)."""
    student = await assert_parent_child(db, p.user_id, student_id, writable=True)
    lr = await svc.apply(db, request_actor(p, request), student, p.user_id, body)
    return await svc.get_leave(db, lr.id)


@router.post("/leave/{leave_id}/cancel", response_model=LeaveOut)
async def cancel_leave(
    leave_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    lr = await svc.cancel(db, request_actor(p, request), p.user_id, leave_id)
    return await svc.get_leave(db, lr.id)


@router.post("/leave/attachments/upload-url", response_model=UploadOut, status_code=201)
async def attachment_upload_url(
    body: AttachmentUploadIn,
    request: Request,
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """Step 1 for a medical note or similar: get a link, PUT the file to it, then call complete."""
    return await svc.parent_upload_url(db, request_actor(p, request), p.user_id, body)


@router.post("/leave/attachments/{file_id}/complete", response_model=FileOut)
async def attachment_complete(
    file_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    return await svc.parent_complete_upload(db, p.user_id, file_id)


@router.get("/leave/{leave_id}/attachment-url", response_model=DownloadOut)
async def attachment_url(
    leave_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    lr = await svc.leave_for_parent(db, p.user_id, leave_id)
    if lr.attachment_id is None:
        raise NotFound("There is no attachment.")
    return await svc.attachment_download(db, lr)
