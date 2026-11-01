import uuid
from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM


class YearIn(BaseModel):
    name: str = Field(min_length=4, max_length=20)
    starts_on: date
    ends_on: date

    @model_validator(mode="after")
    def _order(self):
        if self.ends_on <= self.starts_on:
            raise ValueError("The year must end after it starts.")
        return self


class YearOut(ORM):
    id: uuid.UUID
    name: str
    starts_on: date
    ends_on: date
    status: str


class ClassIn(BaseModel):
    academic_year_id: uuid.UUID | None = None  # default: the current year
    grade: str = Field(min_length=1, max_length=40)
    section: str = Field(default="A", min_length=1, max_length=20)
    capacity: int = Field(default=40, ge=1, le=200)
    is_custom: bool = False
    display_order: int | None = None


class ClassPatch(BaseModel):
    section: str | None = Field(default=None, min_length=1, max_length=20)
    capacity: int | None = Field(default=None, ge=1, le=200)
    next_class_id: uuid.UUID | None = None


class ClassOut(ORM):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    grade: str
    section: str
    display_order: int
    capacity: int
    is_custom: bool
    next_class_id: uuid.UUID | None
    students: int = 0
    class_teacher_id: uuid.UUID | None = None
    subject_ids: list[uuid.UUID] = []


class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str | None = Field(default=None, max_length=20)


class SubjectOut(ORM):
    id: uuid.UUID
    name: str
    code: str | None


class ClassSubjectsIn(BaseModel):
    subject_ids: list[uuid.UUID]


class TeacherIn(BaseModel):
    staff_id: uuid.UUID | None  # null clears the assignment


class AssignmentRow(BaseModel):
    class_id: uuid.UUID
    staff_id: uuid.UUID
    staff_name: str
    role: str
    subject_id: uuid.UUID | None
