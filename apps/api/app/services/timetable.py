"""Timetable: periods, weekly slots per class, teacher absence and substitutes.

Rules: a class has one slot per weekday and period, and a teacher is in one class per weekday and period.
Both are enforced by unique indexes as well as checked here, so two people saving at once cannot double-book.
Weekdays are 1 (Monday) to 6 (Saturday); Sunday has no lessons. Dates are IST school days.
"""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Conflict, NotFound
from app.models.academic import AcademicYear, SchoolClass, Subject
from app.models.enums import AuditCategory, UserKind, YearStatus
from app.models.timetable import Period, StaffAbsence, Substitution, TimetableSlot
from app.models.user import User
from app.schemas.timetable import (
    ChildEntry,
    CoverRow,
    DayEntry,
    FreeTeacher,
    PeriodIn,
    PeriodPatch,
    SlotOut,
    SubstitutionOut,
)
from app.services.audit import Actor, change, log_audit
from app.services.students import class_label


# ------------------------------------------------------------------ lookups
async def get_staff_or_404(db: AsyncSession, staff_id: uuid.UUID) -> User:
    u = await db.get(User, staff_id)
    if not u or u.kind != UserKind.staff.value or not u.is_active or u.deleted_at:
        raise NotFound("Staff member not found.")
    return u


async def _period(db: AsyncSession, period_id: uuid.UUID) -> Period:
    p = await db.get(Period, period_id)
    if not p:
        raise NotFound("Period not found.")
    return p


async def _class(db: AsyncSession, class_id: uuid.UUID) -> SchoolClass:
    c = await db.get(SchoolClass, class_id)
    if not c:
        raise NotFound("Class not found.")
    return c


async def year_for_date(db: AsyncSession, on: date) -> AcademicYear | None:
    """The academic year a school day falls in (the current one if years overlap)."""
    return await db.scalar(
        select(AcademicYear)
        .where(AcademicYear.starts_on <= on, AcademicYear.ends_on >= on)
        .order_by((AcademicYear.status == YearStatus.current.value).desc(), AcademicYear.starts_on.desc())
        .limit(1)
    )


# ------------------------------------------------------------------ periods
async def list_periods(db: AsyncSession) -> list[Period]:
    return list((await db.scalars(select(Period).order_by(Period.number))).all())


async def _check_period(db: AsyncSession, p: Period) -> None:
    if p.ends_at <= p.starts_at:
        raise AppError("A period must end after it starts.", code="invalid_period_time")
    dup = await db.scalar(select(Period).where(Period.number == p.number, Period.id != p.id))
    if dup:
        raise Conflict(f"Period {p.number} already exists.", code="period_number_taken")
    clash = await db.scalar(
        select(Period).where(Period.id != p.id, Period.starts_at < p.ends_at, Period.ends_at > p.starts_at)
    )
    if clash:
        raise Conflict(f"This overlaps {clash.name}.", code="period_overlap")


async def create_period(db: AsyncSession, actor: Actor, body: PeriodIn) -> Period:
    p = Period(
        id=uuid.uuid4(),
        school_id=actor.school_id,
        number=body.number,
        name=body.name.strip(),
        starts_at=body.starts_at,
        ends_at=body.ends_at,
    )
    await _check_period(db, p)
    db.add(p)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "period.created",
        f"Period {p.number} ({p.name}) added: {p.starts_at:%H:%M} to {p.ends_at:%H:%M}",
        entity_type="period",
        entity_id=p.id,
        entity_label=p.name,
    )
    try:
        await db.flush()
    except IntegrityError:
        raise Conflict(f"Period {p.number} already exists.", code="period_number_taken") from None
    return p


