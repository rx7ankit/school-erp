import uuid
from datetime import date, time

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM


class PeriodIn(BaseModel):
    number: int = Field(ge=1, le=20)
    name: str = Field(min_length=1, max_length=50)
    starts_at: time
    ends_at: time

    @model_validator(mode="after")
    def _order(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("A period must end after it starts.")
        return self


class PeriodPatch(BaseModel):
    number: int | None = Field(None, ge=1, le=20)
    name: str | None = Field(None, min_length=1, max_length=50)
    starts_at: time | None = None
    ends_at: time | None = None


class PeriodOut(ORM):
    id: uuid.UUID
    number: int
    name: str
    starts_at: time
    ends_at: time


class SlotIn(BaseModel):
    class_id: uuid.UUID
    weekday: int = Field(ge=1, le=6, description="1 Monday to 6 Saturday")
    period_id: uuid.UUID
    subject_id: uuid.UUID
    staff_id: uuid.UUID


class SlotPatch(BaseModel):
    subject_id: uuid.UUID | None = None
    staff_id: uuid.UUID | None = None


class SlotOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_label: str
    weekday: int
    period_id: uuid.UUID
    period_number: int
    period_name: str
    starts_at: time
    ends_at: time
    subject_id: uuid.UUID
    subject_name: str
    staff_id: uuid.UUID
    staff_name: str


class ClassTimetable(BaseModel):
    class_id: uuid.UUID
    class_label: str
    periods: list[PeriodOut]
    slots: list[SlotOut]


class StaffTimetable(BaseModel):
    staff_id: uuid.UUID
    staff_name: str
    periods: list[PeriodOut]
    slots: list[SlotOut]


class DayEntry(BaseModel):
    """One period of a teacher's day. role: teaching | covered (someone else takes it) | covering (taking
    another teacher's class)."""

    role: str
    slot: SlotOut
    substitute_staff_id: uuid.UUID | None = None
    substitute_name: str | None = None
    absent_staff_id: uuid.UUID | None = None
    absent_staff_name: str | None = None


class MyDay(BaseModel):
    on: date
    weekday: int
    entries: list[DayEntry]


class AbsenceIn(BaseModel):
    staff_id: uuid.UUID
    absent_on: date
    reason: str | None = Field(None, max_length=500)


class AbsenceOut(BaseModel):
    id: uuid.UUID
    staff_id: uuid.UUID
    staff_name: str
    absent_on: date
    reason: str | None
    slots_to_cover: int
    slots_covered: int


class SubstituteIn(BaseModel):
    slot_id: uuid.UUID
    covers_on: date
    substitute_staff_id: uuid.UUID


class SubstitutionOut(BaseModel):
    id: uuid.UUID
    covers_on: date
    slot: SlotOut
    absent_staff_id: uuid.UUID
    absent_staff_name: str
    substitute_staff_id: uuid.UUID
    substitute_name: str


class CoverRow(BaseModel):
    """A slot of an absent teacher on a date, with its substitute if one is assigned."""

    absence_id: uuid.UUID
    slot: SlotOut
    substitution_id: uuid.UUID | None
    substitute_staff_id: uuid.UUID | None
    substitute_name: str | None


class FreeTeacher(BaseModel):
    staff_id: uuid.UUID
    name: str


class ChildEntry(BaseModel):
    """What a parent sees for a period on the chosen date."""

    slot: SlotOut
    teacher_name: str
    substitute_name: str | None


class ChildTimetable(BaseModel):
    student_id: uuid.UUID
    class_id: uuid.UUID
    class_label: str
    periods: list[PeriodOut]
    slots: list[SlotOut]
    on: date
    today: list[ChildEntry]
