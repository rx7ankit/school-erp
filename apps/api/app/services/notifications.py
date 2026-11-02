"""Notifications: the in-app inbox, push to phones, device tokens and preferences.

Other modules call exactly one thing:

    await notify(db, user_ids=[...], kind="fee_reminder", title="...", body="...", data={...}, school_id=sid)
    await notify_guardians_of_student(db, student_id, kind="attendance_absent", title="...", body="...")

The inbox rows are written in the CALLER'S transaction (they commit or roll back with the caller's change). The
push to phones is sent only AFTER that transaction commits, in the background, and a failure there is logged and
never reaches the caller. `notify` itself never raises: if it cannot write, it logs and returns [].
"""

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import delete, event, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import NotFound
from app.core.ids import uuid7
from app.db.session import make_session, system_session
from app.models.enums import DevicePlatform, StudentStatus
from app.models.notification import DeviceToken, Notification, NotificationPreference
from app.models.student import Student
from app.models.user import User
from app.services.guardians import guardian_user_ids_of_student
from app.services.push import InvalidDeviceToken, PushMessage, get_push_sender

log = logging.getLogger("scool.notifications")

# ------------------------------------------------------------------ kinds and categories
# `kind` is free text so a module can add its own without a migration. Preferences work per category:
# a kind that is not listed here falls in "general". Push can be turned off per category, the inbox always shows.
CATEGORIES = [
    "attendance",
    "fees",
    "notices",
    "exams",
    "results",
    "messages",
    "leave",
    "promotion",
    "feedback",
    "general",
]
KIND_CATEGORY = {
    "attendance_present": "attendance",
    "attendance_absent": "attendance",
    "attendance_first_half": "attendance",
    "attendance_second_half": "attendance",
    "fee_reminder": "fees",
    "fee_payment": "fees",
    "fee_invoice": "fees",
    "notice": "notices",
    "broadcast": "messages",
    "message": "messages",
    "exam": "exams",
    "result": "results",
    "leave_decided": "leave",
    "leave_requested": "leave",
    "promotion_promoted": "promotion",
    "promotion_stayed": "promotion",
    "promotion_completed": "promotion",
    "feedback": "feedback",
    "substitute_assigned": "general",
    "certificate_issued": "general",
}


def category_of(kind: str) -> str:
    return KIND_CATEGORY.get(kind, "general")


# ------------------------------------------------------------------ post-commit push
PENDING = "pending_push"


@dataclass
class _Pending:
    notification_id: uuid.UUID
    user_id: uuid.UUID
    kind: str
    title: str
    body: str
    data: dict
    student_id: uuid.UUID | None


@dataclass
class _Batch:
    school_id: uuid.UUID
    items: list[_Pending]


_tasks: set[asyncio.Task] = set()


@event.listens_for(Session, "after_commit")
def _push_after_commit(session: Session) -> None:
    """The caller's transaction is safely stored: now send the pushes, without making the caller wait."""
    batches: list[_Batch] | None = session.info.pop(PENDING, None)
    if not batches:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        log.warning("no event loop: %d push batch(es) dropped", len(batches))
        return
    for b in batches:
        t = loop.create_task(_deliver(b))
        _tasks.add(t)
        t.add_done_callback(_tasks.discard)


@event.listens_for(Session, "after_rollback")
def _forget_after_rollback(session: Session) -> None:
    session.info.pop(PENDING, None)  # the notifications were rolled back with the change: send nothing


async def flush_pushes() -> None:
    """Waits for pushes that are on their way. For tests and for a clean shutdown."""
    while _tasks:
        await asyncio.gather(*list(_tasks), return_exceptions=True)


