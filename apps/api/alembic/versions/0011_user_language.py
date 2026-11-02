"""user_language

users.language ('en' or 'hi'): parents can choose Hindi; everyone else stays on English.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-02 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("language", sa.String(length=2), server_default="en", nullable=False))
    op.create_check_constraint(op.f("ck_users_language"), "users", "language in ('en', 'hi')")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_language"), "users", type_="check")
    op.drop_column("users", "language")
