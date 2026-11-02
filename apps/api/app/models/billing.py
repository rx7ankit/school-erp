"""Platform billing support (erd v3): the daily active-student count each monthly invoice is based on."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SchoolUsageDaily(Base):
    """A school's active student count on one day (IST). The monthly invoice uses the last day of the month."""

    __tablename__ = "school_usage_daily"
    __table_args__ = (PrimaryKeyConstraint("school_id", "day_on"),)

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"))
    day_on: Mapped[date] = mapped_column(Date)
    active_students: Mapped[int] = mapped_column(Integer)
