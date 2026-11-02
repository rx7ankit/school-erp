"""A school sees its own Krevo subscription: price, students, estimate and invoices. Read-only, admin only."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, require_admin
from app.core.principal import Principal
from app.schemas.billing import SchoolBilling
from app.services import billing as svc

router = APIRouter(prefix="/school", tags=["school"])


@router.get("/billing", response_model=SchoolBilling)
async def my_billing(p: Principal = Depends(require_admin), db: AsyncSession = Depends(db_session)):
    assert p.school_id
    return await svc.school_billing(db, p.school_id)
