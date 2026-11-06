import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import Permission
from app.schemas.auth import AssignmentOut
from app.services.permissions import from_clients


class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    designation: str = Field(min_length=1, max_length=100)
    department: str = Field(default="", max_length=100)
    joined_on: date | None = None
    send_login: bool = False
    permissions: list[Permission] = []  # all three = full access (what used to be the admin)

    @field_validator("permissions", mode="before")
    @classmethod
    def _legacy(cls, v):
        return sorted(from_clients(v)) if isinstance(v, list) else v


class StaffBulkRow(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    designation: str = Field(min_length=1, max_length=100)
    email: EmailStr


class StaffBulkIn(BaseModel):
    rows: list[StaffBulkRow] = Field(min_length=1, max_length=500)
    send_login: bool = False


class StaffPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    joined_on: date | None = None


class PermissionsIn(BaseModel):
    permissions: list[Permission]

    @field_validator("permissions", mode="before")
    @classmethod
    def _legacy(cls, v):
        return sorted(from_clients(v)) if isinstance(v, list) else v


class SendLoginIn(BaseModel):
    user_ids: list[uuid.UUID] | None = None  # none = everyone who has not been sent a login yet


class StaffOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: str | None
    designation: str
    department: str
    employee_code: str
    joined_on: date | None
    is_admin: bool
    is_active: bool
    permissions: list[str]
    assignments: list[AssignmentOut]
    invite_status: str
    login_sent_at: datetime | None
    last_login_at: datetime | None


class SendLoginOut(BaseModel):
    sent: int
    failed: int


class PermissionInfo(BaseModel):
    key: str
    label: str
    description: str


class PresetInfo(BaseModel):
    key: str
    label: str
    description: str
    permissions: list[str]


class AccessOptions(BaseModel):
    permissions: list[PermissionInfo]
    presets: list[PresetInfo]
