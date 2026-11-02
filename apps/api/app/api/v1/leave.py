"""Leave applications, staff side: the class teacher (or admin) reads and decides."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_staff
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.enums import LeaveStatus
from app.schemas.common import Page
from app.schemas.file import DownloadOut
from app.schemas.leave import DecisionIn, LeaveOut
from app.services import leave as svc

router = APIRouter(prefix="/leave", tags=["leave"])


@router.get("", response_model=Page[LeaveOut])
async def list_leave(
    status: LeaveStatus | None = None,
    class_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    from_on: date | None = None,
    to_on: date | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """The admin sees all applications; a class teacher sees those of their own class. Pending first."""
    items, total = await svc.list_leave(
        db,
        scope=svc.teacher_class_ids(p),
        class_id=class_id,
        student_id=student_id,
        status=status.value if status else None,
        from_on=from_on,
        to_on=to_on,
        limit=limit,
        offset=offset,
    )
    return Page(items=items, total=total)


@router.get("/{leave_id}", response_model=LeaveOut)
async def get_leave(leave_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    lr = await svc._leave_or_404(db, leave_id)
    await svc.assert_staff_can_see(db, p, lr)
    return await svc.get_leave(db, leave_id)


@router.post("/{leave_id}/decision", response_model=LeaveOut)
async def decide(
    leave_id: uuid.UUID,
    body: DecisionIn,
    request: Request,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Approve or reject a pending application (the child's class teacher, or admin). The parent is notified."""
    await svc.decide(db, request_actor(p, request), p, leave_id, approve=body.decision == "approve", note=body.note)
    return await svc.get_leave(db, leave_id)


@router.get("/{leave_id}/attachment-url", response_model=DownloadOut)
async def attachment_url(
    leave_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    lr = await svc._leave_or_404(db, leave_id)
    await svc.assert_staff_can_see(db, p, lr)
    if lr.attachment_id is None:
        raise NotFound("There is no attachment.")
    return await svc.attachment_download(db, lr)
