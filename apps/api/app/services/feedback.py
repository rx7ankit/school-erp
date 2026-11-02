"""Feedback on teachers (erd v4).

* A manager (academic.manage, admin) opens a request for some classes. One target per teacher, class and subject
  (the class teacher has no subject).
* Parents of those classes give each teacher of their child 1 to 5 stars and an optional comment, one answer per
  parent per child per teacher; it can be changed until the request closes.
* Anonymous: `guardian_id` only blocks duplicates and is never returned, answers are not audited (the audit log
  would name the parent), comments come back without names or dates in alphabetical order.
* Managers see averages, the 1 to 5 spread, the response rate and the comments. A teacher sees their own summary
  only when the request is shared with teachers and has closed (so a handful of early answers cannot be traced).
* A request closes by itself after `closes_on` (IST date) and can be closed early.
"""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.academic import ClassStaff, SchoolClass, Subject
from app.models.enums import AuditCategory, EnrollmentStatus, FeedbackStatus, StudentStatus
from app.models.results import FeedbackRequest, FeedbackResponse, FeedbackTarget
from app.models.student import Enrollment, Guardian, Student
from app.models.user import User
from app.schemas.results import (
    FeedbackDetail,
    FeedbackIn,
    FeedbackRow,
    MyFeedbackRow,
    ParentFeedback,
    ParentTarget,
    RatingIn,
    TargetSummary,
)
from app.services.audit import Actor, change, log_audit
from app.services.guardians import assert_parent_child, parent_child_ids
from app.services.students import class_label, full_name


def effective_status(r: FeedbackRequest, today: date | None = None) -> str:
    today = today or today_ist()
    if r.status == FeedbackStatus.open.value and today > r.closes_on:
        return FeedbackStatus.closed.value
    return r.status


def is_answerable(r: FeedbackRequest, today: date | None = None) -> bool:
    today = today or today_ist()
    return r.status == FeedbackStatus.open.value and r.opens_on <= today <= r.closes_on


async def get_request_or_404(db: AsyncSession, request_id: uuid.UUID) -> FeedbackRequest:
    r = await db.get(FeedbackRequest, request_id)
    if r is None:
        raise NotFound("Feedback request not found.")
    return r


async def _notify_feedback_requested(db: AsyncSession, r: FeedbackRequest, class_ids: list[uuid.UUID]) -> None:
    """NOTIFY: feedback requested. For every active student of `class_ids`, notify each parent login from
    `guardians.guardian_user_ids_of_student(db, student_id)` (type `feedback`): "Please rate your child's teachers:
    {r.title}, until {r.closes_on}". Does nothing until the notifications service is wired."""
    return None


async def create_request(db: AsyncSession, actor: Actor, body: FeedbackIn) -> FeedbackRequest:
    today = today_ist()
    opens = body.opens_on or today
    if body.closes_on < opens:
        raise AppError("The closing date cannot be before the opening date.", code="bad_dates", status=422)
    class_ids = list(dict.fromkeys(body.class_ids))
    found = set((await db.scalars(select(SchoolClass.id).where(SchoolClass.id.in_(class_ids)))).all())
    if found != set(class_ids):
        raise NotFound("Class not found.")
    staff = (
        await db.execute(
            select(ClassStaff.staff_id, ClassStaff.class_id, ClassStaff.subject_id)
            .join(User, User.id == ClassStaff.staff_id)
            .where(ClassStaff.class_id.in_(class_ids), User.is_active, User.deleted_at.is_(None))
        )
    ).all()
    if not staff:
        raise Conflict("These classes have no teachers assigned yet.", code="no_teachers")
    r = FeedbackRequest(
        school_id=actor.school_id,
        title=body.title.strip(),
        opens_on=opens,
        closes_on=body.closes_on,
        status=FeedbackStatus.open.value if body.open_now else FeedbackStatus.draft.value,
        share_with_teachers=body.share_with_teachers,
        created_by=actor.id,
    )
    db.add(r)
    await db.flush()
    for staff_id, class_id, subject_id in staff:
        db.add(
            FeedbackTarget(
                school_id=actor.school_id, request_id=r.id, staff_id=staff_id, class_id=class_id, subject_id=subject_id
            )
        )
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "feedback.created",
        f"Created teacher feedback request {r.title} ({len(staff)} teachers, {len(class_ids)} classes)",
        entity_type="feedback_request",
        entity_id=r.id,
        entity_label=r.title,
    )
    if body.open_now:
        await _notify_feedback_requested(db, r, class_ids)
    return r


async def open_request(db: AsyncSession, actor: Actor, r: FeedbackRequest) -> None:
    if r.status != FeedbackStatus.draft.value:
        raise Conflict("Only a draft can be opened.", code="not_draft")
    if r.closes_on < today_ist():
        raise AppError("The closing date has already passed. Create a new request.", code="bad_dates", status=422)
    r.status = FeedbackStatus.open.value
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "feedback.opened",
        f"Opened teacher feedback request {r.title}",
        entity_type="feedback_request",
        entity_id=r.id,
        entity_label=r.title,
        changes=[change("status", "draft", "open")],
    )
    class_ids = list(
        (await db.scalars(select(FeedbackTarget.class_id).where(FeedbackTarget.request_id == r.id).distinct())).all()
    )
    await _notify_feedback_requested(db, r, class_ids)


