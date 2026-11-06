import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)
    device: str | None = Field(default=None, max_length=200)


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    kind: str
    must_change_password: bool


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(max_length=200)


class AssignmentOut(BaseModel):
    class_id: uuid.UUID
    role: str
    subject_id: uuid.UUID | None


class SchoolBrief(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    logo_url: str | None = None  # a short-lived link; fetch /auth/me again for a fresh one


class ChildBrief(BaseModel):
    student_id: uuid.UUID
    name: str
    class_label: str | None = None
    read_only: bool = False


class MeOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    kind: str
    is_admin: bool
    must_change_password: bool
    designation: str = ""
    permissions: list[str]
    assignments: list[AssignmentOut]
    school: SchoolBrief | None
    photo_url: str | None = None  # this person's own photo (staff only), a short-lived link
    language: str = "en"  # "en" or "hi"; parents can change it at PATCH /parent/preferences
    children: list[ChildBrief] = []  # parents only: the child switcher, also at /parent/children


class PreferencesIn(BaseModel):
    language: Literal["en", "hi"]


class PreferencesOut(BaseModel):
    language: str  # "en" or "hi"


class PhotoSetIn(BaseModel):
    """`file_id` is an uploaded and confirmed file; null removes the photo."""

    file_id: uuid.UUID | None = None


class PhotoOut(BaseModel):
    url: str | None