async def update_period(db: AsyncSession, actor: Actor, period_id: uuid.UUID, body: PeriodPatch) -> Period:
    p = await _period(db, period_id)
    before = (p.number, p.name, p.starts_at, p.ends_at)
    for f in ("number", "name", "starts_at", "ends_at"):
        v = getattr(body, f)
        if v is not None:
            setattr(p, f, v)
    await _check_period(db, p)
    after = (p.number, p.name, p.starts_at, p.ends_at)
    if before != after:
        names = ("Number", "Name", "Starts", "Ends")
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            "period.updated",
            f"Period {p.name} changed",
            entity_type="period",
            entity_id=p.id,
            entity_label=p.name,
            changes=[change(n, b, a) for n, b, a in zip(names, before, after, strict=True) if b != a],
        )
    await db.flush()
    return p


async def delete_period(db: AsyncSession, actor: Actor, period_id: uuid.UUID) -> None:
    p = await _period(db, period_id)
    used = await db.scalar(select(func.count()).select_from(TimetableSlot).where(TimetableSlot.period_id == p.id))
    if used:
        raise Conflict("This period is used in the timetable. Remove those slots first.", code="period_in_use")
    used_sub = await db.scalar(select(func.count()).select_from(Substitution).where(Substitution.period_id == p.id))
    if used_sub:
        raise Conflict("This period has substitute records.", code="period_in_use")
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "period.deleted",
        f"Period {p.number} ({p.name}) removed",
        entity_type="period",
        entity_id=p.id,
        entity_label=p.name,
    )
    await db.delete(p)
    await db.flush()


# ------------------------------------------------------------------ slot views
def _slot_query():
    teacher = User.__table__.alias("teacher")
    stmt = (
        select(
            TimetableSlot,
            Period,
            Subject.name.label("subject_name"),
            teacher.c.name.label("staff_name"),
            SchoolClass,
        )
        .join(Period, Period.id == TimetableSlot.period_id)
        .join(Subject, Subject.id == TimetableSlot.subject_id)
        .join(teacher, teacher.c.id == TimetableSlot.staff_id)
        .join(SchoolClass, SchoolClass.id == TimetableSlot.class_id)
        .order_by(TimetableSlot.weekday, Period.number)
    )
    return stmt


def _slot_out(row) -> SlotOut:
    s, p, subject_name, staff_name, c = row
    return SlotOut(
        id=s.id,
        class_id=s.class_id,
        class_label=class_label(c),
        weekday=s.weekday,
        period_id=p.id,
        period_number=p.number,
        period_name=p.name,
        starts_at=p.starts_at,
        ends_at=p.ends_at,
        subject_id=s.subject_id,
        subject_name=subject_name,
        staff_id=s.staff_id,
        staff_name=staff_name,
    )


async def slot_out(db: AsyncSession, slot_id: uuid.UUID) -> SlotOut:
    row = (await db.execute(_slot_query().where(TimetableSlot.id == slot_id))).first()
    if not row:
        raise NotFound("Timetable slot not found.")
    return _slot_out(row)


async def class_slots(db: AsyncSession, class_id: uuid.UUID) -> list[SlotOut]:
    rows = (await db.execute(_slot_query().where(TimetableSlot.class_id == class_id))).all()
    return [_slot_out(r) for r in rows]


async def staff_slots(db: AsyncSession, staff_id: uuid.UUID, year_id: uuid.UUID | None = None) -> list[SlotOut]:
    """A teacher's weekly timetable in one academic year (default: the current year)."""
    if year_id is None:
        cur = await db.scalar(select(AcademicYear.id).where(AcademicYear.status == YearStatus.current.value))
        if cur is None:
            return []
        year_id = cur
    rows = (
        await db.execute(
            _slot_query().where(TimetableSlot.staff_id == staff_id, TimetableSlot.academic_year_id == year_id)
        )
    ).all()
    return [_slot_out(r) for r in rows]


