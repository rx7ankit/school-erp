"""Parent logins, for staff: who has one, create and send login emails, link parents from an email list."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission
from app.core.clock import today_ist
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.enums import AuditCategory, Permission
from app.models.student import Guardian
from app.schemas.common import Page
from app.schemas.students import (
    GuardianPatch,
    ParentListIn,
    ParentListOut,
    ParentRow,
    ParentSendIn,
    ParentSendOut,
)
from app.services import guardians as gsvc
from app.services import parent_logins as svc
from app.services.audit import log_audit
from app.services.sheets import MAX_BYTES, XLSX, build_xlsx

router = APIRouter(prefix="/parents", tags=["parents"])
manage = require_permission(Permission.academic.value)

LoginFilter = Literal["none", "pending", "sent", "failed", "active", "waiting"]


async def _guardian(db: AsyncSession, guardian_id: uuid.UUID) -> Guardian:
    g = await db.get(Guardian, guardian_id)
    if g is None:
        raise NotFound("Parent not found.")
    return g


async def _filtered(db: AsyncSession, q: str | None, login: LoginFilter | None) -> list[ParentRow]:
    gs = list((await db.scalars(svc.parents_query(q))).all())
    rows = await svc.parent_rows(db, gs)
    if login == "waiting":  # no login yet, or never signed in
        return [r for r in rows if r.login_status != "active"]
    if login:
        return [r for r in rows if r.login_status == login]
    return rows


@router.get("", response_model=Page[ParentRow])
async def list_parents(
    q: str | None = None,
    login: LoginFilter | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    rows = await _filtered(db, q, login)
    return Page(items=rows[offset : offset + limit], total=len(rows))


@router.get("/export")
async def export_parents(
    request: Request,
    q: str | None = None,
    login: LoginFilter | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    rows = await _filtered(db, q, login)
    headers = ["Parent", "Email", "Mobile", "Children", "Login", "Login Sent (UTC)", "Last Sign-in (UTC)"]
    body = [
        [
            r.name,
            r.email or "",
            r.phone or "",
            ", ".join(f"{c.name} ({c.class_label or '-'})" for c in r.children),
            r.login_status,
            r.login_sent_at.strftime("%Y-%m-%d %H:%M") if r.login_sent_at else "",
            r.last_login_at.strftime("%Y-%m-%d %H:%M") if r.last_login_at else "",
        ]
        for r in rows
    ]
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "parents.exported",
        f"Exported {len(rows)} parent logins to Excel",
        entity_label="Parents",
        sensitive=True,
    )
    return Response(
        build_xlsx([("Parents", headers, body)]),
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="parents-{today_ist().isoformat()}.xlsx"'},
    )


@router.post("/send-login", response_model=ParentSendOut)
async def send_many(
    body: ParentSendIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Creates missing logins and emails a fresh temporary password. Without `guardian_ids`: everyone still waiting
    (no login yet, or a login that was never used)."""
    if body.guardian_ids:
        gs = list((await db.scalars(select(Guardian).where(Guardian.id.in_(body.guardian_ids)))).all())
    else:
        gs = await svc.pending_guardians(db)
    return ParentSendOut(**await svc.send_logins(db, request_actor(p, request), gs))


@router.post("/create-logins", response_model=ParentSendOut)
async def create_logins(
    body: ParentSendIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Creates the parent accounts without emailing anyone. Send the emails later with `send-login`."""
    if body.guardian_ids:
        gs = list((await db.scalars(select(Guardian).where(Guardian.id.in_(body.guardian_ids)))).all())
    else:
        gs = await svc.pending_guardians(db)
    return ParentSendOut(**await svc.send_logins(db, request_actor(p, request), gs, create_only=True))


@router.post("/list-import", response_model=ParentListOut)
async def list_import(
    body: ParentListIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Pasted list `scholar no, guardian name, email, mobile`. Grouped by email: one email, one login, many children.
    `dry_run` (the default) only reports. Real runs create the logins and, with `send_login`, email them."""
    return await svc.link_parent_list(db, request_actor(p, request), body)


@router.post("/list-import/file", response_model=ParentListOut)
async def list_import_file(
    request: Request,
    file: UploadFile = File(...),
    dry_run: bool = True,
    send_login: bool = False,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    data = await file.read(MAX_BYTES + 1)
    return await svc.link_parent_file(
        db,
        request_actor(p, request),
        data=data,
        filename=file.filename or "parents.xlsx",
        dry_run=dry_run,
        send_login=send_login,
    )


@router.post("/{guardian_id}/send-login", response_model=ParentSendOut)
async def send_one(
    guardian_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """One click: creates the login if needed and emails a fresh temporary password."""
    g = await _guardian(db, guardian_id)
    svc.require_email(g)
    return ParentSendOut(**await svc.send_logins(db, request_actor(p, request), [g]))


@router.patch("/{guardian_id}", response_model=ParentRow)
async def edit_parent(
    guardian_id: uuid.UUID,
    body: GuardianPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    g = await _guardian(db, guardian_id)
    await gsvc.edit_guardian(db, request_actor(p, request), g, body.model_dump(exclude_unset=True))
    return (await svc.parent_rows(db, [g]))[0]