async def close_request(db: AsyncSession, actor: Actor, r: FeedbackRequest) -> None:
    if effective_status(r) == FeedbackStatus.closed.value:
        raise Conflict("This request is already closed.", code="already_closed")
    before = r.status
    r.status = FeedbackStatus.closed.value
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "feedback.closed",
        f"Closed teacher feedback request {r.title} early",
        entity_type="feedback_request",
        entity_id=r.id,
        entity_label=r.title,
        changes=[change("status", before, "closed")],
    )


# ------------------------------------------------------------------ summaries
def _summary(
    target: FeedbackTarget,
    teacher: str,
    class_name: str,
    subject: str | None,
    ratings: list[tuple[int, str | None]],
    expected: int,
) -> TargetSummary:
    spread = {str(i): 0 for i in range(1, 6)}
    for rating, _ in ratings:
        spread[str(rating)] += 1
    n = len(ratings)
    return TargetSummary(
        target_id=target.id,
        teacher=teacher,
        class_name=class_name,
        subject=subject,
        responses=n,
        average=round(sum(r for r, _ in ratings) / n, 2) if n else None,
        spread=spread,
        expected=expected,
        response_rate=round(min(n / expected, 1.0), 4) if expected else 0.0,
        comments=sorted((c for _, c in ratings if c), key=str.casefold),
    )


async def target_summaries(
    db: AsyncSession, request_id: uuid.UUID, staff_id: uuid.UUID | None = None
) -> list[TargetSummary]:
    q = (
        select(FeedbackTarget, User.name, SchoolClass, Subject.name)
        .join(User, User.id == FeedbackTarget.staff_id)
        .join(SchoolClass, SchoolClass.id == FeedbackTarget.class_id)
        .outerjoin(Subject, Subject.id == FeedbackTarget.subject_id)
        .where(FeedbackTarget.request_id == request_id)
        .order_by(User.name, SchoolClass.display_order, SchoolClass.grade, SchoolClass.section, Subject.name)
    )
    if staff_id is not None:
        q = q.where(FeedbackTarget.staff_id == staff_id)
    rows = (await db.execute(q)).all()
    ids = [t.id for t, *_ in rows]
    given: dict[uuid.UUID, list[tuple[int, str | None]]] = {i: [] for i in ids}
    if ids:  # guardian_id and student_id are deliberately not selected
        for tid, rating, comment in (
            await db.execute(
                select(FeedbackResponse.target_id, FeedbackResponse.rating, FeedbackResponse.comment).where(
                    FeedbackResponse.target_id.in_(ids)
                )
            )
        ).all():
            given[tid].append((rating, comment))
    class_ids = {t.class_id for t, *_ in rows}
    expected: dict[uuid.UUID, int] = {}
    if class_ids:
        expected = dict(
            (
                await db.execute(
                    select(Enrollment.class_id, func.count())
                    .where(Enrollment.class_id.in_(class_ids), Enrollment.status == EnrollmentStatus.active.value)
                    .group_by(Enrollment.class_id)
                )
            ).all()
        )
    return [
        _summary(t, teacher, class_label(c), subject, given[t.id], expected.get(c.id, 0))
        for t, teacher, c, subject in rows
    ]


async def request_rows(db: AsyncSession, requests: list[FeedbackRequest]) -> list[FeedbackRow]:
    out = []
    for r in requests:
        targets = await db.scalar(
            select(func.count()).select_from(FeedbackTarget).where(FeedbackTarget.request_id == r.id)
        )
        responses = await db.scalar(
            select(func.count())
            .select_from(FeedbackResponse)
            .join(FeedbackTarget, FeedbackTarget.id == FeedbackResponse.target_id)
            .where(FeedbackTarget.request_id == r.id)
        )
        out.append(
            FeedbackRow(
                id=r.id,
                title=r.title,
                status=effective_status(r),
                opens_on=r.opens_on,
                closes_on=r.closes_on,
                share_with_teachers=r.share_with_teachers,
                targets=targets or 0,
                responses=responses or 0,
            )
        )
    return out


async def detail(db: AsyncSession, r: FeedbackRequest) -> FeedbackDetail:
    row = (await request_rows(db, [r]))[0]
    teachers = await target_summaries(db, r.id)
    got = sum(t.responses for t in teachers)
    want = sum(t.expected for t in teachers)
    return FeedbackDetail(
        **row.model_dump(), response_rate=round(min(got / want, 1.0), 4) if want else 0.0, teachers=teachers
    )


