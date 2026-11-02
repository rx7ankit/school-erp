"""timetable_certificates

Revision ID: 0008
Revises: 0003
Create Date: 2026-11-02 07:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = (
    "periods",
    "timetable_slots",
    "staff_absences",
    "substitutions",
    "student_documents",
    "certificates",
    "certificate_counters",
)


def _base():
    """id, school_id, created_at, updated_at (every table here has them except the counters)."""
    return [
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def _school_fk(t):
    return sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f(f"fk_{t}_school_id_schools"))


def _fk(t, col, target, **kw):
    ref = target.split(".")[0]
    return sa.ForeignKeyConstraint([col], [target], name=op.f(f"fk_{t}_{col}_{ref}"), **kw)


def upgrade() -> None:
    op.create_table(
        "periods",
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("starts_at", sa.Time(), nullable=False),
        sa.Column("ends_at", sa.Time(), nullable=False),
        *_base(),
        sa.CheckConstraint("number between 1 and 20", name=op.f("ck_periods_number")),
        sa.CheckConstraint("ends_at > starts_at", name=op.f("ck_periods_times")),
        _school_fk("periods"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_periods")),
        sa.UniqueConstraint("school_id", "number", name=op.f("uq_periods_school_id")),
    )
    op.create_index(op.f("ix_periods_school_id"), "periods", ["school_id"])

    op.create_table(
        "timetable_slots",
        sa.Column("class_id", sa.UUID(), nullable=False),
        sa.Column("academic_year_id", sa.UUID(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("period_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),
        sa.Column("staff_id", sa.UUID(), nullable=False),
        *_base(),
        sa.CheckConstraint("weekday between 1 and 6", name=op.f("ck_timetable_slots_weekday")),
        _fk("timetable_slots", "class_id", "classes.id"),
        _fk("timetable_slots", "academic_year_id", "academic_years.id"),
        _fk("timetable_slots", "period_id", "periods.id"),
        _fk("timetable_slots", "subject_id", "subjects.id"),
        _fk("timetable_slots", "staff_id", "users.id"),
        _school_fk("timetable_slots"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_timetable_slots")),
        sa.UniqueConstraint("class_id", "weekday", "period_id", name=op.f("uq_timetable_slots_class_id")),
        sa.UniqueConstraint(
            "staff_id", "academic_year_id", "weekday", "period_id", name=op.f("uq_timetable_slots_staff_id")
        ),
    )
    op.create_index(op.f("ix_timetable_slots_school_id"), "timetable_slots", ["school_id"])
    op.create_index(op.f("ix_timetable_slots_academic_year_id"), "timetable_slots", ["academic_year_id"])
    op.create_index(op.f("ix_timetable_slots_period_id"), "timetable_slots", ["period_id"])

    op.create_table(
        "staff_absences",
        sa.Column("staff_id", sa.UUID(), nullable=False),
        sa.Column("absent_on", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("marked_by", sa.UUID(), nullable=False),
        *_base(),
        _fk("staff_absences", "staff_id", "users.id"),
        _fk("staff_absences", "marked_by", "users.id"),
        _school_fk("staff_absences"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_staff_absences")),
        sa.UniqueConstraint("staff_id", "absent_on", name=op.f("uq_staff_absences_staff_id")),
    )
    op.create_index(op.f("ix_staff_absences_school_id"), "staff_absences", ["school_id"])
    op.create_index(op.f("ix_staff_absences_absent_on"), "staff_absences", ["absent_on"])

    op.create_table(
        "substitutions",
        sa.Column("covers_on", sa.Date(), nullable=False),
        sa.Column("slot_id", sa.UUID(), nullable=False),
        sa.Column("period_id", sa.UUID(), nullable=False),
        sa.Column("absent_staff_id", sa.UUID(), nullable=False),
        sa.Column("substitute_staff_id", sa.UUID(), nullable=False),
        sa.Column("assigned_by", sa.UUID(), nullable=False),
        *_base(),
        _fk("substitutions", "slot_id", "timetable_slots.id", ondelete="CASCADE"),
        _fk("substitutions", "period_id", "periods.id"),
        _fk("substitutions", "absent_staff_id", "users.id"),
        _fk("substitutions", "substitute_staff_id", "users.id"),
        _fk("substitutions", "assigned_by", "users.id"),
        _school_fk("substitutions"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_substitutions")),
        sa.UniqueConstraint("slot_id", "covers_on", name=op.f("uq_substitutions_slot_id")),
        sa.UniqueConstraint(
            "substitute_staff_id", "covers_on", "period_id", name=op.f("uq_substitutions_substitute_staff_id")
        ),
    )
    op.create_index(op.f("ix_substitutions_school_id"), "substitutions", ["school_id"])
    op.create_index("ix_substitutions_covers_on", "substitutions", ["school_id", "covers_on"])

    op.create_table(
        "student_documents",
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("attachment_id", sa.UUID(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("added_by", sa.UUID(), nullable=False),
        *_base(),
        sa.CheckConstraint(
            "kind in ('birth_certificate', 'previous_tc', 'id_proof', 'photo', 'other')",
            name=op.f("ck_student_documents_kind"),
        ),
        _fk("student_documents", "student_id", "students.id"),
        _fk("student_documents", "attachment_id", "attachments.id"),
        _fk("student_documents", "added_by", "users.id"),
        _school_fk("student_documents"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_student_documents")),
        sa.UniqueConstraint("attachment_id", name=op.f("uq_student_documents_attachment_id")),
    )
    op.create_index(op.f("ix_student_documents_school_id"), "student_documents", ["school_id"])
    op.create_index(op.f("ix_student_documents_student_id"), "student_documents", ["student_id"])

    op.create_table(
        "certificates",
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("number", sa.String(length=40), nullable=False),
        sa.Column("issued_on", sa.Date(), nullable=False),
        sa.Column("issued_by", sa.UUID(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by", sa.UUID(), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("replaces_id", sa.UUID(), nullable=True),
        *_base(),
        sa.CheckConstraint("kind in ('transfer', 'bonafide', 'character')", name=op.f("ck_certificates_kind")),
        sa.CheckConstraint("status in ('issued', 'cancelled')", name=op.f("ck_certificates_status")),
        _fk("certificates", "student_id", "students.id"),
        _fk("certificates", "issued_by", "users.id"),
        _fk("certificates", "cancelled_by", "users.id"),
        _fk("certificates", "replaces_id", "certificates.id"),
        _school_fk("certificates"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_certificates")),
        sa.UniqueConstraint("school_id", "number", name=op.f("uq_certificates_school_id")),
    )
    op.create_index(op.f("ix_certificates_school_id"), "certificates", ["school_id"])
    op.create_index(op.f("ix_certificates_student_id"), "certificates", ["student_id"])

    op.create_table(
        "certificate_counters",
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        _school_fk("certificate_counters"),
        sa.PrimaryKeyConstraint("school_id", "kind", "year", name=op.f("pk_certificate_counters")),
    )
    op.create_index(op.f("ix_certificate_counters_school_id"), "certificate_counters", ["school_id"])

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
