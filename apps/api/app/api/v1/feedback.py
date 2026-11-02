"""Feedback on teachers: managers run requests, teachers see their own summary, parents rate anonymously."""

import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_parent, require_permission, require_staff
from app.core.clock import today_ist
from app.core.principal import Principal
from app.models.enums import AuditCategory, Permission
from app.models.results import FeedbackRequest
from app.schemas.results import FeedbackDetail, FeedbackIn, FeedbackRow, MyFeedbackRow, ParentFeedback, RatingIn
from app.services import feedback as svc
from app.services.audit import log_audit
from app.services.sheets import XLSX, build_xlsx

router = APIRouter(prefix="/feedback", tags=["feedback"])
parent_router = APIRouter(prefix="/parent/feedback", tags=["parent"])
manage = require_permission(Permission.academic.value)


@router.get("", response_model=list[FeedbackRow])
async def list_requests(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    rows = (await db.scalars(select(FeedbackRequest).order_by(FeedbackRequest.closes_on.desc()))).all()
    return await svc.request_rows(db, list(rows))


@router.post("", response_model=FeedbackRow, status_code=201)
async def create_request(
    body: FeedbackIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """One target per teacher, class and subject assigned to the chosen classes."""
    r = await svc.create_request(db, request_actor(p, request), body)
    return (await svc.request_rows(db, [r]))[0]


@router.get("/mine", response_model=list[MyFeedbackRow])
async def my_feedback(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    """A teacher's own summary: only requests shared with teachers and already closed. Comments have no names."""
    return await svc.mine(db, p.user_id)


@router.get("/{request_id}", response_model=FeedbackDetail)
async def get_request(request_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """Per teacher: average, 1 to 5 spread, response rate and anonymous comments."""
    return await svc.detail(db, await svc.get_request_or_404(db, request_id))


@router.post("/{request_id}/open", response_model=FeedbackRow)
async def open_request(
    request_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    r = await svc.get_request_or_404(db, request_id)
    await svc.open_request(db, request_actor(p, request), r)
    return (await svc.request_rows(db, [r]))[0]


@router.post("/{request_id}/close", response_model=FeedbackRow)
async def close_request(
    request_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    r = await svc.get_request_or_404(db, request_id)
    await svc.close_request(db, request_actor(p, request), r)
    return (await svc.request_rows(db, [r]))[0]


@router.get("/{request_id}/export")
async def export_request(
    request_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Excel summary per teacher plus the anonymous comments. Audited under exports."""
    r = await svc.get_request_or_404(db, request_id)
    d = await svc.detail(db, r)
    summary = [
        [t.teacher, t.class_name, t.subject or "Class teacher", t.responses, t.expected, t.response_rate, t.average]
        + [t.spread[str(i)] for i in range(1, 6)]
        for t in d.teachers
    ]
    comments = [[t.teacher, t.class_name, t.subject or "Class teacher", c] for t in d.teachers for c in t.comments]
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "feedback.exported",
        f"Exported teacher feedback {r.title} to Excel",
        entity_type="feedback_request",
        entity_id=r.id,
        entity_label=r.title,
        sensitive=True,
    )
    content = build_xlsx(
        [
            (
                "Summary",
                [
                    "Teacher",
                    "Class",
                    "Subject",
                    "Responses",
                    "Students",
                    "Response rate",
                    "Average",
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                ],
                summary,
            ),
            ("Comments", ["Teacher", "Class", "Subject", "Comment"], comments),
        ]
    )
    return Response(
        content,
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="teacher-feedback-{today_ist().isoformat()}.xlsx"'},
    )


# ---------------------------------------------------------------- parent
@parent_router.get("", response_model=list[ParentFeedback])
async def open_for_me(p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)):
    """Open requests for each of my children who is at school, with the teachers to rate and my earlier answers."""
    return await svc.parent_open(db, p.user_id)


@parent_router.put("/targets/{target_id}/children/{student_id}", status_code=204)
async def rate(
    target_id: uuid.UUID,
    student_id: uuid.UUID,
    body: RatingIn,
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """1 to 5 stars and an optional comment (500 characters) for one teacher of one of my children.
    Sending again changes my answer until the request closes."""
    await svc.submit(db, p.user_id, target_id, student_id, body)
    return Response(status_code=204)
