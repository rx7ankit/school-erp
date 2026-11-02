from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_ip, db_session_any, get_principal, request_actor
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.enums import UserKind
from app.models.school import School
from app.models.user import StaffProfile, User
from app.schemas.auth import (
    AssignmentOut,
    ChangePasswordIn,
    ChildBrief,
    ForgotIn,
    LoginIn,
    MeOut,
    RefreshIn,
    ResetIn,
    SchoolBrief,
    TokenOut,
)
from app.services import auth as svc
from app.services.student_views import child_cards

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens(t: svc.Tokens) -> TokenOut:
    return TokenOut(
        access_token=t.access_token,
        refresh_token=t.refresh_token,
        expires_in=t.expires_in,
        kind=t.kind,
        must_change_password=t.must_change_password,
    )


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, request: Request):
    t = await svc.login(
        str(body.email),
        body.password,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
        device=body.device,
    )
    return _tokens(t)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn, request: Request):
    return _tokens(
        await svc.refresh(body.refresh_token, ip=client_ip(request), device=request.headers.get("user-agent"))
    )


@router.post("/logout", status_code=204)
async def logout(p: Principal = Depends(get_principal)):
    await svc.logout(p.session_id)
    return Response(status_code=204)


@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordIn,
    request: Request,
    p: Principal = Depends(get_principal),
    db: AsyncSession = Depends(db_session_any),
):
    user = await db.get(User, p.user_id)
    if not user:
        raise NotFound("User not found.")
    await svc.change_password(
        db, request_actor(p, request), user, p.session_id, body.current_password, body.new_password
    )
    return Response(status_code=204)


@router.post("/forgot-password", status_code=202)
async def forgot_password(body: ForgotIn, request: Request):
    await svc.request_password_reset(str(body.email), client_ip(request))
    return {"message": "If that email is registered, a reset link is on its way."}


@router.post("/reset-password", status_code=204)
async def reset_password(body: ResetIn):
    await svc.reset_password(body.token, body.new_password)
    return Response(status_code=204)


@router.get("/me", response_model=MeOut)
async def me(p: Principal = Depends(get_principal), db: AsyncSession = Depends(db_session_any)):
    school = await db.get(School, p.school_id) if p.school_id else None
    profile = await db.get(StaffProfile, p.user_id) if p.is_staff else None
    kids = []
    if p.kind == UserKind.parent.value and not p.must_change_password:
        kids = [
            ChildBrief(student_id=c.student_id, name=c.name, class_label=c.class_label, read_only=c.read_only)
            for c in await child_cards(db, p.user_id)
        ]
    return MeOut(
        children=kids,
        designation=profile.designation if profile else "",
        id=p.user_id,
        name=p.name,
        email=p.email,
        kind=p.kind,
        is_admin=p.is_admin,
        must_change_password=p.must_change_password,
        permissions=sorted(p.permissions),
        assignments=[AssignmentOut(class_id=a.class_id, role=a.role, subject_id=a.subject_id) for a in p.assignments],
        school=SchoolBrief(id=school.id, name=school.name, status=school.status) if school else None,
    )