async def slots_of_staff_on(db: AsyncSession, staff_id: uuid.UUID, on: date) -> list[SlotOut]:
    year = await year_for_date(db, on)
    wd = on.isoweekday()
    if year is None or wd > 6:
        return []
    rows = (
        await db.execute(
            _slot_query().where(
                TimetableSlot.staff_id == staff_id,
                TimetableSlot.academic_year_id == year.id,
                TimetableSlot.weekday == wd,
            )
        )
    ).all()
    return [_slot_out(r) for r in rows]


# ------------------------------------------------------------------ slot changes
def _slot_race(e: IntegrityError) -> Conflict:
    msg = str(e.orig)
    if "uq_timetable_slots_staff_id" in msg:
        return Conflict("This teacher is already teaching another class in that period.", code="teacher_busy")
    return Conflict("This class already has a lesson in that period.", code="class_busy")


async def _check_teacher_free(
    db: AsyncSession,
    staff_id: uuid.UUID,
    year_id: uuid.UUID,
    weekday: int,
    period_id: uuid.UUID,
    ignore: uuid.UUID | None,
) -> None:
    stmt = _slot_query().where(
        TimetableSlot.staff_id == staff_id,
        TimetableSlot.academic_year_id == year_id,
        TimetableSlot.weekday == weekday,
        TimetableSlot.period_id == period_id,
    )
    if ignore:
        stmt = stmt.where(TimetableSlot.id != ignore)
    other = (await db.execute(stmt)).first()
    if other:
        o = _slot_out(other)
        raise Conflict(
            f"{o.staff_name} is already teaching {o.class_label} in that period.",
            code="teacher_busy",
            details={"slot_id": str(o.id), "class": o.class_label, "subject": o.subject_name},
        )


async def add_slot(
    db: AsyncSession,
    actor: Actor,
    *,
    class_id: uuid.UUID,
    weekday: int,
    period_id: uuid.UUID,
    subject_id: uuid.UUID,
    staff_id: uuid.UUID,
) -> SlotOut:
    cls = await _class(db, class_id)
    year = await db.get(AcademicYear, cls.academic_year_id)
    if year is None or year.status == YearStatus.completed.value:
        raise Conflict("That class belongs to a completed year.", code="year_completed")
    period = await _period(db, period_id)
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise NotFound("Subject not found.")
    teacher = await get_staff_or_404(db, staff_id)
    mine = await db.scalar(
        select(TimetableSlot).where(
            TimetableSlot.class_id == class_id, TimetableSlot.weekday == weekday, TimetableSlot.period_id == period_id
        )
    )
    if mine:
        raise Conflict(
            f"{class_label(cls)} already has a lesson in that period.",
            code="class_busy",
            details={"slot_id": str(mine.id)},
        )
    await _check_teacher_free(db, staff_id, year.id, weekday, period_id, None)
    slot = TimetableSlot(
        id=uuid.uuid4(),
        school_id=actor.school_id,
        class_id=class_id,
        academic_year_id=year.id,
        weekday=weekday,
        period_id=period_id,
        subject_id=subject_id,
        staff_id=staff_id,
    )
    db.add(slot)
    try:
        async with db.begin_nested():
            await db.flush()
    except IntegrityError as e:
        raise _slot_race(e) from None
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "timetable.slot_added",
        f"{class_label(cls)} weekday {weekday} period {period.number}: {subject.name} by {teacher.name}",
        entity_type="timetable_slot",
        entity_id=slot.id,
        entity_label=class_label(cls),
    )
    return await slot_out(db, slot.id)


