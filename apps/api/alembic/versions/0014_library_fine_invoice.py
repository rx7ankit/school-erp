"""library fine invoice

A library fine of a student becomes a one-line fee invoice: loans point at it, and the system fee head 'Library fine'
is flagged so it never lands in a fee structure.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-02 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | Sequence[str] | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("fee_heads", sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("library_loans", sa.Column("fine_invoice_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_library_loans_fine_invoice_id_fee_invoices"),
        "library_loans",
        "fee_invoices",
        ["fine_invoice_id"],
        ["id"],
    )
    op.create_index(op.f("ix_library_loans_fine_invoice_id"), "library_loans", ["fine_invoice_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_library_loans_fine_invoice_id"), table_name="library_loans")
    op.drop_constraint(op.f("fk_library_loans_fine_invoice_id_fee_invoices"), "library_loans", type_="foreignkey")
    op.drop_column("library_loans", "fine_invoice_id")
    op.drop_column("fee_heads", "is_system")
