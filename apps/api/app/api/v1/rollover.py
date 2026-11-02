"""Year-end rollover (docs/year-rollover.md). Needs `academic.manage` (admin passes); class teachers cannot run it."""

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission
from app.core.principal import Principal
from app.models.enums import Permission
from app.schemas.rollover import (
    ApplyIn,
    ApplyOut,
    BatchDetail,
    BatchOut,
    ChecklistItem,
    ClassPanel,
    DraftOut,
    Readiness,
    RolloverPlan,
    RolloverPreview,
    RolloverStatus,
)
from app.services import rollover as svc
from app.services import rollover_plan as plan_svc

router = APIRouter(prefix="/rollover", tags=["rollover"])
manage = require_permission(Permission.academic.value)


async def _plan(db: AsyncSession, given: RolloverPlan | None) -> RolloverPlan:
    return given if given is not None else (await plan_svc.get_draft(db))[0]


@router.get("/status", response_model=RolloverStatus)
async def rollover_status(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """For the banner on the dashboard and Classes page (`show_banner` from 45 days before the year end)."""
    return await plan_svc.status(db)


@router.get("/readiness", response_model=Readiness)
async def rollover_readiness(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """Step 0, a card and not a blocker."""
    return await plan_svc.readiness(db)


@router.get("/draft", response_model=DraftOut)
async def get_draft(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return await plan_svc.draft_out(db)


@router.put("/draft", response_model=DraftOut)
async def save_draft(body: RolloverPlan, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """Save draft and close. One shared draft per school; anyone with the Academic permission can resume it."""
    assert p.school_id
    return await plan_svc.save_draft(db, p.school_id, p.user_id, body)


@router.delete("/draft", status_code=204)
async def discard_draft(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    await plan_svc.delete_draft(db)


@router.get("/students", response_model=list[ClassPanel])
async def students_step(
    class_id: uuid.UUID | None = None, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Step 1: a panel per class, every student with the decision from the saved draft (default promote), and the
    hints (result %, attendance %, fee balance, below pass marks)."""
    return await svc.students_panels(db, (await plan_svc.get_draft(db))[0], class_id)


@router.post("/preview", response_model=RolloverPreview)
async def preview(
    body: RolloverPlan | None = None, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Dry run, writes nothing. Send a plan, or send nothing to preview the saved draft."""
    return plan_svc.to_preview(await plan_svc.build(db, await _plan(db, body)))


@router.post("/apply", response_model=ApplyOut)
async def apply(
    body: ApplyIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """The one irreversible moment: all or nothing. Needs `confirm: true` and the id of the year being closed."""
    return await svc.apply(
        db, request_actor(p, request), await _plan(db, body.plan), from_year_id=body.from_year_id, confirm=body.confirm
    )


@router.get("/checklist", response_model=list[ChecklistItem])
async def checklist(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """ "Here is what is left" for the new year. Live counts; an item disappears when it is done."""
    return await svc.checklist(db)


@router.get("/batches", response_model=list[BatchOut])
async def batches(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return await svc.list_batches(db)


@router.get("/batches/{batch_id}", response_model=BatchDetail)
async def batch(batch_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return await svc.batch_detail(db, batch_id)
