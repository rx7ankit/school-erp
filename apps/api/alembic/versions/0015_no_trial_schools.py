"""Schools are simply active: move any school still on a trial to active.

Revision ID: 0015
Revises: 0014
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | Sequence[str] | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `schools` is row-level protected: this migration is the platform itself, so it opens the bypass for its transaction.
    op.execute("select set_config('app.bypass_rls', 'on', true)")
    op.execute("update schools set status = 'active' where status = 'trial'")


def downgrade() -> None:
    pass
