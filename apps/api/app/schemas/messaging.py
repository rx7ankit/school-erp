import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORM


class AttachmentRef(ORM):
    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int


class BroadcastIn(BaseModel):
    """scope=school: whole school (`audience=all`), a grade, or chosen classes. Needs announcements.manage.
    scope=class: one class (`class_id`) by a teacher assigned to it; `subject_id` is the subject tag."""

    scope: Literal["school", "class"]
    audience: Literal["all", "grade", "classes"] = "all"
    grade: str | None = None
    class_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    class_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    attachment_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)


class BroadcastPatch(BaseModel):
    """Edit a sent notice. Only the fields given change. `attachment_ids` is the complete list of photos/files the notice
    should have afterwards (up to five): anything not listed is removed, new uploads are added."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1, max_length=5000)
    attachment_ids: list[uuid.UUID] | None = Field(default=None, max_length=5)


class FeedItemOut(BaseModel):
    """One update as a parent sees it."""

    id: uuid.UUID
    scope: str
    tag: str  # School | the subject | General
    class_label: str | None
    title: str
    body: str
    sender_name: str
    sender_role: str
    created_at: datetime
    is_read: bool
    attachments: list[AttachmentRef]


class BroadcastOut(FeedItemOut):
    """The same update for staff, with delivery numbers."""

    audience: str
    grade: str | None
    class_id: uuid.UUID | None
    subject_id: uuid.UUID | None
    class_labels: list[str]
    recipient_count: int
    read_count: int
    can_edit: bool = False  # this person may edit or delete it: announcements.manage, or they sent it


class UnreadSummary(BaseModel):
    updates: int
    messages: int


class ThreadOpenIn(BaseModel):
    """Staff: the child and the subject they teach (null = as class teacher)."""

    student_id: uuid.UUID
    subject_id: uuid.UUID | None = None


class ParentThreadOpenIn(BaseModel):
    student_id: uuid.UUID
    staff_id: uuid.UUID
    subject_id: uuid.UUID | None = None


class ThreadOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_label: str | None
    teacher_id: uuid.UUID
    teacher_name: str
    subject_id: uuid.UUID | None
    tag: str  # "Class teacher" or the subject name
    active: bool
    inactive_notice: str | None  # shown instead of the composer (English)
    inactive_notice_hi: str | None = None  # the same in Hindi, for parents whose language is hi
    last_message_at: datetime | None
    last_message_preview: str | None
    unread: int


class TeacherOut(BaseModel):
    """A teacher of the child's class and the thread with them (null until the parent opens it)."""

    staff_id: uuid.UUID
    name: str
    subject_id: uuid.UUID | None
    tag: str
    thread_id: uuid.UUID | None


class MessageIn(BaseModel):
    # May be empty when the message carries an attachment (checked in the service).
    body: str = Field(default="", max_length=4000)
    attachment_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)


class MessageOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    sender_kind: str  # teacher | parent
    mine: bool
    body: str
    created_at: datetime
    seen: bool  # for my own messages: the other side has opened the thread since
    attachments: list[AttachmentRef]
