import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission, require_staff
from app.core.errors import Conflict, NotFound
from app.core.principal import Principal
from app.models.academic import AcademicYear, ClassStaff, ClassSubject, SchoolClass, Subject
from app.models.enums import (
    AuditCategory,
    ClassRole,
    EnrollmentStatus,
    Permission,
    UserKind,
    YearStatus,
)
from app.models.student import Enrollment
from app.models.user import User
from app.schemas.academic import (
    AssignmentRow,
    ClassIn,
    ClassOut,
    ClassPatch,
    ClassSubjectsIn,
    SubjectIn,
    SubjectOut,
    TeacherIn,
    YearIn,
    YearOut,
)
from app.schemas.common import Page
from app.services.audit import change, log_audit

router = APIRouter(prefix="/academic", tags=["academic"])
manage = require_permission(Permission.academic.value)


def label(c: SchoolClass) -> str:
    return f"{c.grade}-{c.section}"


async def current_year(db: AsyncSession) -> AcademicYear:
    y = await db.scalar(select(AcademicYear).where(AcademicYear.status == YearStatus.current.value))
    if not y:
        raise Conflict("There is no current academic year. Create one first.", code="no_current_year")
    return y


async def _class(db: AsyncSession, class_id: uuid.UUID) -> SchoolClass:
    c = await db.get(SchoolClass, class_id)
    if not c:
        raise NotFound("Class not found.")
    return c


async def _staff(db: AsyncSession, staff_id: uuid.UUID) -> User:
    u = await db.get(User, staff_id)
    if not u or u.kind != UserKind.staff.value or not u.is_active or u.deleted_at:
        raise NotFound("Staff member not found.")
    return u


# ---------------------------------------------------------------- years
@router.get("/years", response_model=Page[YearOut])
async def years(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    rows = (await db.scalars(select(AcademicYear).order_by(AcademicYear.starts_on.desc()))).all()
    return Page(items=rows, total=len(rows))


@router.post("/years", response_model=YearOut, status_code=201)
async def add_year(
    body: YearIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    y = AcademicYear(
        school_id=p.school_id,
        name=body.name.strip(),
        starts_on=body.starts_on,
        ends_on=body.ends_on,
        status=YearStatus.draft.value,
    )
    db.add(y)
    try:
        await db.flush()
    except IntegrityError as e:
        raise Conflict(f"The year {body.name} already exists.", code="year_exists") from e
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.academic,
        "year.created",
        f"Created academic year {y.name}",
        entity_type="academic_year",
        entity_id=y.id,
        entity_label=y.name,
    )
    return y


@router.post("/years/{year_id}/set-current", response_model=YearOut)
async def set_current(
    year_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    y = await db.get(AcademicYear, year_id)
    if not y:
        raise NotFound("Year not found.")
    if y.status == YearStatus.completed.value:
        raise Conflict("A completed year cannot be reopened.", code="year_completed")
    old = await db.scalar(select(AcademicYear).where(AcademicYear.status == YearStatus.current.value))
    if old and old.id != y.id:
        old.status = YearStatus.completed.value
        await db.flush()  # free the "one current year" slot before taking it
    y.status = YearStatus.current.value
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.academic,
        "year.current",
        f"Made {y.name} the current academic year",
        entity_type="academic_year",
        entity_id=y.id,
        entity_label=y.name,
        sensitive=True,
        changes=[change("Current year", old.name if old else "None", y.name)],
    )
    await db.flush()
    return y


# ---------------------------------------------------------------- classes
async def _class_out(db: AsyncSession, classes: list[SchoolClass]) -> list[ClassOut]:
    ids = [c.id for c in classes]
    counts = dict(
        (
            await db.execute(
                select(Enrollment.class_id, func.count())
                .where(Enrollment.class_id.in_(ids), Enrollment.status == EnrollmentStatus.active.value)
                .group_by(Enrollment.class_id)
            )
        ).all()
    )
    teachers = dict(
        (
            await db.execute(
                select(ClassStaff.class_id, ClassStaff.staff_id).where(
                    ClassStaff.class_id.in_(ids), ClassStaff.role == ClassRole.class_teacher.value
                )
            )
        ).all()
    )
    subs: dict[uuid.UUID, list[uuid.UUID]] = {}
    for cid, sid in (
        await db.execute(select(ClassSubject.class_id, ClassSubject.subject_id).where(ClassSubject.class_id.in_(ids)))
    ).all():
        subs.setdefault(cid, []).append(sid)
    return [
        ClassOut(
            id=c.id,
            academic_year_id=c.academic_year_id,
            grade=c.grade,
            section=c.section,
            display_order=c.display_order,
            capacity=c.capacity,
            is_custom=c.is_custom,
            next_class_id=c.next_class_id,
            students=counts.get(c.id, 0),
            class_teacher_id=teachers.get(c.id),
            subject_ids=subs.get(c.id, []),
        )
        for c in classes
    ]


@router.get("/classes", response_model=Page[ClassOut])
async def classes(
    year_id: uuid.UUID | None = None, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    yid = year_id or (await current_year(db)).id
    rows = (
        await db.scalars(
            select(SchoolClass)
            .where(SchoolClass.academic_year_id == yid)
            .order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section)
        )
    ).all()
    return Page(items=await _class_out(db, list(rows)), total=len(rows))


@router.post("/classes", response_model=ClassOut, status_code=201)
async def add_class(
    body: ClassIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    year = await db.get(AcademicYear, body.academic_year_id) if body.academic_year_id else await current_year(db)
    if not year:
        raise NotFound("Year not found.")
    if year.status == YearStatus.completed.value:
        raise Conflict("That year is completed. Classes cannot be added to it.", code="year_completed")
    grade = body.grade.strip()
    order = body.display_order
    if order is None:
        order = int(grade) if grade.isdigit() else 0 if body.is_custom else 99
    c = SchoolClass(
        school_id=p.school_id,
        academic_year_id=year.id,
        grade=grade,
        section=body.section.strip(),
        capacity=body.capacity,
        is_custom=body.is_custom or not grade.isdigit(),
        display_order=order,
    )
    db.add(c)
    try:
        await db.flush()
    except IntegrityError as e:
        raise Conflict(f"Class {label(c)} already exists.", code="class_exists") from e
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.academic,
        "class.created",
        f"Created Class {label(c)} ({year.name})",
        entity_type="class",
        entity_id=c.id,
        entity_label=label(c),
    )
    return (await _class_out(db, [c]))[0]


@router.patch("/classes/{class_id}", response_model=ClassOut)
async def edit_class(
    class_id: uuid.UUID,
    body: ClassPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    c = await _class(db, class_id)
    before = label(c)
    if body.section is not None:
        c.section = body.section.strip()
    if body.capacity is not None:
        c.capacity = body.capacity
    if body.next_class_id is not None:
        c.next_class_id = body.next_class_id
    try:
        await db.flush()
    except IntegrityError as e:
        raise Conflict(f"Class {label(c)} already exists.", code="class_exists") from e
    if label(c) != before:
        log_audit(
            db,
            request_actor(p, request),
            AuditCategory.academic,
            "class.renamed",
            f"Renamed Class {before} to {label(c)}",
            entity_type="class",
            entity_id=c.id,
            entity_label=label(c),
            changes=[change("Class", before, label(c))],
        )
    return (await _class_out(db, [c]))[0]


@router.delete("/classes/{class_id}", status_code=204)
async def delete_class(
    class_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    c = await _class(db, class_id)
    students = await db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.class_id == c.id)) or 0
    if students:
        raise Conflict(f"Class {label(c)} has students. Move them first.", code="class_has_students")
    if await db.scalar(select(func.count()).select_from(ClassStaff).where(ClassStaff.class_id == c.id)):
        raise Conflict(f"Class {label(c)} still has teachers assigned. Remove them first.", code="class_has_teachers")
    await db.execute(delete(ClassSubject).where(ClassSubject.class_id == c.id))
    await db.delete(c)
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.academic,
        "class.deleted",
        f"Deleted Class {label(c)}",
        entity_type="class",
        entity_id=c.id,
        entity_label=label(c),
        sensitive=True,
    )


