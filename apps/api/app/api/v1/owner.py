"""Platform owner (Krevo team): schools, billing and stats. Sees counts and money, never a school's student data."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_owner
from app.core.clock import utcnow
from app.core.errors import Conflict, NotFound
from app.core.principal import Principal
from app.models.enums import AuditCategory, SchoolStatus, StudentStatus
from app.models.school import School, SchoolSubscription
from app.models.student import Student
from app.models.user import CredentialInvite, User
from app.schemas.common import Page
from app.schemas.owner import OwnerStats, SchoolCreate, SchoolOut, SchoolPatch
from app.services.audit import change, log_audit
from app.services.billing import revenue_stats
from app.services.invites import send_login
from app.services.schools import create_school

router = APIRouter(prefix="/owner", tags=["owner"])


async def _school_out(db: AsyncSession, school: School) -> SchoolOut:
    sub = await db.scalar(select(SchoolSubscription).where(SchoolSubscription.school_id == school.id))
    students = (
        await db.scalar(
            select(func.count())
            .select_from(Student)
            .where(Student.school_id == school.id, Student.status == StudentStatus.active.value)
        )
        or 0
    )
    price = sub.price_per_student_paise if sub else 0
    admin = await db.scalar(
        select(User).where(User.school_id == school.id, User.is_admin.is_(True)).order_by(User.created_at)
    )
    invite = await db.scalar(select(CredentialInvite).where(CredentialInvite.user_id == admin.id)) if admin else None
    login_status = None
    if admin:
        login_status = "logged_in" if admin.last_login_at else (invite.status if invite else "pending")
    return SchoolOut(
        id=school.id,
        name=school.name,
        slug=school.slug,
        city=school.city,
        status=school.status,
        created_at=school.created_at,
        price_per_student_paise=price,
        active_students=students,
        monthly_paise=students * price if school.status == SchoolStatus.active.value else 0,
        admin_name=admin.name if admin else None,
        admin_email=admin.email if admin else None,
        admin_login_status=login_status,
        admin_last_login_at=admin.last_login_at if admin else None,
    )


@router.post("/schools", response_model=SchoolOut, status_code=201)
async def add_school(
    body: SchoolCreate, request: Request, p: Principal = Depends(require_owner), db: AsyncSession = Depends(db_session)
):
    school, _, _ = await create_school(
        db,
        request_actor(p, request),
        name=body.name,
        city=body.city,
        admin_name=body.admin_name,
        admin_email=str(body.admin_email),
        price_paise=body.price_per_student_paise,
    )
    await db.flush()
    return await _school_out(db, school)


@router.get("/schools", response_model=Page[SchoolOut])
async def list_schools(
    status: str | None = None, p: Principal = Depends(require_owner), db: AsyncSession = Depends(db_session)
):
    q = select(School).order_by(School.created_at.desc())
    if status:
        q = q.where(School.status == status)
    schools = (await db.scalars(q)).all()
    return Page(items=[await _school_out(db, s) for s in schools], total=len(schools))


async def _get(db: AsyncSession, school_id: uuid.UUID) -> School:
    s = await db.get(School, school_id)
    if not s:
        raise NotFound("School not found.")
    return s


@router.get("/schools/{school_id}", response_model=SchoolOut)
async def get_school(
    school_id: uuid.UUID, p: Principal = Depends(require_owner), db: AsyncSession = Depends(db_session)
):
    return await _school_out(db, await _get(db, school_id))


@router.patch("/schools/{school_id}", response_model=SchoolOut)
async def patch_school(
    school_id: uuid.UUID,
    body: SchoolPatch,
    request: Request,
    p: Principal = Depends(require_owner),
    db: AsyncSession = Depends(db_session),
):
    s = await _get(db, school_id)
    actor = request_actor(p, request)
    if body.status is not None and body.status != s.status:
        if body.status not in {SchoolStatus.active.value, SchoolStatus.suspended.value, SchoolStatus.trial.value}:
            raise Conflict("Unknown status.", code="bad_status")
        before, s.status = s.status, body.status
        verb = {"suspended": "Suspended", "active": "Activated", "trial": "Moved to trial"}[body.status]
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            f"school.{body.status}",
            f"{verb} school {s.name}",
            entity_type="school",
            entity_id=s.id,
            entity_label=s.name,
            school_id=s.id,
            sensitive=True,
            changes=[change("Status", before, body.status)],
        )
    if body.name is not None:
        s.name = body.name.strip()
    if body.city is not None:
        s.city = body.city.strip()
    if body.price_per_student_paise is not None:
        sub = await db.scalar(select(SchoolSubscription).where(SchoolSubscription.school_id == s.id))
        if sub and sub.price_per_student_paise != body.price_per_student_paise:
            log_audit(
                db,
                actor,
                AuditCategory.fees,
                "school.price_changed",
                f"Changed price for {s.name}",
                entity_type="school",
                entity_id=s.id,
                entity_label=s.name,
                school_id=s.id,
                sensitive=True,
                changes=[
                    change("Price per student (paise)", sub.price_per_student_paise, body.price_per_student_paise)
                ],
            )
            sub.price_per_student_paise = body.price_per_student_paise
    await db.flush()
    return await _school_out(db, s)


@router.post("/schools/{school_id}/resend-admin-login")
async def resend_admin_login(
    school_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(require_owner),
    db: AsyncSession = Depends(db_session),
):
    s = await _get(db, school_id)
    admin = await db.scalar(
        select(User).where(User.school_id == s.id, User.is_admin.is_(True)).order_by(User.created_at)
    )
    if not admin:
        raise NotFound("This school has no admin yet.")
    ok = await send_login(db, request_actor(p, request), admin, school_name=s.name)
    return {"sent": ok}


@router.get("/stats", response_model=OwnerStats)
async def stats(p: Principal = Depends(require_owner), db: AsyncSession = Depends(db_session)):
    by_status = dict((await db.execute(select(School.status, func.count()).group_by(School.status))).all())
    rows = (
        await db.execute(
            select(School.id, SchoolSubscription.price_per_student_paise, func.count(Student.id))
            .join(SchoolSubscription, SchoolSubscription.school_id == School.id)
            .outerjoin(Student, (Student.school_id == School.id) & (Student.status == StudentStatus.active.value))
            .where(School.status == SchoolStatus.active.value)
            .group_by(School.id, SchoolSubscription.price_per_student_paise)
        )
    ).all()
    mrr = sum(price * n for _, price, n in rows)
    students = sum(n for _, _, n in rows)
    now: datetime = utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_month = await db.scalar(select(func.count()).select_from(School).where(School.created_at >= month_start)) or 0
    money = await revenue_stats(db)
    return OwnerStats(
        collected_paise=money.collected_paise,
        due_paise=money.due_paise,
        overdue_paise=money.overdue_paise,
        schools=sum(by_status.values()),
        schools_active=by_status.get("active", 0),
        schools_trial=by_status.get("trial", 0),
        schools_suspended=by_status.get("suspended", 0),
        active_students=students,
        mrr_paise=mrr,
        arr_paise=mrr * 12,
        new_schools_this_month=new_month,
    )
