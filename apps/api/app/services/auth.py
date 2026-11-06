import re
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.config import settings
from app.core.errors import AppError, Forbidden, Unauthorized
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    needs_rehash,
    new_opaque_token,
    verify_password,
)
from app.db.session import system_session
from app.models.enums import AuditCategory, SchoolStatus, UserKind
from app.models.school import School
from app.models.user import AuthSession, PasswordReset, User
from app.services import ratelimit
from app.services.audit import Actor, change, log_audit
from app.services.email import get_sender, reset_mail


@dataclass
class Tokens:
    access_token: str
    refresh_token: str
    expires_in: int
    must_change_password: bool
    kind: str


def validate_new_password(password: str, email: str = "") -> None:
    problems = []
    if len(password) < 8:
        problems.append("at least 8 characters")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        problems.append("a letter and a number")
    if email and password.lower() == email.split("@")[0].lower():
        problems.append("something other than your email name")
    if len(password) > 128:
        problems.append("at most 128 characters")
    if problems:
        raise AppError("Choose a password with " + ", ".join(problems) + ".", code="weak_password", status=422)


async def _user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(
        select(User).where(func.lower(User.email) == email.strip().lower(), User.deleted_at.is_(None))
    )


async def _issue(
    db: AsyncSession, user: User, *, family_id: uuid.UUID | None, device: str | None, ip: str | None
) -> Tokens:
    refresh = new_opaque_token()
    now = utcnow()
    s = AuthSession(
        user_id=user.id,
        family_id=family_id or uuid.uuid4(),
        device=(device or "")[:200] or None,
        ip=ip,
        refresh_hash=hash_token(refresh),
        expires_at=now + timedelta(days=settings.refresh_ttl_days),
    )
    db.add(s)
    await db.flush()
    access = create_access_token(user_id=user.id, session_id=s.id, kind=user.kind, school_id=user.school_id)
    return Tokens(access, refresh, settings.access_ttl_minutes * 60, user.must_change_password, user.kind)


async def login(email: str, password: str, *, ip: str | None, user_agent: str | None, device: str | None) -> Tokens:
    await ratelimit.check_login_allowed(email, ip)
    failure: AppError | None = None
    tokens: Tokens | None = None
    async with system_session() as db:
        user = await _user_by_email(db, email)
        usable = user is not None and user.is_active
        ok = await verify_password(password, user.password_hash if usable and user else None)
        if not ok or user is None:
            await ratelimit.record_login_failure(email, ip)
            log_audit(
                db,
                Actor(None, "Unknown", "Not signed in", user.school_id if user else None, ip, user_agent),
                AuditCategory.security,
                "login.failed",
                f"Failed sign-in attempt for {email.strip()} (wrong email or password)",
                entity_label=email.strip(),
                sensitive=True,
            )
            failure = Unauthorized(
                "Email or password is not right. Check with the school office.", code="invalid_credentials"
            )
        else:
            school = await db.get(School, user.school_id) if user.school_id else None
            if school and school.status == SchoolStatus.suspended.value:
                failure = Forbidden(
                    "This school's account is paused. Please contact the school office.", code="school_suspended"
                )
            else:
                await ratelimit.clear_login_failures(email, ip)
                if needs_rehash(user.password_hash or ""):
                    user.password_hash = await hash_password(password)
                user.last_login_at = utcnow()
                tokens = await _issue(db, user, family_id=None, device=device, ip=ip)
                if user.kind != UserKind.parent.value:  # parents sign in daily: keep the audit log readable
                    log_audit(
                        db,
                        Actor(
                            user.id,
                            user.name,
                            "Admin" if user.is_admin else user.kind.title(),
                            user.school_id,
                            ip,
                            user_agent,
                        ),
                        AuditCategory.security,
                        "login.success",
                        "Signed in",
                    )
    if failure:
        raise failure
    assert tokens
    return tokens