async def update_slot(
    db: AsyncSession, actor: Actor, slot_id: uuid.UUID, *, subject_id: uuid.UUID | None, staff_id: uuid.UUID | None
) -> SlotOut:
    slot = await db.get(TimetableSlot, slot_id)
    if not slot:
        raise NotFound("Timetable slot not found.")
    before = await slot_out(db, slot.id)
    if subject_id and subject_id != slot.subject_id:
        if not await db.get(Subject, subject_id):
            raise NotFound("Subject not found.")
        slot.subject_id = subject_id
    if staff_id and staff_id != slot.staff_id:
        await get_staff_or_404(db, staff_id)
        await _check_teacher_free(db, staff_id, slot.academic_year_id, slot.weekday, slot.period_id, slot.id)
        slot.staff_id = staff_id
        # cover arranged for the old teacher no longer applies
        stale = (await db.scalars(select(Substitution).where(Substitution.slot_id == slot.id))).all()
        for sub in stale:
            await db.delete(sub)
    try:
        async with db.begin_nested():
            await db.flush()
    except IntegrityError as e:
        raise _slot_race(e) from None
    after = await slot_out(db, slot.id)
    changes = []
    if before.subject_name != after.subject_name:
        changes.append(change("Subject", before.subject_name, after.subject_name))
    if before.staff_name != after.staff_name:
        changes.append(change("Teacher", before.staff_name, after.staff_name))
    if changes:
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            "timetable.slot_updated",
            f"{after.class_label} weekday {after.weekday} period {after.period_number} changed",
            entity_type="timetable_slot",
            entity_id=slot.id,
            entity_label=after.class_label,
            changes=changes,
        )
    return after


async def delete_slot(db: AsyncSession, actor: Actor, slot_id: uuid.UUID) -> None:
    slot = await db.get(TimetableSlot, slot_id)
    if not slot:
        raise NotFound("Timetable slot not found.")
    out = await slot_out(db, slot.id)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "timetable.slot_removed",
        f"{out.class_label} weekday {out.weekday} period {out.period_number} ({out.subject_name}) removed",
        entity_type="timetable_slot",
        entity_id=slot.id,
        entity_label=out.class_label,
    )
    await db.delete(slot)
    await db.flush()


# ------------------------------------------------------------------ absence and cover
async def _slots_needing_cover(db: AsyncSession, staff_id: uuid.UUID, on: date) -> list[SlotOut]:
    return await slots_of_staff_on(db, staff_id, on)


async def mark_absent(
    db: AsyncSession, actor: Actor, *, staff_id: uuid.UUID, absent_on: date, reason: str | None
) -> StaffAbsence:
    teacher = await get_staff_or_404(db, staff_id)
    if await db.scalar(
        select(StaffAbsence.id).where(StaffAbsence.staff_id == staff_id, StaffAbsence.absent_on == absent_on)
    ):
        raise Conflict(f"{teacher.name} is already marked absent on that day.", code="already_absent")
    a = StaffAbsence(
        id=uuid.uuid4(),
        school_id=actor.school_id,
        staff_id=staff_id,
        absent_on=absent_on,
        reason=(reason or "").strip() or None,
        marked_by=actor.id,
    )
    db.add(a)
    try:
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        raise Conflict(f"{teacher.name} is already marked absent on that day.", code="already_absent") from None
    log_audit(
        db,
        actor,
        AuditCategory.staff,
        "staff.absent_marked",
        f"{teacher.name} marked absent on {absent_on.isoformat()}",
        entity_type="staff_absence",
        entity_id=a.id,
        entity_label=teacher.name,
    )
    return a


async def remove_absence(db: AsyncSession, actor: Actor, absence_id: uuid.UUID) -> None:
    a = await db.get(StaffAbsence, absence_id)
    if not a:
        raise NotFound("Absence not found.")
    teacher = await db.get(User, a.staff_id)
    subs = (
        await db.scalars(
            select(Substitution).where(
                Substitution.absent_staff_id == a.staff_id, Substitution.covers_on == a.absent_on
            )
        )
    ).all()
    for s in subs:
        await db.delete(s)
    log_audit(
        db,
        actor,
        AuditCategory.staff,
        "staff.absent_removed",
        f"Absence of {teacher.name if teacher else 'staff'} on {a.absent_on.isoformat()} removed"
        f" ({len(subs)} substitute assignment(s) cancelled)",
        entity_type="staff_absence",
        entity_id=a.id,
        entity_label=teacher.name if teacher else None,
    )
    await db.delete(a)
    await db.flush()