async def _deliver(batch: _Batch) -> None:
    try:
        sender = get_push_sender()
        async with make_session(school_id=batch.school_id) as db:
            user_ids = {i.user_id for i in batch.items}
            tokens = (await db.scalars(select(DeviceToken).where(DeviceToken.user_id.in_(user_ids)))).all()
            by_user: dict[uuid.UUID, list[DeviceToken]] = {}
            for t in tokens:
                by_user.setdefault(t.user_id, []).append(t)
            off = {
                (r.user_id, r.category)
                for r in (
                    await db.scalars(
                        select(NotificationPreference).where(
                            NotificationPreference.user_id.in_(user_ids), NotificationPreference.push_enabled.is_(False)
                        )
                    )
                ).all()
            }
            dead: set[uuid.UUID] = set()
            sent_ids: list[uuid.UUID] = []

            async def one(item: _Pending, tok: DeviceToken) -> bool:
                data = {k: str(v) for k, v in (item.data or {}).items()}
                data.update(kind=item.kind, notification_id=str(item.notification_id))
                if item.student_id:
                    data["student_id"] = str(item.student_id)
                try:
                    await sender.send(
                        PushMessage(
                            tok.token,
                            tok.platform,
                            item.title[: settings.push_max_title],
                            item.body[: settings.push_max_body],
                            data,
                        )
                    )
                    return True
                except InvalidDeviceToken:
                    dead.add(tok.id)
                except Exception:
                    log.exception("push failed for notification %s", item.notification_id)
                return False

            jobs = []
            for item in batch.items:
                if (item.user_id, category_of(item.kind)) in off:
                    continue
                for tok in by_user.get(item.user_id, []):
                    jobs.append((item, one(item, tok)))
            results = await asyncio.gather(*(j[1] for j in jobs))
            for (item, _), ok in zip(jobs, results, strict=True):
                if ok and item.notification_id not in sent_ids:
                    sent_ids.append(item.notification_id)
            if dead:
                await db.execute(delete(DeviceToken).where(DeviceToken.id.in_(dead)))
            if sent_ids:
                await db.execute(
                    update(Notification).where(Notification.id.in_(sent_ids)).values(push_sent_at=datetime.now(UTC))
                )
            await db.commit()
    except Exception:
        log.exception("push delivery failed")


# ------------------------------------------------------------------ the service other modules call
def _jsonable(data: dict | None) -> dict | None:
    return json.loads(json.dumps(data, default=str)) if data else None


async def notify(
    db: AsyncSession,
    *,
    user_ids: list[uuid.UUID],
    kind: str,
    title: str,
    body: str,
    data: dict | None = None,
    school_id: uuid.UUID,
    student_id: uuid.UUID | None = None,
    dedupe_key: str | None = None,
) -> list[uuid.UUID]:
    """Stores one inbox row per recipient in the caller's transaction and queues the push for after the commit.

    - Only active users of `school_id` get a row (a wrong or foreign id is skipped, never an error).
    - `dedupe_key`: earlier rows of the same user, kind and key are replaced (a re-saved attendance sheet
      replaces its notification instead of sending a second one).
    - `student_id` links the notification to a child (shown in the parent app's child switcher).
    - Never raises. On failure it logs and returns [] and the caller's transaction is untouched.
    Returns the new notification ids."""
    try:
        wanted = list(dict.fromkeys(user_ids))
        if not wanted:
            return []
        async with db.begin_nested():
            valid = (
                await db.scalars(
                    select(User.id).where(
                        User.id.in_(wanted),
                        User.school_id == school_id,
                        User.is_active.is_(True),
                        User.deleted_at.is_(None),
                    )
                )
            ).all()
            recipients = [u for u in wanted if u in set(valid)]
            if not recipients:
                return []
            if dedupe_key:
                await db.execute(
                    delete(Notification).where(
                        Notification.user_id.in_(recipients),
                        Notification.kind == kind,
                        Notification.dedupe_key == dedupe_key,
                    )
                )
            now = datetime.now(UTC)
            payload = _jsonable(data)
            items: list[_Pending] = []
            for uid in recipients:
                nid = uuid7()
                db.add(
                    Notification(
                        id=nid,
                        school_id=school_id,
                        user_id=uid,
                        student_id=student_id,
                        kind=kind,
                        title=title[:200],
                        body=body,
                        data=payload,
                        dedupe_key=dedupe_key,
                        created_at=now,
                    )
                )
                items.append(_Pending(nid, uid, kind, title, body, payload or {}, student_id))
            await db.flush()
        db.info.setdefault(PENDING, []).append(_Batch(school_id, items))
        return [i.notification_id for i in items]
    except Exception:
        log.exception("notify failed (kind=%s); the caller's change is kept", kind)
        return []


