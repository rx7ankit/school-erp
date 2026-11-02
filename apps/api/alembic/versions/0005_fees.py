"""fees

Revision ID: 0005
Revises: 0003
Create Date: 2026-11-02 06:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FEE_TABLES = ['fee_counters', 'fee_heads', 'fee_late_rules', 'fee_settings', 'transport_routes', 'fee_concessions', 'fee_invoice_runs', 'fee_structures', 'fee_reminders', 'student_concessions', 'student_fee_options', 'fee_invoices', 'fee_carry_forwards', 'fee_invoice_items', 'fee_payments', 'opening_balances']


def upgrade() -> None:

    op.create_table('fee_counters',
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('last_seq', sa.BigInteger(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_counters_school_id_schools')),
    sa.PrimaryKeyConstraint('school_id', 'kind', name=op.f('pk_fee_counters'))
    )
    op.create_index(op.f('ix_fee_counters_school_id'), 'fee_counters', ['school_id'], unique=False)
    op.create_table('fee_heads',
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('scope', sa.String(length=10), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("scope in ('class', 'optional')", name=op.f('ck_fee_heads_scope')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_heads_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_heads')),
    sa.UniqueConstraint('school_id', 'name', name=op.f('uq_fee_heads_school_id'))
    )
    op.create_index(op.f('ix_fee_heads_school_id'), 'fee_heads', ['school_id'], unique=False)
    op.create_table('fee_late_rules',
    sa.Column('grace_days', sa.Integer(), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('per', sa.String(length=5), nullable=False),
    sa.Column('max_paise', sa.BigInteger(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("per in ('once', 'day')", name=op.f('ck_fee_late_rules_per')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_late_rules_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_late_rules'))
    )
    op.create_index(op.f('ix_fee_late_rules_school_id'), 'fee_late_rules', ['school_id'], unique=False)
    op.create_index('uq_fee_late_rules_one_active', 'fee_late_rules', ['school_id'], unique=True, postgresql_where=sa.text('is_active'))
    op.create_table('fee_settings',
    sa.Column('auto_first_invoice', sa.Boolean(), nullable=False),
    sa.Column('first_invoice_due_days', sa.Integer(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_settings_school_id_schools')),
    sa.PrimaryKeyConstraint('school_id', name=op.f('pk_fee_settings'))
    )
    op.create_index(op.f('ix_fee_settings_school_id'), 'fee_settings', ['school_id'], unique=False)
    op.create_table('transport_routes',
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('amount_paise >= 0', name=op.f('ck_transport_routes_amount')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_transport_routes_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_transport_routes')),
    sa.UniqueConstraint('school_id', 'name', name=op.f('uq_transport_routes_school_id'))
    )
    op.create_index(op.f('ix_transport_routes_school_id'), 'transport_routes', ['school_id'], unique=False)
    op.create_table('fee_concessions',
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('value', sa.BigInteger(), nullable=False),
    sa.Column('fee_head_id', sa.UUID(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind in ('percent', 'fixed')", name=op.f('ck_fee_concessions_kind')),
    sa.CheckConstraint('value > 0', name=op.f('ck_fee_concessions_value_positive')),
    sa.ForeignKeyConstraint(['fee_head_id'], ['fee_heads.id'], name=op.f('fk_fee_concessions_fee_head_id_fee_heads')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_concessions_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_concessions')),
    sa.UniqueConstraint('school_id', 'name', name=op.f('uq_fee_concessions_school_id'))
    )
    op.create_index(op.f('ix_fee_concessions_school_id'), 'fee_concessions', ['school_id'], unique=False)
    op.create_table('fee_invoice_runs',
    sa.Column('academic_year_id', sa.UUID(), nullable=False),
    sa.Column('period_label', sa.String(length=60), nullable=False),
    sa.Column('due_on', sa.Date(), nullable=False),
    sa.Column('frequencies', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('class_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('invoices_created', sa.Integer(), nullable=False),
    sa.Column('skipped_existing', sa.Integer(), nullable=False),
    sa.Column('skipped_no_fees', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], name=op.f('fk_fee_invoice_runs_academic_year_id_academic_years')),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_fee_invoice_runs_created_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_invoice_runs_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_invoice_runs'))
    )
    op.create_index(op.f('ix_fee_invoice_runs_school_id'), 'fee_invoice_runs', ['school_id'], unique=False)
    op.create_table('fee_structures',
    sa.Column('class_id', sa.UUID(), nullable=False),
    sa.Column('fee_head_id', sa.UUID(), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('frequency', sa.String(length=10), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("frequency in ('monthly', 'quarterly', 'term', 'yearly', 'once')", name=op.f('ck_fee_structures_frequency')),
    sa.CheckConstraint('amount_paise > 0', name=op.f('ck_fee_structures_amount_positive')),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_fee_structures_class_id_classes')),
    sa.ForeignKeyConstraint(['fee_head_id'], ['fee_heads.id'], name=op.f('fk_fee_structures_fee_head_id_fee_heads')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_structures_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_structures')),
    sa.UniqueConstraint('class_id', 'fee_head_id', name=op.f('uq_fee_structures_class_id'))
    )
    op.create_index(op.f('ix_fee_structures_class_id'), 'fee_structures', ['class_id'], unique=False)
    op.create_index(op.f('ix_fee_structures_school_id'), 'fee_structures', ['school_id'], unique=False)
    op.create_table('fee_reminders',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('balance_paise', sa.BigInteger(), nullable=False),
    sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('sent_by', sa.UUID(), nullable=False),
    sa.Column('emailed', sa.Integer(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_reminders_school_id_schools')),
    sa.ForeignKeyConstraint(['sent_by'], ['users.id'], name=op.f('fk_fee_reminders_sent_by_users')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_fee_reminders_student_id_students')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_reminders'))
    )
    op.create_index(op.f('ix_fee_reminders_school_id'), 'fee_reminders', ['school_id'], unique=False)
    op.create_index('ix_fee_reminders_student_sent', 'fee_reminders', ['student_id', 'sent_at'], unique=False)
    op.create_table('student_concessions',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('concession_id', sa.UUID(), nullable=False),
    sa.Column('academic_year_id', sa.UUID(), nullable=False),
    sa.Column('approved_by', sa.UUID(), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], name=op.f('fk_student_concessions_academic_year_id_academic_years')),
    sa.ForeignKeyConstraint(['approved_by'], ['users.id'], name=op.f('fk_student_concessions_approved_by_users')),
    sa.ForeignKeyConstraint(['concession_id'], ['fee_concessions.id'], name=op.f('fk_student_concessions_concession_id_fee_concessions')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_student_concessions_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_student_concessions_student_id_students')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_student_concessions')),
    sa.UniqueConstraint('student_id', 'concession_id', 'academic_year_id', name=op.f('uq_student_concessions_student_id'))
    )
    op.create_index(op.f('ix_student_concessions_school_id'), 'student_concessions', ['school_id'], unique=False)
    op.create_index(op.f('ix_student_concessions_student_id'), 'student_concessions', ['student_id'], unique=False)
    op.create_table('student_fee_options',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('academic_year_id', sa.UUID(), nullable=False),
    sa.Column('fee_head_id', sa.UUID(), nullable=False),
    sa.Column('route_id', sa.UUID(), nullable=True),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('frequency', sa.String(length=10), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("frequency in ('monthly', 'quarterly', 'term', 'yearly', 'once')", name=op.f('ck_student_fee_options_frequency')),
    sa.CheckConstraint('amount_paise > 0', name=op.f('ck_student_fee_options_amount_positive')),
    sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], name=op.f('fk_student_fee_options_academic_year_id_academic_years')),
    sa.ForeignKeyConstraint(['fee_head_id'], ['fee_heads.id'], name=op.f('fk_student_fee_options_fee_head_id_fee_heads')),
    sa.ForeignKeyConstraint(['route_id'], ['transport_routes.id'], name=op.f('fk_student_fee_options_route_id_transport_routes')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_student_fee_options_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_student_fee_options_student_id_students')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_student_fee_options')),
    sa.UniqueConstraint('student_id', 'academic_year_id', 'fee_head_id', name=op.f('uq_student_fee_options_student_id'))
    )
    op.create_index(op.f('ix_student_fee_options_school_id'), 'student_fee_options', ['school_id'], unique=False)
    op.create_index(op.f('ix_student_fee_options_student_id'), 'student_fee_options', ['student_id'], unique=False)
    op.create_table('fee_invoices',
    sa.Column('run_id', sa.UUID(), nullable=True),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('enrollment_id', sa.UUID(), nullable=False),
    sa.Column('academic_year_id', sa.UUID(), nullable=False),
    sa.Column('invoice_no', sa.String(length=30), nullable=False),
    sa.Column('period_label', sa.String(length=60), nullable=False),
    sa.Column('due_on', sa.Date(), nullable=False),
    sa.Column('late_rule_id', sa.UUID(), nullable=True),
    sa.Column('late_waived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('late_waived_by', sa.UUID(), nullable=True),
    sa.Column('late_waive_reason', sa.Text(), nullable=True),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('closed_into_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], name=op.f('fk_fee_invoices_academic_year_id_academic_years')),
    sa.ForeignKeyConstraint(['closed_into_id'], ['fee_invoices.id'], name=op.f('fk_fee_invoices_closed_into_id_fee_invoices')),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name=op.f('fk_fee_invoices_enrollment_id_enrollments')),
    sa.ForeignKeyConstraint(['late_rule_id'], ['fee_late_rules.id'], name=op.f('fk_fee_invoices_late_rule_id_fee_late_rules')),
    sa.ForeignKeyConstraint(['late_waived_by'], ['users.id'], name=op.f('fk_fee_invoices_late_waived_by_users')),
    sa.ForeignKeyConstraint(['run_id'], ['fee_invoice_runs.id'], name=op.f('fk_fee_invoices_run_id_fee_invoice_runs')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_invoices_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_fee_invoices_student_id_students')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_invoices')),
    sa.UniqueConstraint('school_id', 'invoice_no', name=op.f('uq_fee_invoices_school_id')),
    sa.UniqueConstraint('student_id', 'academic_year_id', 'period_label', name=op.f('uq_fee_invoices_student_id'))
    )
    op.create_index(op.f('ix_fee_invoices_enrollment_id'), 'fee_invoices', ['enrollment_id'], unique=False)
    op.create_index(op.f('ix_fee_invoices_school_id'), 'fee_invoices', ['school_id'], unique=False)
    op.create_index(op.f('ix_fee_invoices_student_id'), 'fee_invoices', ['student_id'], unique=False)
    op.create_index('ix_fee_invoices_year_due', 'fee_invoices', ['academic_year_id', 'due_on'], unique=False)
    op.create_table('fee_carry_forwards',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('from_invoice_id', sa.UUID(), nullable=False),
    sa.Column('to_invoice_id', sa.UUID(), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('written_off', sa.Boolean(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['from_invoice_id'], ['fee_invoices.id'], name=op.f('fk_fee_carry_forwards_from_invoice_id_fee_invoices')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_carry_forwards_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_fee_carry_forwards_student_id_students')),
    sa.ForeignKeyConstraint(['to_invoice_id'], ['fee_invoices.id'], name=op.f('fk_fee_carry_forwards_to_invoice_id_fee_invoices')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_carry_forwards'))
    )
    op.create_index(op.f('ix_fee_carry_forwards_school_id'), 'fee_carry_forwards', ['school_id'], unique=False)
    op.create_index(op.f('ix_fee_carry_forwards_student_id'), 'fee_carry_forwards', ['student_id'], unique=False)
    op.create_table('fee_invoice_items',
    sa.Column('invoice_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.String(length=15), nullable=False),
    sa.Column('fee_head_id', sa.UUID(), nullable=True),
    sa.Column('description', sa.String(length=200), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.CheckConstraint("kind in ('fee', 'concession', 'late_fee', 'previous_dues')", name=op.f('ck_fee_invoice_items_kind')),
    sa.ForeignKeyConstraint(['fee_head_id'], ['fee_heads.id'], name=op.f('fk_fee_invoice_items_fee_head_id_fee_heads')),
    sa.ForeignKeyConstraint(['invoice_id'], ['fee_invoices.id'], name=op.f('fk_fee_invoice_items_invoice_id_fee_invoices')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_invoice_items_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_invoice_items'))
    )
    op.create_index(op.f('ix_fee_invoice_items_invoice_id'), 'fee_invoice_items', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_fee_invoice_items_school_id'), 'fee_invoice_items', ['school_id'], unique=False)
    op.create_table('fee_payments',
    sa.Column('invoice_id', sa.UUID(), nullable=False),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('mode', sa.String(length=15), nullable=False),
    sa.Column('reference', sa.String(length=100), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('receipt_no', sa.String(length=30), nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('received_by', sa.UUID(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancelled_by', sa.UUID(), nullable=True),
    sa.Column('cancel_reason', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("mode in ('cash', 'cheque', 'upi', 'bank_transfer', 'online')", name=op.f('ck_fee_payments_mode')),
    sa.CheckConstraint("status = 'active' or (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)", name=op.f('ck_fee_payments_cancel_fields')),
    sa.CheckConstraint("status in ('active', 'cancelled')", name=op.f('ck_fee_payments_status')),
    sa.CheckConstraint('amount_paise > 0', name=op.f('ck_fee_payments_amount_positive')),
    sa.ForeignKeyConstraint(['cancelled_by'], ['users.id'], name=op.f('fk_fee_payments_cancelled_by_users')),
    sa.ForeignKeyConstraint(['invoice_id'], ['fee_invoices.id'], name=op.f('fk_fee_payments_invoice_id_fee_invoices')),
    sa.ForeignKeyConstraint(['received_by'], ['users.id'], name=op.f('fk_fee_payments_received_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_fee_payments_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_fee_payments_student_id_students')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fee_payments')),
    sa.UniqueConstraint('school_id', 'receipt_no', name=op.f('uq_fee_payments_school_id'))
    )
    op.create_index(op.f('ix_fee_payments_invoice_id'), 'fee_payments', ['invoice_id'], unique=False)
    op.create_index('ix_fee_payments_received', 'fee_payments', ['school_id', 'received_at'], unique=False)
    op.create_index(op.f('ix_fee_payments_school_id'), 'fee_payments', ['school_id'], unique=False)
    op.create_index(op.f('ix_fee_payments_student_id'), 'fee_payments', ['student_id'], unique=False)
    op.create_table('opening_balances',
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('academic_year_id', sa.UUID(), nullable=False),
    sa.Column('amount_paise', sa.BigInteger(), nullable=False),
    sa.Column('as_of_on', sa.Date(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('imported_by', sa.UUID(), nullable=False),
    sa.Column('used_invoice_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('amount_paise > 0', name=op.f('ck_opening_balances_amount_positive')),
    sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], name=op.f('fk_opening_balances_academic_year_id_academic_years')),
    sa.ForeignKeyConstraint(['imported_by'], ['users.id'], name=op.f('fk_opening_balances_imported_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_opening_balances_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_opening_balances_student_id_students')),
    sa.ForeignKeyConstraint(['used_invoice_id'], ['fee_invoices.id'], name=op.f('fk_opening_balances_used_invoice_id_fee_invoices')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_opening_balances')),
    sa.UniqueConstraint('student_id', 'academic_year_id', name=op.f('uq_opening_balances_student_id'))
    )
    op.create_index(op.f('ix_opening_balances_school_id'), 'opening_balances', ['school_id'], unique=False)
    op.create_index(op.f('ix_opening_balances_student_id'), 'opening_balances', ['student_id'], unique=False)
    
    same_school = (
        "school_id = nullif(current_setting('app.school_id', true), '')::uuid "
        "or current_setting('app.bypass_rls', true) = 'on'"
    )
    for t in FEE_TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy school_isolation on {t} using ({same_school}) with check ({same_school})")


def downgrade() -> None:
    for t in reversed(FEE_TABLES):
        op.execute(f"drop table if exists {t} cascade")
