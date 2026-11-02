import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import CertificateKind, DocumentKind
from app.schemas.common import ORM


class DocumentIn(BaseModel):
    kind: DocumentKind
    attachment_id: uuid.UUID
    note: str | None = Field(None, max_length=500)


class DocumentOut(ORM):
    id: uuid.UUID
    student_id: uuid.UUID
    kind: str
    attachment_id: uuid.UUID
    filename: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    note: str | None
    created_at: datetime


class DocumentUrl(BaseModel):
    url: str
    expires_in: int


class CertificateIn(BaseModel):
    student_id: uuid.UUID
    kind: CertificateKind
    issued_on: date | None = None
    reason: str | None = Field(None, max_length=500)
    conduct: str | None = Field(
        None, max_length=200, description="Conduct line printed on a TC or character certificate"
    )
    remarks: str | None = Field(None, max_length=500)
    purpose: str | None = Field(None, max_length=200, description="Why a bonafide certificate is needed")
    left_on: date | None = Field(
        None, description="Transfer: the leaving date, needed when the student is still active"
    )


class ReissueIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    issued_on: date | None = None
    conduct: str | None = Field(None, max_length=200)
    remarks: str | None = Field(None, max_length=500)
    purpose: str | None = Field(None, max_length=200)


class CancelIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class CertificateOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    scholar_no: str
    kind: str
    number: str
    issued_on: date
    issued_by: uuid.UUID
    issued_by_name: str | None
    reason: str | None
    status: str
    cancelled_at: datetime | None
    cancel_reason: str | None
    replaces_id: uuid.UUID | None
    snapshot: dict


class ParentCertificate(ORM):
    id: uuid.UUID
    kind: str
    number: str
    issued_on: date
    snapshot: dict
