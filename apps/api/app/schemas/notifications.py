import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORM


class NotificationOut(ORM):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    data: dict | None
    student_id: uuid.UUID | None
    created_at: datetime
    read_at: datetime | None
    is_read: bool = False


class InboxOut(BaseModel):
    items: list[NotificationOut]
    total: int
    unread: int


class UnreadOut(BaseModel):
    unread: int


class ReadAllIn(BaseModel):
    student_id: uuid.UUID | None = None


class DeviceIn(BaseModel):
    token: str = Field(min_length=10, max_length=1024)
    platform: Literal["ios", "android"]


class DeviceTokenIn(BaseModel):
    token: str = Field(min_length=1, max_length=1024)


class PreferenceIn(BaseModel):
    category: str
    push_enabled: bool


class PreferencesOut(BaseModel):
    """Push on or off per category. The inbox always shows everything."""

    preferences: dict[str, bool]
