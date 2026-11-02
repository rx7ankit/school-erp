"""Holidays and calendar markers (academic.manage), and teacher/staff attendance (staff.manage)."""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, NotFound
from app.models.attendance import Holiday, StaffAttendance
from app.models.enums import AuditCategory, UserKind
from app.models.user import User
from app.schemas.attendance import HolidayIn, HolidayPatch, StaffMarkIn, StaffMarkOut
from app.services.audit import Actor, change, log_audit


# ------------------------------------------------------------------ holidays
async def list_holidays(db: AsyncSession, from_on: date | None, to_on: date | None) -> list[Holiday]:
    stmt = select(Holiday).order_by(Holiday.from_on, Holiday.title)
    if from_on:
        stmt = stmt.where(Holiday.to_on >= from_on)
    if to_on:
        stmt = stmt.where(Holiday.from_on <= to_on)
    return list((await db.scalars(stmt)).all())


async def _get(db: AsyncSession, holiday_id: uuid.UUID) -> Holiday:
    h = await db.get(Holiday, holiday_id)
    if h is None:
        raise NotFound("Holiday not found.")
    return h


def _describe(h: Holiday) -> str:
    span = h.from_on.isoformat() if h.from_on == h.to_on else f"{h.from_on.isoformat()} to {h.to_on.isoformat()}"
    return f"{h.title} ({h.kind}, {span})"


async def create_holiday(db: AsyncSession, actor: Actor, body: HolidayIn) -> Holiday:
    h = Holiday(
        school_id=actor.school_id,
        title=body.title.strip(),
        from_on=body.from_on,
        to_on=body.to_on or body.from_on,
        kind=body.kind,
        created_by=actor.id,
    )
    db.add(h)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "holiday.created",
        f"Added {_describe(h)}",
        entity_type="holiday",
        entity_id=h.id,
        entity_label=h.title,
    )
    return h


async def edit_holiday(db: AsyncSession, actor: Actor, holiday_id: uuid.UUID, body: HolidayPatch) -> Holiday:
    h = await _get(db, holiday_id)
    values = body.model_dump(exclude_unset=True)
    if "title" in values:
        values["title"] = values["title"].strip()
    changes = []
    for k, v in values.items():
        if v is not None and getattr(h, k) != v:
            changes.append(change(k, getattr(h, k), v))
            setattr(h, k, v)
    if h.from_on > h.to_on:
        raise AppError("The end date is before the start date.", code="invalid_period", status=422)
    if changes:
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            "holiday.updated",
            f"Changed {_describe(h)}",
            entity_type="holiday",
            entity_id=h.id,
            entity_label=h.title,
            changes=changes,
        )
    await db.flush()
    return h


async def delete_holiday(db: AsyncSession, actor: Actor, holiday_id: uuid.UUID) -> None:
    h = await _get(db, holiday_id)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "holiday.deleted",
        f"Removed {_describe(h)}",
        entity_type="holiday",
        entity_id=h.id,
        entity_label=h.title,
    )
    await db.delete(h)
    await db.flush()


# ------------------------------------------------------------------ staff attendance
async def _staff_users(db: AsyncSession, school_id: uuid.UUID) -> list[User]:
    return list(
        (
            await db.scalars(
                select(User)
                .where(
                    User.school_id == school_id,
                    User.kind == UserKind.staff.value,
                    User.is_active.is_(True),
                    User.deleted_at.is_(None),
                )
                .order_by(User.name)
            )
        ).all()
    )


async def staff_sheet(db: AsyncSession, school_id: uuid.UUID, day_on: date) -> list[StaffMarkOut]:
    saved = {r.staff_id: r for r in await db.scalars(select(StaffAttendance).where(StaffAttendance.day_on == day_on))}
    return [
        StaffMarkOut(
            staff_id=u.id,
            name=u.name,
            status=saved[u.id].status if u.id in saved else None,
            reason=saved[u.id].reason if u.id in saved else None,
            saved=u.id in saved,
        )
        for u in await _staff_users(db, school_id)
    ]


async def mark_staff(db: AsyncSession, actor: Actor, day_on: date, records: list[StaffMarkIn]) -> None:
    if day_on > today_ist():
        raise AppError("Attendance cannot be marked for a future date.", code="future_date", status=422)
    users = {u.id: u for u in await _staff_users(db, actor.school_id)}
    saved = {r.staff_id: r for r in await db.scalars(select(StaffAttendance).where(StaffAttendance.day_on == day_on))}
    seen: set[uuid.UUID] = set()
    changes: list[dict] = []
    now = utcnow()
    for r in records:
        if r.staff_id not in users:
            raise AppError("A person in the list is not a staff member of this school.", code="not_staff", status=422)
        if r.staff_id in seen:
            raise AppError("A person is listed twice.", code="duplicate_staff", status=422)
        seen.add(r.staff_id)
        reason = (r.reason or "").strip() or None
        row = saved.get(r.staff_id)
        who = users[r.staff_id].name
        if row is None:
            db.add(
                StaffAttendance(
                    school_id=actor.school_id,
                    staff_id=r.staff_id,
                    day_on=day_on,
                    status=r.status,
                    reason=reason,
                    marked_by=actor.id,
                    marked_at=now,
                )
            )
            changes.append(change(f"{who} status", None, r.status))
        elif row.status != r.status or row.reason != reason:
            changes.append(change(f"{who} status", row.status, r.status))
            row.status, row.reason, row.marked_by, row.marked_at = r.status, reason, actor.id, now
    if changes:
        log_audit(
            db,
            actor,
            AuditCategory.attendance,
            "staff_attendance.marked",
            f"Marked staff attendance for {day_on.isoformat()} ({len(changes)} changes)",
            entity_type="staff_attendance",
            entity_label=day_on.isoformat(),
            changes=changes,
        )
    await db.flush()
