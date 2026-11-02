"""The in-app notification inbox, device tokens for push, and push preferences.

The same routes are mounted twice: `/notifications/*` for staff and `/parent/notifications/*` for parents."""

import uuid
from collections.abc import Callable

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, require_parent, require_staff
from app.core.errors import AppError
from app.core.principal import Principal
from app.schemas.notifications import (
    DeviceIn,
    DeviceTokenIn,
    InboxOut,
    NotificationOut,
    PreferenceIn,
    PreferencesOut,
    ReadAllIn,
    UnreadOut,
)
from app.services import notifications as svc


def _out(n) -> NotificationOut:
    o = NotificationOut.model_validate(n)
    o.is_read = n.read_at is not None
    return o


def build_router(prefix: str, tag: str, who: Callable) -> APIRouter:
    r = APIRouter(prefix=prefix, tags=[tag])

    @r.get("", response_model=InboxOut)
    async def inbox(
        unread_only: bool = False,
        student_id: uuid.UUID | None = None,
        limit: int = Query(30, ge=1, le=100),
        offset: int = Query(0, ge=0),
        p: Principal = Depends(who),
        db: AsyncSession = Depends(db_session),
    ):
        """Newest first. `student_id` filters to one child."""
        items, total, unread = await svc.list_inbox(
            db, p.user_id, unread_only=unread_only, student_id=student_id, limit=limit, offset=offset
        )
        return InboxOut(items=[_out(n) for n in items], total=total, unread=unread)

    @r.get("/unread-count", response_model=UnreadOut)
    async def unread(p: Principal = Depends(who), db: AsyncSession = Depends(db_session)):
        return UnreadOut(unread=await svc.unread_count(db, p.user_id))

    @r.post("/read-all", response_model=UnreadOut)
    async def read_all(
        body: ReadAllIn | None = None, p: Principal = Depends(who), db: AsyncSession = Depends(db_session)
    ):
        await svc.mark_all_read(db, p.user_id, body.student_id if body else None)
        return UnreadOut(unread=await svc.unread_count(db, p.user_id))

    @r.post("/devices", status_code=204)
    async def register(body: DeviceIn, p: Principal = Depends(who), db: AsyncSession = Depends(db_session)):
        """Call after sign in and whenever the push token changes. `platform` is ios or android (iOS goes via FCM)."""
        await svc.register_device(
            db, school_id=p.school_id, user_id=p.user_id, token=body.token, platform=body.platform
        )

    @r.post("/devices/unregister", status_code=204)
    async def unregister(body: DeviceTokenIn, p: Principal = Depends(who), db: AsyncSession = Depends(db_session)):
        """Call on sign out so the next person on this phone does not get your pushes."""
        await svc.unregister_device(db, p.user_id, body.token)

    @r.get("/preferences", response_model=PreferencesOut)
    async def preferences(p: Principal = Depends(who), db: AsyncSession = Depends(db_session)):
        return PreferencesOut(preferences=await svc.get_preferences(db, p.user_id))

    @r.put("/preferences", response_model=PreferencesOut)
    async def set_preferences(body: PreferenceIn, p: Principal = Depends(who), db: AsyncSession = Depends(db_session)):
        if body.category not in svc.CATEGORIES:
            raise AppError("Unknown category.", code="invalid_category", details={"allowed": svc.CATEGORIES})
        await svc.set_preference(
            db, school_id=p.school_id, user_id=p.user_id, category=body.category, push_enabled=body.push_enabled
        )
        return PreferencesOut(preferences=await svc.get_preferences(db, p.user_id))

    @r.post("/{notification_id}/read", response_model=NotificationOut)
    async def read(notification_id: uuid.UUID, p: Principal = Depends(who), db: AsyncSession = Depends(db_session)):
        return _out(await svc.mark_read(db, p.user_id, notification_id))

    return r


staff_router = build_router("/notifications", "notifications", require_staff)
parent_router = build_router("/parent/notifications", "notifications (parent)", require_parent)
