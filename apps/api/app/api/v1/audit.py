from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, require_admin
from app.core.clock import IST
from app.core.principal import Principal
from app.models.audit import AuditLog
from app.schemas.audit import AuditOut
from app.schemas.common import Page

router = APIRouter(prefix="/audit", tags=["audit"])


def _ist_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=IST)


@router.get("", response_model=Page[AuditOut])
async def audit_log(
    q: str | None = None,
    category: str | None = None,
    actor: str | None = None,
    action: str | None = None,
    sensitive: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_admin),
    db: AsyncSession = Depends(db_session),
):
    """Admin only. Dates are IST calendar days, so 'today' means the school's today."""
    where = []
    if q:
        like = f"%{q.strip()}%"
        where.append(
            or_(
                AuditLog.summary.ilike(like),
                AuditLog.actor_name.ilike(like),
                AuditLog.entity_label.ilike(like),
                AuditLog.action.ilike(like),
            )
        )
    if category:
        where.append(AuditLog.category == category)
    if actor:
        where.append(AuditLog.actor_name == actor)
    if action:
        where.append(AuditLog.action == action)
    if sensitive is not None:
        where.append(AuditLog.sensitive.is_(sensitive))
    if date_from:
        where.append(AuditLog.at >= _ist_start(date_from))
    if date_to:
        where.append(AuditLog.at < _ist_start(date_to + timedelta(days=1)))
    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*where)) or 0
    rows = (
        await db.scalars(
            select(AuditLog).where(*where).order_by(desc(AuditLog.at), desc(AuditLog.id)).limit(limit).offset(offset)
        )
    ).all()
    return Page(items=list(rows), total=total)


@router.get("/options")
async def options(p: Principal = Depends(require_admin), db: AsyncSession = Depends(db_session)):
    """What the filter dropdowns offer: people and actions that appear in this school's log."""
    actors = (await db.scalars(select(AuditLog.actor_name).distinct().order_by(AuditLog.actor_name))).all()
    actions = (await db.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action))).all()
    return {"actors": list(actors), "actions": list(actions)}
