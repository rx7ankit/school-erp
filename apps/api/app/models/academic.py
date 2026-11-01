import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import ClassRole, YearStatus, check_in


class AcademicYear(IdMixin, TenantMixin, TimestampMixin, Base):
    """draft (being prepared) -> current (the only one running) -> completed (read-only archive)."""

    __tablename__ = "academic_years"
    __table_args__ = (
        UniqueConstraint("school_id", "name"),
        CheckConstraint(check_in("status", YearStatus), name="status"),
        Index("uq_academic_years_one_current", "school_id", unique=True, postgresql_where=text("status = 'current'")),
    )

    name: Mapped[str] = mapped_column(String(20))  # "2026-27"
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(10), default=YearStatus.draft.value)


class SchoolClass(IdMixin, TenantMixin, TimestampMixin, Base):
    """A section of a grade in one academic year, such as 8-B. Grades 1 to 12 are the usual set, a school can
    also create its own (Nursery, LKG...) with is_custom. `next_class_id` chains custom classes for promotion."""

    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("school_id", "academic_year_id", "grade", "section"),)

    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"), index=True)
    grade: Mapped[str] = mapped_column(String(40))
    section: Mapped[str] = mapped_column(String(20), default="A")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    capacity: Mapped[int] = mapped_column(Integer, default=40)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    next_class_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("classes.id"), nullable=True)


class Subject(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("school_id", "name"),)

    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str | None] = mapped_column(String(20), nullable=True)


class ClassSubject(TenantMixin, Base):
    """Which subjects a class studies."""

    __tablename__ = "class_subjects"
    __table_args__ = (PrimaryKeyConstraint("class_id", "subject_id"),)

    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))


class ClassStaff(IdMixin, TenantMixin, TimestampMixin, Base):
    """Teacher assignments. These drive who marks attendance (class teacher), who can message a class
    (anyone assigned) and which parent chats are active. One class teacher per class, one subject teacher
    per class and subject."""

    __tablename__ = "class_staff"
    __table_args__ = (
        CheckConstraint(check_in("role", ClassRole), name="role"),
        CheckConstraint("(role = 'subject_teacher') = (subject_id is not null)", name="subject_matches_role"),
        Index(
            "uq_class_staff_one_class_teacher", "class_id", unique=True, postgresql_where=text("role = 'class_teacher'")
        ),
        Index(
            "uq_class_staff_one_subject_teacher",
            "class_id",
            "subject_id",
            unique=True,
            postgresql_where=text("role = 'subject_teacher'"),
        ),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), index=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id"), nullable=True)