async def notify_guardians_of_student(
    db: AsyncSession,
    student_id: uuid.UUID,
    *,
    kind: str,
    title: str,
    body: str,
    data: dict | None = None,
    dedupe_key: str | None = None,
    skip_if_left: bool = True,
) -> list[uuid.UUID]:
    """Notifies every parent login linked to the child. A child who has left (or has a TC, or passed out) gets
    nothing unless `skip_if_left=False`, as the ERD says for attendance and fee notifications."""
    try:
        student = await db.get(Student, student_id)
        if student is None or (skip_if_left and student.status != StudentStatus.active.value):
            return []
        users = await guardian_user_ids_of_student(db, student_id)
    except Exception:
        log.exception("notify_guardians_of_student failed for %s", student_id)
        return []
    return await notify(
        db,
        user_ids=users,
        kind=kind,
        title=title,
        body=body,
        data=data,
        school_id=student.school_id,
        student_id=student_id,
        dedupe_key=dedupe_key,
    )


# ------------------------------------------------------------------ inbox
async def list_inbox(
    db: AsyncSession, user_id: uuid.UUID, *, unread_only: bool, student_id: uuid.UUID | None, limit: int, offset: int
) -> tuple[list[Notification], int, int]:
    """(items newest first, total matching, unread count of the whole inbox)."""
    q = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        q = q.where(Notification.read_at.is_(None))
    if student_id:
        q = q.where(Notification.student_id == student_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = (
        await db.scalars(q.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).offset(offset))
    ).all()
    return list(rows), total, await unread_count(db, user_id)


async def unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    return (
        await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        )
        or 0
    )


async def mark_read(db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
    n = await db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id))
    if n is None:
        raise NotFound("Notification not found.")
    if n.read_at is None:
        n.read_at = datetime.now(UTC)
        await db.flush()
    return n


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID, student_id: uuid.UUID | None = None) -> int:
    q = update(Notification).where(Notification.user_id == user_id, Notification.read_at.is_(None))
    if student_id:
        q = q.where(Notification.student_id == student_id)
    res = await db.execute(q.values(read_at=datetime.now(UTC)))
    return res.rowcount or 0


# ------------------------------------------------------------------ devices and preferences
async def register_device(
    db: AsyncSession, *, school_id: uuid.UUID, user_id: uuid.UUID, token: str, platform: str
) -> DeviceToken:
    """A token belongs to one person at a time: signing in on a phone moves it from the previous person (even in
    another school, hence the system session) so they stop getting someone else's push."""
    DevicePlatform(platform)
    async with system_session() as s:
        await s.execute(delete(DeviceToken).where(DeviceToken.token == token, DeviceToken.user_id != user_id))
    now = datetime.now(UTC)
    row = await db.scalar(select(DeviceToken).where(DeviceToken.token == token))
    if row is None:
        row = DeviceToken(school_id=school_id, user_id=user_id, token=token, platform=platform, last_seen_at=now)
        db.add(row)
    else:
        row.platform, row.last_seen_at = platform, now
    await db.flush()
    return row


async def unregister_device(db: AsyncSession, user_id: uuid.UUID, token: str) -> None:
    """Call on sign out. Idempotent; only the owner's own token is removed."""
    await db.execute(delete(DeviceToken).where(DeviceToken.token == token, DeviceToken.user_id == user_id))


async def get_preferences(db: AsyncSession, user_id: uuid.UUID) -> dict[str, bool]:
    rows = (await db.scalars(select(NotificationPreference).where(NotificationPreference.user_id == user_id))).all()
    off = {r.category: r.push_enabled for r in rows}
    return {c: off.get(c, True) for c in CATEGORIES}


async def set_preference(
    db: AsyncSession, *, school_id: uuid.UUID, user_id: uuid.UUID, category: str, push_enabled: bool
) -> None:
    await db.execute(
        pg_insert(NotificationPreference)
        .values(school_id=school_id, user_id=user_id, category=category, push_enabled=push_enabled)
        .on_conflict_do_update(index_elements=["user_id", "category"], set_={"push_enabled": push_enabled})
    )
