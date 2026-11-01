import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission
from app.core.errors import Conflict, Forbidden, NotFound
from app.core.principal import Principal
from app.models.academic import ClassStaff
from app.models.enums import AuditCategory, InviteStatus, Permission, UserKind
from app.models.school import School
from app.models.user import CredentialInvite, StaffPermission, StaffProfile, User
from app.schemas.auth import AssignmentOut
from app.schemas.common import Page
from app.schemas.staff import (
    PermissionsIn,
    SendLoginIn,
    SendLoginOut,
    StaffBulkIn,
    StaffCreate,
    StaffOut,
    StaffPatch,
)
from app.services.audit import change, log_audit
from app.services.invites import ensure_invite, send_login
from app.services.schools import email_taken

router = APIRouter(prefix="/staff", tags=["staff"])
guard = require_permission(Permission.staff.value)

LABEL = {"fees.manage": "Fees", "library.manage": "Library", "staff.manage": "Staff", "academic.manage": "Academic"}


async def _school(db: AsyncSession, p: Principal) -> School:
    s = await db.get(School, p.school_id)
    assert s
    return s


async def _out(db: AsyncSession, users: list[User]) -> list[StaffOut]:
    ids = [u.id for u in users]
    profiles = {
        r.user_id: r for r in (await db.scalars(select(StaffProfile).where(StaffProfile.user_id.in_(ids)))).all()
    }
    perms: dict[uuid.UUID, list[str]] = {}
    for r in (
        await db.execute(
            select(StaffPermission.user_id, StaffPermission.permission).where(StaffPermission.user_id.in_(ids))
        )
    ).all():
        perms.setdefault(r.user_id, []).append(r.permission)
    assigns: dict[uuid.UUID, list[AssignmentOut]] = {}
    for r in (
        await db.execute(
            select(ClassStaff.staff_id, ClassStaff.class_id, ClassStaff.role, ClassStaff.subject_id).where(
                ClassStaff.staff_id.in_(ids)
            )
        )
    ).all():
        assigns.setdefault(r.staff_id, []).append(
            AssignmentOut(class_id=r.class_id, role=r.role, subject_id=r.subject_id)
        )
    invites = {
        i.user_id: i
        for i in (await db.scalars(select(CredentialInvite).where(CredentialInvite.user_id.in_(ids)))).all()
    }
    out = []
    for u in users:
        pr, inv = profiles.get(u.id), invites.get(u.id)
        status = "active" if u.last_login_at else (inv.status if inv else InviteStatus.pending.value)
        out.append(
            StaffOut(
                id=u.id,
                name=u.name,
                email=u.email,
                phone=u.phone,
                designation=pr.designation if pr else "",
                department=pr.department if pr else "",
                employee_code=pr.employee_code if pr else "",
                joined_on=pr.joined_on if pr else None,
                is_admin=u.is_admin,
                is_active=u.is_active,
                permissions=sorted(perms.get(u.id, [])),
                assignments=assigns.get(u.id, []),
                invite_status=status,
                login_sent_at=inv.last_sent_at if inv else None,
                last_login_at=u.last_login_at,
            )
        )
    return out


async def _staff_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    u = await db.get(User, user_id)
    if not u or u.kind != UserKind.staff.value or u.deleted_at:
        raise NotFound("Staff member not found.")
    return u


async def _next_code(db: AsyncSession, school_id: uuid.UUID) -> str:
    codes = (await db.scalars(select(StaffProfile.employee_code).where(StaffProfile.school_id == school_id))).all()
    top = max((int(c[3:]) for c in codes if c[3:].isdigit()), default=0)
    return f"EMP{top + 1:03d}"


