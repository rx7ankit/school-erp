import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import CertificateKind, CertificateStatus, DocumentKind, check_in


class StudentDocument(IdMixin, TenantMixin, TimestampMixin, Base):
    """Metadata for a paper kept on a student's record. The file itself is an `attachments` row."""

    __tablename__ = "student_documents"
    __table_args__ = (
        UniqueConstraint("attachment_id"),
        CheckConstraint(check_in("kind", DocumentKind), name="kind"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    attachment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attachments.id"))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Certificate(IdMixin, TenantMixin, TimestampMixin, Base):
    """An issued certificate. The number is never reused. `snapshot` is exactly what is printed."""

    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("school_id", "number"),
        CheckConstraint(check_in("kind", CertificateKind), name="kind"),
        CheckConstraint(check_in("status", CertificateStatus), name="status"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    kind: Mapped[str] = mapped_column(String(12))
    number: Mapped[str] = mapped_column(String(40))
    issued_on: Mapped[date] = mapped_column(Date)
    issued_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(10), default=CertificateStatus.issued.value)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    replaces_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("certificates.id"), nullable=True)


class CertificateCounter(TenantMixin, Base):
    """The last number handed out per school, kind and year. Bumped with one atomic upsert."""

    __tablename__ = "certificate_counters"
    __table_args__ = (PrimaryKeyConstraint("school_id", "kind", "year"),)

    kind: Mapped[str] = mapped_column(String(12))
    year: Mapped[int] = mapped_column(Integer)
    last: Mapped[int] = mapped_column(Integer, default=0)
