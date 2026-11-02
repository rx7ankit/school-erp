import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

LeaveHalfT = Literal["none", "first", "second"]


class LeaveIn(BaseModel):
    from_on: date
    to_on: date | None = None  # defaults to from_on
    half: LeaveHalfT = "none"
    reason: str = Field(min_length=1, max_length=1000)
    attachment_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _dates(self):
        end = self.to_on or self.from_on
        if end < self.from_on:
            raise ValueError("to_on cannot be before from_on")
        if self.half != "none" and end != self.from_on:
            raise ValueError("a half day can only be for a single day")
        return self


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=500)


class LeaveOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    class_label: str | None
    guardian_name: str
    from_on: date
    to_on: date
    half: str
    reason: str
    status: str
    has_attachment: bool
    decided_by_name: str | None = None
    decided_at: datetime | None = None
    decision_note: str | None = None
    created_at: datetime


class AttachmentUploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str
    size_bytes: int = Field(gt=0)