async def _create(
    db: AsyncSession,
    p: Principal,
    *,
    name: str,
    email: str,
    designation: str,
    department: str = "",
    phone: str | None = None,
    joined_on=None,
) -> User:
    email = email.strip().lower()
    if await email_taken(db, email):
        raise Conflict(f"{email} already has a Scool login.", code="email_taken", details={"email": email})
    assert p.school_id
    u = User(
        school_id=p.school_id,
        kind=UserKind.staff.value,
        name=name.strip(),
        email=email,
        phone=phone,
        must_change_password=True,
    )
    db.add(u)
    await db.flush()
    db.add(
        StaffProfile(
            user_id=u.id,
            school_id=p.school_id,
            employee_code=await _next_code(db, p.school_id),
            designation=designation.strip(),
            department=department.strip(),
            joined_on=joined_on,
        )
    )
    await ensure_invite(db, u)
    return u


@router.get("", response_model=Page[StaffOut])
async def list_staff(q: str | None = None, p: Principal = Depends(guard), db: AsyncSession = Depends(db_session)):
    stmt = select(User).where(User.kind == UserKind.staff.value, User.deleted_at.is_(None)).order_by(User.name)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.email.ilike(like)))
    users = (await db.scalars(stmt)).all()
    return Page(items=await _out(db, list(users)), total=len(users))


@router.post("", response_model=StaffOut, status_code=201)
async def add_staff(
    body: StaffCreate, request: Request, p: Principal = Depends(guard), db: AsyncSession = Depends(db_session)
):
    u = await _create(
        db,
        p,
        name=body.name,
        email=str(body.email),
        designation=body.designation,
        department=body.department,
        phone=body.phone,
        joined_on=body.joined_on,
    )
    actor = request_actor(p, request)
    log_audit(
        db,
        actor,
        AuditCategory.staff,
        "staff.added",
        f"Added staff member {u.name} ({body.designation})",
        entity_type="user",
        entity_id=u.id,
        entity_label=u.name,
    )
    if body.send_login:
        await send_login(db, actor, u, school_name=(await _school(db, p)).name)
    await db.flush()
    return (await _out(db, [u]))[0]


@router.post("/bulk", response_model=Page[StaffOut], status_code=201)
async def add_staff_bulk(
    body: StaffBulkIn, request: Request, p: Principal = Depends(guard), db: AsyncSession = Depends(db_session)
):
    emails = [str(r.email).lower() for r in body.rows]
    if len(set(emails)) != len(emails):
        raise Conflict("The list has the same email twice.", code="duplicate_in_list")
    school = await _school(db, p)
    actor = request_actor(p, request)
    made = [await _create(db, p, name=r.name, email=str(r.email), designation=r.designation) for r in body.rows]
    log_audit(
        db,
        actor,
        AuditCategory.staff,
        "staff.added",
        f"Added {len(made)} staff members from a list",
        entity_label="Staff list",
    )
    if body.send_login:
        for u in made:
            await send_login(db, actor, u, school_name=school.name, audit=False)
        log_audit(
            db,
            actor,
            AuditCategory.staff,
            "login.sent",
            f"Sent login emails to {len(made)} staff",
            entity_label="Staff",
        )
    await db.flush()
    return Page(items=await _out(db, made), total=len(made))


@router.patch("/{user_id}", response_model=StaffOut)
async def edit_staff(
    user_id: uuid.UUID,
    body: StaffPatch,
    request: Request,
    p: Principal = Depends(guard),
    db: AsyncSession = Depends(db_session),
):
    u = await _staff_user(db, user_id)
    prof = await db.get(StaffProfile, u.id)
    changes = []
    if body.email and body.email.lower() != u.email:
        if await email_taken(db, str(body.email)):
            raise Conflict("That email already has a Scool login.", code="email_taken")
        changes.append(change("Email", u.email, str(body.email).lower()))
        u.email = str(body.email).lower()
    for field, target in (("name", u), ("phone", u)):
        v = getattr(body, field)
        if v is not None and v != getattr(target, field):
            changes.append(change(field.title(), getattr(target, field), v))
            setattr(target, field, v.strip() if isinstance(v, str) else v)
    if prof:
        for field in ("designation", "department", "joined_on"):
            v = getattr(body, field)
            if v is not None and v != getattr(prof, field):
                changes.append(change(field.replace("_", " ").title(), getattr(prof, field), v))
                setattr(prof, field, v.strip() if isinstance(v, str) else v)
    if changes:
        log_audit(
            db,
            request_actor(p, request),
            AuditCategory.staff,
            "staff.edited",
            f"Updated details of {u.name}",
            entity_type="user",
            entity_id=u.id,
            entity_label=u.name,
            changes=changes,
        )
    await db.flush()
    return (await _out(db, [u]))[0]