# ---------------------------------------------------------------- subjects
@router.get("/subjects", response_model=Page[SubjectOut])
async def subjects(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    rows = (await db.scalars(select(Subject).order_by(Subject.name))).all()
    return Page(items=rows, total=len(rows))


@router.post("/subjects", response_model=SubjectOut, status_code=201)
async def add_subject(
    body: SubjectIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    s = Subject(school_id=p.school_id, name=body.name.strip(), code=body.code)
    db.add(s)
    try:
        await db.flush()
    except IntegrityError as e:
        raise Conflict(f"{body.name} already exists.", code="subject_exists") from e
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.academic,
        "subject.created",
        f"Created subject {s.name}",
        entity_type="subject",
        entity_id=s.id,
        entity_label=s.name,
    )
    return s


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
async def edit_subject(
    subject_id: uuid.UUID,
    body: SubjectIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await db.get(Subject, subject_id)
    if not s:
        raise NotFound("Subject not found.")
    before = s.name
    s.name, s.code = body.name.strip(), body.code
    try:
        await db.flush()
    except IntegrityError as e:
        raise Conflict(f"{body.name} already exists.", code="subject_exists") from e
    if before != s.name:
        log_audit(
            db,
            request_actor(p, request),
            AuditCategory.academic,
            "subject.renamed",
            f"Renamed subject {before} to {s.name}",
            entity_type="subject",
            entity_id=s.id,
            entity_label=s.name,
            changes=[change("Subject", before, s.name)],
        )
    return s


@router.delete("/subjects/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    s = await db.get(Subject, subject_id)
    if not s:
        raise NotFound("Subject not found.")
    if await db.scalar(select(func.count()).select_from(ClassSubject).where(ClassSubject.subject_id == s.id)):
        raise Conflict(f"{s.name} is still taught in some classes. Untick it there first.", code="subject_in_use")
    await db.delete(s)
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.academic,
        "subject.deleted",
        f"Deleted subject {s.name}",
        entity_type="subject",
        entity_id=s.id,
        entity_label=s.name,
    )


@router.put("/classes/{class_id}/subjects", response_model=ClassOut)
async def set_class_subjects(
    class_id: uuid.UUID,
    body: ClassSubjectsIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    c = await _class(db, class_id)
    wanted = set(body.subject_ids)
    found = set((await db.scalars(select(Subject.id).where(Subject.id.in_(wanted)))).all()) if wanted else set()
    if found != wanted:
        raise NotFound("One of the subjects does not exist.")
    current = set((await db.scalars(select(ClassSubject.subject_id).where(ClassSubject.class_id == c.id))).all())
    for sid in current - wanted:  # removing a subject also ends its teacher assignment
        await db.execute(delete(ClassStaff).where(ClassStaff.class_id == c.id, ClassStaff.subject_id == sid))
    await db.execute(
        delete(ClassSubject).where(ClassSubject.class_id == c.id, ClassSubject.subject_id.in_(current - wanted))
    )
    for sid in wanted - current:
        db.add(ClassSubject(school_id=p.school_id, class_id=c.id, subject_id=sid))
    if current != wanted:
        log_audit(
            db,
            request_actor(p, request),
            AuditCategory.academic,
            "class.subjects_changed",
            f"Changed subjects of Class {label(c)}: {len(current)} to {len(wanted)}",
            entity_type="class",
            entity_id=c.id,
            entity_label=label(c),
        )
    await db.flush()
    return (await _class_out(db, [c]))[0]


# ---------------------------------------------------------------- teacher assignments
@router.get("/assignments", response_model=Page[AssignmentRow])
async def assignments(
    class_id: uuid.UUID | None = None, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    stmt = select(ClassStaff, User.name).join(User, User.id == ClassStaff.staff_id)
    if class_id:
        stmt = stmt.where(ClassStaff.class_id == class_id)
    rows = (await db.execute(stmt)).all()
    return Page(
        items=[
            AssignmentRow(class_id=a.class_id, staff_id=a.staff_id, staff_name=n, role=a.role, subject_id=a.subject_id)
            for a, n in rows
        ],
        total=len(rows),
    )


@router.put("/classes/{class_id}/class-teacher")
async def set_class_teacher(
    class_id: uuid.UUID,
    body: TeacherIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    c = await _class(db, class_id)
    cur = await db.scalar(
        select(ClassStaff).where(ClassStaff.class_id == c.id, ClassStaff.role == ClassRole.class_teacher.value)
    )
    cur_name = (await db.get(User, cur.staff_id)).name if cur else "Nobody"  # type: ignore[union-attr]
    if cur and body.staff_id == cur.staff_id:
        return {"ok": True}
    if cur:
        await db.delete(cur)
        await db.flush()
    new_name = "Nobody"
    if body.staff_id:
        u = await _staff(db, body.staff_id)
        new_name = u.name
        db.add(ClassStaff(school_id=p.school_id, class_id=c.id, staff_id=u.id, role=ClassRole.class_teacher.value))
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.staff,
        "classteacher.changed",
        f"Changed class teacher of Class {label(c)} from {cur_name} to {new_name}",
        entity_type="class",
        entity_id=c.id,
        entity_label=label(c),
        sensitive=True,
        changes=[change(f"Class teacher, {label(c)}", cur_name, new_name)],
    )
    await db.flush()
    return {"ok": True}


@router.put("/classes/{class_id}/subject-teachers/{subject_id}")
async def set_subject_teacher(
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
    body: TeacherIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    c = await _class(db, class_id)
    subj = await db.get(Subject, subject_id)
    if not subj or not await db.scalar(
        select(ClassSubject).where(ClassSubject.class_id == c.id, ClassSubject.subject_id == subject_id)
    ):
        raise NotFound("Class does not study this subject.")
    cur = await db.scalar(
        select(ClassStaff).where(
            ClassStaff.class_id == c.id,
            ClassStaff.subject_id == subject_id,
            ClassStaff.role == ClassRole.subject_teacher.value,
        )
    )
    cur_name = (await db.get(User, cur.staff_id)).name if cur else "Nobody"  # type: ignore[union-attr]
    if cur and body.staff_id == cur.staff_id:
        return {"ok": True}
    if cur:
        await db.delete(cur)
        await db.flush()
    new_name = "Nobody"
    if body.staff_id:
        u = await _staff(db, body.staff_id)
        new_name = u.name
        db.add(
            ClassStaff(
                school_id=p.school_id,
                class_id=c.id,
                staff_id=u.id,
                role=ClassRole.subject_teacher.value,
                subject_id=subject_id,
            )
        )
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.academic,
        "subjectteacher.changed",
        f"Changed {subj.name} teacher of Class {label(c)} from {cur_name} to {new_name}",
        entity_type="class",
        entity_id=c.id,
        entity_label=label(c),
        changes=[change(f"{subj.name}, {label(c)}", cur_name, new_name)],
    )
    await db.flush()
    return {"ok": True}
