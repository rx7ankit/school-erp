"""Enrolment: the one place that creates a student with guardians, an enrollment and a history entry.

Used by direct enrolment (`POST /students`), by admission enrol and by the Excel import, so the rules are the same.
Other modules (fees) can register a hook with `register_enrol_hook` to act in the same transaction, for example
to save per-student fee options chosen at admission.
"""

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist
from app.core.errors import AppError, Conflict
from app.models.academic import AcademicYear, SchoolClass
from app.models.enums import AuditCategory, EnrollmentStatus, StudentStatus, YearStatus
from app.models.student import Enrollment, Guardian, Student
from app.models.user import User
from app.schemas.students import GuardianIn
from app.services.audit import Actor, log_audit
from app.services.guardians import (
    ensure_parent_login,
    ensure_primary,
    link_guardian,
    norm_email,
    resolve_guardian,
    school_name,
    send_parent_login,
)
from app.services.students import (
    add_student_event,
    class_label,
    ensure_capacity,
    full_name,
    get_class_or_404,
    next_roll_no,
    next_scholar_no,
    scholar_no_taken,
    student_label,
)


@dataclass
class EnrolContext:
    student: Student
    enrollment: Enrollment
    school_class: SchoolClass
    guardians: list[Guardian]
    actor: Actor
    fee_options: list[dict[str, Any]] | None = None


EnrolHook = Callable[[AsyncSession, EnrolContext], Awaitable[None]]
ENROL_HOOKS: list[EnrolHook] = []


def register_enrol_hook(hook: EnrolHook) -> None:
    """Runs inside the enrolment transaction, once the student and enrollment exist. Raise to roll back."""
    if hook not in ENROL_HOOKS:
        ENROL_HOOKS.append(hook)


@dataclass
class EnrolResult:
    student: Student
    enrollment: Enrollment
    guardians: list[Guardian]
    new_users: list[User] = field(default_factory=list)
    login_users: list[User] = field(default_factory=list)  # every parent login of this child
    sent: int = 0
    failed: int = 0


STUDENT_COLUMNS = (
    "first_name",
    "last_name",
    "dob",
    "gender",
    "address",
    "blood_group",
    "category",
    "samagra_id",
    "pen",
    "previous_school",
    "medical_notes",
    "emergency_name",
    "emergency_phone",
)


def check_guardians(guardians: list[GuardianIn], *, need_email: bool) -> None:
    """Cheap checks before anything is written. A new guardian needs a name and a mobile (ERD v9)."""
    for g in guardians:
        if g.guardian_id:
            continue
        if not (g.name and g.name.strip()):
            raise AppError("Every guardian needs a name.", code="guardian_name_required", status=422)
        if not (g.phone and g.phone.strip()):
            raise AppError(f"{g.name}: a mobile number is needed.", code="guardian_phone_required", status=422)
    if need_email and not any(g.guardian_id or g.email for g in guardians):
        raise AppError(
            "A guardian email is needed to create a parent login.", code="guardian_email_required", status=422
        )


async def enrol_student(
    db: AsyncSession,
    actor: Actor,
    *,
    fields: dict[str, Any],
    class_id: uuid.UUID,
    guardians: list[GuardianIn],
    admitted_on: date | None = None,
    scholar_no: str | None = None,
    roll_no: int | None = None,
    create_login: bool = False,
    send_login: bool = False,
    fee_options: list[dict[str, Any]] | None = None,
    reason: str | None = None,
    audit: bool = True,
) -> EnrolResult:
    """Everything in the caller's transaction: if anything fails, nothing is saved.
    The login email is sent last, after all rows exist."""
    assert actor.school_id
    check_guardians(guardians, need_email=create_login)
    cls = await get_class_or_404(db, class_id)
    year = await db.get(AcademicYear, cls.academic_year_id)
    if year is None or year.status == YearStatus.completed.value:
        raise Conflict("That class belongs to a completed year.", code="year_completed")
    await ensure_capacity(db, cls)
    on = admitted_on or today_ist()
    if scholar_no:
        scholar_no = scholar_no.strip()
        if await scholar_no_taken(db, scholar_no):
            raise Conflict(f"Scholar number {scholar_no} is already used.", code="scholar_no_taken")
    else:
        scholar_no = await next_scholar_no(db, actor.school_id)

    student = Student(
        school_id=actor.school_id,
        scholar_no=scholar_no,
        status=StudentStatus.active.value,
        admitted_on=on,
        **{k: fields.get(k) for k in STUDENT_COLUMNS if k != "last_name"},
        last_name=fields.get("last_name") or "",
    )
    db.add(student)
    await db.flush()

    linked: list[Guardian] = []
    has_primary = any(g.is_primary for g in guardians)
    for i, g in enumerate(guardians):
        guardian, _ = await resolve_guardian(db, actor.school_id, g)
        if any(x.id == guardian.id for x in linked):
            continue
        await link_guardian(
            db,
            student,
            guardian,
            relation=g.relation,
            is_primary=g.is_primary or (not has_primary and i == 0),
            is_emergency=g.is_emergency,
        )
        linked.append(guardian)
    await ensure_primary(db, student)

    enr = Enrollment(
        school_id=actor.school_id,
        student_id=student.id,
        class_id=cls.id,
        academic_year_id=year.id,
        roll_no=roll_no or await next_roll_no(db, cls.id),
        status=EnrollmentStatus.active.value,
        started_on=on,
    )
    db.add(enr)
    await db.flush()
    add_student_event(
        db, actor, student, "admitted", to_class_id=cls.id, academic_year_id=year.id, effective_on=on, reason=reason
    )

    ctx = EnrolContext(student, enr, cls, linked, actor, fee_options)
    for hook in ENROL_HOOKS:
        await hook(db, ctx)

    result = EnrolResult(student, enr, linked)
    if create_login:
        for g in linked:
            if norm_email(g.email) or g.user_id:
                user, created = await ensure_parent_login(db, g)
                result.login_users.append(user)
                if created:
                    result.new_users.append(user)
    if audit:
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "student.admitted",
            f"Admitted {student_label(student)} to Class {class_label(cls)} ({year.name})",
            entity_type="student",
            entity_id=student.id,
            entity_label=full_name(student),
        )
    await db.flush()
    if send_login and result.login_users:
        await send_new_logins(db, actor, result)
    return result


async def send_new_logins(db: AsyncSession, actor: Actor, result: EnrolResult) -> None:
    """Sends a login to parents who have never signed in. A parent who already uses the app (a sibling was
    enrolled before) keeps their password: nothing is reset."""
    school = await school_name(db, actor.school_id) if actor.school_id else ""
    for u in result.login_users:
        if u.last_login_at is None:
            if await send_parent_login(db, actor, u, school=school):
                result.sent += 1
            else:
                result.failed += 1
