"""Admissions: enquiry -> applied -> approved -> enrolled (or rejected). Enrol is one transaction."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.enums import AdmissionStatus, AuditCategory
from app.models.student import Admission
from app.schemas.students import AdmissionEnrolIn, AdmissionIn, GuardianIn
from app.services.audit import Actor, change, log_audit
from app.services.enrolment import EnrolResult, enrol_student
from app.services.students import class_label, full_name, get_class_or_404

S = AdmissionStatus
# where each status may go next
FLOW: dict[str, set[str]] = {
    S.enquiry.value: {S.applied.value, S.approved.value, S.rejected.value},
    S.applied.value: {S.enquiry.value, S.approved.value, S.rejected.value},
    S.approved.value: {S.applied.value, S.rejected.value},
    S.rejected.value: {S.enquiry.value, S.applied.value},
    S.enrolled.value: set(),
}


async def get_admission_or_404(db: AsyncSession, admission_id: uuid.UUID, *, lock: bool = False) -> Admission:
    stmt = select(Admission).where(Admission.id == admission_id)
    if lock:
        stmt = stmt.with_for_update()
    a = await db.scalar(stmt)
    if a is None:
        raise NotFound("Admission not found.")
    return a


async def create_admission(db: AsyncSession, actor: Actor, body: AdmissionIn) -> Admission:
    assert actor.school_id
    if body.class_id:
        await get_class_or_404(db, body.class_id)
    a = Admission(
        school_id=actor.school_id,
        applicant_name=body.applicant_name.strip(),
        dob=body.dob,
        gender=body.gender,
        grade_applied=body.grade_applied.strip(),
        class_id=body.class_id,
        guardian_name=body.guardian_name.strip(),
        guardian_phone=body.guardian_phone,
        guardian_email=str(body.guardian_email).lower() if body.guardian_email else None,
        previous_school=body.previous_school,
        notes=body.notes,
        status=body.status,
        applied_at=utcnow(),
        handled_by=actor.id,
    )
    db.add(a)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "admission.created",
        f"Recorded {a.status} for {a.applicant_name} (Class {a.grade_applied})",
        entity_type="admission",
        entity_id=a.id,
        entity_label=a.applicant_name,
    )
    return a


async def edit_admission(db: AsyncSession, actor: Actor, a: Admission, values: dict) -> None:
    if a.status == S.enrolled.value:
        raise Conflict("This admission is already enrolled. Edit the student instead.", code="already_enrolled")
    if values.get("class_id"):
        await get_class_or_404(db, values["class_id"])
    changes = []
    for k, v in values.items():
        if isinstance(v, str):
            v = v.strip() or None
        if k == "guardian_email" and v:
            v = str(v).lower()
        if k in ("applicant_name", "grade_applied", "guardian_name") and not v:
            raise AppError("This cannot be empty.", code="validation_error", status=422)
        if getattr(a, k) != v:
            changes.append(change(k.replace("_", " ").title(), getattr(a, k), v))
            setattr(a, k, v)
    if changes:
        a.handled_by = actor.id
        await db.flush()
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "admission.edited",
            f"Updated admission of {a.applicant_name}",
            entity_type="admission",
            entity_id=a.id,
            entity_label=a.applicant_name,
            changes=changes,
        )


async def set_status(db: AsyncSession, actor: Actor, a: Admission, status: str, note: str | None) -> None:
    if status == a.status:
        return
    if status not in FLOW.get(a.status, set()):
        raise Conflict(f"An admission cannot move from {a.status} to {status}.", code="invalid_transition")
    old, a.status, a.handled_by = a.status, status, actor.id
    if note:
        a.notes = f"{a.notes}\n{note}".strip() if a.notes else note
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.students,
        f"admission.{status}",
        f"Admission of {a.applicant_name}: {old} to {status}",
        entity_type="admission",
        entity_id=a.id,
        entity_label=a.applicant_name,
        changes=[change("Status", old, status)],
    )


def split_name(name: str) -> tuple[str, str]:
    parts = name.split()
    return (parts[0], " ".join(parts[1:])) if parts else ("", "")


async def enrol_admission(
    db: AsyncSession, actor: Actor, admission_id: uuid.UUID, body: AdmissionEnrolIn
) -> EnrolResult:
    """One transaction: student + guardians + enrollment + admitted event (+ parent login), then the admission is
    marked enrolled. The admission row is locked so it cannot be enrolled twice."""
    a = await get_admission_or_404(db, admission_id, lock=True)
    if a.status == S.enrolled.value:
        raise Conflict("This admission is already enrolled.", code="already_enrolled")
    if a.status != S.approved.value:
        raise Conflict("Approve the admission before enrolling.", code="not_approved")
    class_id = body.class_id or a.class_id
    if not class_id:
        raise AppError("Choose the class to enrol into.", code="class_required", status=422)

    fields = body.student.model_dump() if body.student else {}
    if not fields:
        first, last = split_name(a.applicant_name)
        fields = {
            "first_name": first,
            "last_name": last,
            "dob": a.dob,
            "gender": a.gender,
            "previous_school": a.previous_school,
        }
    guardians = body.guardians or [
        GuardianIn(
            name=a.guardian_name, phone=a.guardian_phone, email=a.guardian_email, relation="other", is_primary=True
        )
    ]
    has_email = any(g.guardian_id or g.email for g in guardians)
    result = await enrol_student(
        db,
        actor,
        fields=fields,
        class_id=class_id,
        guardians=guardians,
        admitted_on=body.admitted_on,
        scholar_no=body.scholar_no,
        roll_no=body.roll_no,
        create_login=body.create_parent_login and (has_email or body.send_login),
        send_login=body.send_login,
        fee_options=body.fee_options,
        reason="Admission",
        audit=False,
    )
    a.status, a.student_id, a.enrolled_at, a.handled_by = S.enrolled.value, result.student.id, utcnow(), actor.id
    cls = await get_class_or_404(db, class_id)
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "admission.enrolled",
        f"Enrolled {full_name(result.student)} ({result.student.scholar_no}) in Class {class_label(cls)} (admission)",
        entity_type="student",
        entity_id=result.student.id,
        entity_label=full_name(result.student),
    )
    await db.flush()
    return result
