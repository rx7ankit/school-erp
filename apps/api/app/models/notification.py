import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, PrimaryKeyConstraint, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import DevicePlatform, check_in


class Notification(IdMixin, TenantMixin, Base):
    """The in-app inbox: one row per recipient. Always shown, whatever the push preferences say."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_unread", "user_id", postgresql_where=text("read_at is null")),
        Index(
            "ix_notifications_dedupe", "user_id", "kind", "dedupe_key", postgresql_where=text("dedupe_key is not null")
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("students.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    push_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DeviceToken(IdMixin, TenantMixin, TimestampMixin, Base):
    """A phone that can receive push. A token belongs to one person at a time (signing in on the phone moves it)."""

    __tablename__ = "device_tokens"
    __table_args__ = (
        CheckConstraint(check_in("platform", DevicePlatform), name="platform"),
        Index("uq_device_tokens_token", "token", unique=True),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(10))
    token: Mapped[str] = mapped_column(String(1024))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NotificationPreference(TenantMixin, Base):
    """Push on or off per category. A missing row means on."""

    __tablename__ = "notification_preferences"
    __table_args__ = (PrimaryKeyConstraint("user_id", "category"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    category: Mapped[str] = mapped_column(String(30))
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
