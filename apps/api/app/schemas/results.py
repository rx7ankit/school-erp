import uuid
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORM


# ------------------------------------------------------------------ grading
class BandIn(BaseModel):
    min_percent: int = Field(ge=0, le=100)
    grade: str = Field(min_length=1, max_length=10)

    @field_validator("grade")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class BandOut(ORM):
    min_percent: int
    grade: str


class SchemeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    bands: list[BandIn] = Field(min_length=1)
    make_active: bool = False


class SchemePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    bands: list[BandIn] | None = Field(default=None, min_length=1)


class SchemeOut(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool
    bands: list[BandOut]


# ------------------------------------------------------------------ exams
class ExamIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    academic_year_id: uuid.UUID | None = None  # default: the current year
    starts_on: date | None = None
    ends_on: date | None = None


class ExamPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    starts_on: date | None = None
    ends_on: date | None = None


class ExamOut(ORM):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    name: str
    starts_on: date | None
    ends_on: date | None


class PaperIn(BaseModel):
    subject_id: uuid.UUID
    max_marks: int = Field(gt=0, le=1000)
    pass_marks: int | None = Field(default=None, ge=0)  # default: 33% of max, rounded up


class PapersIn(BaseModel):
    class_ids: list[uuid.UUID] = Field(min_length=1)
    papers: list[PaperIn]


class PaperOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    subject_id: uuid.UUID
    subject: str
    max_marks: int
    pass_marks: int
    can_edit: bool = False  # the caller may enter marks for this paper


class ExamClassStatus(BaseModel):
    class_id: uuid.UUID
    class_name: str
    papers: int
    students: int
    entered: int  # marks entered (or absent) out of students x papers
    expected: int
    published_at: datetime | None


# ------------------------------------------------------------------ marks
class MarkIn(BaseModel):
    enrollment_id: uuid.UUID
    subject_id: uuid.UUID
    marks_obtained: Decimal | None = Field(default=None, ge=0, max_digits=6, decimal_places=2)
    absent: bool = False
    remarks: str | None = Field(default=None, max_length=300)


class MarksIn(BaseModel):
    entries: list[MarkIn] = Field(min_length=1, max_length=2000)


class RemarkIn(BaseModel):
    enrollment_id: uuid.UUID
    remark: str = Field(max_length=500)  # empty removes the remark


class RemarksIn(BaseModel):
    remarks: list[RemarkIn] = Field(min_length=1, max_length=500)


class MarkCell(BaseModel):
    subject_id: uuid.UUID
    marks_obtained: float | None
    absent: bool
    entered: bool
    grade: str | None
    passed: bool | None
    remarks: str | None


class StudentRow(BaseModel):
    enrollment_id: uuid.UUID
    student_id: uuid.UUID
    scholar_no: str
    name: str
    roll_no: int | None
    marks: list[MarkCell]
    total: float
    max_total: int
    percentage: float | None
    grade: str | None
    passed: bool | None  # None until every paper is entered
    complete: bool
    rank: int | None
    remark: str | None


class ClassSheet(BaseModel):
    exam: ExamOut
    class_id: uuid.UUID
    class_name: str
    papers: list[PaperOut]
    students: list[StudentRow]
    published_at: datetime | None
    grading: list[BandOut]


class MarksSaved(BaseModel):
    saved: int
    cleared: int


class StudentResult(BaseModel):
    exam: ExamOut
    student_id: uuid.UUID
    scholar_no: str
    name: str
    class_name: str
    roll_no: int | None
    papers: list[PaperOut]
    marks: list[MarkCell]
    total: float
    max_total: int
    percentage: float | None
    grade: str | None
    passed: bool | None
    complete: bool
    rank: int | None
    class_size: int
    remark: str | None
    published_at: datetime | None


class ReportCard(StudentResult):
    school_name: str
    academic_year: str
    grading: list[BandOut]
    attendance: dict | None = None  # attendance Stats plus from_on/to_on: the year so far, up to the exam's end
    generated_at: datetime


class ParentExamRow(BaseModel):
    exam: ExamOut
    class_name: str
    published_at: datetime
    percentage: float | None
    grade: str | None
    rank: int | None
    passed: bool | None


# ------------------------------------------------------------------ date sheet
class ScheduleIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    exam_id: uuid.UUID | None = None


class ScheduleOut(BaseModel):
    id: uuid.UUID
    name: str
    exam_id: uuid.UUID | None
    published_at: datetime | None
    papers: int


class SchedulePaperIn(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    paper_on: date  # IST date
    starts_at: time  # IST clock time


class SchedulePapersIn(BaseModel):
    papers: list[SchedulePaperIn] = Field(max_length=2000)  # replaces all papers of the sheet


class SchedulePaperOut(BaseModel):
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject: str
    paper_on: date
    starts_at: time


class ScheduleDetail(ScheduleOut):
    items: list[SchedulePaperOut]


class ParentSchedule(BaseModel):
    id: uuid.UUID
    name: str
    published_at: datetime
    items: list[SchedulePaperOut]


# ------------------------------------------------------------------ feedback
class FeedbackIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    class_ids: list[uuid.UUID] = Field(min_length=1)
    opens_on: date | None = None  # default: today
    closes_on: date
    share_with_teachers: bool = False
    open_now: bool = True  # False keeps it as a draft


class FeedbackRow(BaseModel):
    id: uuid.UUID
    title: str
    status: str  # draft | open | closed (closed also once closes_on has passed)
    opens_on: date
    closes_on: date
    share_with_teachers: bool
    targets: int
    responses: int


class TargetSummary(BaseModel):
    target_id: uuid.UUID
    teacher: str
    class_name: str
    subject: str | None
    responses: int
    average: float | None
    spread: dict[str, int]  # "1".."5" -> count
    expected: int  # active students of the class
    response_rate: float
    comments: list[str]  # no names, no dates, in no time order


class FeedbackDetail(FeedbackRow):
    response_rate: float
    teachers: list[TargetSummary]


class MyFeedbackRow(BaseModel):
    """What a teacher sees about themselves (needs share_with_teachers and a closed request)."""

    request_id: uuid.UUID
    title: str
    closes_on: date
    summaries: list[TargetSummary]


class RatingIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)

    @field_validator("comment")
    @classmethod
    def _blank(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None


class ParentTarget(BaseModel):
    target_id: uuid.UUID
    teacher: str
    subject: str | None
    my_rating: int | None
    my_comment: str | None


class ParentFeedback(BaseModel):
    request_id: uuid.UUID
    title: str
    closes_on: date
    student_id: uuid.UUID
    student_name: str
    targets: list[ParentTarget]


class PublishedOut(BaseModel):
    published_at: datetime | None


class ChangedOut(BaseModel):
    changed: int
