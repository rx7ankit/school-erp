import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin


class Attachment(IdMixin, TenantMixin, TimestampMixin, Base):
    """A file in the bucket. Starts `pending` when the upload link is issued, becomes `ready` once the file is
    confirmed to be there. Other tables point at it (photo, leave note, message attachment)."""

    __tablename__ = "attachments"
    __table_args__ = (
        CheckConstraint("status in ('pending','ready')", name="status"),
        CheckConstraint("size_bytes > 0", name="size"),
    )

    purpose: Mapped[str] = mapped_column(String(30), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(400), unique=True)
    status: Mapped[str] = mapped_column(String(10), default="pending")
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