async def mine(db: AsyncSession, user_id: uuid.UUID) -> list[MyFeedbackRow]:
    """A teacher's own summaries, from requests shared with teachers that have closed."""
    today = today_ist()
    reqs = (
        await db.scalars(
            select(FeedbackRequest)
            .where(
                FeedbackRequest.share_with_teachers,
                FeedbackRequest.status != FeedbackStatus.draft.value,
                FeedbackRequest.id.in_(select(FeedbackTarget.request_id).where(FeedbackTarget.staff_id == user_id)),
            )
            .order_by(FeedbackRequest.closes_on.desc())
        )
    ).all()
    out = []
    for r in reqs:
        if effective_status(r, today) != FeedbackStatus.closed.value:
            continue
        out.append(
            MyFeedbackRow(
                request_id=r.id,
                title=r.title,
                closes_on=r.closes_on,
                summaries=await target_summaries(db, r.id, user_id),
            )
        )
    return out


# ------------------------------------------------------------------ parents
async def parent_open(db: AsyncSession, user_id: uuid.UUID) -> list[ParentFeedback]:
    """Open requests for the parent's children who are at school now, with their own earlier answers."""
    today = today_ist()
    guardian_id = await db.scalar(select(Guardian.id).where(Guardian.user_id == user_id))
    if guardian_id is None:
        return []
    kids = (
        await db.execute(
            select(Student, Enrollment.class_id)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(
                Student.id.in_(await parent_child_ids(db, user_id)),
                Student.status == StudentStatus.active.value,
                Enrollment.status == EnrollmentStatus.active.value,
            )
            .order_by(Student.first_name)
        )
    ).all()
    out = []
    for stu, class_id in kids:
        reqs = (
            await db.scalars(
                select(FeedbackRequest)
                .where(
                    FeedbackRequest.status == FeedbackStatus.open.value,
                    FeedbackRequest.opens_on <= today,
                    FeedbackRequest.closes_on >= today,
                    FeedbackRequest.id.in_(
                        select(FeedbackTarget.request_id).where(FeedbackTarget.class_id == class_id)
                    ),
                )
                .order_by(FeedbackRequest.closes_on)
            )
        ).all()
        for r in reqs:
            rows = (
                await db.execute(
                    select(
                        FeedbackTarget.id, User.name, Subject.name, FeedbackResponse.rating, FeedbackResponse.comment
                    )
                    .join(User, User.id == FeedbackTarget.staff_id)
                    .outerjoin(Subject, Subject.id == FeedbackTarget.subject_id)
                    .outerjoin(
                        FeedbackResponse,
                        (FeedbackResponse.target_id == FeedbackTarget.id)
                        & (FeedbackResponse.guardian_id == guardian_id)
                        & (FeedbackResponse.student_id == stu.id),
                    )
                    .where(FeedbackTarget.request_id == r.id, FeedbackTarget.class_id == class_id)
                    .order_by(User.name, Subject.name)
                )
            ).all()
            out.append(
                ParentFeedback(
                    request_id=r.id,
                    title=r.title,
                    closes_on=r.closes_on,
                    student_id=stu.id,
                    student_name=full_name(stu),
                    targets=[
                        ParentTarget(target_id=t, teacher=n, subject=s, my_rating=rt, my_comment=c)
                        for t, n, s, rt, c in rows
                    ],
                )
            )
    return out


async def submit(
    db: AsyncSession, user_id: uuid.UUID, target_id: uuid.UUID, student_id: uuid.UUID, body: RatingIn
) -> None:
    """Give or change this parent's rating of one teacher for one child (an upsert; not audited, to stay anonymous)."""
    await assert_parent_child(db, user_id, student_id, writable=True)
    target = await db.get(FeedbackTarget, target_id)
    if target is None:
        raise NotFound("Teacher not found.")
    req = await db.get(FeedbackRequest, target.request_id)
    in_class = await db.scalar(
        select(Enrollment.id).where(
            Enrollment.student_id == student_id,
            Enrollment.class_id == target.class_id,
            Enrollment.status == EnrollmentStatus.active.value,
        )
    )
    if req is None or in_class is None or req.status == FeedbackStatus.draft.value:
        raise NotFound("Teacher not found.")
    if not is_answerable(req):
        raise Conflict("This feedback request is closed.", code="feedback_closed")
    guardian_id = await db.scalar(select(Guardian.id).where(Guardian.user_id == user_id))
    if guardian_id is None:
        raise NotFound("Teacher not found.")
    values = dict(
        school_id=target.school_id,
        target_id=target_id,
        guardian_id=guardian_id,
        student_id=student_id,
        rating=body.rating,
        comment=body.comment,
        submitted_at=utcnow(),
    )
    stmt = insert(FeedbackResponse).values(**values)
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=["target_id", "guardian_id", "student_id"],
            set_={
                "rating": stmt.excluded.rating,
                "comment": stmt.excluded.comment,
                "submitted_at": stmt.excluded.submitted_at,
            },
        )
    )
