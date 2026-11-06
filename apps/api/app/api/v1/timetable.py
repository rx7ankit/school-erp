import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, request_actor, require_parent, require_permission, require_staff
from app.core.clock import today_ist
from app.core.errors import Forbidden, NotFound
from app.core.principal import Principal
from app.models.enums import Permission
from app.models.student import Student
from app.schemas.common import Page
from app.schemas.timetable import (
    AbsenceIn,
    AbsenceOut,
    ChildTimetable,
    ClassTimetable,
    CoverRow,
    FreeTeacher,
    MyDay,
    PeriodIn,
    PeriodOut,
    PeriodPatch,
    SlotIn,
    SlotOut,
    SlotPatch,
    StaffTimetable,
    SubstituteIn,
    SubstitutionOut,
)
from app.services import timetable as svc
from app.services.students import class_label, class_of_student

router = APIRouter(tags=["timetable"])
manage_timetable = require_permission(Permission.academic.value)
manage_staff = require_permission(Permission.academic.value)


# ------------------------------------------------------------------ periods
@router.get("/timetable/periods", response_model=list[PeriodOut])
async def periods(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    return await svc.list_periods(db)


@router.post("/timetable/periods", response_model=PeriodOut, status_code=201)
async def create_period(
    body: PeriodIn, request: Request, p: Principal = Depends(manage_timetable), db: AsyncSession = Depends(db_session)
):
    return await svc.create_period(db, request_actor(p, request), body)


@router.patch("/timetable/periods/{period_id}", response_model=PeriodOut)
async def update_period(
    period_id: uuid.UUID,
    body: PeriodPatch,
    request: Request,
    p: Principal = Depends(manage_timetable),
    db: AsyncSession = Depends(db_session),
):
    return await svc.update_period(db, request_actor(p, request), period_id, body)


@router.delete("/timetable/periods/{period_id}", status_code=204)
async def delete_period(
    period_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage_timetable),
    db: AsyncSession = Depends(db_session),
):
    await svc.delete_period(db, request_actor(p, request), period_id)


# ------------------------------------------------------------------ class timetable
@router.get("/timetable/classes/{class_id}", response_model=ClassTimetable)
async def class_timetable(
    class_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    cls = await svc._class(db, class_id)
    return ClassTimetable(
        class_id=cls.id,
        class_label=class_label(cls),
        periods=await svc.list_periods(db),
        slots=await svc.class_slots(db, cls.id),
    )


@router.post("/timetable/slots", response_model=SlotOut, status_code=201)
async def add_slot(
    body: SlotIn, request: Request, p: Principal = Depends(manage_timetable), db: AsyncSession = Depends(db_session)
):
    """409 `class_busy` (class already has a lesson then) or `teacher_busy` (teacher is in another class)."""
    return await svc.add_slot(db, request_actor(p, request), **body.model_dump())


@router.patch("/timetable/slots/{slot_id}", response_model=SlotOut)
async def update_slot(
    slot_id: uuid.UUID,
    body: SlotPatch,
    request: Request,
    p: Principal = Depends(manage_timetable),
    db: AsyncSession = Depends(db_session),
):
    return await svc.update_slot(
        db, request_actor(p, request), slot_id, subject_id=body.subject_id, staff_id=body.staff_id
    )


@router.delete("/timetable/slots/{slot_id}", status_code=204)
async def delete_slot(
    slot_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage_timetable),
    db: AsyncSession = Depends(db_session),
):
    await svc.delete_slot(db, request_actor(p, request), slot_id)


