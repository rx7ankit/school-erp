"""rollover_billing

Year-end rollover tables, daily usage for platform billing, one platform invoice per school and month,
and write-offs without a target invoice.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-02 09:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("rollover_drafts", "promotion_batches", "promotion_items", "school_usage_daily")


def _school_fk(t):
    return sa.ForeignKeyConstraint(["school_id"], ["schools.id"], name=op.f(f"fk_{t}_school_id_schools"))


def upgrade() -> None:
    op.create_table(
        "rollover_drafts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], name=op.f("fk_rollover_drafts_updated_by_users")),
        _school_fk("rollover_drafts"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rollover_drafts")),
        sa.UniqueConstraint("school_id", name=op.f("uq_rollover_drafts_school_id")),
    )

    op.create_table(
        "promotion_batches",
        sa.Column("from_year_id", sa.UUID(), nullable=False),
        sa.Column("to_year_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status in ('draft', 'applied')", name=op.f("ck_promotion_batches_status")),
        sa.ForeignKeyConstraint(
            ["from_year_id"], ["academic_years.id"], name=op.f("fk_promotion_batches_from_year_id_academic_years")
        ),
        sa.ForeignKeyConstraint(
            ["to_year_id"], ["academic_years.id"], name=op.f("fk_promotion_batches_to_year_id_academic_years")
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_promotion_batches_created_by_users")),
        _school_fk("promotion_batches"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_promotion_batches")),
    )
    op.create_index(op.f("ix_promotion_batches_school_id"), "promotion_batches", ["school_id"])
    op.create_index(
        "uq_promotion_batches_one_applied",
        "promotion_batches",
        ["school_id", "from_year_id"],
        unique=True,
        postgresql_where=sa.text("status = 'applied'"),
    )

    op.create_table(
        "promotion_items",
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("enrollment_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("decision", sa.String(length=12), nullable=False),
        sa.Column("from_class_id", sa.UUID(), nullable=False),
        sa.Column("to_class_id", sa.UUID(), nullable=True),
        sa.Column("new_enrollment_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.CheckConstraint(
            "decision in ('promote', 'repeat', 'leave', 'passed_out')", name=op.f("ck_promotion_items_decision")
        ),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["promotion_batches.id"],
            name=op.f("fk_promotion_items_batch_id_promotion_batches"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["enrollment_id"], ["enrollments.id"], name=op.f("fk_promotion_items_enrollment_id_enrollments")
        ),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], name=op.f("fk_promotion_items_student_id_students")),
        sa.ForeignKeyConstraint(
            ["from_class_id"], ["classes.id"], name=op.f("fk_promotion_items_from_class_id_classes")
        ),
        sa.ForeignKeyConstraint(["to_class_id"], ["classes.id"], name=op.f("fk_promotion_items_to_class_id_classes")),
        sa.ForeignKeyConstraint(
            ["new_enrollment_id"], ["enrollments.id"], name=op.f("fk_promotion_items_new_enrollment_id_enrollments")
        ),
        _school_fk("promotion_items"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_promotion_items")),
        sa.UniqueConstraint("batch_id", "enrollment_id", name=op.f("uq_promotion_items_batch_id")),
    )
    op.create_index(op.f("ix_promotion_items_batch_id"), "promotion_items", ["batch_id"])
    op.create_index(op.f("ix_promotion_items_student_id"), "promotion_items", ["student_id"])
    op.create_index(op.f("ix_promotion_items_school_id"), "promotion_items", ["school_id"])
    op.create_index(op.f("ix_rollover_drafts_school_id"), "rollover_drafts", ["school_id"])

    # write-offs have no target invoice
    op.alter_column("fee_carry_forwards", "to_invoice_id", existing_type=sa.UUID(), nullable=True)

    # platform billing
    op.create_table(
        "school_usage_daily",
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("day_on", sa.Date(), nullable=False),
        sa.Column("active_students", sa.Integer(), nullable=False),
        _school_fk("school_usage_daily"),
        sa.PrimaryKeyConstraint("school_id", "day_on", name=op.f("pk_school_usage_daily")),
    )
    op.create_unique_constraint(
        op.f("uq_platform_invoices_school_id"), "platform_invoices", ["school_id", "period_on"]
    )
    op.create_check_constraint(
        op.f("ck_platform_invoices_status"), "platform_invoices", "status in ('due', 'paid')"
    )

    same_school = (
        "school_id = nullif(current_setting('app.school_id', true), '')::uuid "
        "or current_setting('app.bypass_rls', true) = 'on'"
    )
    for t in TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy school_isolation on {t} using ({same_school}) with check ({same_school})")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_platform_invoices_status"), "platform_invoices", type_="check")
    op.drop_constraint(op.f("uq_platform_invoices_school_id"), "platform_invoices", type_="unique")
    for t in ("school_usage_daily", "promotion_items", "promotion_batches", "rollover_drafts"):
        op.drop_table(t)
