import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORM

Gender = Literal["male", "female", "other"]
Category = Literal["General", "OBC", "SC", "ST", "EWS"]
Relation = Literal["father", "mother", "guardian", "other"]
StudentStatusFilter = Literal["active", "left", "tc_issued", "passed_out", "all"]


class StudentFields(BaseModel):
    """Everything about the child that is not class or guardians."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)
    dob: date | None = None
    gender: Gender | None = None
    address: str | None = Field(default=None, max_length=1000)
    blood_group: str | None = Field(default=None, max_length=5)
    category: Category | None = None
    samagra_id: str | None = Field(default=None, pattern=r"^\d{8}$")
    pen: str | None = Field(default=None, min_length=11, max_length=11)
    previous_school: str | None = Field(default=None, max_length=1000)
    medical_notes: str | None = Field(default=None, max_length=2000)
    emergency_name: str | None = Field(default=None, max_length=200)
    emergency_phone: str | None = Field(default=None, max_length=30)

    @field_validator("first_name", "last_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class StudentPatch(BaseModel):
    scholar_no: str | None = Field(default=None, min_length=1, max_length=30)
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    dob: date | None = None
    gender: Gender | None = None
    address: str | None = Field(default=None, max_length=1000)
    blood_group: str | None = Field(default=None, max_length=5)
    category: Category | None = None
    samagra_id: str | None = Field(default=None, pattern=r"^\d{8}$")
    pen: str | None = Field(default=None, min_length=11, max_length=11)
    previous_school: str | None = Field(default=None, max_length=1000)
    medical_notes: str | None = Field(default=None, max_length=2000)
    emergency_name: str | None = Field(default=None, max_length=200)
    emergency_phone: str | None = Field(default=None, max_length=30)
    admitted_on: date | None = None


class GuardianIn(BaseModel):
    """A parent or guardian on a new student. Give `guardian_id` to attach an existing one (a sibling's parent).
    The same email as an existing guardian in the school also reuses that guardian."""

    guardian_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    occupation: str | None = Field(default=None, max_length=100)
    relation: Relation = "other"
    is_primary: bool = False
    is_emergency: bool = False


class GuardianLinkPatch(BaseModel):
    relation: Relation | None = None
    is_primary: bool | None = None
    is_emergency: bool | None = None


class GuardianPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    occupation: str | None = Field(default=None, max_length=100)


class EnrolIn(StudentFields):
    """Direct enrolment: the student, the guardians and the class in one go."""

    scholar_no: str | None = Field(default=None, min_length=1, max_length=30)  # default: next number
    class_id: uuid.UUID
    admitted_on: date | None = None  # default: today (IST)
    roll_no: int | None = Field(default=None, ge=1)
    guardians: list[GuardianIn] = Field(min_length=1, max_length=5)
    create_parent_login: bool = False
    send_login: bool = False
    fee_options: list[dict[str, Any]] | None = None  # passed to the fees module's enrol hook, if any


class ClassBrief(BaseModel):
    id: uuid.UUID
    grade: str
    section: str
    label: str


class EnrollmentOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_label: str
    academic_year_id: uuid.UUID
    academic_year: str
    roll_no: int | None
    status: str
    started_on: date | None
    ended_on: date | None


class GuardianOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    occupation: str | None
    relation: str
    is_primary: bool
    is_emergency: bool
    has_login: bool
    login_status: str  # none | pending | sent | failed | active
    last_login_at: datetime | None


class EventOut(ORM):
    id: uuid.UUID
    kind: str
    from_class_id: uuid.UUID | None
    to_class_id: uuid.UUID | None
    from_class: str | None = None
    to_class: str | None = None
    academic_year_id: uuid.UUID | None
    effective_on: date | None
    reason: str | None
    recorded_by: uuid.UUID | None
    recorded_by_name: str | None = None
    recorded_at: datetime


class StudentListItem(BaseModel):
    id: uuid.UUID
    scholar_no: str
    first_name: str
    last_name: str
    name: str
    gender: str | None
    dob: date | None
    status: str
    class_id: uuid.UUID | None
    class_label: str | None
    roll_no: int | None
    enrollment_status: str | None
    guardian_name: str | None
    guardian_phone: str | None


class StudentDetail(BaseModel):
    id: uuid.UUID
    scholar_no: str
    first_name: str
    last_name: str
    name: str
    dob: date | None
    gender: str | None
    address: str | None
    status: str
    admitted_on: date | None
    left_on: date | None
    leaving_reason: str | None
    tc_number: str | None
    photo_url: str | None
    blood_group: str | None
    category: str | None
    samagra_id: str | None
    pen: str | None
    previous_school: str | None
    medical_notes: str | None
    emergency_name: str | None
    emergency_phone: str | None
    current_enrollment: EnrollmentOut | None
    enrollments: list[EnrollmentOut]
    guardians: list[GuardianOut]
    history: list[EventOut]


class LeaveIn(BaseModel):
    left_on: date | None = None  # default: today (IST)
    reason: str = Field(min_length=1, max_length=1000)


class RejoinIn(BaseModel):
    class_id: uuid.UUID
    on: date | None = None
    reason: str | None = Field(default=None, max_length=1000)


class TransferIn(BaseModel):
    class_id: uuid.UUID
    effective_on: date | None = None
    reason: str | None = Field(default=None, max_length=1000)


class PhotoIn(BaseModel):
    file_id: uuid.UUID


class GuardianAddIn(GuardianIn):
    create_login: bool = False
    send_login: bool = False


# ---- parent logins (staff side)
class ParentChild(BaseModel):
    student_id: uuid.UUID
    name: str
    class_label: str | None


class ParentRow(BaseModel):
    guardian_id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    children: list[ParentChild]
    login_status: str  # none | pending | sent | failed | active
    login_sent_at: datetime | None
    last_login_at: datetime | None


class ParentSendIn(BaseModel):
    guardian_ids: list[uuid.UUID] | None = None  # none = everyone still waiting for a login


class ParentSendOut(BaseModel):
    created: int
    sent: int
    failed: int
    skipped_no_email: int = 0


class ParentListRow(BaseModel):
    scholar_no: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    mobile: str | None = Field(default=None, max_length=30)
    relation: Relation = "other"


class ParentListIn(BaseModel):
    rows: list[ParentListRow] = Field(min_length=1, max_length=2000)
    dry_run: bool = True
    send_login: bool = False


class RowError(BaseModel):
    row_no: int
    error: str


class ParentListOut(BaseModel):
    dry_run: bool
    total_rows: int
    error_rows: int
    errors: list[RowError]
    parents: int
    links: int
    logins_created: int
    sent: int
    failed: int


# ---- parent app
class ChildOut(BaseModel):
    student_id: uuid.UUID
    scholar_no: str
    name: str
    status: str
    read_only: bool
    photo_url: str | None
    class_id: uuid.UUID | None
    class_label: str | None
    roll_no: int | None
    relation: str


class ChildDetail(ChildOut):
    dob: date | None
    gender: str | None
    blood_group: str | None
    address: str | None
    admitted_on: date | None
    guardians: list[GuardianOut]


# ---- import
class ImportRowOut(BaseModel):
    row_no: int
    ok: bool
    error: str | None
    data: dict[str, Any]


class ImportJobOut(BaseModel):
    id: uuid.UUID
    file_name: str
    status: str
    total_rows: int
    ok_rows: int
    error_rows: int
    imported_at: datetime | None
    rows: list[ImportRowOut]


class ImportCommitIn(BaseModel):
    skip_errors: bool = False  # import the valid rows even if some rows have errors
    send_login: bool = False


class ImportCommitOut(BaseModel):
    job_id: uuid.UUID
    imported: int
    skipped: int
    logins_created: int
    sent: int
    failed: int