# ------------------------------------------------------------------ teacher views
@router.get("/timetable/me", response_model=StaffTimetable)
async def my_timetable(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    return StaffTimetable(
        staff_id=p.user_id,
        staff_name=p.name,
        periods=await svc.list_periods(db),
        slots=await svc.staff_slots(db, p.user_id),
    )


@router.get("/timetable/me/day", response_model=MyDay)
async def my_day(on: date | None = None, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    """My day: own lessons (marked `covered` when someone else takes them) and lessons I cover. Default today."""
    on = on or today_ist()
    return MyDay(on=on, weekday=on.isoweekday(), entries=await svc.my_day(db, p.user_id, on))


@router.get("/timetable/staff/{staff_id}", response_model=StaffTimetable)
async def staff_timetable(
    staff_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    if staff_id != p.user_id and not p.has(Permission.academic.value):
        raise Forbidden("You can only see your own timetable.", code="missing_permission")
    u = await svc.get_staff_or_404(db, staff_id)
    return StaffTimetable(
        staff_id=u.id, staff_name=u.name, periods=await svc.list_periods(db), slots=await svc.staff_slots(db, u.id)
    )


# ------------------------------------------------------------------ absence and substitutes
@router.post("/timetable/absences", response_model=AbsenceOut, status_code=201)
async def mark_absent(
    body: AbsenceIn, request: Request, p: Principal = Depends(manage_staff), db: AsyncSession = Depends(db_session)
):
    a = await svc.mark_absent(
        db, request_actor(p, request), staff_id=body.staff_id, absent_on=body.absent_on, reason=body.reason
    )
    items, _ = await svc.list_absences(db, on=a.absent_on, limit=200, offset=0)
    return next(i for i in items if i["id"] == a.id)


@router.get("/timetable/absences", response_model=Page[AbsenceOut])
async def absences(
    on: date | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage_staff),
    db: AsyncSession = Depends(db_session),
):
    items, total = await svc.list_absences(db, on=on, limit=limit, offset=offset)
    return Page(items=items, total=total)


@router.delete("/timetable/absences/{absence_id}", status_code=204)
async def remove_absence(
    absence_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage_staff),
    db: AsyncSession = Depends(db_session),
):
    """Un-mark an absence; substitutes assigned for that teacher and day are cancelled."""
    await svc.remove_absence(db, request_actor(p, request), absence_id)


@router.get("/timetable/cover", response_model=list[CoverRow])
async def cover(on: date | None = None, p: Principal = Depends(manage_staff), db: AsyncSession = Depends(db_session)):
    """Slots of absent teachers on a day that need (or already have) a substitute. Default today."""
    return await svc.cover_needed(db, on or today_ist())


@router.get("/timetable/free-teachers", response_model=list[FreeTeacher])
async def free_teachers(
    on: date, period_id: uuid.UUID, p: Principal = Depends(manage_staff), db: AsyncSession = Depends(db_session)
):
    return await svc.free_teachers(db, on, period_id)


@router.post("/timetable/substitutions", response_model=SubstitutionOut, status_code=201)
async def assign_substitute(
    body: SubstituteIn, request: Request, p: Principal = Depends(manage_staff), db: AsyncSession = Depends(db_session)
):
    """Assign or change the substitute for a slot on a date. The teacher must be absent and the substitute free."""
    sub = await svc.assign_substitute(
        db,
        request_actor(p, request),
        slot_id=body.slot_id,
        covers_on=body.covers_on,
        substitute_staff_id=body.substitute_staff_id,
    )
    return next(s for s in await svc.substitutions_on(db, sub.covers_on) if s.id == sub.id)


@router.get("/timetable/substitutions", response_model=list[SubstitutionOut])
async def substitutions(
    on: date | None = None, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    return await svc.substitutions_on(db, on or today_ist())


@router.delete("/timetable/substitutions/{substitution_id}", status_code=204)
async def remove_substitution(
    substitution_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage_staff),
    db: AsyncSession = Depends(db_session),
):
    await svc.remove_substitution(db, request_actor(p, request), substitution_id)


# ------------------------------------------------------------------ parents
@router.get("/parent/children/{student_id}/timetable", response_model=ChildTimetable)
async def child_timetable(
    on: date | None = None,
    s: Student = Depends(parent_child),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """The class timetable and, for the day `on` (default today), each period with any substitute teacher."""
    cls = await class_of_student(db, s.id, active_only=False)
    if cls is None:
        raise NotFound("No timetable for this child this year.", code="no_class")
    on = on or today_ist()
    return ChildTimetable(
        student_id=s.id,
        class_id=cls.id,
        class_label=class_label(cls),
        periods=await svc.list_periods(db),
        slots=await svc.class_slots(db, cls.id),
        on=on,
        today=await svc.child_day(db, cls.id, on),
    )
