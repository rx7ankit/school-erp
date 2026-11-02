import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM

Mode = Literal["cash", "cheque", "upi", "bank_transfer", "online"]


class PlatformInvoiceOut(ORM):
    id: uuid.UUID
    school_id: uuid.UUID
    school_name: str
    month: str  # "2026-10"
    period_on: date
    active_students: int
    price_per_student_paise: int
    amount_paise: int
    due_on: date
    status: str  # due | paid
    overdue: bool
    paid_at: datetime | None
    payment_mode: str | None
    reference: str | None


class GenerateIn(BaseModel):
    month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")  # default: last month


class GenerateOut(BaseModel):
    month: str
    created: int
    skipped_existing: int
    skipped_trial: int
    skipped_empty: int
    amount_paise: int


class MarkPaidIn(BaseModel):
    payment_mode: Mode
    reference: str | None = Field(default=None, max_length=200)
    paid_on: date | None = None  # IST date the money arrived; default today

    @model_validator(mode="after")
    def _ref(self):
        if self.payment_mode != "cash" and not (self.reference or "").strip():
            raise ValueError("A reference (cheque no., UTR...) is needed for this payment mode.")
        return self


class MonthPoint(BaseModel):
    month: str
    billed_paise: int
    collected_paise: int


class CountPoint(BaseModel):
    month: str
    count: int


class RevenueStats(BaseModel):
    schools_paying: int
    active_students: int
    mrr_paise: int
    arr_paise: int
    billed_paise: int
    collected_paise: int
    due_paise: int
    overdue_paise: int
    by_month: list[MonthPoint]
    new_schools_by_month: list[CountPoint]


class SchoolBilling(BaseModel):
    """What a school sees about its own subscription. Read-only."""

    school_status: str  # trial | active | suspended
    price_per_student_paise: int
    active_students: int
    estimated_monthly_paise: int
    billed_now: bool  # false while on trial
    started_on: date
    outstanding_paise: int
    invoices: list["SchoolInvoiceOut"]


class SchoolInvoiceOut(ORM):
    id: uuid.UUID
    month: str
    active_students: int
    price_per_student_paise: int
    amount_paise: int
    due_on: date
    status: str
    overdue: bool
    paid_at: datetime | None


SchoolBilling.model_rebuild()
