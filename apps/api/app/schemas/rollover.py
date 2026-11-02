import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM

Decision = Literal["promote", "repeat", "leave", "passed_out"]
Frequency = Literal["monthly", "quarterly", "term", "yearly", "once"]


# ------------------------------------------------------------------ the plan (what the wizard saves)
class DestinationIn(BaseModel):
    """A class of the new year by grade and section. Created automatically when it does not exist yet."""

    grade: str = Field(min_length=1, max_length=40)
    section: str = Field(default="A", min_length=1, max_length=20)


class DecisionIn(BaseModel):
    """An exception to the default (promote to the next grade, last grade passes out)."""

    student_id: uuid.UUID
    decision: Decision
    to_class: DestinationIn | None = None  # for promote or repeat: another class than the default


class ClassMoveIn(BaseModel):
    """Where a whole class goes ("8-A becomes 9-B")."""

    from_class_id: uuid.UUID
    to_class: DestinationIn


class ExtraClassIn(DestinationIn):
    capacity: int | None = Field(default=None, ge=1, le=500)


class SubjectsIn(DestinationIn):
    subject_ids: list[uuid.UUID]


class AssignmentIn(DestinationIn):
    """Set one teacher slot of a new class. staff_id null leaves the slot empty."""

    role: Literal["class_teacher", "subject_teacher"]
    subject_id: uuid.UUID | None = None
    staff_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _subject(self):
        if (self.role == "subject_teacher") != (self.subject_id is not None):
            raise ValueError("A subject teacher needs subject_id, a class teacher must not have one.")
        return self


class FeeCellIn(BaseModel):
    """Override one cell of the new class x fee head grid. amount_paise 0 removes the line."""

    grade: str
    section: str | None = None  # null = every section of the grade
    fee_head_id: uuid.UUID
    amount_paise: int = Field(ge=0, le=100_000_000)
    frequency: Frequency | None = None  # for a head the class did not have: default term


class FirstInvoiceIn(BaseModel):
    period_label: str = Field(default="Term 1", min_length=1, max_length=60)
    due_on: date
    frequencies: list[Frequency] = Field(default_factory=lambda: ["term", "yearly", "once"], min_length=1)


class FeesPlanIn(BaseModel):
    increase_percent: int = Field(default=0, ge=0, le=100)
    round_to_paise: int = Field(default=0, ge=0, le=10_000_000)  # 0 = no rounding, 10000 = nearest Rs 100
    cells: list[FeeCellIn] = Field(default_factory=list)
    dues: Literal["carry", "write_off"] = "carry"
    write_off_reason: str | None = Field(default=None, max_length=500)
    carry_concession_ids: list[uuid.UUID] | None = None  # null = every active concession, [] = none
    carry_options: bool = True  # optional fees (transport...) of continuing students
    first_invoice: FirstInvoiceIn | None = None

    @model_validator(mode="after")
    def _reason(self):
        if self.dues == "write_off" and not (self.write_off_reason or "").strip():
            raise ValueError("Writing off dues needs a reason.")
        return self


class RolloverPlan(BaseModel):
    new_year_name: str | None = Field(default=None, max_length=20)
    starts_on: date | None = None
    ends_on: date | None = None
    decisions: list[DecisionIn] = Field(default_factory=list)
    class_moves: list[ClassMoveIn] = Field(default_factory=list)
    extra_classes: list[ExtraClassIn] = Field(default_factory=list)
    roll_order: Literal["alphabetical", "keep"] = "alphabetical"
    subjects: list[SubjectsIn] = Field(default_factory=list)
    teachers: Literal["same", "move_up", "empty"] = "same"
    assignments: list[AssignmentIn] = Field(default_factory=list)
    timetable: Literal["copy", "empty"] = "copy"
    fees: FeesPlanIn = Field(default_factory=FeesPlanIn)

    @model_validator(mode="after")
    def _dates(self):
        if self.starts_on and self.ends_on and self.ends_on <= self.starts_on:
            raise ValueError("The new year must end after it starts.")
        return self


class DraftOut(BaseModel):
    plan: RolloverPlan
    updated_at: datetime | None
    updated_by: str | None


class ApplyIn(BaseModel):
    from_year_id: uuid.UUID  # the year being closed (RolloverStatus.current_year_id): makes a repeated click harmless
    confirm: bool = False  # "I have checked this"
    plan: RolloverPlan | None = None  # default: the saved draft


# ------------------------------------------------------------------ readiness and status
class ReadinessItem(BaseModel):
    key: str
    label: str
    count: int
    ok: bool
    amount_paise: int | None = None
    link: str
    details: list[str] = Field(default_factory=list)


class Readiness(BaseModel):
    items: list[ReadinessItem]
    all_ok: bool


class RolloverStatus(BaseModel):
    current_year_id: uuid.UUID | None
    current_year: str | None
    ends_on: date | None
    days_left: int | None
    show_banner: bool  # from 45 days before the year end
    suggested_name: str | None
    suggested_starts_on: date | None
    suggested_ends_on: date | None
    has_draft: bool
    already_applied: bool
    last_batch_id: uuid.UUID | None


# ------------------------------------------------------------------ students step
class StudentHint(BaseModel):
    enrollment_id: uuid.UUID
    student_id: uuid.UUID
    scholar_no: str
    name: str
    roll_no: int | None
    decision: Decision
    to_class: str | None
    result_percentage: float | None
    below_pass: bool
    attendance_percentage: float | None
    fee_balance_paise: int


class ClassPanel(BaseModel):
    class_id: uuid.UUID
    class_label: str
    destination: str | None  # "9-A", or null when the class passes out / has no destination
    students: list[StudentHint]


# ------------------------------------------------------------------ preview
class PlanProblem(BaseModel):
    code: str
    message: str


class NewClassOut(BaseModel):
    label: str
    grade: str
    section: str
    capacity: int
    students: int
    exists: bool
    from_classes: list[str]
    subjects: int
    teacher_slots: int
    teacher_slots_filled: int
    timetable_slots: int
    fee_total_paise: int


class DuesOut(BaseModel):
    mode: str
    students: int
    total_paise: int


class RolloverPreview(BaseModel):
    from_year: str
    to_year: str
    to_year_exists: bool
    starts_on: date | None
    ends_on: date | None
    promoted: int
    staying: int
    leaving: int
    passed_out: int
    new_classes: list[NewClassOut]
    teacher_slots: int
    teacher_slots_filled: int
    fee_total_paise: int
    dues: DuesOut
    first_invoices: bool
    parents_notified: int
    problems: list[PlanProblem]
    warnings: list[str]
    can_apply: bool


# ------------------------------------------------------------------ after apply
class ChecklistItem(BaseModel):
    key: str
    label: str
    count: int
    link: str


class ApplyOut(BaseModel):
    batch_id: uuid.UUID
    from_year: str
    to_year: str
    promoted: int
    staying: int
    leaving: int
    passed_out: int
    classes_created: int
    dues_carried_paise: int
    dues_written_off_paise: int
    invoices_created: int
    parents_notified: int
    checklist: list[ChecklistItem]


class BatchOut(ORM):
    id: uuid.UUID
    from_year_id: uuid.UUID
    to_year_id: uuid.UUID
    from_year: str
    to_year: str
    status: str
    applied_at: datetime | None
    created_by: uuid.UUID
    summary: dict | None


class BatchItemOut(BaseModel):
    student_id: uuid.UUID
    scholar_no: str
    name: str
    decision: str
    from_class: str
    to_class: str | None


class BatchDetail(BatchOut):
    items: list[BatchItemOut]
