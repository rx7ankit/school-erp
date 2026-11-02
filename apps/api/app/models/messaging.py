import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TenantMixin, TimestampMixin
from app.models.enums import BroadcastAudience, BroadcastScope, check_in


class Broadcast(IdMixin, TenantMixin, TimestampMixin, Base):
    """A one-way update to parents. `scope=school` is sent by admin or academic managers to the whole school, a
    grade or chosen classes; `scope=class` by a teacher assigned to that class (subject tag = their subject)."""

    __tablename__ = "broadcasts"
    __table_args__ = (
        CheckConstraint(check_in("scope", BroadcastScope), name="scope"),
        CheckConstraint(check_in("audience", BroadcastAudience), name="audience"),
        Index("ix_broadcasts_school_created", "school_id", "created_at"),
    )

    scope: Mapped[str] = mapped_column(String(10))
    audience: Mapped[str] = mapped_column(String(10), default=BroadcastAudience.all.value)
    grade: Mapped[str | None] = mapped_column(String(40), nullable=True)
    class_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("classes.id"), nullable=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    sender_name: Mapped[str] = mapped_column(String(200))
    sender_role: Mapped[str] = mapped_column(String(20))  # Admin | Class teacher | Teacher | Staff
    recipient_count: Mapped[int] = mapped_column(Integer, default=0)


class BroadcastClass(TenantMixin, Base):
    """The classes a broadcast reaches (none for audience=all)."""

    __tablename__ = "broadcast_classes"
    __table_args__ = (PrimaryKeyConstraint("broadcast_id", "class_id"), Index("ix_broadcast_classes_class", "class_id"))

    broadcast_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("broadcasts.id", ondelete="CASCADE"))
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"))


class BroadcastRead(TenantMixin, Base):
    __tablename__ = "broadcast_reads"
    __table_args__ = (PrimaryKeyConstraint("broadcast_id", "user_id"),)

    broadcast_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("broadcasts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MessageThread(IdMixin, TenantMixin, TimestampMixin, Base):
    """Private chat between a child's parents and one teacher for one subject (`subject_id` null = class teacher
    thread). Whether it is open is derived from `class_staff` and the child's status, never stored."""

    __tablename__ = "message_threads"
    __table_args__ = (
        Index(
            "uq_message_threads_class_teacher",
            "student_id",
            "staff_id",
            unique=True,
            postgresql_where=text("subject_id is null"),
        ),
        Index(
            "uq_message_threads_subject",
            "student_id",
            "staff_id",
            "subject_id",
            unique=True,
            postgresql_where=text("subject_id is not null"),
        ),
        Index("ix_message_threads_staff_last", "staff_id", "last_message_at"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), index=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_preview: Mapped[str | None] = mapped_column(String(160), nullable=True)
    last_sender_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class Message(IdMixin, TenantMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_thread_created", "thread_id", "created_at"),)

    thread_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("message_threads.id"))
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ThreadRead(TenantMixin, Base):
    """How far each participant has read a thread. Drives unread counts and the 'seen' tick."""

    __tablename__ = "thread_reads"
    __table_args__ = (PrimaryKeyConstraint("thread_id", "user_id"),)

    thread_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("message_threads.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MessageFile(IdMixin, TenantMixin, Base):
    """An attachment on a broadcast or a message."""

    __tablename__ = "message_files"
    __table_args__ = (
        CheckConstraint("(broadcast_id is null) <> (message_id is null)", name="one_parent"),
        Index("ix_message_files_broadcast", "broadcast_id"),
        Index("ix_message_files_message", "message_id"),
    )

    broadcast_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=True
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("messages.id"), nullable=True)
    attachment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attachments.id"))