async def refresh(refresh_token: str, *, ip: str | None, device: str | None) -> Tokens:
    failure: AppError | None = None
    tokens: Tokens | None = None
    async with system_session() as db:
        s = await db.scalar(
            select(AuthSession).where(AuthSession.refresh_hash == hash_token(refresh_token)).with_for_update()
        )
        now = utcnow()
        if s is None:
            failure = Unauthorized("Please sign in again.", code="invalid_refresh")
        elif s.revoked_at or (s.used_at and (now - s.used_at).total_seconds() > settings.refresh_reuse_grace_seconds):
            # A used or revoked token came back: someone may have copied it. End the whole chain.
            # (A token used a moment ago is let through: two screens or tabs of the same person can refresh at once.)
            await db.execute(
                update(AuthSession)
                .where(AuthSession.family_id == s.family_id, AuthSession.revoked_at.is_(None))
                .values(revoked_at=now)
            )
            failure = Unauthorized("Please sign in again.", code="session_reused")
        elif s.expires_at <= now:
            failure = Unauthorized("Your session has expired. Please sign in again.", code="refresh_expired")
        else:
            user = await db.get(User, s.user_id)
            school = await db.get(School, user.school_id) if user and user.school_id else None
            if (
                not user
                or not user.is_active
                or user.deleted_at
                or (school and school.status == SchoolStatus.suspended.value)
            ):
                failure = Unauthorized("Please sign in again.", code="invalid_refresh")
            else:
                s.used_at = now
                tokens = await _issue(db, user, family_id=s.family_id, device=device or s.device, ip=ip)
    if failure:
        raise failure
    assert tokens
    return tokens


async def logout(session_id: uuid.UUID) -> None:
    async with system_session() as db:
        await db.execute(
            update(AuthSession)
            .where(AuthSession.id == session_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )


async def revoke_other_sessions(db: AsyncSession, user_id: uuid.UUID, keep: uuid.UUID | None) -> None:
    q = update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    if keep:
        q = q.where(AuthSession.id != keep)
    await db.execute(q.values(revoked_at=utcnow()))


async def change_password(
    db: AsyncSession, actor: Actor, user: User, session_id: uuid.UUID, current: str, new: str
) -> None:
    if not await verify_password(current, user.password_hash):
        raise AppError("Your current password is not right.", code="wrong_password", status=422)
    if new == current:
        raise AppError("Choose a password different from the current one.", code="same_password", status=422)
    validate_new_password(new, user.email)
    user.password_hash = await hash_password(new)
    user.must_change_password = False
    user.password_changed_at = utcnow()
    await revoke_other_sessions(db, user.id, keep=session_id)
    log_audit(
        db,
        actor,
        AuditCategory.security,
        "password.changed",
        "Changed their password",
        sensitive=True,
        changes=[change("Password", "", "changed")],
        entity_type="user",
        entity_id=user.id,
        entity_label=user.name,
    )


async def request_password_reset(email: str, ip: str | None) -> None:
    """Always looks the same to the caller, whether or not the email exists."""
    await ratelimit.check_and_count(f"reset:{email.lower()}", 3, 3600)
    await ratelimit.check_and_count(f"reset-ip:{ip or '-'}", 20, 3600)
    token: str | None = None
    user_row: tuple[str, str, bool] | None = None
    async with system_session() as db:
        user = await _user_by_email(db, email)
        if user and user.is_active:
            token = new_opaque_token()
            db.add(
                PasswordReset(
                    user_id=user.id,
                    token_hash=hash_token(token),
                    expires_at=utcnow() + timedelta(minutes=settings.reset_ttl_minutes),
                )
            )
            user_row = (user.name, user.email, user.kind == UserKind.parent.value)
    if token and user_row:
        try:
            await get_sender().send(reset_mail(name=user_row[0], email=user_row[1], token=token, parent=user_row[2]))
        except Exception:  # noqa: BLE001 - never reveal delivery problems to the caller
            pass


async def reset_password(token: str, new: str) -> None:
    async with system_session() as db:
        r = await db.scalar(
            select(PasswordReset).where(PasswordReset.token_hash == hash_token(token)).with_for_update()
        )
        if not r or r.used_at or r.expires_at <= utcnow():
            raise AppError("This reset link has expired. Ask for a new one.", code="reset_expired", status=400)
        user = await db.get(User, r.user_id)
        assert user
        validate_new_password(new, user.email)
        user.password_hash = await hash_password(new)
        user.must_change_password = False
        user.password_changed_at = utcnow()
        r.used_at = utcnow()
        await revoke_other_sessions(db, user.id, keep=None)
        log_audit(
            db,
            Actor(user.id, user.name, "User", user.school_id),
            AuditCategory.security,
            "password.reset",
            "Reset their password using an emailed link",
            sensitive=True,
            entity_type="user",
            entity_id=user.id,
        )
