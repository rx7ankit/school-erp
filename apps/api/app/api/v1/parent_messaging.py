"""Parent side of unified messaging: the updates feed, and threads with each of the child's teachers.

Parents never reply to broadcasts. Threads are read-only once the teacher is no longer assigned or the child left."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, require_parent
from app.core.principal import Principal
from app.models.student import Student
from app.schemas.common import Page
from app.schemas.file import DownloadOut, FileOut, UploadIn, UploadOut
from app.schemas.messaging import (
    FeedItemOut,
    MessageIn,
    MessageOut,
    ParentThreadOpenIn,
    TeacherOut,
    ThreadOut,
    UnreadSummary,
)
from app.services import messaging as svc

router = APIRouter(prefix="/parent", tags=["messaging (parent)"])


# ------------------------------------------------------------------ updates feed
@router.get("/updates", response_model=Page[FeedItemOut])
async def feed(
    student_id: uuid.UUID | None = None,
    unread_only: bool = False,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """School and class broadcasts for the parent's active children, newest first. `student_id` limits to one child."""
    items, total = await svc.parent_feed(
        db, p.user_id, student_id=student_id, unread_only=unread_only, limit=limit, offset=offset
    )
    return Page(items=items, total=total)


@router.get("/messaging/unread", response_model=UnreadSummary)
async def unread(p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)):
    """Badge numbers: unread updates and unread teacher messages."""
    return await svc.parent_summary(db, p.user_id)


@router.post("/updates/read-all", response_model=UnreadSummary)
async def read_all(p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)):
    await svc.mark_all_broadcasts_read(db, p.school_id, p.user_id)
    return await svc.parent_summary(db, p.user_id)


@router.get("/updates/{broadcast_id}", response_model=FeedItemOut)
async def update_item(
    broadcast_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    return await svc.parent_feed_item(db, p.user_id, broadcast_id)


@router.post("/updates/{broadcast_id}/read", status_code=204)
async def update_read(
    broadcast_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    await svc.mark_broadcast_read(db, p.school_id, p.user_id, broadcast_id)


# ------------------------------------------------------------------ teachers and threads
@router.get("/children/{student_id}/teachers", response_model=list[TeacherOut])
async def teachers(s: Student = Depends(parent_child), db: AsyncSession = Depends(db_session)):
    """The child's teachers right now (class teacher first) and the thread with each, if one was opened."""
    return await svc.teachers_of_child(db, s)


@router.get("/threads", response_model=Page[ThreadOut])
async def threads(
    student_id: uuid.UUID | None = None,
    active: bool | None = None,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """All threads about my children, latest first. Inactive ones are greyed out in the app but stay readable."""
    items, total = await svc.list_threads_parent(
        db, p.user_id, student_id=student_id, active=active, limit=limit, offset=offset
    )
    return Page(items=items, total=total)


@router.post("/threads", response_model=ThreadOut, status_code=201)
async def open_thread(
    body: ParentThreadOpenIn, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    """Open (or reuse) the thread with one of my child's current teachers. 404 if the child is not mine,
    403 `child_read_only` if the child left, 403 `not_assigned` if that teacher does not teach the child."""
    t = await svc.open_thread_parent(db, p, body.student_id, body.staff_id, body.subject_id)
    return await svc.thread_out(db, p.user_id, t)


@router.get("/threads/{thread_id}", response_model=ThreadOut)
async def get_thread(
    thread_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    return await svc.thread_out(db, p.user_id, await svc.thread_for_parent(db, p, thread_id))


@router.get("/threads/{thread_id}/messages", response_model=Page[MessageOut])
async def messages(
    thread_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    t = await svc.thread_for_parent(db, p, thread_id)
    items, total = await svc.list_messages(db, t, p.user_id, limit=limit, offset=offset)
    return Page(items=items, total=total)


@router.post("/threads/{thread_id}/messages", response_model=MessageOut, status_code=201)
async def send(
    thread_id: uuid.UUID,
    body: MessageIn,
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """403 `thread_inactive` when the teacher no longer teaches the child, 403 `child_read_only` if the child left."""
    t = await svc.thread_for_parent(db, p, thread_id)
    return await svc.send_message(db, p, t, body.body, body.attachment_ids)


@router.post("/threads/{thread_id}/read", status_code=204)
async def read(thread_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)):
    await svc.mark_thread_read(db, await svc.thread_for_parent(db, p, thread_id), p.user_id)


# ------------------------------------------------------------------ attachments
@router.post("/messaging/upload-url", response_model=UploadOut, status_code=201)
async def upload_url(body: UploadIn, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)):
    """Step 1 of attaching a file to a reply (PUT the file to the link, then call complete). Messages only."""
    return await svc.start_parent_upload(
        db, p, filename=body.filename, content_type=body.content_type, size_bytes=body.size_bytes
    )


@router.post("/messaging/files/{file_id}/complete", response_model=FileOut)
async def upload_complete(
    file_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    return await svc.finish_parent_upload(db, p, file_id)


@router.get("/messaging/files/{attachment_id}/url", response_model=DownloadOut)
async def file_url(
    attachment_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    url, ttl = await svc.file_download(db, p, attachment_id)
    return DownloadOut(url=url, expires_in=ttl)
