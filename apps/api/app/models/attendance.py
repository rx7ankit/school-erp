import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import AttendanceMark, HolidayKind, LeaveHalf, LeaveStatus, check_in


class Holiday(IdMixin, TenantMixin, TimestampMixin, Base):
    """A non-school day (`holiday`), or a marker on the calendar (`exam`, `event`). Only `holiday` is taken out of
    the working days in attendance statistics."""

    __tablename__ = "holidays"
    __table_args__ = (
        CheckConstraint(check_in("kind", HolidayKind), name="kind"),
        CheckConstraint("from_on <= to_on", name="dates"),
    )

    title: Mapped[str] = mapped_column(String(200))
    from_on: Mapped[date] = mapped_column(Date, index=True)
    to_on: Mapped[date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(10), default=HolidayKind.holiday.value)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class AttendanceDay(IdMixin, TenantMixin, TimestampMixin, Base):
    """One per class per school day, created when the class teacher first saves."""

    __tablename__ = "attendance_days"
    __table_args__ = (UniqueConstraint("class_id", "day_on"),)

    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), index=True)
    day_on: Mapped[date] = mapped_column(Date, index=True)
    marked_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AttendanceRecord(IdMixin, TenantMixin, Base):
    """One enrolled student on one day, with a mark for each half."""

    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("attendance_day_id", "enrollment_id"),
        CheckConstraint(check_in("first_half", AttendanceMark), name="first_half"),
        CheckConstraint(check_in("second_half", AttendanceMark), name="second_half"),
        Index("ix_attendance_records_enrollment", "enrollment_id"),
    )

    attendance_day_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendance_days.id", ondelete="CASCADE"))
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id"))
    first_half: Mapped[str] = mapped_column(String(10))
    second_half: Mapped[str] = mapped_column(String(10))
    late: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class StaffAttendance(IdMixin, TenantMixin, TimestampMixin, Base):
    """A teacher's or staff member's day (marked by someone with `staff.manage`)."""

    __tablename__ = "staff_attendance"
    __table_args__ = (
        UniqueConstraint("staff_id", "day_on"),
        CheckConstraint(check_in("status", AttendanceMark), name="status"),
    )

    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    day_on: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(10))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    marked_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LeaveRequest(IdMixin, TenantMixin, TimestampMixin, Base):
    """A parent's leave application for one child. Approved leave pre-selects "leave" on the attendance sheet."""

    __tablename__ = "leave_requests"
    __table_args__ = (
        CheckConstraint(check_in("status", LeaveStatus), name="status"),
        CheckConstraint(check_in("half", LeaveHalf), name="half"),
        CheckConstraint("from_on <= to_on", name="dates"),
        CheckConstraint("half = 'none' or from_on = to_on", name="half_single_day"),
        Index("ix_leave_requests_student_dates", "student_id", "from_on", "to_on"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    guardian_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guardians.id"))
    from_on: Mapped[date] = mapped_column(Date)
    to_on: Mapped[date] = mapped_column(Date)
    half: Mapped[str] = mapped_column(String(10), default=LeaveHalf.none.value)
    reason: Mapped[str] = mapped_column(Text)
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("attachments.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default=LeaveStatus.pending.value, index=True)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
