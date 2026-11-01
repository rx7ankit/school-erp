"""Login emails. Sending always creates a fresh temporary password, so nothing readable is ever stored."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.security import hash_password, temp_password
from app.models.enums import AuditCategory, InviteStatus
from app.models.user import CredentialInvite, User
from app.services.audit import Actor, log_audit
from app.services.email import get_sender, login_mail


async def ensure_invite(db: AsyncSession, user: User) -> CredentialInvite:
    inv = await db.scalar(select(CredentialInvite).where(CredentialInvite.user_id == user.id))
    if inv is None:
        assert user.school_id
        inv = CredentialInvite(
            school_id=user.school_id, user_id=user.id, status=InviteStatus.pending.value, send_count=0
        )
        db.add(inv)
        await db.flush()
    return inv


async def send_login(db: AsyncSession, actor: Actor, user: User, *, school_name: str, audit: bool = True) -> bool:
    """Creates a new temporary password and emails it. Returns False if the email could not be sent."""
    password = temp_password()
    user.password_hash = await hash_password(password)
    user.must_change_password = True
    inv = await ensure_invite(db, user)
    inv.send_count += 1
    inv.last_sent_at = utcnow()
    inv.last_sent_by = actor.id
    ok = True
    try:
        await get_sender().send(login_mail(name=user.name, email=user.email, password=password, school=school_name))
        inv.status, inv.last_error = InviteStatus.sent.value, None
    except Exception as e:  # noqa: BLE001
        ok = False
        inv.status, inv.last_error = InviteStatus.failed.value, str(e)[:300]
    if audit:
        log_audit(
            db,
            actor,
            AuditCategory.staff,
            "login.sent" if ok else "login.failed_to_send",
            f"Sent login email to {user.name}" if ok else f"Could not send login email to {user.name}",
            entity_type="user",
            entity_id=user.id,
            entity_label=user.name,
        )
    return ok
