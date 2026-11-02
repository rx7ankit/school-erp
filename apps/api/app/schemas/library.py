import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORM

CopyStatusIn = Literal["available", "lost", "damaged"]
LoanFilter = Literal["open", "overdue", "returned", "lost", "damaged", "all"]


class SettingsIn(BaseModel):
    loan_days: int = Field(ge=1, le=365)
    fine_per_day_paise: int = Field(ge=0, le=10_000_000)


class SettingsOut(SettingsIn):
    pass


class BookIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    author: str = Field("", max_length=200)
    isbn: str | None = Field(None, max_length=20)
    category: str | None = Field(None, max_length=100)
    copies: int = Field(0, ge=0, le=200, description="Create this many copies right away")

    @field_validator("title", "author", "isbn", "category", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class BookPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    author: str | None = Field(None, max_length=200)
    isbn: str | None = Field(None, max_length=20)
    category: str | None = Field(None, max_length=100)


class BookOut(ORM):
    id: uuid.UUID
    title: str
    author: str
    isbn: str | None
    category: str | None
    copies_total: int = 0
    available: int = 0
    issued: int = 0
    lost: int = 0
    damaged: int = 0


class CopyOut(ORM):
    id: uuid.UUID
    book_id: uuid.UUID
    accession_no: str
    status: str
    book_title: str | None = None
    current_loan_id: uuid.UUID | None = None


class BookDetail(BookOut):
    copies: list[CopyOut]


class CopiesIn(BaseModel):
    count: int = Field(1, ge=1, le=200)
    accession_no: str | None = Field(None, min_length=1, max_length=40, description="Only with count 1; else automatic")


class CopyStatusPatch(BaseModel):
    status: CopyStatusIn


class IssueIn(BaseModel):
    copy_id: uuid.UUID | None = None
    accession_no: str | None = Field(None, max_length=40)
    student_id: uuid.UUID | None = None
    staff_id: uuid.UUID | None = None
    due_on: date | None = Field(None, description="Default: today plus the school's loan days")


class ReturnIn(BaseModel):
    condition: Literal["good", "damaged", "lost"] = "good"
    fine_paise: int | None = Field(
        None, ge=0, le=100_000_000, description="Override the computed fine (e.g. a replacement charge)"
    )
    waive_fine: bool = False
    waive_reason: str | None = Field(None, max_length=300)


class LoanOut(BaseModel):
    id: uuid.UUID
    copy_id: uuid.UUID
    accession_no: str
    book_id: uuid.UUID
    title: str
    author: str
    borrower_type: Literal["student", "staff"]
    student_id: uuid.UUID | None
    student_name: str | None = None
    scholar_no: str | None = None
    staff_id: uuid.UUID | None
    staff_name: str | None = None
    issued_at: datetime
    due_on: date
    returned_at: datetime | None
    outcome: str | None
    status: str  # open | overdue | returned | damaged | lost
    overdue: bool
    days_overdue: int
    fine_paise: int  # final when closed, accrued so far while open
    fine_waived_paise: int
    waive_reason: str | None
    renewals: int
    # none: nothing to pay (open loan, no fine); unpaid | partial | paid: state of the fee invoice that collects the
    # fine; waived; closed: the invoice was carried forward or written off at year end; manual: not billed (a staff
    # borrower, or a student without an enrolment this year), collect it by hand
    fine_status: Literal["none", "unpaid", "partial", "paid", "waived", "closed", "manual"] = "none"
    fine_paid: bool = False
    fine_invoice_id: uuid.UUID | None = None
    fine_invoice_no: str | None = None
    fine_balance_paise: int = 0


class ParentLoan(BaseModel):
    id: uuid.UUID
    title: str
    author: str
    accession_no: str
    issued_at: datetime
    due_on: date
    overdue: bool
    days_overdue: int
    renewals: int
    fine_paise: int


class ParentFine(BaseModel):
    loan_id: uuid.UUID
    title: str
    returned_at: datetime
    fine_paise: int
    fine_status: str  # unpaid | partial | paid | closed
    fine_paid: bool
    invoice_id: uuid.UUID
    balance_paise: int


class ParentLibrary(BaseModel):
    student_id: uuid.UUID
    current: list[ParentLoan]
    overdue_count: int
    fines: list[ParentFine] = []  # fines on returned books, newest first (pay them like any fee invoice)


class BorrowerOut(BaseModel):
    kind: Literal["student", "staff"]
    id: uuid.UUID
    name: str
    detail: str  # scholar number for a student, designation for staff
