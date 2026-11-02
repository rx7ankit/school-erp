"""Year-end rollover (erd v8): the shared wizard draft, and what an applied rollover did."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import PromotionBatchStatus, PromotionDecision, check_in


class RolloverDraft(IdMixin, TenantMixin, Base):
    """The wizard's choices, saved so anyone with the Academic permission can resume. One per school."""

    __tablename__ = "rollover_drafts"
    __table_args__ = (UniqueConstraint("school_id"),)

    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PromotionBatch(IdMixin, TenantMixin, TimestampMixin, Base):
    """One rollover of one year. A year can be rolled over once (unique while applied)."""

    __tablename__ = "promotion_batches"
    __table_args__ = (
        CheckConstraint(check_in("status", PromotionBatchStatus), name="status"),
        Index(
            "uq_promotion_batches_one_applied",
            "school_id",
            "from_year_id",
            unique=True,
            postgresql_where=text("status = 'applied'"),
        ),
    )

    from_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    to_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    status: Mapped[str] = mapped_column(String(10), default=PromotionBatchStatus.applied.value)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class PromotionItem(IdMixin, TenantMixin, Base):
    """What happened to one student's enrollment."""

    __tablename__ = "promotion_items"
    __table_args__ = (
        UniqueConstraint("batch_id", "enrollment_id"),
        CheckConstraint(check_in("decision", PromotionDecision), name="decision"),
    )

    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("promotion_batches.id", ondelete="CASCADE"), index=True)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    decision: Mapped[str] = mapped_column(String(12))
    from_class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"))
    to_class_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("classes.id"), nullable=True)
    new_enrollment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("enrollments.id"), nullable=True)
