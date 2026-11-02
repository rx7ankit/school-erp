import uuid
from datetime import date, datetime

from sqlalchemy import (
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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import AdmissionStatus, EnrollmentStatus, ImportStatus, StudentStatus, check_in


class Student(IdMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("school_id", "scholar_no"),
        CheckConstraint(check_in("status", StudentStatus), name="status"),
    )

    scholar_no: Mapped[str] = mapped_column(String(30))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100), default="")
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default=StudentStatus.active.value, index=True)
    admitted_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    left_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    leaving_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    tc_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # legacy; the photo is photo_file_id
    photo_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("attachments.id"), nullable=True)
    # Fuller record
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    category: Mapped[str | None] = mapped_column(String(10), nullable=True)  # General, OBC, SC, ST, EWS
    samagra_id: Mapped[str | None] = mapped_column(String(8), nullable=True)
    pen: Mapped[str | None] = mapped_column(String(11), nullable=True)
    previous_school: Mapped[str | None] = mapped_column(Text, nullable=True)
    medical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)


class Guardian(IdMixin, TenantMixin, TimestampMixin, Base):
    """A parent or guardian. `user_id` is their app login. One guardian can have several children."""

    __tablename__ = "guardians"
    __table_args__ = (
        # one guardian per email in a school: the same email on two children is one parent login
        Index(
            "uq_guardians_school_email", "school_id", "email", unique=True, postgresql_where=text("email is not null")
        ),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True)
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    occupation: Mapped[str | None] = mapped_column(String(100), nullable=True)


class StudentGuardian(TenantMixin, Base):
    __tablename__ = "student_guardians"
    __table_args__ = (PrimaryKeyConstraint("student_id", "guardian_id"),)

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"))
    guardian_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guardians.id"), index=True)
    relation: Mapped[str] = mapped_column(String(20), default="other")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=False)


class Enrollment(IdMixin, TenantMixin, TimestampMixin, Base):
    """A student in a class for one academic year. History lives here: one row per year."""

    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "academic_year_id"),
        CheckConstraint(check_in("status", EnrollmentStatus), name="status"),
        Index("ix_enrollments_class_active", "class_id", "status"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"))
    academic_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_years.id"))
    roll_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default=EnrollmentStatus.active.value)
    started_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ended_on: Mapped[date | None] = mapped_column(Date, nullable=True)


class StudentEvent(IdMixin, TenantMixin, Base):
    """The full history of a student: admitted, promoted, left, certificates..."""

    __tablename__ = "student_events"

    __table_args__ = (Index("ix_student_events_student_recorded", "student_id", "recorded_at"),)

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    from_class_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    to_class_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    academic_year_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    effective_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Admission(IdMixin, TenantMixin, TimestampMixin, Base):
    """An application: enquiry -> applied -> approved -> enrolled (or rejected). Enrolling creates the student."""

    __tablename__ = "admissions"
    __table_args__ = (CheckConstraint(check_in("status", AdmissionStatus), name="status"),)

    applicant_name: Mapped[str] = mapped_column(String(200))
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    grade_applied: Mapped[str] = mapped_column(String(40))
    class_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("classes.id"), nullable=True)
    guardian_name: Mapped[str] = mapped_column(String(200))
    guardian_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    previous_school: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default=AdmissionStatus.enquiry.value, index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("students.id"), nullable=True, unique=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    handled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class ImportJob(IdMixin, TenantMixin, TimestampMixin, Base):
    """An Excel/CSV import: first validated (nothing written), then committed."""

    __tablename__ = "import_jobs"
    __table_args__ = (CheckConstraint(check_in("status", ImportStatus), name="status"),)

    kind: Mapped[str] = mapped_column(String(20), default="students")
    file_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(12), default=ImportStatus.validated.value)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    ok_rows: Mapped[int] = mapped_column(Integer, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, default=0)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ImportRow(IdMixin, TenantMixin, Base):
    __tablename__ = "import_rows"
    __table_args__ = (UniqueConstraint("job_id", "row_no"),)

    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"), index=True)
    row_no: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