async def list_absences(db: AsyncSession, *, on: date | None, limit: int, offset: int):
    teacher = User.__table__.alias("teacher")
    stmt = select(StaffAbsence, teacher.c.name).join(teacher, teacher.c.id == StaffAbsence.staff_id)
    if on:
        stmt = stmt.where(StaffAbsence.absent_on == on)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (
        await db.execute(stmt.order_by(StaffAbsence.absent_on.desc(), teacher.c.name).limit(limit).offset(offset))
    ).all()
    items = []
    for a, name in rows:
        slots = await _slots_needing_cover(db, a.staff_id, a.absent_on)
        covered = await db.scalar(
            select(func.count())
            .select_from(Substitution)
            .where(Substitution.absent_staff_id == a.staff_id, Substitution.covers_on == a.absent_on)
        )
        items.append(
            {
                "id": a.id,
                "staff_id": a.staff_id,
                "staff_name": name,
                "absent_on": a.absent_on,
                "reason": a.reason,
                "slots_to_cover": len(slots),
                "slots_covered": covered or 0,
            }
        )
    return items, total or 0


async def cover_needed(db: AsyncSession, on: date) -> list[CoverRow]:
    """Every slot of every teacher absent on `on`, with its substitute when assigned."""
    absences = (await db.scalars(select(StaffAbsence).where(StaffAbsence.absent_on == on))).all()
    subs = {s.slot_id: s for s in (await db.scalars(select(Substitution).where(Substitution.covers_on == on))).all()}
    names = {
        u.id: u.name
        for u in (
            await db.scalars(select(User).where(User.id.in_([s.substitute_staff_id for s in subs.values()])))
        ).all()
    }
    rows: list[CoverRow] = []
    for a in absences:
        for slot in await _slots_needing_cover(db, a.staff_id, on):
            sub = subs.get(slot.id)
            rows.append(
                CoverRow(
                    absence_id=a.id,
                    slot=slot,
                    substitution_id=sub.id if sub else None,
                    substitute_staff_id=sub.substitute_staff_id if sub else None,
                    substitute_name=names.get(sub.substitute_staff_id) if sub else None,
                )
            )
    rows.sort(key=lambda r: (r.slot.period_number, r.slot.class_label))
    return rows


async def free_teachers(db: AsyncSession, on: date, period_id: uuid.UUID) -> list[FreeTeacher]:
    """Active teachers with no lesson in that period on that day, not absent, not already covering it."""
    await _period(db, period_id)
    wd = on.isoweekday()
    year = await year_for_date(db, on)
    busy_stmt = select(TimetableSlot.staff_id).where(TimetableSlot.weekday == wd, TimetableSlot.period_id == period_id)
    if year:
        busy_stmt = busy_stmt.where(TimetableSlot.academic_year_id == year.id)
    busy = set((await db.scalars(busy_stmt)).all()) if wd <= 6 else set()
    busy |= set((await db.scalars(select(StaffAbsence.staff_id).where(StaffAbsence.absent_on == on))).all())
    busy |= set(
        (
            await db.scalars(
                select(Substitution.substitute_staff_id).where(
                    Substitution.covers_on == on, Substitution.period_id == period_id
                )
            )
        ).all()
    )
    users = (
        await db.scalars(
            select(User)
            .where(User.kind == UserKind.staff.value, User.is_active.is_(True), User.deleted_at.is_(None))
            .order_by(User.name)
        )
    ).all()
    return [FreeTeacher(staff_id=u.id, name=u.name) for u in users if u.id not in busy]


