"""Turns students into API shapes: list rows, the full detail with history, the parent's child cards, the photo."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, NotFound
from app.models.academic import AcademicYear, SchoolClass
from app.models.enums import AuditCategory
from app.models.file import Attachment
from app.models.student import Enrollment, Guardian, Student, StudentEvent, StudentGuardian
from app.models.user import User
from app.schemas.students import (
    ChildDetail,
    ChildOut,
    EnrollmentOut,
    EventOut,
    StudentDetail,
    StudentListItem,
)
from app.services.audit import Actor, change, log_audit
from app.services.guardians import guardians_of_student
from app.services.storage import get_storage
from app.services.students import (
    class_label,
    current_enrollment,
    current_year_or_none,
    full_name,
    guardian_summary_map,
    student_label,
)


async def photo_link(db: AsyncSession, student: Student) -> str | None:
    if not student.photo_file_id:
        return None
    a = await db.get(Attachment, student.photo_file_id)
    if a is None or a.status != "ready":
        return None
    return await get_storage().download_url(a.storage_key, a.filename, settings.download_url_ttl_seconds)


async def set_photo(db: AsyncSession, actor: Actor, student: Student, file_id: uuid.UUID | None) -> None:
    if file_id is None:
        student.photo_file_id = None
    else:
        a = await db.get(Attachment, file_id)
        if a is None:
            raise NotFound("File not found.")
        if a.purpose != "student_photo" or a.status != "ready":
            raise AppError(
                "Upload the photo first (purpose student_photo) and confirm it.", code="invalid_photo", status=422
            )
        student.photo_file_id = a.id
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student.photo_changed",
        f"{'Changed' if file_id else 'Removed'} photo of {student_label(student)}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        changes=[change("Photo", "", "updated" if file_id else "removed")],
    )


def _enr_out(e: Enrollment, c: SchoolClass, y: AcademicYear) -> EnrollmentOut:
    return EnrollmentOut(
        id=e.id,
        class_id=c.id,
        class_label=class_label(c),
        academic_year_id=y.id,
        academic_year=y.name,
        roll_no=e.roll_no,
        status=e.status,
        started_on=e.started_on,
        ended_on=e.ended_on,
    )


async def history(db: AsyncSession, student_id: uuid.UUID) -> list[EventOut]:
    events = (
        await db.scalars(
            select(StudentEvent)
            .where(StudentEvent.student_id == student_id)
            .order_by(StudentEvent.recorded_at.desc(), StudentEvent.id.desc())
        )
    ).all()
    cids = {x for e in events for x in (e.from_class_id, e.to_class_id) if x}
    classes = (
        {c.id: c for c in (await db.scalars(select(SchoolClass).where(SchoolClass.id.in_(cids)))).all()} if cids else {}
    )
    uids = {e.recorded_by for e in events if e.recorded_by}
    users = {u.id: u.name for u in (await db.scalars(select(User).where(User.id.in_(uids)))).all()} if uids else {}
    out = []
    for e in events:
        o = EventOut.model_validate(e)
        o.from_class = class_label(classes[e.from_class_id]) if e.from_class_id in classes else None
        o.to_class = class_label(classes[e.to_class_id]) if e.to_class_id in classes else None
        o.recorded_by_name = users.get(e.recorded_by) if e.recorded_by else None
        out.append(o)
    return out


async def enrollments(db: AsyncSession, student_id: uuid.UUID) -> list[EnrollmentOut]:
    rows = (
        await db.execute(
            select(Enrollment, SchoolClass, AcademicYear)
            .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
            .join(AcademicYear, AcademicYear.id == Enrollment.academic_year_id)
            .where(Enrollment.student_id == student_id)
            .order_by(AcademicYear.starts_on.desc())
        )
    ).all()
    return [_enr_out(*r) for r in rows]


async def student_detail(db: AsyncSession, s: Student) -> StudentDetail:
    enrs = await enrollments(db, s.id)
    cur = await current_enrollment(db, s.id, active_only=False)
    current = next((e for e in enrs if cur and e.id == cur.id), None)
    return StudentDetail(
        id=s.id,
        scholar_no=s.scholar_no,
        first_name=s.first_name,
        last_name=s.last_name,
        name=full_name(s),
        dob=s.dob,
        gender=s.gender,
        address=s.address,
        status=s.status,
        admitted_on=s.admitted_on,
        left_on=s.left_on,
        leaving_reason=s.leaving_reason,
        tc_number=s.tc_number,
        photo_url=await photo_link(db, s),
        blood_group=s.blood_group,
        category=s.category,
        samagra_id=s.samagra_id,
        pen=s.pen,
        previous_school=s.previous_school,
        medical_notes=s.medical_notes,
        emergency_name=s.emergency_name,
        emergency_phone=s.emergency_phone,
        current_enrollment=current,
        enrollments=enrs,
        guardians=await guardians_of_student(db, s.id),
        history=await history(db, s.id),
    )


async def list_items(
    db: AsyncSession, rows: list[tuple[Student, Enrollment | None, SchoolClass | None]]
) -> list[StudentListItem]:
    gmap = await guardian_summary_map(db, [s.id for s, _, _ in rows])
    return [
        StudentListItem(
            id=s.id,
            scholar_no=s.scholar_no,
            first_name=s.first_name,
            last_name=s.last_name,
            name=full_name(s),
            gender=s.gender,
            dob=s.dob,
            status=s.status,
            class_id=c.id if c else None,
            class_label=class_label(c) if c else None,
            roll_no=e.roll_no if e else None,
            enrollment_status=e.status if e else None,
            guardian_name=gmap[s.id].name if s.id in gmap else None,
            guardian_phone=gmap[s.id].phone if s.id in gmap else None,
        )
        for s, e, c in rows
    ]


# ------------------------------------------------------------------ the parent's view
async def child_cards(db: AsyncSession, user_id: uuid.UUID) -> list[ChildOut]:
    year = await current_year_or_none(db)
    rows = (
        await db.execute(
            select(Student, StudentGuardian.relation, Enrollment, SchoolClass)
            .join(StudentGuardian, StudentGuardian.student_id == Student.id)
            .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
            .outerjoin(
                Enrollment,
                (Enrollment.student_id == Student.id) & (Enrollment.academic_year_id == (year.id if year else None)),
            )
            .outerjoin(SchoolClass, SchoolClass.id == Enrollment.class_id)
            .where(Guardian.user_id == user_id)
            .order_by(Student.first_name, Student.id)
        )
    ).all()
    return [await _card(db, s, rel, e, c) for s, rel, e, c in rows]


async def _card(db: AsyncSession, s: Student, rel: str, e: Enrollment | None, c: SchoolClass | None) -> ChildOut:
    return ChildOut(
        student_id=s.id,
        scholar_no=s.scholar_no,
        name=full_name(s),
        status=s.status,
        read_only=s.status != "active",
        photo_url=await photo_link(db, s),
        class_id=c.id if c else None,
        class_label=class_label(c) if c else None,
        roll_no=e.roll_no if e else None,
        relation=rel,
    )


async def child_detail(db: AsyncSession, user_id: uuid.UUID, s: Student) -> ChildDetail:
    cards = [c for c in await child_cards(db, user_id) if c.student_id == s.id]
    if not cards:
        raise NotFound("Child not found.")
    return ChildDetail(
        **cards[0].model_dump(),
        dob=s.dob,
        gender=s.gender,
        blood_group=s.blood_group,
        address=s.address,
        admitted_on=s.admitted_on,
        guardians=await guardians_of_student(db, s.id),
    )
