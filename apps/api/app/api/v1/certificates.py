import uuid

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, request_actor, require_parent, require_permission
from app.core.config import settings
from app.core.principal import Principal
from app.models.certificate import Certificate
from app.models.enums import CertificateKind, CertificateStatus, Permission
from app.models.student import Student
from app.schemas.certificates import (
    CancelIn,
    CertificateIn,
    CertificateOut,
    DocumentIn,
    DocumentOut,
    DocumentUrl,
    ParentCertificate,
    ReissueIn,
)
from app.schemas.common import Page
from app.services import certificates as svc
from app.services.students import get_student_or_404

router = APIRouter(tags=["certificates"])
manage = require_permission(Permission.academic.value)


# ------------------------------------------------------------------ student documents
@router.get("/students/{student_id}/documents", response_model=list[DocumentOut])
async def documents(
    student_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Only academic.manage and admin. Every view is audit logged."""
    s = await get_student_or_404(db, student_id)
    return await svc.list_documents(db, request_actor(p, request), s)


@router.post("/students/{student_id}/documents", response_model=DocumentOut, status_code=201)
async def add_document(
    student_id: uuid.UUID,
    body: DocumentIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Attach a confirmed upload (purpose `student_document`) to the record."""
    s = await get_student_or_404(db, student_id)
    return await svc.add_document(db, request_actor(p, request), s, body)


@router.get("/students/{student_id}/documents/{doc_id}/url", response_model=DocumentUrl)
async def document_url(
    student_id: uuid.UUID,
    doc_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await get_student_or_404(db, student_id)
    ttl = settings.download_url_ttl_seconds
    return DocumentUrl(url=await svc.document_url(db, request_actor(p, request), s, doc_id, ttl), expires_in=ttl)


@router.delete("/students/{student_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    student_id: uuid.UUID,
    doc_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await get_student_or_404(db, student_id)
    await svc.delete_document(db, request_actor(p, request), s, doc_id)
    return Response(status_code=204)


# ------------------------------------------------------------------ certificates
@router.get("/certificates", response_model=Page[CertificateOut])
async def list_certificates(
    student_id: uuid.UUID | None = None,
    kind: CertificateKind | None = None,
    status: CertificateStatus | None = None,
    q: str | None = Query(None, description="number, scholar no or student name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    items, total = await svc.list_certificates(
        db,
        student_id=student_id,
        kind=kind.value if kind else None,
        status=status.value if status else None,
        q=q,
        limit=limit,
        offset=offset,
    )
    return Page(items=items, total=total)


@router.post("/certificates", response_model=CertificateOut, status_code=201)
async def issue(
    body: CertificateIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Issue with the next number. A transfer certificate marks the student `tc_issued`; it needs a student who has
    left (or `left_on` for one who is leaving). Bonafide and character are for current students."""
    s = await get_student_or_404(db, body.student_id)
    cert = await svc.issue_from_body(db, request_actor(p, request), s, body)
    return await svc.certificate_out(db, cert)


@router.get("/certificates/{cert_id}", response_model=CertificateOut)
async def get_certificate(cert_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return await svc.certificate_out(db, await svc.get_certificate_or_404(db, cert_id))


@router.post("/certificates/{cert_id}/cancel", response_model=CertificateOut)
async def cancel(
    cert_id: uuid.UUID,
    body: CancelIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    cert = await svc.get_certificate_or_404(db, cert_id)
    return await svc.certificate_out(db, await svc.cancel_certificate(db, request_actor(p, request), cert, body.reason))


@router.post("/certificates/{cert_id}/reissue", response_model=CertificateOut, status_code=201)
async def reissue(
    cert_id: uuid.UUID,
    body: ReissueIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Cancels this certificate and issues a new one with a new number (for example after a correction)."""
    cert = await svc.get_certificate_or_404(db, cert_id)
    new = await svc.reissue_certificate(
        db,
        request_actor(p, request),
        cert,
        reason=body.reason,
        issued_on=body.issued_on,
        conduct=body.conduct,
        remarks=body.remarks,
        purpose=body.purpose,
    )
    return await svc.certificate_out(db, new)


# ------------------------------------------------------------------ parents
@router.get("/parent/children/{student_id}/certificates", response_model=list[ParentCertificate])
async def child_certificates(
    s: Student = Depends(parent_child), p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    """Issued (not cancelled) certificates of the parent's own child."""
    rows = (
        await db.scalars(
            select(Certificate)
            .where(Certificate.student_id == s.id, Certificate.status == CertificateStatus.issued.value)
            .order_by(Certificate.issued_on.desc(), Certificate.number.desc())
        )
    ).all()
    return rows
