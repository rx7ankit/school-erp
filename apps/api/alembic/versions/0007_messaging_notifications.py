"""messaging_notifications

Revision ID: 0007
Revises: 0003
Create Date: 2026-11-02 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0007'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    "broadcasts", "broadcast_classes", "broadcast_reads", "message_threads", "messages", "thread_reads",
    "message_files", "notifications", "device_tokens", "notification_preferences",
]


def _ts(name: str, **kw) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, **kw)


def _school() -> sa.Column:
    return sa.Column('school_id', sa.UUID(), nullable=False)


def upgrade() -> None:
    op.create_table('broadcasts',
        sa.Column('scope', sa.String(length=10), nullable=False),
        sa.Column('audience', sa.String(length=10), nullable=False),
        sa.Column('grade', sa.String(length=40), nullable=True),
        sa.Column('class_id', sa.UUID(), nullable=True),
        sa.Column('subject_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('sender_name', sa.String(length=200), nullable=False),
        sa.Column('sender_role', sa.String(length=20), nullable=False),
        sa.Column('recipient_count', sa.Integer(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        _school(), _ts('created_at'), _ts('updated_at'),
        sa.CheckConstraint("scope in ('school', 'class')", name=op.f('ck_broadcasts_scope')),
        sa.CheckConstraint("audience in ('all', 'grade', 'classes')", name=op.f('ck_broadcasts_audience')),
        sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_broadcasts_class_id_classes')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_broadcasts_school_id_schools')),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], name=op.f('fk_broadcasts_sender_id_users')),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], name=op.f('fk_broadcasts_subject_id_subjects')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_broadcasts')),
    )
    op.create_index(op.f('ix_broadcasts_school_id'), 'broadcasts', ['school_id'], unique=False)
    op.create_index(op.f('ix_broadcasts_sender_id'), 'broadcasts', ['sender_id'], unique=False)
    op.create_index('ix_broadcasts_school_created', 'broadcasts', ['school_id', 'created_at'], unique=False)

    op.create_table('broadcast_classes',
        sa.Column('broadcast_id', sa.UUID(), nullable=False),
        sa.Column('class_id', sa.UUID(), nullable=False),
        _school(),
        sa.ForeignKeyConstraint(['broadcast_id'], ['broadcasts.id'], name=op.f('fk_broadcast_classes_broadcast_id_broadcasts'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_broadcast_classes_class_id_classes')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_broadcast_classes_school_id_schools')),
        sa.PrimaryKeyConstraint('broadcast_id', 'class_id', name=op.f('pk_broadcast_classes')),
    )
    op.create_index(op.f('ix_broadcast_classes_school_id'), 'broadcast_classes', ['school_id'], unique=False)
    op.create_index('ix_broadcast_classes_class', 'broadcast_classes', ['class_id'], unique=False)

    op.create_table('broadcast_reads',
        sa.Column('broadcast_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=False),
        _school(),
        sa.ForeignKeyConstraint(['broadcast_id'], ['broadcasts.id'], name=op.f('fk_broadcast_reads_broadcast_id_broadcasts'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_broadcast_reads_school_id_schools')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_broadcast_reads_user_id_users')),
        sa.PrimaryKeyConstraint('broadcast_id', 'user_id', name=op.f('pk_broadcast_reads')),
    )
    op.create_index(op.f('ix_broadcast_reads_school_id'), 'broadcast_reads', ['school_id'], unique=False)

    op.create_table('message_threads',
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('staff_id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=True),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_message_preview', sa.String(length=160), nullable=True),
        sa.Column('last_sender_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        _school(), _ts('created_at'), _ts('updated_at'),
        sa.ForeignKeyConstraint(['last_sender_id'], ['users.id'], name=op.f('fk_message_threads_last_sender_id_users')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_message_threads_school_id_schools')),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id'], name=op.f('fk_message_threads_staff_id_users')),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_message_threads_student_id_students')),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], name=op.f('fk_message_threads_subject_id_subjects')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_message_threads')),
    )
    op.create_index(op.f('ix_message_threads_school_id'), 'message_threads', ['school_id'], unique=False)
    op.create_index(op.f('ix_message_threads_student_id'), 'message_threads', ['student_id'], unique=False)
    op.create_index('ix_message_threads_staff_last', 'message_threads', ['staff_id', 'last_message_at'], unique=False)
    op.create_index('uq_message_threads_class_teacher', 'message_threads', ['student_id', 'staff_id'], unique=True,
                    postgresql_where=sa.text('subject_id is null'))
    op.create_index('uq_message_threads_subject', 'message_threads', ['student_id', 'staff_id', 'subject_id'], unique=True,
                    postgresql_where=sa.text('subject_id is not null'))

    op.create_table('messages',
        sa.Column('thread_id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        _school(),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_messages_school_id_schools')),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], name=op.f('fk_messages_sender_id_users')),
        sa.ForeignKeyConstraint(['thread_id'], ['message_threads.id'], name=op.f('fk_messages_thread_id_message_threads')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_messages')),
    )
    op.create_index(op.f('ix_messages_school_id'), 'messages', ['school_id'], unique=False)
    op.create_index('ix_messages_thread_created', 'messages', ['thread_id', 'created_at'], unique=False)

    op.create_table('thread_reads',
        sa.Column('thread_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=False),
        _school(),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_thread_reads_school_id_schools')),
        sa.ForeignKeyConstraint(['thread_id'], ['message_threads.id'], name=op.f('fk_thread_reads_thread_id_message_threads')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_thread_reads_user_id_users')),
        sa.PrimaryKeyConstraint('thread_id', 'user_id', name=op.f('pk_thread_reads')),
    )
    op.create_index(op.f('ix_thread_reads_school_id'), 'thread_reads', ['school_id'], unique=False)

    op.create_table('message_files',
        sa.Column('broadcast_id', sa.UUID(), nullable=True),
        sa.Column('message_id', sa.UUID(), nullable=True),
        sa.Column('attachment_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        _school(),
        sa.CheckConstraint("(broadcast_id is null) <> (message_id is null)", name=op.f('ck_message_files_one_parent')),
        sa.ForeignKeyConstraint(['attachment_id'], ['attachments.id'], name=op.f('fk_message_files_attachment_id_attachments')),
        sa.ForeignKeyConstraint(['broadcast_id'], ['broadcasts.id'], name=op.f('fk_message_files_broadcast_id_broadcasts'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], name=op.f('fk_message_files_message_id_messages')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_message_files_school_id_schools')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_message_files')),
    )
    op.create_index(op.f('ix_message_files_school_id'), 'message_files', ['school_id'], unique=False)
    op.create_index('ix_message_files_broadcast', 'message_files', ['broadcast_id'], unique=False)
    op.create_index('ix_message_files_message', 'message_files', ['message_id'], unique=False)

    op.create_table('notifications',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=True),
        sa.Column('kind', sa.String(length=40), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('dedupe_key', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('push_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        _school(),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_notifications_school_id_schools')),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_notifications_student_id_students')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_notifications_user_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_notifications')),
    )
    op.create_index(op.f('ix_notifications_school_id'), 'notifications', ['school_id'], unique=False)
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'], unique=False)
    op.create_index('ix_notifications_user_unread', 'notifications', ['user_id'], unique=False,
                    postgresql_where=sa.text('read_at is null'))
    op.create_index('ix_notifications_dedupe', 'notifications', ['user_id', 'kind', 'dedupe_key'], unique=False,
                    postgresql_where=sa.text('dedupe_key is not null'))

    op.create_table('device_tokens',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('platform', sa.String(length=10), nullable=False),
        sa.Column('token', sa.String(length=1024), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        _school(), _ts('created_at'), _ts('updated_at'),
        sa.CheckConstraint("platform in ('ios', 'android')", name=op.f('ck_device_tokens_platform')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_device_tokens_school_id_schools')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_device_tokens_user_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_device_tokens')),
    )
    op.create_index(op.f('ix_device_tokens_school_id'), 'device_tokens', ['school_id'], unique=False)
    op.create_index(op.f('ix_device_tokens_user_id'), 'device_tokens', ['user_id'], unique=False)
    op.create_index('uq_device_tokens_token', 'device_tokens', ['token'], unique=True)

    op.create_table('notification_preferences',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('category', sa.String(length=30), nullable=False),
        sa.Column('push_enabled', sa.Boolean(), nullable=False),
        _school(),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_notification_preferences_school_id_schools')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_notification_preferences_user_id_users')),
        sa.PrimaryKeyConstraint('user_id', 'category', name=op.f('pk_notification_preferences')),
    )
    op.create_index(op.f('ix_notification_preferences_school_id'), 'notification_preferences', ['school_id'], unique=False)

    # Row level security (same block as 0001_foundation).
    same_school = (
        "school_id = nullif(current_setting('app.school_id', true), '')::uuid "
        "or current_setting('app.bypass_rls', true) = 'on'"
    )
    for t in TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy school_isolation on {t} using ({same_school}) with check ({same_school})")


def downgrade() -> None:
    for t in reversed(TABLES):
        op.drop_table(t)
