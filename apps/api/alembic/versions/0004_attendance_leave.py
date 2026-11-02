"""attendance_leave

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-02 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ["holidays", "attendance_days", "attendance_records", "staff_attendance", "leave_requests"]


def _base() -> list:
    return [
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
    ]


def _ts() -> list:
    return [
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    ]


def upgrade() -> None:
    op.create_table('holidays',
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('from_on', sa.Date(), nullable=False),
    sa.Column('to_on', sa.Date(), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    *_base(), *_ts(),
    sa.CheckConstraint("kind in ('holiday', 'exam', 'event')", name=op.f('ck_holidays_kind')),
    sa.CheckConstraint('from_on <= to_on', name=op.f('ck_holidays_dates')),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_holidays_created_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_holidays_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_holidays'))
    )
    op.create_index(op.f('ix_holidays_from_on'), 'holidays', ['from_on'], unique=False)
    op.create_index(op.f('ix_holidays_school_id'), 'holidays', ['school_id'], unique=False)

    op.create_table('attendance_days',
    sa.Column('class_id', sa.UUID(), nullable=False),
    sa.Column('day_on', sa.Date(), nullable=False),
    sa.Column('marked_by', sa.UUID(), nullable=False),
    sa.Column('marked_at', sa.DateTime(timezone=True), nullable=False),
    *_base(), *_ts(),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_attendance_days_class_id_classes')),
    sa.ForeignKeyConstraint(['marked_by'], ['users.id'], name=op.f('fk_attendance_days_marked_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_attendance_days_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_attendance_days')),
    sa.UniqueConstraint('class_id', 'day_on', name=op.f('uq_attendance_days_class_id'))
    )
    op.create_index(op.f('ix_attendance_days_class_id'), 'attendance_days', ['class_id'], unique=False)
    op.create_index(op.f('ix_attendance_days_day_on'), 'attendance_days', ['day_on'], unique=False)
    op.create_index(op.f('ix_attendance_days_school_id'), 'attendance_days', ['school_id'], unique=False)

    op.create_table('attendance_records',
    sa.Column('attendance_day_id', sa.UUID(), nullable=False),
    sa.Column('enrollment_id', sa.UUID(), nullable=False),
    sa.Column('first_half', sa.String(length=10), nullable=False),
    sa.Column('second_half', sa.String(length=10), nullable=False),
    sa.Column('late', sa.Boolean(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    *_base(),
    sa.CheckConstraint("first_half in ('present', 'absent', 'leave')", name=op.f('ck_attendance_records_first_half')),
    sa.CheckConstraint("second_half in ('present', 'absent', 'leave')", name=op.f('ck_attendance_records_second_half')),
    sa.ForeignKeyConstraint(['attendance_day_id'], ['attendance_days.id'], name=op.f('fk_attendance_records_attendance_day_id_attendance_days'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name=op.f('fk_attendance_records_enrollment_id_enrollments')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_attendance_records_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_attendance_records')),
    sa.UniqueConstraint('attendance_day_id', 'enrollment_id', name=op.f('uq_attendance_records_attendance_day_id'))
    )
    op.create_index('ix_attendance_records_enrollment', 'attendance_records', ['enrollment_id'], unique=False)
    op.create_index(op.f('ix_attendance_records_school_id'), 'attendance_records', ['school_id'], unique=False)

    op.create_table('staff_attendance',
    sa.Column('staff_id', sa.UUID(), nullable=False),
    sa.Column('day_on', sa.Date(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('marked_by', sa.UUID(), nullable=False),
    sa.Column('marked_at', sa.DateTime(timezone=True), nullable=False),
    *_base(), *_ts(),
    sa.CheckConstraint("status in ('present', 'absent', 'leave')", name=op.f('ck_staff_attendance_status')),
    sa.ForeignKeyConstraint(['marked_by'], ['users.id'], name=op.f('fk_staff_attendance_marked_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_staff_attendance_school_id_schools')),
    sa.ForeignKeyConstraint(['staff_id'], ['users.id'], name=op.f('fk_staff_attendance_staff_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_staff_attendance')),
    sa.UniqueConstraint('staff_id', 'day_on', name=op.f('uq_staff_attendance_staff_id'))
    )
    op.create_index(op.f('ix_staff_attendance_day_on'), 'staff_attendance', ['day_on'], unique=False)
    op.create_index(op.f('ix_staff_attendance_school_id'), 'staff_attendance', ['school_id'], unique=False)
    op.create_index(op.f('ix_staff_attendance_staff_id'), 'staff_attendance', ['staff_id'], unique=False)

    op.create_table('leave_requests',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('guardian_id', sa.UUID(), nullable=False),
    sa.Column('from_on', sa.Date(), nullable=False),
    sa.Column('to_on', sa.Date(), nullable=False),
    sa.Column('half', sa.String(length=10), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('attachment_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('decided_by', sa.UUID(), nullable=True),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('decision_note', sa.Text(), nullable=True),
    *_base(), *_ts(),
    sa.CheckConstraint("status in ('pending', 'approved', 'rejected', 'cancelled')", name=op.f('ck_leave_requests_status')),
    sa.CheckConstraint("half in ('none', 'first', 'second')", name=op.f('ck_leave_requests_half')),
    sa.CheckConstraint('from_on <= to_on', name=op.f('ck_leave_requests_dates')),
    sa.CheckConstraint("half = 'none' or from_on = to_on", name=op.f('ck_leave_requests_half_single_day')),
    sa.ForeignKeyConstraint(['attachment_id'], ['attachments.id'], name=op.f('fk_leave_requests_attachment_id_attachments')),
    sa.ForeignKeyConstraint(['decided_by'], ['users.id'], name=op.f('fk_leave_requests_decided_by_users')),
    sa.ForeignKeyConstraint(['guardian_id'], ['guardians.id'], name=op.f('fk_leave_requests_guardian_id_guardians')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_leave_requests_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_leave_requests_student_id_students')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_leave_requests'))
    )
    op.create_index('ix_leave_requests_student_dates', 'leave_requests', ['student_id', 'from_on', 'to_on'], unique=False)
    op.create_index(op.f('ix_leave_requests_school_id'), 'leave_requests', ['school_id'], unique=False)
    op.create_index(op.f('ix_leave_requests_status'), 'leave_requests', ['status'], unique=False)
    op.create_index(op.f('ix_leave_requests_student_id'), 'leave_requests', ['student_id'], unique=False)

    # Row level security for the new school tables (same block as 0001_foundation).
    same_school = (
        "school_id = nullif(current_setting('app.school_id', true), '')::uuid "
        "or current_setting('app.bypass_rls', true) = 'on'"
    )
    for t in TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy school_isolation on {t} using ({same_school}) with check ({same_school})")


def downgrade() -> None:
    for t in ["leave_requests", "staff_attendance", "attendance_records", "attendance_days", "holidays"]:
        op.drop_table(t)
