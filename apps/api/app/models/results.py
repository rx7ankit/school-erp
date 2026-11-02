"""Exams, marks, grading, report cards, the exam date sheet and feedback on teachers (erd v2, v4, v5, v6)."""

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import FeedbackStatus, check_in


class GradingScheme(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "grading_schemes"
    __table_args__ = (
        UniqueConstraint("school_id", "name"),
        Index("uq_grading_schemes_one_active", "school_id", unique=True, postgresql_where=text("is_active")),
    )

    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class GradeBand(IdMixin, TenantMixin, Base):
    """Minimum percent for a grade (90 = A+). The highest band whose minimum is reached wins."""

    __tablename__ = "grade_bands"
    __table_args__ = (
        UniqueConstraint("scheme_id", "min_percent"),
        CheckConstraint("min_percent between 0 and 100", name="percent"),
    )

    scheme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("grading_schemes.id", ondelete="cascade"), index=True)
    min_percent: Mapped[int] = mapped_column(Integer)
    grade: Mapped[str] = mapped_column(String(10))


class Exam(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "exams"
    __table_args__ = (UniqueConstraint("school_id", "academic_year_id", "name"),)

    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))  # "Half-yearly"
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)


class ExamSubject(IdMixin, TenantMixin, Base):
    """A paper: one subject of one class in an exam."""

    __tablename__ = "exam_subjects"
    __table_args__ = (
        UniqueConstraint("exam_id", "class_id", "subject_id"),
        CheckConstraint("max_marks > 0", name="max_marks"),
        CheckConstraint("pass_marks >= 0 and pass_marks <= max_marks", name="pass_marks"),
    )

    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id"), index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))
    max_marks: Mapped[int] = mapped_column(Integer)
    pass_marks: Mapped[int] = mapped_column(Integer, default=0)


class Result(IdMixin, TenantMixin, Base):
    __tablename__ = "results"
    __table_args__ = (
        UniqueConstraint("exam_subject_id", "enrollment_id"),
        CheckConstraint("marks_obtained >= 0", name="marks"),
        CheckConstraint("not (absent and marks_obtained is not null)", name="absent_has_no_marks"),
    )

    exam_subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_subjects.id"), index=True)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id"), index=True)
    marks_obtained: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    absent: Mapped[bool] = mapped_column(Boolean, default=False)
    grade: Mapped[str | None] = mapped_column(String(10), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    entered_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ExamPublication(IdMixin, TenantMixin, Base):
    """The class teacher released this exam's results to the parents of one class. Deleted on unpublish."""

    __tablename__ = "exam_publications"
    __table_args__ = (UniqueConstraint("exam_id", "class_id"),)

    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id"), index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    published_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class ReportRemark(IdMixin, TenantMixin, Base):
    __tablename__ = "report_remarks"
    __table_args__ = (UniqueConstraint("exam_id", "enrollment_id"),)

    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id"))
    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id"), index=True)
    remark: Mapped[str] = mapped_column(Text)


class ReportCard(IdMixin, TenantMixin, Base):
    """One row per student each time the class teacher publishes (audit of what was released and by whom)."""

    __tablename__ = "report_cards"

    enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enrollments.id"), index=True)
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id"), index=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    published_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class ExamSchedule(IdMixin, TenantMixin, TimestampMixin, Base):
    """An exam date sheet. Parents of the classes it covers see it once published."""

    __tablename__ = "exam_schedules"

    name: Mapped[str] = mapped_column(String(100))
    exam_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("exams.id"), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class ExamPaper(IdMixin, TenantMixin, Base):
    __tablename__ = "exam_papers"
    __table_args__ = (UniqueConstraint("schedule_id", "class_id", "subject_id"),)

    schedule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_schedules.id", ondelete="cascade"), index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))
    paper_on: Mapped[date] = mapped_column(Date)  # IST date
    starts_at: Mapped[time] = mapped_column(Time)  # IST clock time


class FeedbackRequest(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "feedback_requests"
    __table_args__ = (
        CheckConstraint(check_in("status", FeedbackStatus), name="status"),
        CheckConstraint("closes_on >= opens_on", name="dates"),
    )

    title: Mapped[str] = mapped_column(String(200))
    opens_on: Mapped[date] = mapped_column(Date)
    closes_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(10), default=FeedbackStatus.open.value)
    share_with_teachers: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))


class FeedbackTarget(IdMixin, TenantMixin, Base):
    """A teacher to be rated for one class (and subject; null = the class teacher)."""

    __tablename__ = "feedback_targets"
    __table_args__ = (
        Index(
            "uq_feedback_targets_unique",
            "request_id",
            "staff_id",
            "class_id",
            text("coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)"),
            unique=True,
        ),
    )

    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("feedback_requests.id", ondelete="cascade"), index=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id"), nullable=True)


class FeedbackResponse(IdMixin, TenantMixin, Base):
    """`guardian_id` only blocks duplicates. No API ever returns it."""

    __tablename__ = "feedback_responses"
    __table_args__ = (
        UniqueConstraint("target_id", "guardian_id", "student_id"),
        CheckConstraint("rating between 1 and 5", name="rating"),
        CheckConstraint("comment is null or char_length(comment) <= 500", name="comment_length"),
    )

    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("feedback_targets.id", ondelete="cascade"), index=True)
    guardian_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guardians.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"))
    rating: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
