import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import InviteStatus, Permission, UserKind, check_in


class User(IdMixin, TimestampMixin, Base):
    """One login for everyone. `kind` decides where they land: owner, staff or parent.
    Owner has no school. A parent email belongs to one school."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(check_in("kind", UserKind), name="kind"),
        Index("uq_users_email_lower", func.lower(text("email")), unique=True),
    )

    school_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("schools.id"), index=True, nullable=True)
    kind: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StaffProfile(TenantMixin, Base):
    __tablename__ = "staff_profiles"
    __table_args__ = (UniqueConstraint("school_id", "employee_code"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(30))
    designation: Mapped[str] = mapped_column(String(100), default="")
    department: Mapped[str] = mapped_column(String(100), default="")
    joined_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(200), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class StaffPermission(TenantMixin, Base):
    """A fixed key per capability. Admins bypass these. Class teacher rights come from class_staff instead."""

    __tablename__ = "staff_permissions"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "permission"),
        CheckConstraint(check_in("permission", Permission), name="permission"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    permission: Mapped[str] = mapped_column(String(30))


class CredentialInvite(TenantMixin, IdMixin, TimestampMixin, Base):
    """Tracks the login email. The temporary password is never stored: sending creates a fresh one."""

    __tablename__ = "credential_invites"
    __table_args__ = (CheckConstraint(check_in("status", InviteStatus), name="status"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    status: Mapped[str] = mapped_column(String(10), default=InviteStatus.pending.value)
    send_count: Mapped[int] = mapped_column(Integer, default=0)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sent_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuthSession(IdMixin, Base):
    """One signed-in device. Refresh tokens rotate on every use; `family_id` links a chain so that
    replaying an old token (theft) revokes the whole chain."""

    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    device: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PasswordReset(IdMixin, Base):
    __tablename__ = "password_resets"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
