"""Fees: request and response shapes. All money is integer paise."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORM

Paise = Field(gt=0, le=10_000_000_000)  # up to 10 crore rupees
Frequency = Literal["monthly", "quarterly", "term", "yearly", "once"]
Mode = Literal["cash", "cheque", "upi", "bank_transfer", "online"]
ALL_FREQUENCIES: list[str] = ["monthly", "quarterly", "term", "yearly", "once"]


# ---------------------------------------------------------------- setup
class HeadIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    scope: Literal["class", "optional"] = "class"


class HeadPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None


class HeadOut(ORM):
    id: uuid.UUID
    name: str
    scope: str
    is_active: bool


class StructureIn(BaseModel):
    class_id: uuid.UUID
    fee_head_id: uuid.UUID
    amount_paise: int = Paise
    frequency: Frequency = "monthly"


class StructureCopyIn(BaseModel):
    from_class_id: uuid.UUID
    to_class_id: uuid.UUID


class StructureOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_label: str
    fee_head_id: uuid.UUID
    head_name: str
    amount_paise: int
    frequency: str


class RouteIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount_paise: int = Field(ge=0, le=10_000_000_000)


class RoutePatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    amount_paise: int | None = Field(None, ge=0, le=10_000_000_000)
    is_active: bool | None = None


class RouteOut(ORM):
    id: uuid.UUID
    name: str
    amount_paise: int
    is_active: bool


class OptionIn(BaseModel):
    fee_head_id: uuid.UUID
    route_id: uuid.UUID | None = None
    amount_paise: int | None = Field(None, gt=0, le=10_000_000_000)  # default: the route's price
    frequency: Frequency = "monthly"
    academic_year_id: uuid.UUID | None = None  # default: the current year
    note: str | None = Field(None, max_length=500)


class OptionOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    academic_year_id: uuid.UUID
    fee_head_id: uuid.UUID
    head_name: str
    route_id: uuid.UUID | None
    route_name: str | None
    amount_paise: int
    frequency: str
    note: str | None


class ConcessionIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    kind: Literal["percent", "fixed"]
    value: int = Field(gt=0, le=10_000_000_000)  # whole percent (1-100) or paise
    fee_head_id: uuid.UUID | None = None  # null = the whole invoice

    @field_validator("value")
    @classmethod
    def _v(cls, v, info):
        if info.data.get("kind") == "percent" and v > 100:
            raise ValueError("A percentage is between 1 and 100.")
        return v


class ConcessionPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None


class ConcessionOut(ORM):
    id: uuid.UUID
    name: str
    kind: str
    value: int
    fee_head_id: uuid.UUID | None
    is_active: bool


class StudentConcessionIn(BaseModel):
    concession_id: uuid.UUID
    academic_year_id: uuid.UUID | None = None
    note: str | None = Field(None, max_length=500)


class StudentConcessionOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    concession_id: uuid.UUID
    concession_name: str
    kind: str
    value: int
    academic_year_id: uuid.UUID
    approved_by: uuid.UUID | None
    approved_by_name: str | None
    note: str | None


class LateRuleIn(BaseModel):
    grace_days: int = Field(0, ge=0, le=365)
    amount_paise: int = Paise
    per: Literal["once", "day"] = "once"
    max_paise: int | None = Field(None, gt=0, le=10_000_000_000)


class LateRuleOut(ORM):
    id: uuid.UUID
    grace_days: int
    amount_paise: int
    per: str
    max_paise: int | None
    is_active: bool
    created_at: datetime


class LateApplyIn(BaseModel):
    as_of: date | None = None  # default today (IST)


class LateApplyOut(BaseModel):
    as_of: date
    updated: int
    total_late_paise: int


class WaiveIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class SettingsIn(BaseModel):
    auto_first_invoice: bool
    first_invoice_due_days: int = Field(15, ge=0, le=180)


class SettingsOut(ORM):
    auto_first_invoice: bool
    first_invoice_due_days: int


# ---------------------------------------------------------------- invoices
class RunIn(BaseModel):
    academic_year_id: uuid.UUID | None = None  # default: the current year
    period_label: str = Field(min_length=1, max_length=60)
    due_on: date
    frequencies: list[Frequency] = Field(default_factory=lambda: list(ALL_FREQUENCIES), min_length=1)
    class_ids: list[uuid.UUID] | None = None  # default: every class of the year
    carry_forward: bool = True


class RunOut(BaseModel):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    period_label: str
    due_on: date
    frequencies: list[str]
    invoices_created: int
    skipped_existing: int
    skipped_no_fees: int
    created_by: uuid.UUID
    created_by_name: str | None = None
    created_at: datetime


class ItemOut(BaseModel):
    id: uuid.UUID
    kind: str
    fee_head_id: uuid.UUID | None
    description: str
    amount_paise: int


class InvoiceRow(BaseModel):
    id: uuid.UUID
    invoice_no: str
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    class_label: str | None
    academic_year_id: uuid.UUID
    period_label: str
    due_on: date
    total_paise: int
    paid_paise: int
    balance_paise: int
    status: str  # unpaid | partial | paid | closed
    overdue: bool


class PaymentOut(BaseModel):
    id: uuid.UUID
    receipt_no: str
    invoice_id: uuid.UUID
    invoice_no: str
    student_id: uuid.UUID
    student_name: str
    amount_paise: int
    mode: str
    reference: str | None
    note: str | None
    received_at: datetime
    received_by: uuid.UUID
    received_by_name: str | None
    status: str
    cancelled_at: datetime | None = None
    cancelled_by_name: str | None = None
    cancel_reason: str | None = None


class InvoiceDetail(InvoiceRow):
    items: list[ItemOut]
    payments: list[PaymentOut]
    late_waived: bool
    late_waive_reason: str | None
    closed_into_invoice_no: str | None = None


class PaymentIn(BaseModel):
    amount_paise: int = Paise
    mode: Mode
    reference: str | None = Field(None, max_length=100)
    note: str | None = Field(None, max_length=500)


class CancelIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


# ---------------------------------------------------------------- student view
class OpeningBalanceIn(BaseModel):
    student_id: uuid.UUID
    academic_year_id: uuid.UUID | None = None
    amount_paise: int = Paise
    as_of_on: date
    note: str | None = Field(None, max_length=500)


class OpeningBalanceOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    academic_year_id: uuid.UUID
    amount_paise: int
    as_of_on: date
    note: str | None
    locked: bool  # already on an invoice
    used_invoice_id: uuid.UUID | None


class StudentFees(BaseModel):
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    status: str
    total_paise: int
    paid_paise: int
    balance_paise: int
    opening_balance_paise: int  # not yet on an invoice
    due_paise: int  # balance + opening balance
    overdue_paise: int
    invoices: list[InvoiceRow]


# ---------------------------------------------------------------- reports
class DueRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    class_label: str | None
    status: str
    guardian_name: str | None
    guardian_phone: str | None
    invoices_open: int
    oldest_due_on: date | None
    balance_paise: int
    overdue_paise: int
    opening_balance_paise: int
    due_paise: int


class DuesReport(BaseModel):
    as_of: date
    total_due_paise: int
    total_overdue_paise: int
    students: int
    items: list[DueRow]
    total: int


class CollectionRow(BaseModel):
    key: str
    label: str
    count: int
    amount_paise: int


class CollectionReport(BaseModel):
    date_from: date
    date_to: date
    group_by: str
    total_paise: int
    payments: int
    cancelled_paise: int
    cancelled_count: int
    rows: list[CollectionRow]


class ReminderRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    class_label: str | None
    guardian_name: str | None
    guardian_email: str | None
    balance_paise: int
    earliest_due_on: date | None
    overdue: bool
    last_reminded_at: datetime | None
    can_remind: bool
    message: str


class ReminderSendIn(BaseModel):
    student_ids: list[uuid.UUID] | None = None  # null = everyone who can be reminded
    overdue_only: bool = False
    email: bool = False  # also email guardians that have an address


class ReminderSendOut(BaseModel):
    reminded: int
    skipped_recent: int
    emailed: int
    student_ids: list[uuid.UUID]


class OpeningImportRowOut(BaseModel):
    row_no: int
    ok: bool
    error: str | None
    data: dict


class OpeningImportOut(BaseModel):
    id: uuid.UUID
    file_name: str
    status: str
    total_rows: int
    ok_rows: int
    error_rows: int
    imported_at: datetime | None
    rows: list[OpeningImportRowOut]


class OpeningCommitIn(BaseModel):
    skip_errors: bool = False


class OpeningCommitOut(BaseModel):
    job_id: uuid.UUID
    imported: int
    skipped: int


# ---------------------------------------------------------------- parent
class ParentChildFees(BaseModel):
    student_id: uuid.UUID
    student_name: str
    read_only: bool
    balance_paise: int
    opening_balance_paise: int
    due_paise: int
    overdue_paise: int
    next_due_on: date | None


class Receipt(BaseModel):
    id: uuid.UUID
    receipt_no: str
    invoice_id: uuid.UUID
    invoice_no: str
    period_label: str
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    class_label: str | None
    amount_paise: int
    mode: str
    reference: str | None
    received_at: datetime
    received_by_name: str | None
    status: str
    status_label: str  # "Paid" or "Cancelled by school"
    status_label_hi: str = ""  # the same in Hindi, for parents whose language is hi
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None  # staff only, never sent to parents
    school_name: str
