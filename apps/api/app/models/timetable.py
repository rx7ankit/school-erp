import uuid
from datetime import date, time

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin


class Period(IdMixin, TenantMixin, TimestampMixin, Base):
    """A bell period of the school day. Clock times are IST wall-clock times."""

    __tablename__ = "periods"
    __table_args__ = (
        UniqueConstraint("school_id", "number"),
        CheckConstraint("number between 1 and 20", name="number"),
        CheckConstraint("ends_at > starts_at", name="times"),
    )

    number: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(50))
    starts_at: Mapped[time] = mapped_column(Time)
    ends_at: Mapped[time] = mapped_column(Time)


class TimetableSlot(IdMixin, TenantMixin, TimestampMixin, Base):
    """For one class, weekday (1 Mon to 6 Sat) and period: the subject and the teacher.
    A class has one slot per weekday and period; a teacher is in one class per weekday and period (per year)."""

    __tablename__ = "timetable_slots"
    __table_args__ = (
        UniqueConstraint("class_id", "weekday", "period_id"),
        UniqueConstraint("staff_id", "academic_year_id", "weekday", "period_id"),
        CheckConstraint("weekday between 1 and 6", name="weekday"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"))
    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"), index=True)
    weekday: Mapped[int] = mapped_column(Integer)
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("periods.id"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class StaffAbsence(IdMixin, TenantMixin, TimestampMixin, Base):
    """A teacher marked absent for a school day; their slots that day need cover."""

    __tablename__ = "staff_absences"
    __table_args__ = (UniqueConstraint("staff_id", "absent_on"),)

    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    absent_on: Mapped[date] = mapped_column(Date, index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    marked_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class Substitution(IdMixin, TenantMixin, TimestampMixin, Base):
    """Cover for one slot on one date. `period_id` is copied from the slot so a substitute cannot be
    given two classes in the same period on the same day (enforced by the database)."""

    __tablename__ = "substitutions"
    __table_args__ = (
        UniqueConstraint("slot_id", "covers_on"),
        UniqueConstraint("substitute_staff_id", "covers_on", "period_id"),
        Index("ix_substitutions_covers_on", "school_id", "covers_on"),
    )

    covers_on: Mapped[date] = mapped_column(Date)
    slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("timetable_slots.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("periods.id"))
    absent_staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    substitute_staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    assigned_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
