from enum import StrEnum


class SchoolStatus(StrEnum):
    trial = "trial"
    active = "active"
    suspended = "suspended"


class UserKind(StrEnum):
    owner = "owner"
    staff = "staff"
    parent = "parent"


class Language(StrEnum):
    """Interface language of a login. Only parents can pick Hindi; staff and the owner stay on English."""

    en = "en"
    hi = "hi"


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


class AdmissionStatus(StrEnum):
    enquiry = "enquiry"
    applied = "applied"
    approved = "approved"
    rejected = "rejected"
    enrolled = "enrolled"


class ImportStatus(StrEnum):
    validated = "validated"
    imported = "imported"
    failed = "failed"


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


class FeedbackStatus(StrEnum):
    draft = "draft"
    open = "open"
    closed = "closed"


class CertificateKind(StrEnum):
    transfer = "transfer"
    bonafide = "bonafide"
    character = "character"


class CertificateStatus(StrEnum):
    issued = "issued"
    cancelled = "cancelled"


class DocumentKind(StrEnum):
    birth_certificate = "birth_certificate"
    previous_tc = "previous_tc"
    id_proof = "id_proof"
    photo = "photo"
    other = "other"


# ---------------------------------------------------------------- fees
class FeeScope(StrEnum):
    class_ = "class"  # everyone in the class pays (fee_structures)
    optional = "optional"  # only students who take it (student_fee_options)


class FeeFrequency(StrEnum):
    monthly = "monthly"
    quarterly = "quarterly"
    term = "term"
    yearly = "yearly"
    once = "once"


class FeeItemKind(StrEnum):
    fee = "fee"
    concession = "concession"
    late_fee = "late_fee"
    previous_dues = "previous_dues"


class PaymentMode(StrEnum):
    cash = "cash"
    cheque = "cheque"
    upi = "upi"
    bank_transfer = "bank_transfer"
    online = "online"


class PaymentStatus(StrEnum):
    active = "active"
    cancelled = "cancelled"


class ConcessionKind(StrEnum):
    percent = "percent"
    fixed = "fixed"


class LateFeePer(StrEnum):
    once = "once"
    day = "day"


class AttendanceMark(StrEnum):
    """One half day (or one staff day): present, absent, or on approved leave. Leave counts as not present."""

    present = "present"
    absent = "absent"
    leave = "leave"


class HolidayKind(StrEnum):
    holiday = "holiday"
    exam = "exam"
    event = "event"


class LeaveStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class LeaveHalf(StrEnum):
    none = "none"
    first = "first"
    second = "second"


class BroadcastScope(StrEnum):
    school = "school"
    cls = "class"


class BroadcastAudience(StrEnum):
    all = "all"
    grade = "grade"
    classes = "classes"


class DevicePlatform(StrEnum):
    ios = "ios"
    android = "android"


# ---------------------------------------------------------------- year-end rollover and platform billing
class PromotionDecision(StrEnum):
    promote = "promote"
    repeat = "repeat"  # stays in the same grade (detained)
    leave = "leave"
    passed_out = "passed_out"


class PromotionBatchStatus(StrEnum):
    draft = "draft"
    applied = "applied"


class PlatformInvoiceStatus(StrEnum):
    due = "due"
    paid = "paid"
