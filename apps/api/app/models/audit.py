import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin
from app.models.enums import AuditCategory, check_in


class AuditLog(IdMixin, Base):
    """Append-only. A database trigger rejects any update or delete. school_id is null for platform-owner actions.
    Written in the same transaction as the change it describes."""

    __tablename__ = "audit_logs"
    __table_args__ = (CheckConstraint(check_in("category", AuditCategory), name="category"),)

    school_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("schools.id"), index=True, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(200))
    actor_role: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(20), index=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    summary: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    changes: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [{field, from, to}]
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