async def assign_substitute(
    db: AsyncSession, actor: Actor, *, slot_id: uuid.UUID, covers_on: date, substitute_staff_id: uuid.UUID
) -> Substitution:
    slot = await db.get(TimetableSlot, slot_id)
    if not slot:
        raise NotFound("Timetable slot not found.")
    if covers_on.isoweekday() != slot.weekday:
        raise AppError("That date does not fall on this slot's weekday.", code="wrong_weekday")
    year = await db.get(AcademicYear, slot.academic_year_id)
    if year is None or not (year.starts_on <= covers_on <= year.ends_on):
        raise AppError("That date is outside the slot's academic year.", code="outside_year")
    if not await db.scalar(
        select(StaffAbsence.id).where(StaffAbsence.staff_id == slot.staff_id, StaffAbsence.absent_on == covers_on)
    ):
        raise Conflict("The teacher of this slot is not marked absent on that day.", code="not_absent")
    if substitute_staff_id == slot.staff_id:
        raise AppError("The absent teacher cannot cover their own lesson.", code="invalid_substitute")
    sub_user = await get_staff_or_404(db, substitute_staff_id)
    if await db.scalar(
        select(StaffAbsence.id).where(StaffAbsence.staff_id == substitute_staff_id, StaffAbsence.absent_on == covers_on)
    ):
        raise Conflict(f"{sub_user.name} is absent that day.", code="substitute_absent")
    own = await db.scalar(
        select(TimetableSlot.id).where(
            TimetableSlot.staff_id == substitute_staff_id,
            TimetableSlot.academic_year_id == slot.academic_year_id,
            TimetableSlot.weekday == slot.weekday,
            TimetableSlot.period_id == slot.period_id,
        )
    )
    if own:
        raise Conflict(f"{sub_user.name} has a lesson in that period.", code="substitute_busy")
    other = await db.scalar(
        select(Substitution.id).where(
            Substitution.substitute_staff_id == substitute_staff_id,
            Substitution.covers_on == covers_on,
            Substitution.period_id == slot.period_id,
            Substitution.slot_id != slot.id,
        )
    )
    if other:
        raise Conflict(f"{sub_user.name} is already covering another class in that period.", code="substitute_busy")
    existing = await db.scalar(
        select(Substitution)
        .where(Substitution.slot_id == slot.id, Substitution.covers_on == covers_on)
        .with_for_update()
    )
    info = await slot_out(db, slot.id)
    if existing:
        if existing.substitute_staff_id == substitute_staff_id:
            return existing
        old = await db.get(User, existing.substitute_staff_id)
        existing.substitute_staff_id, existing.assigned_by = substitute_staff_id, actor.id
        sub, action = existing, "substitution.changed"
        changes = [change("Substitute", old.name if old else "", sub_user.name)]
    else:
        sub = Substitution(
            id=uuid.uuid4(),
            school_id=actor.school_id,
            covers_on=covers_on,
            slot_id=slot.id,
            period_id=slot.period_id,
            absent_staff_id=slot.staff_id,
            substitute_staff_id=substitute_staff_id,
            assigned_by=actor.id,
        )
        db.add(sub)
        action, changes = "substitution.assigned", None
    try:
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        raise Conflict(f"{sub_user.name} is already covering a class in that period.", code="substitute_busy") from None
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        action,
        f"{sub_user.name} covers {info.class_label} period {info.period_number} ({info.subject_name}) "
        f"for {info.staff_name} on {covers_on.isoformat()}",
        entity_type="substitution",
        entity_id=sub.id,
        entity_label=info.class_label,
        changes=changes,
    )
    await _notify_substitute_assigned(db, sub, info)
    return sub


async def remove_substitution(db: AsyncSession, actor: Actor, substitution_id: uuid.UUID) -> None:
    sub = await db.get(Substitution, substitution_id)
    if not sub:
        raise NotFound("Substitution not found.")
    info = await slot_out(db, sub.slot_id)
    who = await db.get(User, sub.substitute_staff_id)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "substitution.removed",
        f"Cover by {who.name if who else 'staff'} for {info.class_label} period {info.period_number} "
        f"on {sub.covers_on.isoformat()} removed",
        entity_type="substitution",
        entity_id=sub.id,
        entity_label=info.class_label,
    )
    await db.delete(sub)
    await db.flush()


