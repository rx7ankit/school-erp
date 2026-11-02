import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission
from app.core.clock import IST, today_ist
from app.core.principal import Principal
from app.models.enums import AuditCategory, Permission
from app.models.student import Admission
from app.schemas.common import Page
from app.schemas.students import (
    AdmissionEnrolIn,
    AdmissionIn,
    AdmissionOut,
    AdmissionPatch,
    AdmissionStatusIn,
    StudentDetail,
)
from app.services import admissions as svc
from app.services.audit import log_audit
from app.services.sheets import XLSX, build_xlsx
from app.services.student_views import student_detail

router = APIRouter(prefix="/admissions", tags=["admissions"])
manage = require_permission(Permission.academic.value)

StatusFilter = Literal["enquiry", "applied", "approved", "rejected", "enrolled"]


def _query(status: str | None, q: str | None):
    stmt = select(Admission).order_by(Admission.applied_at.desc(), Admission.id.desc())
    if status:
        stmt = stmt.where(Admission.status == status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Admission.applicant_name.ilike(like),
                Admission.guardian_name.ilike(like),
                Admission.guardian_phone.ilike(like),
            )
        )
    return stmt


@router.get("", response_model=Page[AdmissionOut])
async def list_admissions(
    status: StatusFilter | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    stmt = _query(status, q)
    total = await db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = (await db.scalars(stmt.limit(limit).offset(offset))).all()
    return Page(items=rows, total=total)


@router.post("", response_model=AdmissionOut, status_code=201)
async def create(
    body: AdmissionIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await svc.create_admission(db, request_actor(p, request), body)


@router.get("/export")
async def export(
    request: Request,
    status: StatusFilter | None = None,
    q: str | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    rows = (await db.scalars(_query(status, q))).all()
    headers = ["Applicant", "Date of Birth", "Grade Applied", "Guardian", "Mobile", "Email", "Status", "Applied (IST)"]
    body = [
        [
            a.applicant_name,
            a.dob,
            a.grade_applied,
            a.guardian_name,
            a.guardian_phone or "",
            a.guardian_email or "",
            a.status,
            a.applied_at.astimezone(IST).strftime("%Y-%m-%d %H:%M"),
        ]
        for a in rows
    ]
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "admissions.exported",
        f"Exported {len(rows)} admissions to Excel",
        entity_label="Admissions",
        sensitive=True,
    )
    return Response(
        build_xlsx([("Admissions", headers, body)]),
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="admissions-{today_ist().isoformat()}.xlsx"'},
    )


@router.get("/{admission_id}", response_model=AdmissionOut)
async def get(admission_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return await svc.get_admission_or_404(db, admission_id)


@router.patch("/{admission_id}", response_model=AdmissionOut)
async def edit(
    admission_id: uuid.UUID,
    body: AdmissionPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    a = await svc.get_admission_or_404(db, admission_id)
    await svc.edit_admission(db, request_actor(p, request), a, body.model_dump(exclude_unset=True))
    return a


@router.post("/{admission_id}/status", response_model=AdmissionOut)
async def set_status(
    admission_id: uuid.UUID,
    body: AdmissionStatusIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """enquiry, applied, approved or rejected. Enrolled is only reached through `enrol`."""
    a = await svc.get_admission_or_404(db, admission_id)
    await svc.set_status(db, request_actor(p, request), a, body.status, body.note)
    return a


@router.post("/{admission_id}/enrol", response_model=StudentDetail, status_code=201)
async def enrol(
    admission_id: uuid.UUID,
    request: Request,
    body: AdmissionEnrolIn | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """The one action: student, guardians, enrollment, admitted event and (optionally) the parent login, all in
    one transaction. The admission becomes `enrolled` and keeps the student id."""
    result = await svc.enrol_admission(db, request_actor(p, request), admission_id, body or AdmissionEnrolIn())
    return await student_detail(db, result.student)
