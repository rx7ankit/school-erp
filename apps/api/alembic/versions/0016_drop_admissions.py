"""Remove the admissions pipeline: a school adds a student directly.

Revision ID: 0016
Revises: 0015
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | Sequence[str] | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drops its row-level-security policy, indexes and constraints with it.
    op.execute("drop table if exists admissions")


def downgrade() -> None:
    pass
