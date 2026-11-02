import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
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
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import CopyStatus, LoanOutcome, check_in


class LibrarySettings(TenantMixin, TimestampMixin, Base):
    """One row per school (created on first save; defaults apply until then)."""

    __tablename__ = "library_settings"
    __table_args__ = (
        PrimaryKeyConstraint("school_id"),
        CheckConstraint("loan_days between 1 and 365", name="loan_days"),
        CheckConstraint("fine_per_day_paise >= 0", name="fine"),
    )

    loan_days: Mapped[int] = mapped_column(Integer, default=14)
    fine_per_day_paise: Mapped[int] = mapped_column(BigInteger, default=0)


class LibraryBook(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "library_books"

    title: Mapped[str] = mapped_column(String(300), index=True)
    author: Mapped[str] = mapped_column(String(200), default="")
    isbn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)


class LibraryCopy(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "library_copies"
    __table_args__ = (
        UniqueConstraint("school_id", "accession_no"),
        CheckConstraint(check_in("status", CopyStatus), name="status"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("library_books.id"), index=True)
    accession_no: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(10), default=CopyStatus.available.value)


class LibraryCounter(TenantMixin, Base):
    """Last accession number handed out per school; bumped by one atomic upsert."""

    __tablename__ = "library_counters"
    __table_args__ = (PrimaryKeyConstraint("school_id"),)

    last: Mapped[int] = mapped_column(Integer, default=0)


class LibraryLoan(IdMixin, TenantMixin, TimestampMixin, Base):
    """A copy lent to a student or to a staff member. Open while `returned_at` is null; `outcome` says how it ended."""

    __tablename__ = "library_loans"
    __table_args__ = (
        CheckConstraint("num_nonnulls(student_id, staff_id) = 1", name="borrower"),
        CheckConstraint(check_in("outcome", LoanOutcome), name="outcome"),
        CheckConstraint("fine_paise >= 0 and fine_waived_paise >= 0", name="fine"),
        Index("uq_library_loans_open_copy", "copy_id", unique=True, postgresql_where=text("returned_at is null")),
    )

    copy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("library_copies.id"), index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("students.id"), nullable=True, index=True)
    staff_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    due_on: Mapped[date] = mapped_column(Date)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(10), nullable=True)
    fine_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    fine_waived_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    waive_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    renewals: Mapped[int] = mapped_column(Integer, default=0)
    issued_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    returned_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # the fee invoice that collects the fine of a student's loan (null: no fine, waived, or a staff borrower)
    fine_invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fee_invoices.id"), nullable=True, index=True)
