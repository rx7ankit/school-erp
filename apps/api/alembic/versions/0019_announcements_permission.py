"""A fifth permission, announcements.manage. Everyone who held academic.manage keeps writing school-wide notices.

Revision ID: 0019
Revises: 0018
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0019"
down_revision: str | Sequence[str] | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # staff_permissions is row-level protected: this migration is the platform itself, so it opens the bypass.
    op.execute("select set_config('app.bypass_rls', 'on', true)")
    op.execute("alter table staff_permissions drop constraint if exists ck_staff_permissions_permission")
    # Writing school-wide notices used to need academic.manage, so those people keep it (and full access stays full).
    op.execute(
        """
        insert into staff_permissions (user_id, school_id, permission)
        select user_id, school_id, 'announcements.manage' from staff_permissions where permission = 'academic.manage'
        on conflict do nothing
        """
    )
    op.execute(
        "alter table staff_permissions add constraint ck_staff_permissions_permission "
        "check (permission in ('fees.manage', 'library.manage', 'academic.manage', 'announcements.manage', 'people.manage'))"
    )


def downgrade() -> None:
    pass
