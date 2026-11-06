"""Creating a school: the school, its price, its first academic year, and its admin with a login email."""

import re
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist
from app.core.config import settings
from app.core.errors import Conflict
from app.db.session import system_session
from app.models.academic import AcademicYear
from app.models.enums import ALL_PERMISSIONS, AuditCategory, SchoolStatus, UserKind, YearStatus
from app.models.school import School, SchoolSubscription
from app.models.user import StaffPermission, StaffProfile, User
from app.services.audit import Actor, log_audit
from app.services.invites import ensure_invite, send_login


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "school"


def year_for(today: date) -> tuple[str, date, date]:
    """The Indian school year runs April to March."""
    start = today.year if today.month >= 4 else today.year - 1
    return f"{start}-{str(start + 1)[-2:]}", date(start, 4, 1), date(start + 1, 3, 31)


async def email_taken(db: AsyncSession, email: str) -> bool:
    """One email, one login across the whole platform. Looks across schools, which the caller's own session cannot."""
    async with system_session() as any_school:
        return bool(
            await any_school.scalar(
                select(func.count()).select_from(User).where(func.lower(User.email) == email.strip().lower())
            )
        )


async def create_school(
    db: AsyncSession,
    actor: Actor,
    *,
    name: str,
    city: str,
    admin_name: str,
    admin_email: str,
    price_paise: int | None,
    status: str = SchoolStatus.trial.value,
) -> tuple[School, User, bool]:
    if await email_taken(db, admin_email):
        raise Conflict("That email already has a Krevo login.", code="email_taken")
    slug = base = slugify(name)
    n = 2
    while await db.scalar(select(func.count()).select_from(School).where(School.slug == slug)):
        slug, n = f"{base}-{n}", n + 1
    school = School(name=name.strip(), slug=slug, city=city.strip(), status=status, created_by=actor.id)
    db.add(school)
    await db.flush()
    today = today_ist()
    db.add(
        SchoolSubscription(
            school_id=school.id,
            started_on=today,
            status=status,
            price_per_student_paise=price_paise if price_paise is not None else settings.default_price_paise,
        )
    )
    y_name, y_start, y_end = year_for(today)
    db.add(
        AcademicYear(
            school_id=school.id, name=y_name, starts_on=y_start, ends_on=y_end, status=YearStatus.current.value
        )
    )
    admin = User(
        school_id=school.id,
        kind=UserKind.staff.value,
        name=admin_name.strip(),
        email=admin_email.strip().lower(),
        is_admin=True,
        must_change_password=True,
    )
    db.add(admin)
    await db.flush()
    db.add(
        StaffProfile(
            user_id=admin.id, school_id=school.id, employee_code="EMP001", designation="Principal", joined_on=today
        )
    )
    for perm in ALL_PERMISSIONS:  # the first person has all three: full access
        db.add(StaffPermission(school_id=school.id, user_id=admin.id, permission=perm))
    await ensure_invite(db, admin)
    sent = await send_login(db, actor, admin, school_name=school.name, audit=False)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "school.created",
        f"Created school {school.name} with admin {admin.name}",
        entity_type="school",
        entity_id=school.id,
        entity_label=school.name,
        school_id=school.id,
        sensitive=True,
    )
    return school, admin, sent
