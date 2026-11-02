"""Leave applications (erd v5/v6). A parent applies for one child; the class teacher (or admin) decides.

Approved leave pre-selects "leave" on the attendance sheet (see `attendance.approved_leave_on`) and, if the days
were already marked, turns a matching `absent` into `leave`. Leave counts as not present in statistics.
"""

import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.config import settings
from app.core.errors import AppError, Conflict, NotFound
from app.core.ids import uuid7
from app.core.principal import Principal
from app.models.academic import AcademicYear, SchoolClass
from app.models.attendance import AttendanceDay, AttendanceRecord, LeaveRequest
from app.models.enums import AuditCategory, ClassRole, EnrollmentStatus, LeaveHalf, LeaveStatus, YearStatus
from app.models.file import Attachment
from app.models.student import Enrollment, Guardian, Student
from app.models.user import User
from app.schemas.file import DownloadOut, UploadOut
from app.schemas.leave import AttachmentUploadIn, LeaveIn, LeaveOut
from app.services.attendance import ABSENT, LEAVE
from app.services.audit import Actor, change, log_audit
from app.services.guardians import assert_parent_child
from app.services.notifications import notify_guardians_of_student
from app.services.notify_helpers import short_date
from app.services.storage import PURPOSES, get_storage, make_key
from app.services.students import class_label, class_of_student, full_name

MAX_LEAVE_DAYS = 60
BACKDATE_DAYS = 7
PURPOSE = "leave_attachment"


# ------------------------------------------------------------------ notification hooks
async def _notify_leave_decided(db: AsyncSession, lr: LeaveRequest, student: Student) -> None:
    """Tell the child's parent logins (guardians.guardian_user_ids_of_student) that the leave was
    approved or rejected (`lr.status`, `lr.decision_note`)."""
    approved = lr.status == LeaveStatus.approved.value
    span = short_date(lr.from_on) if lr.from_on == lr.to_on else f"{short_date(lr.from_on)} to {short_date(lr.to_on)}"
    body = f"Leave for {student.first_name} ({span}) was {'approved' if approved else 'not approved'}."
    if lr.decision_note:
        body += f" Note: {lr.decision_note}"
    await notify_guardians_of_student(
        db,
        student.id,
        kind="leave_decided",
        title="Leave approved" if approved else "Leave not approved",
        body=body,
        data={"leave_id": lr.id, "status": lr.status},
        dedupe_key=f"leave:{lr.id}",
    )


# ------------------------------------------------------------------ reading
def _current_class_subquery():
    return (
        select(Enrollment.student_id.label("student_id"), Enrollment.class_id.label("class_id"))
        .join(AcademicYear, AcademicYear.id == Enrollment.academic_year_id)
        .where(AcademicYear.status == YearStatus.current.value, Enrollment.status == EnrollmentStatus.active.value)
        .subquery()
    )


def teacher_class_ids(p: Principal) -> set[uuid.UUID] | None:
    """None = every class (admin). Otherwise the classes this staff member is class teacher of."""
    if p.is_admin:
        return None
    return {a.class_id for a in p.assignments if a.role == ClassRole.class_teacher.value}


def to_out(lr: LeaveRequest, s: Student, g: Guardian, c: SchoolClass | None, decider: str | None) -> LeaveOut:
    return LeaveOut(
        id=lr.id,
        student_id=s.id,
        student_name=full_name(s),
        scholar_no=s.scholar_no,
        class_label=class_label(c) if c else None,
        guardian_name=g.name,
        from_on=lr.from_on,
        to_on=lr.to_on,
        half=lr.half,
        reason=lr.reason,
        status=lr.status,
        has_attachment=lr.attachment_id is not None,
        decided_by_name=decider,
        decided_at=lr.decided_at,
        decision_note=lr.decision_note,
        created_at=lr.created_at,
    )


def _stmt():
    cur = _current_class_subquery()
    stmt = (
        select(LeaveRequest, Student, Guardian, SchoolClass, User.name)
        .join(Student, Student.id == LeaveRequest.student_id)
        .join(Guardian, Guardian.id == LeaveRequest.guardian_id)
        .outerjoin(cur, cur.c.student_id == Student.id)
        .outerjoin(SchoolClass, SchoolClass.id == cur.c.class_id)
        .outerjoin(User, User.id == LeaveRequest.decided_by)
    )
    return stmt, SchoolClass


