import uuid

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
