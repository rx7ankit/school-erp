"""Four permissions: academic, fees, library, people. Admins hold all four; staff.manage becomes people + academic.

Revision ID: 0018
Revises: 0017
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018"
down_revision: str | Sequence[str] | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ALL = ("academic.manage", "fees.manage", "library.manage", "people.manage")


def upgrade() -> None:
    # staff_permissions is row-level protected: this migration is the platform itself, so it opens the bypass.
    op.execute("select set_config('app.bypass_rls', 'on', true)")
    # the old list of allowed permissions has to go before a new value can be written
    op.execute("alter table staff_permissions drop constraint if exists ck_staff_permissions_permission")
    # Whoever held staff.manage now manages people, and keeps the staff attendance powers (they moved to academic).
    for new in ("people.manage", "academic.manage"):
        op.execute(
            f"""
            insert into staff_permissions (user_id, school_id, permission)
            select user_id, school_id, '{new}' from staff_permissions where permission = 'staff.manage'
            on conflict do nothing
            """
        )
    op.execute("delete from staff_permissions where permission = 'staff.manage'")
    # every admin holds all four
    values = ", ".join(f"('{p}')" for p in ALL)
    op.execute(
        f"""
        insert into staff_permissions (user_id, school_id, permission)
        select u.id, u.school_id, v.p
        from users u cross join (values {values}) as v(p)
        where u.is_admin and u.kind = 'staff' and u.school_id is not null
        on conflict do nothing
        """
    )
    op.execute(
        "alter table staff_permissions add constraint ck_staff_permissions_permission "
        "check (permission in ('fees.manage', 'library.manage', 'academic.manage', 'people.manage'))"
    )


def downgrade() -> None:
    pass