async def substitutions_on(db: AsyncSession, on: date) -> list[SubstitutionOut]:
    subs = (await db.scalars(select(Substitution).where(Substitution.covers_on == on))).all()
    out = []
    for s in subs:
        absent, cover = await db.get(User, s.absent_staff_id), await db.get(User, s.substitute_staff_id)
        out.append(
            SubstitutionOut(
                id=s.id,
                covers_on=s.covers_on,
                slot=await slot_out(db, s.slot_id),
                absent_staff_id=s.absent_staff_id,
                absent_staff_name=absent.name if absent else "",
                substitute_staff_id=s.substitute_staff_id,
                substitute_name=cover.name if cover else "",
            )
        )
    out.sort(key=lambda x: (x.slot.period_number, x.slot.class_label))
    return out


# ------------------------------------------------------------------ the teacher's day
async def my_day(db: AsyncSession, staff_id: uuid.UUID, on: date) -> list[DayEntry]:
    """Own lessons (marked `covered` when someone else takes them) plus lessons this teacher covers."""
    own = await slots_of_staff_on(db, staff_id, on)
    subs = {
        s.slot_id: s
        for s in (
            await db.scalars(
                select(Substitution).where(Substitution.covers_on == on, Substitution.slot_id.in_([s.id for s in own]))
            )
        ).all()
    }
    ids = {x.substitute_staff_id for x in subs.values()}
    duties = (
        await db.scalars(
            select(Substitution).where(Substitution.covers_on == on, Substitution.substitute_staff_id == staff_id)
        )
    ).all()
    ids |= {d.absent_staff_id for d in duties}
    names = {u.id: u.name for u in (await db.scalars(select(User).where(User.id.in_(ids)))).all()} if ids else {}
    entries: list[DayEntry] = []
    for s in own:
        sub = subs.get(s.id)
        if sub:
            entries.append(
                DayEntry(
                    role="covered",
                    slot=s,
                    substitute_staff_id=sub.substitute_staff_id,
                    substitute_name=names.get(sub.substitute_staff_id),
                )
            )
        else:
            entries.append(DayEntry(role="teaching", slot=s))
    for d in duties:
        entries.append(
            DayEntry(
                role="covering",
                slot=await slot_out(db, d.slot_id),
                absent_staff_id=d.absent_staff_id,
                absent_staff_name=names.get(d.absent_staff_id),
            )
        )
    entries.sort(key=lambda e: e.slot.period_number)
    return entries


# ------------------------------------------------------------------ parents
async def child_day(db: AsyncSession, class_id: uuid.UUID, on: date) -> list[ChildEntry]:
    wd = on.isoweekday()
    if wd > 6:
        return []
    slots = [s for s in await class_slots(db, class_id) if s.weekday == wd]
    subs = {
        s.slot_id: s
        for s in (
            await db.scalars(
                select(Substitution).where(
                    Substitution.covers_on == on, Substitution.slot_id.in_([s.id for s in slots])
                )
            )
        ).all()
    }
    sub_names = {}
    if subs:
        sub_names = {
            u.id: u.name
            for u in (
                await db.scalars(select(User).where(User.id.in_([s.substitute_staff_id for s in subs.values()])))
            ).all()
        }
    return [
        ChildEntry(
            slot=s,
            teacher_name=s.staff_name,
            substitute_name=sub_names.get(subs[s.id].substitute_staff_id) if s.id in subs else None,
        )
        for s in slots
    ]


# ------------------------------------------------------------------ notification hooks
async def _notify_substitute_assigned(db: AsyncSession, sub: Substitution, info: SlotOut) -> None:
    """Tell the substitute (sub.substitute_staff_id) which class and period they cover on sub.covers_on.
    Optionally the parents of the class (guardian_user_ids_of_student for its active students).
    """
    # NOTIFY: substitute assigned. Wired by the notifications module; does nothing for now.
    return None
