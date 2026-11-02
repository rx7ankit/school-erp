"""What a signed-in parent sees. Every route here is limited to the parent's own children."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, require_parent
from app.core.principal import Principal
from app.models.student import Student
from app.schemas.auth import PreferencesIn, PreferencesOut
from app.schemas.students import ChildDetail, ChildOut
from app.services.guardians import get_language, set_language
from app.services.student_views import child_cards, child_detail

router = APIRouter(prefix="/parent", tags=["parent"])


@router.get("/preferences", response_model=PreferencesOut)
async def get_preferences(p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)):
    return PreferencesOut(language=await get_language(db, p.user_id))


@router.patch("/preferences", response_model=PreferencesOut)
async def update_preferences(
    body: PreferencesIn, p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    """The parent chooses English or Hindi. Notifications (inbox and push) and fee-reminder emails follow it."""
    return PreferencesOut(language=await set_language(db, p.user_id, body.language))


@router.get("/children", response_model=list[ChildOut])
async def children(p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)):
    """The child switcher: every child linked to this parent login, across siblings and guardians."""
    return await child_cards(db, p.user_id)


@router.get("/children/{student_id}", response_model=ChildDetail)
async def child(
    s: Student = Depends(parent_child), p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    return await child_detail(db, p.user_id, s)