async def list_leave(
    db: AsyncSession,
    *,
    scope: set[uuid.UUID] | None = None,
    student_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
    status: str | None = None,
    from_on: date | None = None,
    to_on: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[LeaveOut], int]:
    """`scope`: the class ids the caller may see (None = all). Newest first, pending first."""
    stmt, C = _stmt()
    if scope is not None:
        stmt = stmt.where(C.id.in_(scope))
    if class_id:
        stmt = stmt.where(C.id == class_id)
    if student_id:
        stmt = stmt.where(LeaveRequest.student_id == student_id)
    if status:
        stmt = stmt.where(LeaveRequest.status == status)
    if from_on:
        stmt = stmt.where(LeaveRequest.to_on >= from_on)
    if to_on:
        stmt = stmt.where(LeaveRequest.from_on <= to_on)
    total = await db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    pending_first = (LeaveRequest.status == LeaveStatus.pending.value).desc()
    rows = (
        await db.execute(stmt.order_by(pending_first, LeaveRequest.from_on.desc()).limit(limit).offset(offset))
    ).all()
    return [to_out(*r) for r in rows], total


async def get_leave(db: AsyncSession, leave_id: uuid.UUID) -> LeaveOut:
    stmt, _ = _stmt()
    r = (await db.execute(stmt.where(LeaveRequest.id == leave_id))).first()
    if r is None:
        raise NotFound("Leave application not found.")
    return to_out(*r)


async def _leave_or_404(db: AsyncSession, leave_id: uuid.UUID, *, lock: bool = False) -> LeaveRequest:
    stmt = select(LeaveRequest).where(LeaveRequest.id == leave_id)
    lr = await db.scalar(stmt.with_for_update() if lock else stmt)
    if lr is None:
        raise NotFound("Leave application not found.")
    return lr


async def assert_staff_can_see(db: AsyncSession, p: Principal, lr: LeaveRequest) -> SchoolClass | None:
    """Admin, or the class teacher of the child's class. Anyone else gets a 404."""
    c = await class_of_student(db, lr.student_id)
    if c is None:
        c = await class_of_student(db, lr.student_id, active_only=False)
    if not (p.is_admin or (c is not None and p.is_class_teacher_of(c.id))):
        raise NotFound("Leave application not found.")
    return c


# ------------------------------------------------------------------ parent: apply, cancel
def _overlaps(a: LeaveRequest, b_from: date, b_to: date, b_half: str) -> bool:
    if a.from_on > b_to or a.to_on < b_from:
        return False
    same_day_other_halves = (
        a.half != LeaveHalf.none.value and b_half != LeaveHalf.none.value and a.half != b_half and a.from_on == b_from
    )
    return not same_day_other_halves


async def _check_attachment(db: AsyncSession, user_id: uuid.UUID, attachment_id: uuid.UUID) -> None:
    a = await db.get(Attachment, attachment_id)
    if a is None or a.uploaded_by != user_id or a.purpose != PURPOSE or a.status != "ready":
        raise AppError("The attached file is not available. Upload it again.", code="invalid_attachment", status=422)


