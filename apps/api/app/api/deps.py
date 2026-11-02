"""Request dependencies: who is calling, which school's data they may touch, and what they may do."""

import hmac
import uuid
from collections.abc import AsyncIterator, Callable

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import Forbidden, Unauthorized
from app.core.principal import ClassAssignment, Principal
from app.core.security import decode_access_token
from app.db.session import make_session
from app.models.academic import ClassStaff
from app.models.enums import SchoolStatus, UserKind
from app.models.school import School
from app.models.student import Student
from app.models.user import AuthSession, StaffPermission, User
from app.services.guardians import assert_parent_child, parent_child_ids

_bearer = HTTPBearer(auto_error=False)


async def get_principal(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Principal:
    """The signed-in user, from the access token. Does not check must_change_password."""
    if creds is None:
        raise Unauthorized("Please sign in.", code="not_signed_in")
    claims = decode_access_token(creds.credentials)
    s = make_session(school_id=claims.school_id, bypass=claims.kind == UserKind.owner.value)
    try:
        sess = await s.get(AuthSession, claims.session_id)
        if sess is None or sess.revoked_at is not None or sess.user_id != claims.user_id:
            raise Unauthorized("Please sign in again.", code="session_ended")
        user = await s.get(User, claims.user_id)
        if user is None or not user.is_active or user.deleted_at is not None or user.school_id != claims.school_id:
            raise Unauthorized("Please sign in again.", code="session_ended")
        school_status = None
        if user.school_id:
            school = await s.get(School, user.school_id)
            school_status = school.status if school else None
            if school_status == SchoolStatus.suspended.value:
                raise Forbidden(
                    "This school's account is paused. Please contact the school office.", code="school_suspended"
                )
        perms: set[str] = set()
        assignments: list[ClassAssignment] = []
        if user.kind == UserKind.staff.value:
            perms = set(
                (await s.scalars(select(StaffPermission.permission).where(StaffPermission.user_id == user.id))).all()
            )
            rows = (
                await s.execute(
                    select(ClassStaff.class_id, ClassStaff.role, ClassStaff.subject_id).where(
                        ClassStaff.staff_id == user.id
                    )
                )
            ).all()
            assignments = [ClassAssignment(r.class_id, r.role, r.subject_id) for r in rows]
        return Principal(
            user.id,
            claims.session_id,
            user.kind,
            user.school_id,
            user.name,
            user.email,
            user.is_admin,
            user.must_change_password,
            perms,
            assignments,
            school_status,
        )
    finally:
        await s.close()


async def current_principal(p: Principal = Depends(get_principal)) -> Principal:
    """Same as get_principal, but a person with a temporary password must choose their own first."""
    if p.must_change_password:
        raise Forbidden("Please choose your own password first.", code="password_change_required")
    return p


async def db_session(p: Principal = Depends(current_principal)) -> AsyncIterator[AsyncSession]:
    """A session limited to the caller's school. The platform owner crosses schools on purpose."""
    s = make_session(school_id=p.school_id, bypass=p.is_owner)
    try:
        yield s
        await s.commit()
    except Exception:
        await s.rollback()
        raise
    finally:
        await s.close()


async def db_session_any(p: Principal = Depends(get_principal)) -> AsyncIterator[AsyncSession]:
    """For the few routes a person with a temporary password may call (change password, me)."""
    s = make_session(school_id=p.school_id, bypass=p.is_owner)
    try:
        yield s
        await s.commit()
    except Exception:
        await s.rollback()
        raise
    finally:
        await s.close()


def require_permission(permission: str) -> Callable[..., Principal]:
    async def dep(p: Principal = Depends(current_principal)) -> Principal:
        if not p.has(permission):
            raise Forbidden("You do not have access to this.", code="missing_permission", details={"needs": permission})
        return p

    return dep


async def require_staff(p: Principal = Depends(current_principal)) -> Principal:
    if not p.is_staff:
        raise Forbidden("This is for school staff.", code="staff_only")
    return p


async def require_parent(p: Principal = Depends(current_principal)) -> Principal:
    """The mobile/web parent app. Staff and the owner cannot use the /parent routes."""
    if p.kind != UserKind.parent.value:
        raise Forbidden("This is for parents.", code="parent_only")
    return p


async def parent_children(
    p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
) -> list[uuid.UUID]:
    """Ids of this parent's children (every student linked to their guardian record, including ones who left)."""
    return await parent_child_ids(db, p.user_id)


async def parent_child(
    student_id: uuid.UUID, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
) -> Student:
    """For routes with `{student_id}` in the path: the child, or 404 if it is not this parent's child.
    For actions that change something, also call `assert_parent_child(db, p.user_id, id, writable=True)`."""
    return await assert_parent_child(db, p.user_id, student_id)


async def require_admin(p: Principal = Depends(current_principal)) -> Principal:
    if not (p.is_staff and p.is_admin):
        raise Forbidden("Only the school admin can do this.", code="admin_only")
    return p


async def require_owner(p: Principal = Depends(current_principal)) -> Principal:
    if not p.is_owner:
        raise Forbidden("This is for the Slov team.", code="owner_only")
    return p


def client_ip(request: Request) -> str | None:
    """The visitor's address. Behind Caddy, X-Forwarded-For is the real caller. The web app's server (Vercel) calls the
    API on behalf of a visitor, so it sends the visitor's address in X-Client-IP together with a shared secret; the
    header is trusted only when that secret matches."""
    secret = settings.bff_secret
    if secret and hmac.compare_digest(request.headers.get("x-bff-secret", ""), secret):
        forwarded = request.headers.get("x-client-ip", "").strip()
        if forwarded:
            return forwarded[:64]
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)) or None


def request_actor(p: Principal, request: Request):
    return p.actor(client_ip(request), request.headers.get("user-agent"))
