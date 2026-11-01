from enum import StrEnum


class SchoolStatus(StrEnum):
    trial = "trial"
    active = "active"
    suspended = "suspended"


class UserKind(StrEnum):
    owner = "owner"
    staff = "staff"
    parent = "parent"


class Permission(StrEnum):
    fees = "fees.manage"
    library = "library.manage"
    staff = "staff.manage"
    academic = "academic.manage"


class InviteStatus(StrEnum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class YearStatus(StrEnum):
    draft = "draft"
    current = "current"
    completed = "completed"


class ClassRole(StrEnum):
    class_teacher = "class_teacher"
    subject_teacher = "subject_teacher"


class StudentStatus(StrEnum):
    active = "active"
    left = "left"
    tc_issued = "tc_issued"
    passed_out = "passed_out"


class EnrollmentStatus(StrEnum):
    active = "active"
    promoted = "promoted"
    detained = "detained"
    left = "left"
    passed_out = "passed_out"


class AuditCategory(StrEnum):
    attendance = "attendance"
    fees = "fees"
    students = "students"
    staff = "staff"
    academic = "academic"
    messages = "messages"
    leave = "leave"
    security = "security"
    exports = "exports"


def check_in(column: str, enum: type[StrEnum]) -> str:
    """SQL for a CHECK constraint that limits a text column to the enum values."""
    values = ", ".join(f"'{e.value}'" for e in enum)
    return f"{column} in ({values})"
