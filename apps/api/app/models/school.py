import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin
from app.models.enums import PlatformInvoiceStatus, SchoolStatus, check_in


class School(IdMixin, TimestampMixin, Base):
    """The tenant. Everything else belongs to one school."""

    __tablename__ = "schools"
    __table_args__ = (CheckConstraint(check_in("status", SchoolStatus), name="status"),)

    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    city: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(20), default=SchoolStatus.trial.value)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class SchoolSubscription(IdMixin, TimestampMixin, Base):
    """Price per active student per month, in paise. Default Rs 10 (1000 paise)."""

    __tablename__ = "school_subscriptions"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), unique=True)
    price_per_student_paise: Mapped[int] = mapped_column(BigInteger, default=1000)
    started_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="trial")


class PlatformInvoice(IdMixin, TimestampMixin, Base):
    """What a school owes Krevo for a month. One per school per month, billed on the active student count."""

    __tablename__ = "platform_invoices"
    __table_args__ = (
        UniqueConstraint("school_id", "period_on"),
        CheckConstraint(check_in("status", PlatformInvoiceStatus), name="status"),
    )

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True)
    period_on: Mapped[date] = mapped_column(Date)  # first day of the billed month
    active_students: Mapped[int]
    price_per_student_paise: Mapped[int] = mapped_column(BigInteger)
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    due_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="due")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reference: Mapped[str | None] = mapped_column(Text, nullable=True)
