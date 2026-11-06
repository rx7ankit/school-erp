"""A photo for each staff member and a logo for each school (both are files in the bucket).

Revision ID: 0017
Revises: 0016
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017"
down_revision: str | Sequence[str] | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("schools", sa.Column("logo_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attachments.id"), nullable=True))
    op.add_column(
        "staff_profiles", sa.Column("photo_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attachments.id"), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("staff_profiles", "photo_file_id")
    op.drop_column("schools", "logo_file_id")
