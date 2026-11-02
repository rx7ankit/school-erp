"""Fees: heads, structure, routes, options, concessions, late rules, invoices, payments, opening balances."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
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
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import (
    ConcessionKind,
    FeeFrequency,
    FeeItemKind,
    FeeScope,
    LateFeePer,
    PaymentMode,
    PaymentStatus,
    check_in,
)


class FeeHead(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "fee_heads"
    __table_args__ = (UniqueConstraint("school_id", "name"), CheckConstraint(check_in("scope", FeeScope), name="scope"))

    name: Mapped[str] = mapped_column(String(100))
    scope: Mapped[str] = mapped_column(String(10), default=FeeScope.class_.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class FeeStructure(IdMixin, TenantMixin, TimestampMixin, Base):
    """What a class pays for a head. The class belongs to one academic year, so this is per class, head and year."""

    __tablename__ = "fee_structures"
    __table_args__ = (
        UniqueConstraint("class_id", "fee_head_id"),
        CheckConstraint(check_in("frequency", FeeFrequency), name="frequency"),
        CheckConstraint("amount_paise > 0", name="amount_positive"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), index=True)
    fee_head_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fee_heads.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    frequency: Mapped[str] = mapped_column(String(10), default=FeeFrequency.monthly.value)


class TransportRoute(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "transport_routes"
    __table_args__ = (UniqueConstraint("school_id", "name"), CheckConstraint("amount_paise >= 0", name="amount"))

    name: Mapped[str] = mapped_column(String(100))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class StudentFeeOption(IdMixin, TenantMixin, TimestampMixin, Base):
    """A student takes an optional head (transport...) in a year, at their own amount (prefilled from a route)."""

    __tablename__ = "student_fee_options"
    __table_args__ = (
        UniqueConstraint("student_id", "academic_year_id", "fee_head_id"),
        CheckConstraint(check_in("frequency", FeeFrequency), name="frequency"),
        CheckConstraint("amount_paise > 0", name="amount_positive"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    fee_head_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fee_heads.id"))
    route_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("transport_routes.id"), nullable=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    frequency: Mapped[str] = mapped_column(String(10), default=FeeFrequency.monthly.value)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class FeeConcession(IdMixin, TenantMixin, TimestampMixin, Base):
    """Sibling discount, RTE, staff child, merit. `value` is a whole percent (1-100) or paise."""

    __tablename__ = "fee_concessions"
    __table_args__ = (
        UniqueConstraint("school_id", "name"),
        CheckConstraint(check_in("kind", ConcessionKind), name="kind"),
        CheckConstraint("value > 0", name="value_positive"),
    )

    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(10))
    value: Mapped[int] = mapped_column(BigInteger)
    fee_head_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fee_heads.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class StudentConcession(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "student_concessions"
    __table_args__ = (UniqueConstraint("student_id", "concession_id", "academic_year_id"),)

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    concession_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fee_concessions.id"))
    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class FeeLateRule(IdMixin, TenantMixin, TimestampMixin, Base):
    """At most one active rule per school."""

    __tablename__ = "fee_late_rules"
    __table_args__ = (
        CheckConstraint(check_in("per", LateFeePer), name="per"),
        Index("uq_fee_late_rules_one_active", "school_id", unique=True, postgresql_where=text("is_active")),
    )

    grace_days: Mapped[int] = mapped_column(Integer, default=0)
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    per: Mapped[str] = mapped_column(String(5), default=LateFeePer.once.value)
    max_paise: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # null = no cap
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class FeeSettings(TenantMixin, Base):
    """One row per school (created on first use)."""

    __tablename__ = "fee_settings"
    __table_args__ = (PrimaryKeyConstraint("school_id"),)

    auto_first_invoice: Mapped[bool] = mapped_column(Boolean, default=False)
    first_invoice_due_days: Mapped[int] = mapped_column(Integer, default=15)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FeeCounter(TenantMixin, Base):
    """Sequential numbers per school (`invoice`, `receipt`). Incremented with one atomic upsert, so two cashiers
    can never get the same number. Rolls back with the transaction, so numbers have no gaps."""

    __tablename__ = "fee_counters"
    __table_args__ = (PrimaryKeyConstraint("school_id", "kind"),)

    kind: Mapped[str] = mapped_column(String(20))
    last_seq: Mapped[int] = mapped_column(BigInteger, default=0)


class FeeInvoiceRun(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "fee_invoice_runs"

    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    period_label: Mapped[str] = mapped_column(String(60))
    due_on: Mapped[date] = mapped_column(Date)
    frequencies: Mapped[list] = mapped_column(JSONB, default=list)
    class_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    invoices_created: Mapped[int] = mapped_column(Integer, default=0)
    skipped_existing: Mapped[int] = mapped_column(Integer, default=0)
    skipped_no_fees: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class FeeInvoice(IdMixin, TenantMixin, TimestampMixin, Base):
    """Total, paid and status are computed from the lines and payments, never stored."""

    __tablename__ = "fee_invoices"
    __table_args__ = (
        UniqueConstraint("school_id", "invoice_no"),
        UniqueConstraint("student_id", "academic_year_id", "period_label"),
        Index("ix_fee_invoices_year_due", "academic_year_id", "due_on"),
    )

    run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fee_invoice_runs.id"), nullable=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id"), index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    invoice_no: Mapped[str] = mapped_column(String(30))
    period_label: Mapped[str] = mapped_column(String(60))
    due_on: Mapped[date] = mapped_column(Date)
    late_rule_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fee_late_rules.id"), nullable=True)
    late_waived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    late_waived_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    late_waive_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_into_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fee_invoices.id"), nullable=True)


class FeeInvoiceItem(IdMixin, TenantMixin, Base):
    """One line. Concessions are negative. Total of an invoice = sum of its lines."""

    __tablename__ = "fee_invoice_items"
    __table_args__ = (CheckConstraint(check_in("kind", FeeItemKind), name="kind"),)

    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fee_invoices.id"), index=True)
    kind: Mapped[str] = mapped_column(String(15))
    fee_head_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fee_heads.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(200))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    position: Mapped[int] = mapped_column(Integer, default=0)


class FeeCarryForward(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "fee_carry_forwards"

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    from_invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fee_invoices.id"))
    to_invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fee_invoices.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    written_off: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class FeePayment(IdMixin, TenantMixin, TimestampMixin, Base):
    """An instalment. Never deleted: a wrong entry is cancelled and the receipt number stays used."""

    __tablename__ = "fee_payments"
    __table_args__ = (
        UniqueConstraint("school_id", "receipt_no"),
        CheckConstraint(check_in("mode", PaymentMode), name="mode"),
        CheckConstraint(check_in("status", PaymentStatus), name="status"),
        CheckConstraint("amount_paise > 0", name="amount_positive"),
        CheckConstraint(
            "status = 'active' or "
            "(cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)",
            name="cancel_fields",
        ),
        Index("ix_fee_payments_received", "school_id", "received_at"),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fee_invoices.id"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    mode: Mapped[str] = mapped_column(String(15))
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_no: Mapped[str] = mapped_column(String(30))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(10), default=PaymentStatus.active.value)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class FeeReminder(IdMixin, TenantMixin, Base):
    """Remembers who was reminded and when (a child is reminded at most once per 3 days)."""

    __tablename__ = "fee_reminders"
    __table_args__ = (Index("ix_fee_reminders_student_sent", "student_id", "sent_at"),)

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"))
    balance_paise: Mapped[int] = mapped_column(BigInteger)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sent_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    emailed: Mapped[int] = mapped_column(Integer, default=0)


class OpeningBalance(IdMixin, TenantMixin, TimestampMixin, Base):
    """Dues a student owed before using Scool. Becomes a 'Previous dues' line on their first invoice of the year,
    then is locked (`used_invoice_id`)."""

    __tablename__ = "opening_balances"
    __table_args__ = (
        UniqueConstraint("student_id", "academic_year_id"),
        CheckConstraint("amount_paise > 0", name="amount_positive"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    as_of_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    imported_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    used_invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fee_invoices.id"), nullable=True)
