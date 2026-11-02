"""Small helpers shared by the notification hooks of the other modules (recipients and wording)."""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import AcademicYear
from app.models.enums import EnrollmentStatus, StudentStatus, YearStatus
from app.models.student import Enrollment, Student


def short_date(d: date) -> str:
    return f"{d.day} {d:%b}"


async def active_students_of_classes(db: AsyncSession, class_ids: list[uuid.UUID]) -> list[Student]:
    """Students who are active now and in one of `class_ids` in the current academic year."""
    if not class_ids:
        return []
    rows = await db.scalars(
        select(Student)
        .join(Enrollment, Enrollment.student_id == Student.id)
        .join(AcademicYear, AcademicYear.id == Enrollment.academic_year_id)
        .where(
            Enrollment.class_id.in_(class_ids),
            Enrollment.status == EnrollmentStatus.active.value,
            AcademicYear.status == YearStatus.current.value,
            Student.status == StudentStatus.active.value,
        )
        .order_by(Student.first_name, Student.id)
    )
    return list(rows.all())
