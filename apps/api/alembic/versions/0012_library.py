"""library

Books, copies, loans, per-school settings and the accession counter.

Revision ID: 0012
Revises: 0010
Create Date: 2026-11-02 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("library_settings", "library_books", "library_copies", "library_counters", "library_loans")


def _base():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def _id():
    return sa.Column("id", sa.UUID(), nullable=False)


def _fk(t, col, target):
    ref = target.split(".")[0]
    return sa.ForeignKeyConstraint([col], [target], name=op.f(f"fk_{t}_{col}_{ref}"))


def upgrade() -> None:
    op.create_table(
        "library_settings",
        sa.Column("loan_days", sa.Integer(), nullable=False),
        sa.Column("fine_per_day_paise", sa.BigInteger(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        *_base(),
        sa.CheckConstraint("loan_days between 1 and 365", name=op.f("ck_library_settings_loan_days")),
        sa.CheckConstraint("fine_per_day_paise >= 0", name=op.f("ck_library_settings_fine")),
        _fk("library_settings", "school_id", "schools.id"),
        sa.PrimaryKeyConstraint("school_id", name=op.f("pk_library_settings")),
    )
    op.create_index(op.f("ix_library_settings_school_id"), "library_settings", ["school_id"])

    op.create_table(
        "library_books",
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("author", sa.String(length=200), nullable=False),
        sa.Column("isbn", sa.String(length=20), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        _id(),
        sa.Column("school_id", sa.UUID(), nullable=False),
        *_base(),
        _fk("library_books", "school_id", "schools.id"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_library_books")),
    )
    op.create_index(op.f("ix_library_books_school_id"), "library_books", ["school_id"])
    op.create_index(op.f("ix_library_books_title"), "library_books", ["title"])

    op.create_table(
        "library_copies",
        sa.Column("book_id", sa.UUID(), nullable=False),
        sa.Column("accession_no", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        _id(),
        sa.Column("school_id", sa.UUID(), nullable=False),
        *_base(),
        sa.CheckConstraint(
            "status in ('available', 'issued', 'lost', 'damaged')", name=op.f("ck_library_copies_status")
        ),
        _fk("library_copies", "book_id", "library_books.id"),
        _fk("library_copies", "school_id", "schools.id"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_library_copies")),
        sa.UniqueConstraint("school_id", "accession_no", name=op.f("uq_library_copies_school_id")),
    )
    op.create_index(op.f("ix_library_copies_school_id"), "library_copies", ["school_id"])
    op.create_index(op.f("ix_library_copies_book_id"), "library_copies", ["book_id"])

    op.create_table(
        "library_counters",
        sa.Column("last", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        _fk("library_counters", "school_id", "schools.id"),
        sa.PrimaryKeyConstraint("school_id", name=op.f("pk_library_counters")),
    )
    op.create_index(op.f("ix_library_counters_school_id"), "library_counters", ["school_id"])

    op.create_table(
        "library_loans",
        sa.Column("copy_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=True),
        sa.Column("staff_id", sa.UUID(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("outcome", sa.String(length=10), nullable=True),
        sa.Column("fine_paise", sa.BigInteger(), nullable=False),
        sa.Column("fine_waived_paise", sa.BigInteger(), nullable=False),
        sa.Column("waive_reason", sa.Text(), nullable=True),
        sa.Column("renewals", sa.Integer(), nullable=False),
        sa.Column("issued_by", sa.UUID(), nullable=False),
        sa.Column("returned_by", sa.UUID(), nullable=True),
        sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True),
        _id(),
        sa.Column("school_id", sa.UUID(), nullable=False),
        *_base(),
        sa.CheckConstraint("num_nonnulls(student_id, staff_id) = 1", name=op.f("ck_library_loans_borrower")),
        sa.CheckConstraint("outcome in ('returned', 'damaged', 'lost')", name=op.f("ck_library_loans_outcome")),
        sa.CheckConstraint("fine_paise >= 0 and fine_waived_paise >= 0", name=op.f("ck_library_loans_fine")),
        _fk("library_loans", "copy_id", "library_copies.id"),
        _fk("library_loans", "student_id", "students.id"),
        _fk("library_loans", "staff_id", "users.id"),
        _fk("library_loans", "issued_by", "users.id"),
        _fk("library_loans", "returned_by", "users.id"),
        _fk("library_loans", "school_id", "schools.id"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_library_loans")),
    )
    op.create_index(op.f("ix_library_loans_school_id"), "library_loans", ["school_id"])
    op.create_index(op.f("ix_library_loans_copy_id"), "library_loans", ["copy_id"])
    op.create_index(op.f("ix_library_loans_student_id"), "library_loans", ["student_id"])
    op.create_index(op.f("ix_library_loans_staff_id"), "library_loans", ["staff_id"])
    op.create_index(
        "uq_library_loans_open_copy",
        "library_loans",
        ["copy_id"],
        unique=True,
        postgresql_where=sa.text("returned_at is null"),
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
    for t in reversed(TABLES):
        op.drop_table(t)