async def apply(db: AsyncSession, actor: Actor, student: Student, user_id: uuid.UUID, body: LeaveIn) -> LeaveRequest:
    """The caller already proved the child is theirs and not left (assert_parent_child(writable=True))."""
    c = await class_of_student(db, student.id)
    if c is None:
        raise Conflict("This child is not in a class this year.", code="no_class")
    guardian = await db.scalar(select(Guardian).where(Guardian.user_id == user_id))
    if guardian is None:
        raise NotFound("Child not found.")
    from_on, to_on = body.from_on, body.to_on or body.from_on
    if from_on < today_ist() - timedelta(days=BACKDATE_DAYS):
        raise AppError(f"Leave can start at most {BACKDATE_DAYS} days ago.", code="too_old", status=422)
    if (to_on - from_on).days + 1 > MAX_LEAVE_DAYS:
        raise AppError(f"Leave can be at most {MAX_LEAVE_DAYS} days.", code="too_long", status=422)
    open_ones = await db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.student_id == student.id,
            LeaveRequest.status.in_([LeaveStatus.pending.value, LeaveStatus.approved.value]),
            LeaveRequest.from_on <= to_on,
            LeaveRequest.to_on >= from_on,
        )
    )
    if any(_overlaps(o, from_on, to_on, body.half) for o in open_ones):
        raise Conflict("There is already a leave application for these dates.", code="leave_overlaps")
    if body.attachment_id:
        await _check_attachment(db, user_id, body.attachment_id)
    lr = LeaveRequest(
        school_id=actor.school_id,
        student_id=student.id,
        guardian_id=guardian.id,
        from_on=from_on,
        to_on=to_on,
        half=body.half,
        reason=body.reason.strip(),
        attachment_id=body.attachment_id,
        status=LeaveStatus.pending.value,
    )
    db.add(lr)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.leave,
        "leave.requested",
        f"Applied for leave for {full_name(student)} from {from_on.isoformat()} to {to_on.isoformat()}",
        entity_type="leave_request",
        entity_id=lr.id,
        entity_label=full_name(student),
    )
    await db.refresh(lr)
    return lr


async def cancel(db: AsyncSession, actor: Actor, user_id: uuid.UUID, leave_id: uuid.UUID) -> LeaveRequest:
    lr = await _leave_or_404(db, leave_id, lock=True)
    student = await assert_parent_child(db, user_id, lr.student_id, writable=True)  # 404 if another family's
    if lr.status != LeaveStatus.pending.value:
        raise Conflict("Only a pending application can be cancelled.", code="not_pending")
    lr.status = LeaveStatus.cancelled.value
    log_audit(
        db,
        actor,
        AuditCategory.leave,
        "leave.cancelled",
        f"Cancelled the leave application for {full_name(student)}",
        entity_type="leave_request",
        entity_id=lr.id,
        entity_label=full_name(student),
        changes=[change("status", LeaveStatus.pending.value, lr.status)],
    )
    await db.flush()
    return lr


# ------------------------------------------------------------------ class teacher: decide
async def _mark_leave_on_saved_days(
    db: AsyncSession, actor: Actor, lr: LeaveRequest, c: SchoolClass, s: Student
) -> None:
    """Days already marked: an `absent` half that the leave covers becomes `leave`."""
    rows = (
        await db.execute(
            select(AttendanceRecord, AttendanceDay.day_on)
            .join(AttendanceDay, AttendanceDay.id == AttendanceRecord.attendance_day_id)
            .join(Enrollment, Enrollment.id == AttendanceRecord.enrollment_id)
            .where(
                Enrollment.student_id == lr.student_id,
                AttendanceDay.class_id == c.id,
                AttendanceDay.day_on.between(lr.from_on, lr.to_on),
            )
            .order_by(AttendanceDay.day_on)
        )
    ).all()
    changes: list[dict] = []
    for rec, day_on in rows:
        if lr.half in (LeaveHalf.none.value, LeaveHalf.first.value) and rec.first_half == ABSENT:
            changes.append(change(f"{day_on.isoformat()} first_half", rec.first_half, LEAVE))
            rec.first_half = LEAVE
        if lr.half in (LeaveHalf.none.value, LeaveHalf.second.value) and rec.second_half == ABSENT:
            changes.append(change(f"{day_on.isoformat()} second_half", rec.second_half, LEAVE))
            rec.second_half = LEAVE
    if changes:
        log_audit(
            db,
            actor,
            AuditCategory.attendance,
            "attendance.leave_applied",
            f"Approved leave marked {full_name(s)} on leave for {len(changes)} half days already saved",
            entity_type="student",
            entity_id=s.id,
            entity_label=full_name(s),
            changes=changes,
        )


