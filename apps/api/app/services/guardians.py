"""Guardians, parent logins and the parent's view of their children.

Helpers other modules should use: `parent_child_ids`, `assert_parent_child`, `guardians_of_student`,
`guardian_user_ids_of_student` (who to notify), `ensure_parent_login`.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Conflict, NotFound
from app.models.enums import AuditCategory, InviteStatus, StudentStatus, UserKind
from app.models.school import School
from app.models.student import Guardian, Student, StudentGuardian
from app.models.user import CredentialInvite, User
from app.schemas.students import GuardianIn, GuardianOut
from app.services.audit import Actor, change, log_audit
from app.services.invites import ensure_invite, send_login
from app.services.schools import email_taken
from app.services.students import full_name, get_student_or_404, student_label


def norm_email(email: str | None) -> str | None:
    e = (email or "").strip().lower()
    return e or None


# ------------------------------------------------------------------ parent side
async def parent_child_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    """Ids of the students linked to this parent login (any status: a child who left stays readable)."""
    rows = await db.scalars(
        select(StudentGuardian.student_id)
        .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
        .where(Guardian.user_id == user_id)
    )
    return list(rows.all())


async def assert_parent_child(
    db: AsyncSession, user_id: uuid.UUID, student_id: uuid.UUID, *, writable: bool = False
) -> Student:
    """Returns the child, or 404 if this parent has no such child (never reveals another family's child).
    `writable=True` is for actions that change something (sending a message, a leave request): a child who has
    left is read-only for the parent."""
    linked = await db.scalar(
        select(StudentGuardian.student_id)
        .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
        .where(Guardian.user_id == user_id, StudentGuardian.student_id == student_id)
    )
    if linked is None:
        raise NotFound("Child not found.")
    student = await get_student_or_404(db, student_id)
    if writable and student.status != StudentStatus.active.value:
        raise AppError(
            f"{full_name(student)} has left the school, so this is read-only.", code="child_read_only", status=403
        )
    return student


async def guardian_user_ids_of_student(db: AsyncSession, student_id: uuid.UUID) -> list[uuid.UUID]:
    """Parent logins to notify about a child."""
    rows = await db.scalars(
        select(Guardian.user_id)
        .join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id)
        .where(StudentGuardian.student_id == student_id, Guardian.user_id.is_not(None))
    )
    return list(rows.all())


# ------------------------------------------------------------------ guardians
async def find_guardian_by_email(db: AsyncSession, email: str | None) -> Guardian | None:
    e = norm_email(email)
    return await db.scalar(select(Guardian).where(Guardian.email == e)) if e else None


async def login_state(
    db: AsyncSession, guardians: list[Guardian]
) -> dict[uuid.UUID, tuple[str, User | None, CredentialInvite | None]]:
    """guardian id -> (none | pending | sent | failed | active, user, invite)."""
    uids = [g.user_id for g in guardians if g.user_id]
    users = {u.id: u for u in (await db.scalars(select(User).where(User.id.in_(uids)))).all()} if uids else {}
    invites = (
        {
            i.user_id: i
            for i in (await db.scalars(select(CredentialInvite).where(CredentialInvite.user_id.in_(uids)))).all()
        }
        if uids
        else {}
    )
    out = {}
    for g in guardians:
        u = users.get(g.user_id) if g.user_id else None
        inv = invites.get(u.id) if u else None
        if u is None:
            status = "none"
        elif u.last_login_at:
            status = "active"
        else:
            status = inv.status if inv else InviteStatus.pending.value
        out[g.id] = (status, u, inv)
    return out


async def guardians_of_student(db: AsyncSession, student_id: uuid.UUID) -> list[GuardianOut]:
    rows = (
        await db.execute(
            select(Guardian, StudentGuardian)
            .join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id)
            .where(StudentGuardian.student_id == student_id)
            .order_by(StudentGuardian.is_primary.desc(), Guardian.name)
        )
    ).all()
    state = await login_state(db, [g for g, _ in rows])
    return [
        GuardianOut(
            id=g.id,
            name=g.name,
            phone=g.phone,
            email=g.email,
            occupation=g.occupation,
            relation=link.relation,
            is_primary=link.is_primary,
            is_emergency=link.is_emergency,
            has_login=g.user_id is not None,
            login_status=state[g.id][0],
            last_login_at=state[g.id][1].last_login_at if state[g.id][1] else None,
        )
        for g, link in rows
    ]


async def resolve_guardian(db: AsyncSession, school_id: uuid.UUID, g: GuardianIn) -> tuple[Guardian, bool]:
    """Finds the guardian this input means (by id, then by email) or creates one. Returns (guardian, created)."""
    if g.guardian_id:
        found = await db.get(Guardian, g.guardian_id)
        if found is None:
            raise NotFound("Guardian not found.")
        return found, False
    email = norm_email(str(g.email) if g.email else None)
    existing = await find_guardian_by_email(db, email)
    if existing:
        return existing, False
    if not g.name or not g.name.strip():
        raise AppError("A guardian needs a name.", code="validation_error", status=422)
    new = Guardian(
        school_id=school_id,
        name=g.name.strip(),
        phone=(g.phone or "").strip() or None,
        email=email,
        occupation=g.occupation,
    )
    db.add(new)
    await db.flush()
    return new, True


async def link_guardian(
    db: AsyncSession, student: Student, guardian: Guardian, *, relation: str, is_primary: bool, is_emergency: bool
) -> StudentGuardian:
    """Links (or updates the link of) a guardian and a student. Only one guardian is primary per student."""
    link = await db.get(StudentGuardian, (student.id, guardian.id))
    if link is None:
        link = StudentGuardian(school_id=student.school_id, student_id=student.id, guardian_id=guardian.id)
        db.add(link)
    link.relation, link.is_emergency = relation, is_emergency
    link.is_primary = is_primary
    await db.flush()
    if is_primary:
        for other in (
            await db.scalars(
                select(StudentGuardian).where(
                    StudentGuardian.student_id == student.id, StudentGuardian.guardian_id != guardian.id
                )
            )
        ).all():
            other.is_primary = False
    return link


async def ensure_primary(db: AsyncSession, student: Student) -> None:
    """If a student has guardians but none is primary, the first one becomes primary."""
    links = (await db.scalars(select(StudentGuardian).where(StudentGuardian.student_id == student.id))).all()
    if links and not any(link.is_primary for link in links):
        links[0].is_primary = True
        await db.flush()


# ------------------------------------------------------------------ parent logins
async def ensure_parent_login(db: AsyncSession, guardian: Guardian) -> tuple[User, bool]:
    """The guardian's parent login (kind=parent, must change password), created if missing. Returns (user, created).
    The email must not already be a login of anyone else, in any school."""
    if guardian.user_id:
        u = await db.get(User, guardian.user_id)
        if u:
            return u, False
    email = norm_email(guardian.email)
    if not email:
        raise AppError(
            f"{guardian.name} has no email, so a login cannot be created.", code="guardian_email_required", status=422
        )
    if await email_taken(db, email):
        raise Conflict(
            f"{email} already has a Scool login.",
            code="email_taken",
            details={"email": email, "guardian": guardian.name},
        )
    user = User(
        school_id=guardian.school_id,
        kind=UserKind.parent.value,
        name=guardian.name,
        email=email,
        phone=guardian.phone,
        must_change_password=True,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as e:  # a parallel request took the email
        raise Conflict(f"{email} already has a Scool login.", code="email_taken") from e
    guardian.user_id = user.id
    await ensure_invite(db, user)
    await db.flush()
    return user, True


async def school_name(db: AsyncSession, school_id: uuid.UUID) -> str:
    s = await db.get(School, school_id)
    return s.name if s else "your school"


async def send_parent_login(db: AsyncSession, actor: Actor, user: User, *, school: str, audit: bool = True) -> bool:
    return await send_login(db, actor, user, school_name=school, audit=audit, category=AuditCategory.students)


# ------------------------------------------------------------------ editing guardians
async def edit_guardian(db: AsyncSession, actor: Actor, guardian: Guardian, values: dict) -> None:
    changes = []
    for field in ("name", "phone", "email", "occupation"):
        if field not in values:
            continue
        v = values[field]
        v = norm_email(str(v)) if field == "email" and v else (v.strip() or None) if isinstance(v, str) else v
        if field == "name" and not v:
            raise AppError("A guardian needs a name.", code="validation_error", status=422)
        old = getattr(guardian, field)
        if v == old:
            continue
        if field == "email":
            if guardian.user_id:
                raise Conflict(
                    "This parent already has a login, so the email cannot be changed here.", code="guardian_has_login"
                )
            if v and await find_guardian_by_email(db, v):
                raise Conflict("Another guardian already uses that email.", code="guardian_email_taken")
        changes.append(change(field.title(), old, v))
        setattr(guardian, field, v)
    if changes:
        if guardian.user_id:
            u = await db.get(User, guardian.user_id)
            if u:
                u.name, u.phone = guardian.name, guardian.phone
        try:
            await db.flush()
        except IntegrityError as e:
            raise Conflict("Another guardian already uses that email.", code="guardian_email_taken") from e
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "guardian.edited",
            f"Updated guardian {guardian.name}",
            entity_type="guardian",
            entity_id=guardian.id,
            entity_label=guardian.name,
            changes=changes,
        )


async def unlink_guardian(db: AsyncSession, actor: Actor, student: Student, guardian: Guardian) -> None:
    link = await db.get(StudentGuardian, (student.id, guardian.id))
    if link is None:
        raise NotFound("That guardian is not linked to this student.")
    await db.delete(link)
    await db.flush()
    await ensure_primary(db, student)
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "guardian.unlinked",
        f"Removed guardian {guardian.name} from {student_label(student)}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=guardian.user_id is not None,
    )
