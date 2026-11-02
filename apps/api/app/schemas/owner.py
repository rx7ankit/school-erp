import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORM


class SchoolCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    city: str = Field(default="", max_length=100)
    admin_name: str = Field(min_length=2, max_length=200)
    admin_email: EmailStr
    price_per_student_paise: int | None = Field(default=None, ge=0, le=100_000)


class SchoolPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    status: str | None = None
    price_per_student_paise: int | None = Field(default=None, ge=0, le=100_000)


class SchoolOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    city: str
    status: str
    created_at: datetime
    price_per_student_paise: int
    active_students: int
    monthly_paise: int
    admin_name: str | None
    admin_email: str | None
    admin_login_status: str | None
    admin_last_login_at: datetime | None


class OwnerStats(BaseModel):
    schools: int
    schools_active: int
    schools_trial: int
    schools_suspended: int
    active_students: int
    mrr_paise: int
    arr_paise: int
    new_schools_this_month: int
    collected_paise: int = 0  # platform invoices marked paid
    due_paise: int = 0  # invoiced and not yet paid
    overdue_paise: int = 0  # due and past the due date