@router.put("/{user_id}/permissions", response_model=StaffOut)
async def set_permissions(
    user_id: uuid.UUID,
    body: PermissionsIn,
    request: Request,
    p: Principal = Depends(guard),
    db: AsyncSession = Depends(db_session),
):
    u = await _staff_user(db, user_id)
    if u.is_admin:
        raise Conflict("An admin already has every permission.", code="admin_has_all")
    if u.id == p.user_id and Permission.staff.value not in {x.value for x in body.permissions} and not p.is_admin:
        raise Forbidden("You cannot remove your own Staff access.", code="self_lockout")
    old = {
        r for r in (await db.scalars(select(StaffPermission.permission).where(StaffPermission.user_id == u.id))).all()
    }
    new = {x.value for x in body.permissions}
    if old != new:
        await db.execute(delete(StaffPermission).where(StaffPermission.user_id == u.id))
        for perm in sorted(new):
            db.add(StaffPermission(school_id=u.school_id, user_id=u.id, permission=perm))
        names = lambda s: ", ".join(LABEL[x] for x in sorted(s)) or "None"  # noqa: E731
        log_audit(
            db,
            request_actor(p, request),
            AuditCategory.staff,
            "staff.access_changed",
            f"Changed access for {u.name}: {names(old)} to {names(new)}",
            entity_type="user",
            entity_id=u.id,
            entity_label=u.name,
            sensitive=True,
            changes=[change("Access", names(old), names(new))],
        )
    await db.flush()
    return (await _out(db, [u]))[0]


@router.post("/{user_id}/send-login", response_model=SendLoginOut)
async def send_one(
    user_id: uuid.UUID, request: Request, p: Principal = Depends(guard), db: AsyncSession = Depends(db_session)
):
    u = await _staff_user(db, user_id)
    ok = await send_login(db, request_actor(p, request), u, school_name=(await _school(db, p)).name)
    return SendLoginOut(sent=int(ok), failed=int(not ok))


@router.post("/send-login", response_model=SendLoginOut)
async def send_many(
    body: SendLoginIn, request: Request, p: Principal = Depends(guard), db: AsyncSession = Depends(db_session)
):
    stmt = select(User).where(User.kind == UserKind.staff.value, User.deleted_at.is_(None), User.is_active.is_(True))
    if body.user_ids:
        stmt = stmt.where(User.id.in_(body.user_ids))
    else:  # everyone still waiting for a first login
        pending = select(CredentialInvite.user_id).where(CredentialInvite.status == InviteStatus.pending.value)
        stmt = stmt.where(User.id.in_(pending), User.last_login_at.is_(None))
    users = (await db.scalars(stmt)).all()
    school, actor, sent, failed = await _school(db, p), request_actor(p, request), 0, 0
    for u in users:
        if await send_login(db, actor, u, school_name=school.name, audit=False):
            sent += 1
        else:
            failed += 1
    log_audit(db, actor, AuditCategory.staff, "login.sent", f"Sent login emails to {sent} staff", entity_label="Staff")
    return SendLoginOut(sent=sent, failed=failed)


@router.delete("/{user_id}", status_code=204)
async def deactivate(
    user_id: uuid.UUID, request: Request, p: Principal = Depends(guard), db: AsyncSession = Depends(db_session)
):
    u = await _staff_user(db, user_id)
    if u.is_admin:
        raise Conflict("The admin account cannot be removed.", code="admin_protected")
    if u.id == p.user_id:
        raise Forbidden("You cannot remove yourself.", code="self_remove")
    u.is_active = False
    await db.execute(delete(ClassStaff).where(ClassStaff.staff_id == u.id))
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.staff,
        "staff.removed",
        f"Removed staff member {u.name}",
        entity_type="user",
        entity_id=u.id,
        entity_label=u.name,
        sensitive=True,
    )
