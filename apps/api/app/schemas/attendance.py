import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM

Mark = Literal["present", "absent", "leave"]
HolidayKindT = Literal["holiday", "exam", "event"]
DayStatus = Literal["full", "half", "absent", "leave", "not_marked"]


# ------------------------------------------------------------------ holidays
class HolidayIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    from_on: date
    to_on: date | None = None
    kind: HolidayKindT = "holiday"

    @model_validator(mode="after")
    def _dates(self):
        if self.to_on is not None and self.to_on < self.from_on:
            raise ValueError("to_on cannot be before from_on")
        return self


class HolidayPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    from_on: date | None = None
    to_on: date | None = None
    kind: HolidayKindT | None = None


class HolidayOut(ORM):
    id: uuid.UUID
    title: str
    from_on: date
    to_on: date
    kind: str


# ------------------------------------------------------------------ the daily sheet
class SheetStudent(BaseModel):
    student_id: uuid.UUID
    enrollment_id: uuid.UUID
    name: str
    scholar_no: str
    roll_no: int | None
    first_half: Mark
    second_half: Mark
    late: bool = False
    note: str | None = None
    saved: bool  # False: a suggestion (present, or leave from an approved application), not yet saved
    leave_id: uuid.UUID | None = None  # an approved leave covers this student today


class Sheet(BaseModel):
    class_id: uuid.UUID
    class_label: str
    day_on: date
    marked: bool
    marked_by: str | None = None
    marked_at: datetime | None = None
    holiday: str | None = None  # title, if the day is a holiday
    can_mark: bool
    students: list[SheetStudent]


class RecordIn(BaseModel):
    student_id: uuid.UUID
    first_half: Mark
    second_half: Mark
    late: bool = False
    note: str | None = Field(default=None, max_length=500)


class MarkIn(BaseModel):
    records: list[RecordIn] = Field(min_length=1)


class DaySummary(BaseModel):
    day_on: date
    students: int
    present_days: float
    percentage: float | None
    marked_by: str | None = None
    marked_at: datetime
    is_holiday: bool


# ------------------------------------------------------------------ stats
class Stats(BaseModel):
    """Computed on the fly. A full day is 1, a half day 0.5. present + absent + leave = working_days."""

    working_days: int
    present_days: float
    absent_days: float
    leave_days: float
    full_days: int
    half_days: int
    late_days: int
    percentage: float | None


class StudentStats(Stats):
    student_id: uuid.UUID
    name: str
    scholar_no: str
    roll_no: int | None
    status: str  # the enrollment: active, left...
    below_threshold: bool


class ClassStats(BaseModel):
    class_id: uuid.UUID
    class_label: str
    from_on: date
    to_on: date
    threshold: float
    summary: Stats
    students: list[StudentStats]


class CalendarDay(BaseModel):
    day_on: date
    status: DayStatus
    first_half: Mark | None = None
    second_half: Mark | None = None
    late: bool = False
    note: str | None = None
    holiday: str | None = None


class Calendar(BaseModel):
    student_id: uuid.UUID
    month: str
    days: list[CalendarDay]
    holidays: list[HolidayOut]
    stats: Stats


class StudentStatsOut(BaseModel):
    student_id: uuid.UUID
    from_on: date
    to_on: date
    stats: Stats


# ------------------------------------------------------------------ analytics
class ClassRow(BaseModel):
    class_id: uuid.UUID
    class_label: str
    students: int
    working_days: int
    percentage: float | None


class TrendPoint(BaseModel):
    day_on: date
    percentage: float | None


class WeekdayPoint(BaseModel):
    weekday: int  # 1 Monday .. 7 Sunday
    percentage: float | None


class Analytics(BaseModel):
    from_on: date
    to_on: date
    overall_percentage: float | None
    marked_days: int
    by_class: list[ClassRow]
    trend: list[TrendPoint]
    by_weekday: list[WeekdayPoint]
    students_below_threshold: int
    threshold: float


class BelowRow(BaseModel):
    student_id: uuid.UUID
    name: str
    scholar_no: str
    class_id: uuid.UUID
    class_label: str
    working_days: int
    percentage: float


class TeacherRow(BaseModel):
    staff_id: uuid.UUID
    name: str
    classes: list[str]  # classes they teach ("8-A", "8-B")
    class_teacher_of: list[str]
    class_attendance_percentage: float | None  # of the classes they are class teacher of
    days_marked: int  # days they are recorded in staff_attendance
    days_present: int
    days_absent: int
    days_leave: int


# ------------------------------------------------------------------ staff attendance
class StaffMarkIn(BaseModel):
    staff_id: uuid.UUID
    status: Mark
    reason: str | None = Field(default=None, max_length=500)


class StaffMarksIn(BaseModel):
    records: list[StaffMarkIn] = Field(min_length=1)


class StaffMarkOut(BaseModel):
    staff_id: uuid.UUID
    name: str
    status: Mark | None
    reason: str | None = None
    saved: bool


# ------------------------------------------------------------------ one day across classes
class ClassDay(BaseModel):
    class_id: uuid.UUID
    class_label: str
    marked: bool
    students: int  # marked students on that day (0 when the class was not marked)
    percentage: float | None  # present share that day; null until the class is marked


class DayOverview(BaseModel):
    """One date for every class this person can see: the classes marked, and the day's attendance percentage."""

    day_on: date
    holiday: str | None = None
    classes_total: int
    classes_marked: int
    percentage: float | None
    classes: list[ClassDay]
