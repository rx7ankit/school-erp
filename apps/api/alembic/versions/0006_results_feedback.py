"""results_feedback

Revision ID: 0006
Revises: 0003
Create Date: 2026-11-02 06:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0006'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['grading_schemes', 'grade_bands', 'exams', 'exam_subjects', 'results', 'exam_publications', 'report_remarks', 'report_cards', 'exam_schedules', 'exam_papers', 'feedback_requests', 'feedback_targets', 'feedback_responses']


def upgrade() -> None:
    """Exams, marks, grading, report cards, exam date sheet, feedback on teachers."""
    op.create_table('grading_schemes',
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_grading_schemes_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_grading_schemes')),
    sa.UniqueConstraint('school_id', 'name', name=op.f('uq_grading_schemes_school_id'))
    )
    op.create_table('grade_bands',
    sa.Column('scheme_id', sa.UUID(), nullable=False),
    sa.Column('min_percent', sa.Integer(), nullable=False),
    sa.Column('grade', sa.String(length=10), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.CheckConstraint('min_percent between 0 and 100', name=op.f('ck_grade_bands_percent')),
    sa.ForeignKeyConstraint(['scheme_id'], ['grading_schemes.id'], name=op.f('fk_grade_bands_scheme_id_grading_schemes'), ondelete='cascade'),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_grade_bands_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_grade_bands')),
    sa.UniqueConstraint('scheme_id', 'min_percent', name=op.f('uq_grade_bands_scheme_id'))
    )
    op.create_table('exams',
    sa.Column('academic_year_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('starts_on', sa.Date(), nullable=True),
    sa.Column('ends_on', sa.Date(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], name=op.f('fk_exams_academic_year_id_academic_years')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_exams_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exams')),
    sa.UniqueConstraint('school_id', 'academic_year_id', 'name', name=op.f('uq_exams_school_id'))
    )
    op.create_table('exam_subjects',
    sa.Column('exam_id', sa.UUID(), nullable=False),
    sa.Column('class_id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=False),
    sa.Column('max_marks', sa.Integer(), nullable=False),
    sa.Column('pass_marks', sa.Integer(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.CheckConstraint('max_marks > 0', name=op.f('ck_exam_subjects_max_marks')),
    sa.CheckConstraint('pass_marks >= 0 and pass_marks <= max_marks', name=op.f('ck_exam_subjects_pass_marks')),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_exam_subjects_class_id_classes')),
    sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], name=op.f('fk_exam_subjects_exam_id_exams')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_exam_subjects_school_id_schools')),
    sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], name=op.f('fk_exam_subjects_subject_id_subjects')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exam_subjects')),
    sa.UniqueConstraint('exam_id', 'class_id', 'subject_id', name=op.f('uq_exam_subjects_exam_id'))
    )
    op.create_table('results',
    sa.Column('exam_subject_id', sa.UUID(), nullable=False),
    sa.Column('enrollment_id', sa.UUID(), nullable=False),
    sa.Column('marks_obtained', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('absent', sa.Boolean(), nullable=False),
    sa.Column('grade', sa.String(length=10), nullable=True),
    sa.Column('remarks', sa.Text(), nullable=True),
    sa.Column('entered_by', sa.UUID(), nullable=False),
    sa.Column('entered_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.CheckConstraint('marks_obtained >= 0', name=op.f('ck_results_marks')),
    sa.CheckConstraint('not (absent and marks_obtained is not null)', name=op.f('ck_results_absent_has_no_marks')),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name=op.f('fk_results_enrollment_id_enrollments')),
    sa.ForeignKeyConstraint(['entered_by'], ['users.id'], name=op.f('fk_results_entered_by_users')),
    sa.ForeignKeyConstraint(['exam_subject_id'], ['exam_subjects.id'], name=op.f('fk_results_exam_subject_id_exam_subjects')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_results_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_results')),
    sa.UniqueConstraint('exam_subject_id', 'enrollment_id', name=op.f('uq_results_exam_subject_id'))
    )
    op.create_table('exam_publications',
    sa.Column('exam_id', sa.UUID(), nullable=False),
    sa.Column('class_id', sa.UUID(), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('published_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_exam_publications_class_id_classes')),
    sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], name=op.f('fk_exam_publications_exam_id_exams')),
    sa.ForeignKeyConstraint(['published_by'], ['users.id'], name=op.f('fk_exam_publications_published_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_exam_publications_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exam_publications')),
    sa.UniqueConstraint('exam_id', 'class_id', name=op.f('uq_exam_publications_exam_id'))
    )
    op.create_table('report_remarks',
    sa.Column('exam_id', sa.UUID(), nullable=False),
    sa.Column('enrollment_id', sa.UUID(), nullable=False),
    sa.Column('remark', sa.Text(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name=op.f('fk_report_remarks_enrollment_id_enrollments')),
    sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], name=op.f('fk_report_remarks_exam_id_exams')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_report_remarks_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_report_remarks')),
    sa.UniqueConstraint('exam_id', 'enrollment_id', name=op.f('uq_report_remarks_exam_id'))
    )
    op.create_table('report_cards',
    sa.Column('enrollment_id', sa.UUID(), nullable=False),
    sa.Column('exam_id', sa.UUID(), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('published_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name=op.f('fk_report_cards_enrollment_id_enrollments')),
    sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], name=op.f('fk_report_cards_exam_id_exams')),
    sa.ForeignKeyConstraint(['published_by'], ['users.id'], name=op.f('fk_report_cards_published_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_report_cards_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_report_cards'))
    )
    op.create_table('exam_schedules',
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('exam_id', sa.UUID(), nullable=True),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_exam_schedules_created_by_users')),
    sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], name=op.f('fk_exam_schedules_exam_id_exams')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_exam_schedules_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exam_schedules'))
    )
    op.create_table('exam_papers',
    sa.Column('schedule_id', sa.UUID(), nullable=False),
    sa.Column('class_id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=False),
    sa.Column('paper_on', sa.Date(), nullable=False),
    sa.Column('starts_at', sa.Time(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_exam_papers_class_id_classes')),
    sa.ForeignKeyConstraint(['schedule_id'], ['exam_schedules.id'], name=op.f('fk_exam_papers_schedule_id_exam_schedules'), ondelete='cascade'),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_exam_papers_school_id_schools')),
    sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], name=op.f('fk_exam_papers_subject_id_subjects')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exam_papers')),
    sa.UniqueConstraint('schedule_id', 'class_id', 'subject_id', name=op.f('uq_exam_papers_schedule_id'))
    )
    op.create_table('feedback_requests',
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('opens_on', sa.Date(), nullable=False),
    sa.Column('closes_on', sa.Date(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('share_with_teachers', sa.Boolean(), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status in ('draft', 'open', 'closed')", name=op.f('ck_feedback_requests_status')),
    sa.CheckConstraint('closes_on >= opens_on', name=op.f('ck_feedback_requests_dates')),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_feedback_requests_created_by_users')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_feedback_requests_school_id_schools')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_feedback_requests'))
    )
    op.create_table('feedback_targets',
    sa.Column('request_id', sa.UUID(), nullable=False),
    sa.Column('staff_id', sa.UUID(), nullable=False),
    sa.Column('class_id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], name=op.f('fk_feedback_targets_class_id_classes')),
    sa.ForeignKeyConstraint(['request_id'], ['feedback_requests.id'], name=op.f('fk_feedback_targets_request_id_feedback_requests'), ondelete='cascade'),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_feedback_targets_school_id_schools')),
    sa.ForeignKeyConstraint(['staff_id'], ['users.id'], name=op.f('fk_feedback_targets_staff_id_users')),
    sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], name=op.f('fk_feedback_targets_subject_id_subjects')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_feedback_targets'))
    )
    op.create_table('feedback_responses',
    sa.Column('target_id', sa.UUID(), nullable=False),
    sa.Column('guardian_id', sa.UUID(), nullable=False),
    sa.Column('student_id', sa.UUID(), nullable=False),
    sa.Column('rating', sa.SmallInteger(), nullable=False),
    sa.Column('comment', sa.String(length=500), nullable=True),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.CheckConstraint('comment is null or char_length(comment) <= 500', name=op.f('ck_feedback_responses_comment_length')),
    sa.CheckConstraint('rating between 1 and 5', name=op.f('ck_feedback_responses_rating')),
    sa.ForeignKeyConstraint(['guardian_id'], ['guardians.id'], name=op.f('fk_feedback_responses_guardian_id_guardians')),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], name=op.f('fk_feedback_responses_school_id_schools')),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], name=op.f('fk_feedback_responses_student_id_students')),
    sa.ForeignKeyConstraint(['target_id'], ['feedback_targets.id'], name=op.f('fk_feedback_responses_target_id_feedback_targets'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_feedback_responses')),
    sa.UniqueConstraint('target_id', 'guardian_id', 'student_id', name=op.f('uq_feedback_responses_target_id'))
    )

    op.create_index(op.f('ix_grading_schemes_school_id'), 'grading_schemes', ['school_id'], unique=False)
    op.create_index('uq_grading_schemes_one_active', 'grading_schemes', ['school_id'], unique=True, postgresql_where=sa.text('is_active'))
    op.create_index(op.f('ix_grade_bands_scheme_id'), 'grade_bands', ['scheme_id'], unique=False)
    op.create_index(op.f('ix_grade_bands_school_id'), 'grade_bands', ['school_id'], unique=False)
    op.create_index(op.f('ix_exams_academic_year_id'), 'exams', ['academic_year_id'], unique=False)
    op.create_index(op.f('ix_exams_school_id'), 'exams', ['school_id'], unique=False)
    op.create_index(op.f('ix_exam_subjects_class_id'), 'exam_subjects', ['class_id'], unique=False)
    op.create_index(op.f('ix_exam_subjects_exam_id'), 'exam_subjects', ['exam_id'], unique=False)
    op.create_index(op.f('ix_exam_subjects_school_id'), 'exam_subjects', ['school_id'], unique=False)
    op.create_index(op.f('ix_results_enrollment_id'), 'results', ['enrollment_id'], unique=False)
    op.create_index(op.f('ix_results_exam_subject_id'), 'results', ['exam_subject_id'], unique=False)
    op.create_index(op.f('ix_results_school_id'), 'results', ['school_id'], unique=False)
    op.create_index(op.f('ix_exam_publications_exam_id'), 'exam_publications', ['exam_id'], unique=False)
    op.create_index(op.f('ix_exam_publications_school_id'), 'exam_publications', ['school_id'], unique=False)
    op.create_index(op.f('ix_report_remarks_enrollment_id'), 'report_remarks', ['enrollment_id'], unique=False)
    op.create_index(op.f('ix_report_remarks_school_id'), 'report_remarks', ['school_id'], unique=False)
    op.create_index(op.f('ix_report_cards_enrollment_id'), 'report_cards', ['enrollment_id'], unique=False)
    op.create_index(op.f('ix_report_cards_exam_id'), 'report_cards', ['exam_id'], unique=False)
    op.create_index(op.f('ix_report_cards_school_id'), 'report_cards', ['school_id'], unique=False)
    op.create_index(op.f('ix_exam_schedules_school_id'), 'exam_schedules', ['school_id'], unique=False)
    op.create_index(op.f('ix_exam_papers_class_id'), 'exam_papers', ['class_id'], unique=False)
    op.create_index(op.f('ix_exam_papers_schedule_id'), 'exam_papers', ['schedule_id'], unique=False)
    op.create_index(op.f('ix_exam_papers_school_id'), 'exam_papers', ['school_id'], unique=False)
    op.create_index(op.f('ix_feedback_requests_school_id'), 'feedback_requests', ['school_id'], unique=False)
    op.create_index(op.f('ix_feedback_targets_request_id'), 'feedback_targets', ['request_id'], unique=False)
    op.create_index(op.f('ix_feedback_targets_school_id'), 'feedback_targets', ['school_id'], unique=False)
    op.create_index(op.f('ix_feedback_targets_staff_id'), 'feedback_targets', ['staff_id'], unique=False)
    op.create_index('uq_feedback_targets_unique', 'feedback_targets', ['request_id', 'staff_id', 'class_id', sa.literal_column("coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)")], unique=True)
    op.create_index(op.f('ix_feedback_responses_school_id'), 'feedback_responses', ['school_id'], unique=False)
    op.create_index(op.f('ix_feedback_responses_target_id'), 'feedback_responses', ['target_id'], unique=False)

    # Row level security for the new school tables (same block as 0001_foundation).
    same_school = (
        "school_id = nullif(current_setting('app.school_id', true), '')::uuid "
        "or current_setting('app.bypass_rls', true) = 'on'"
    )
    for t in TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy school_isolation on {t} using ({same_school}) with check ({same_school})")


def downgrade() -> None:
    """Downgrade schema."""
    for t in reversed(TABLES):
        op.drop_table(t)
