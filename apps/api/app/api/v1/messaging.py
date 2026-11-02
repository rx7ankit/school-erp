"""Staff side of unified messaging: broadcasts and one-to-one threads with parents.

Who may do what is enforced in `services/messaging.py`: school broadcasts need `academic.manage` (or admin), class
broadcasts need an assignment to the class (subject teachers: their own subject only), threads need a current
assignment to the child's class."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_staff
from app.core.principal import Principal
from app.schemas.common import Page
from app.schemas.file import DownloadOut
from app.schemas.messaging import (
    BroadcastIn,
    BroadcastOut,
    MessageIn,
    MessageOut,
    ThreadOpenIn,
    ThreadOut,
)
from app.services import messaging as svc

router = APIRouter(prefix="/messaging", tags=["messaging"])


# ------------------------------------------------------------------ broadcasts
@router.post("/broadcasts", response_model=BroadcastOut, status_code=201)
async def send_broadcast(
    body: BroadcastIn, request: Request, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    b = await svc.create_broadcast(db, p, request_actor(p, request), body)
    return await svc.get_broadcast_staff(db, p, b.id)


@router.get("/broadcasts", response_model=Page[BroadcastOut])
async def list_broadcasts(
    scope: Literal["school", "class"] | None = None,
    mine: bool = False,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Newest first. Admin and academic managers see all; other staff see their own and school-wide ones."""
    items, total = await svc.list_broadcasts_staff(db, p, scope=scope, mine=mine, limit=limit, offset=offset)
    return Page(items=items, total=total)


@router.get("/broadcasts/{broadcast_id}", response_model=BroadcastOut)
async def get_broadcast(
    broadcast_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    """With delivery numbers: `recipient_count` parent logins reached and `read_count` who opened it."""
    return await svc.get_broadcast_staff(db, p, broadcast_id)


# ------------------------------------------------------------------ threads
@router.get("/threads", response_model=Page[ThreadOut])
async def list_threads(
    student_id: uuid.UUID | None = None,
    active: bool | None = None,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """My conversations, latest first. Inactive ones (no longer assigned, or the child left) stay readable."""
    items, total = await svc.list_threads_staff(db, p, student_id=student_id, active=active, limit=limit, offset=offset)
    return Page(items=items, total=total)


@router.get("/unread-count")
async def unread(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)) -> dict[str, int]:
    return {"messages": await svc.unread_messages_staff(db, p)}


@router.post("/threads", response_model=ThreadOut, status_code=201)
async def open_thread(
    body: ThreadOpenIn, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    """Start, or reopen, my thread about a child. `subject_id` null = as class teacher. Only teachers currently
    assigned to the child's class (403 `not_assigned` otherwise)."""
    t = await svc.open_thread_staff(db, p, body.student_id, body.subject_id)
    return await svc.thread_out(db, p.user_id, t)


@router.get("/threads/{thread_id}", response_model=ThreadOut)
async def get_thread(
    thread_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    return await svc.thread_out(db, p.user_id, await svc.thread_for_staff(db, p, thread_id))


@router.get("/threads/{thread_id}/messages", response_model=Page[MessageOut])
async def messages(
    thread_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Newest first. `seen` on my own messages means a parent opened the thread after it was sent."""
    t = await svc.thread_for_staff(db, p, thread_id)
    items, total = await svc.list_messages(db, t, p.user_id, limit=limit, offset=offset)
    return Page(items=items, total=total)


@router.post("/threads/{thread_id}/messages", response_model=MessageOut, status_code=201)
async def send(
    thread_id: uuid.UUID, body: MessageIn, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    """403 `thread_inactive` when the assignment ended or the child left. Attach files uploaded through
    /files/upload-url with purpose `message_attachment`."""
    t = await svc.thread_for_staff(db, p, thread_id)
    return await svc.send_message(db, p, t, body.body, body.attachment_ids)


@router.post("/threads/{thread_id}/read", status_code=204)
async def read(thread_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    await svc.mark_thread_read(db, await svc.thread_for_staff(db, p, thread_id), p.user_id)


@router.get("/files/{attachment_id}/url", response_model=DownloadOut)
async def file_url(
    attachment_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    url, ttl = await svc.file_download(db, p, attachment_id)
    return DownloadOut(url=url, expires_in=ttl)
