"""Academic year rules shared by every module: a completed year is an archive and cannot be written to."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.models.academic import AcademicYear, SchoolClass
from app.models.enums import YearStatus


async def assert_year_writable(db: AsyncSession, year: AcademicYear | uuid.UUID | None) -> AcademicYear:
    """Raises 409 `year_completed` for an archived year. Call it before writing marks, attendance, invoices..."""
    if isinstance(year, uuid.UUID):
        year = await db.get(AcademicYear, year)
    if year is None:
        raise NotFound("Academic year not found.")
    if year.status == YearStatus.completed.value:
        raise Conflict(
            f"{year.name} is completed and read-only. Last year's records can no longer be changed.",
            code="year_completed",
            details={"year_id": str(year.id)},
        )
    return year


async def assert_class_year_writable(db: AsyncSession, school_class: SchoolClass | uuid.UUID) -> AcademicYear:
    """Same check for the year a class belongs to (marks, attendance and timetable hang off a class)."""
    if isinstance(school_class, uuid.UUID):
        loaded = await db.get(SchoolClass, school_class)
        if loaded is None:
            raise NotFound("Class not found.")
        school_class = loaded
    return await assert_year_writable(db, school_class.academic_year_id)
