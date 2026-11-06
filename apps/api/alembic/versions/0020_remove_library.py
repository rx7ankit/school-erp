"""Remove the Library module: its tables, its fee-fine link, its permission and its notifications.

Revision ID: 0020
Revises: 0019

What this does to data (all of it is deleted, none of it is archived):
- every row of library_settings, library_books, library_copies, library_counters and library_loans, and the tables;
- every 'library.manage' row in staff_permissions; the CHECK constraint then allows only the four permissions
  academic.manage, fees.manage, announcements.manage and people.manage;
- every notification of kind 'library_due' (overdue book reminders). 'library_fine' invoices announced through the
  generic 'fee_invoice' kind are left alone;
- the column fee_heads.is_system, which existed only to protect the system fee head 'Library fine'.
Fee invoices that were raised for library fines, and their payments, are real money records and are KEPT. They stay
as ordinary invoices; the fee head called 'Library fine' stays too, now an ordinary head that a school may rename or
switch off like any other. Only the link from a loan to its invoice (library_loans.fine_invoice_id) goes, with the loan.

downgrade() raises: the dropped data cannot be recovered. Restore a backup taken before this migration instead.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | Sequence[str] | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# children before parents. Dropping a table drops its indexes, policies and constraints, including
# library_loans.fine_invoice_id and its foreign key to fee_invoices.
TABLES = ("library_loans", "library_copies", "library_counters", "library_books", "library_settings")


def upgrade() -> None:
    # staff_permissions and notifications are row-level protected: this migration is the platform itself.
    op.execute("select set_config('app.bypass_rls', 'on', true)")
    op.execute("alter table staff_permissions drop constraint if exists ck_staff_permissions_permission")
    op.execute("delete from staff_permissions where permission = 'library.manage'")
    op.execute(
        "alter table staff_permissions add constraint ck_staff_permissions_permission "
        "check (permission in ('fees.manage', 'academic.manage', 'announcements.manage', 'people.manage'))"
    )
    op.execute("delete from notifications where kind = 'library_due'")
    for t in TABLES:
        op.execute(f"drop table if exists {t} cascade")
    op.execute("alter table fee_heads drop column if exists is_system")


def downgrade() -> None:
    raise RuntimeError(
        "0020 removed the Library module and its data for good; it cannot be reversed. Restore a backup taken before it."
    )