async def decide(
    db: AsyncSession, actor: Actor, p: Principal, leave_id: uuid.UUID, *, approve: bool, note: str | None
) -> LeaveRequest:
    lr = await _leave_or_404(db, leave_id, lock=True)
    c = await assert_staff_can_see(db, p, lr)
    student = await db.get(Student, lr.student_id)
    if lr.status != LeaveStatus.pending.value:
        raise Conflict(f"This application is already {lr.status}.", code="already_decided")
    if c is None or await class_of_student(db, lr.student_id) is None:
        raise Conflict("This child is no longer in a class.", code="no_class")
    before = lr.status
    lr.status = LeaveStatus.approved.value if approve else LeaveStatus.rejected.value
    lr.decided_by, lr.decided_at = actor.id, utcnow()
    lr.decision_note = (note or "").strip() or None
    log_audit(
        db,
        actor,
        AuditCategory.leave,
        "leave.approved" if approve else "leave.rejected",
        f"{'Approved' if approve else 'Rejected'} leave for {full_name(student)} "
        f"({lr.from_on.isoformat()} to {lr.to_on.isoformat()})",
        entity_type="leave_request",
        entity_id=lr.id,
        entity_label=full_name(student),
        changes=[change("status", before, lr.status)]
        + ([change("note", None, lr.decision_note)] if lr.decision_note else []),
    )
    if approve:
        await _mark_leave_on_saved_days(db, actor, lr, c, student)
    await db.flush()
    await _notify_leave_decided(db, lr, student)
    return lr


# ------------------------------------------------------------------ attachments (the parent has no /files access)
async def parent_upload_url(db: AsyncSession, actor: Actor, user_id: uuid.UUID, body: AttachmentUploadIn) -> UploadOut:
    types, max_bytes = PURPOSES[PURPOSE]
    if body.content_type not in types:
        raise AppError("This kind of file is not allowed here.", code="invalid_file_type")
    if body.size_bytes > max_bytes:
        raise AppError(f"The file is too large. The limit is {max_bytes // (1024 * 1024)} MB.", code="file_too_large")
    file_id = uuid7()
    key = make_key(actor.school_id, PURPOSE, file_id, body.filename)
    db.add(
        Attachment(
            id=file_id,
            school_id=actor.school_id,
            purpose=PURPOSE,
            filename=body.filename[:200],
            content_type=body.content_type,
            size_bytes=body.size_bytes,
            storage_key=key,
            uploaded_by=user_id,
        )
    )
    await db.flush()
    ttl = settings.upload_url_ttl_seconds
    return UploadOut(
        id=file_id,
        upload_url=await get_storage().upload_url(key, body.content_type, ttl),
        headers={"Content-Type": body.content_type},
        expires_in=ttl,
    )


async def parent_complete_upload(db: AsyncSession, user_id: uuid.UUID, file_id: uuid.UUID) -> Attachment:
    a = await db.get(Attachment, file_id)
    if a is None or a.uploaded_by != user_id or a.purpose != PURPOSE:
        raise NotFound("File not found.")
    if a.status == "ready":
        return a
    obj = await get_storage().head(a.storage_key)
    if obj is None:
        raise AppError("The file was not uploaded. Please try again.", code="upload_missing")
    if obj.size != a.size_bytes:
        await get_storage().delete(a.storage_key)
        raise AppError("The uploaded file does not match. Please try again.", code="upload_mismatch")
    a.status, a.confirmed_at = "ready", utcnow()
    await db.flush()
    return a


async def attachment_download(db: AsyncSession, lr: LeaveRequest) -> DownloadOut:
    a = await db.get(Attachment, lr.attachment_id) if lr.attachment_id else None
    if a is None or a.status != "ready":
        raise NotFound("There is no attachment.")
    ttl = settings.download_url_ttl_seconds
    return DownloadOut(url=await get_storage().download_url(a.storage_key, a.filename, ttl), expires_in=ttl)


async def leave_for_parent(db: AsyncSession, user_id: uuid.UUID, leave_id: uuid.UUID) -> LeaveRequest:
    """The leave application, only if it is for one of this parent's children (else 404)."""
    lr = await _leave_or_404(db, leave_id)
    await assert_parent_child(db, user_id, lr.student_id)
    return lr
