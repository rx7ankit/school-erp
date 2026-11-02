"""Certificates (transfer, bonafide, character) and the documents kept on a student's record.

Numbers look like `TC-2026-014`: one counter per school, kind and calendar year, bumped with a single atomic
upsert, so two people issuing at once never get the same number and a number is never reused, even after a
cancel. `snapshot` holds everything that is printed; a reprint is rendered from it, never from live data.
"""

import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.academic import AcademicYear, SchoolClass
from app.models.certificate import Certificate, CertificateCounter, StudentDocument
from app.models.enums import AuditCategory, CertificateKind, CertificateStatus, StudentStatus
from app.models.file import Attachment
from app.models.school import School
from app.models.student import Enrollment, Guardian, Student, StudentGuardian
from app.models.user import User
from app.schemas.certificates import CertificateIn, CertificateOut, DocumentIn, DocumentOut
from app.services.audit import Actor, change, log_audit
from app.services.storage import get_storage
from app.services.students import class_label, full_name, mark_tc_issued, student_label

PREFIX = {
    CertificateKind.transfer.value: "TC",
    CertificateKind.bonafide.value: "BON",
    CertificateKind.character.value: "CHR",
}
TITLE = {"transfer": "Transfer certificate", "bonafide": "Bonafide certificate", "character": "Character certificate"}


# ------------------------------------------------------------------ numbering
async def next_number(db: AsyncSession, school_id: uuid.UUID, kind: str, year: int) -> str:
    """Atomic: concurrent callers queue on the counter row and each gets the next value."""
    stmt = (
        pg_insert(CertificateCounter)
        .values(school_id=school_id, kind=kind, year=year, last=1)
        .on_conflict_do_update(
            index_elements=[CertificateCounter.school_id, CertificateCounter.kind, CertificateCounter.year],
            set_={"last": CertificateCounter.last + 1},
        )
        .returning(CertificateCounter.last)
    )
    n = (await db.execute(stmt)).scalar_one()
    return f"{PREFIX[kind]}-{year}-{n:03d}"


# ------------------------------------------------------------------ snapshot
async def _snapshot(
    db: AsyncSession, student: Student, kind: str, *, issued_on: date, left_on: date | None, body: dict
) -> dict:
    school = await db.get(School, student.school_id)
    row = (
        await db.execute(
            select(Enrollment, SchoolClass, AcademicYear)
            .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
            .join(AcademicYear, AcademicYear.id == Enrollment.academic_year_id)
            .where(Enrollment.student_id == student.id)
            .order_by(AcademicYear.starts_on.desc())
            .limit(1)
        )
    ).first()
    guardian = (
        await db.execute(
            select(Guardian.name, StudentGuardian.relation)
            .join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id)
            .where(StudentGuardian.student_id == student.id)
            .order_by(StudentGuardian.is_primary.desc(), Guardian.name)
            .limit(1)
        )
    ).first()

    def d(x: date | None) -> str | None:
        return x.isoformat() if x else None

    snap: dict = {
        "title": TITLE[kind],
        "school": {"name": school.name if school else "", "city": school.city if school else ""},
        "student": {
            "name": full_name(student),
            "scholar_no": student.scholar_no,
            "dob": d(student.dob),
            "gender": student.gender,
            "category": student.category,
            "admitted_on": d(student.admitted_on),
            "pen": student.pen,
            "samagra_id": student.samagra_id,
        },
        "guardian": {"name": guardian[0], "relation": guardian[1]} if guardian else None,
        "class": class_label(row[1]) if row else None,
        "academic_year": row[2].name if row else None,
        "roll_no": row[0].roll_no if row else None,
        "issued_on": d(issued_on),
    }
    for key in ("reason", "conduct", "remarks", "purpose"):
        if body.get(key):
            snap[key] = body[key]
    if kind == CertificateKind.transfer.value:
        snap["left_on"] = d(left_on or student.left_on or issued_on)
    return snap


# ------------------------------------------------------------------ issue
async def _active_tc(db: AsyncSession, student_id: uuid.UUID) -> Certificate | None:
    return await db.scalar(
        select(Certificate).where(
            Certificate.student_id == student_id,
            Certificate.kind == CertificateKind.transfer.value,
            Certificate.status == CertificateStatus.issued.value,
        )
    )


async def issue_certificate(
    db: AsyncSession,
    actor: Actor,
    student: Student,
    kind: str,
    *,
    issued_on: date | None = None,
    reason: str | None = None,
    conduct: str | None = None,
    remarks: str | None = None,
    purpose: str | None = None,
    left_on: date | None = None,
    replaces: Certificate | None = None,
) -> Certificate:
    # one issuer at a time per student, so two TCs cannot both pass the checks below
    await db.execute(select(Student.id).where(Student.id == student.id).with_for_update())
    await db.refresh(student)
    issued_on = issued_on or today_ist()
    is_tc = kind == CertificateKind.transfer.value
    if replaces is None:
        if is_tc:
            if student.status == StudentStatus.passed_out.value:
                raise Conflict(
                    "A transfer certificate is not issued to a student who passed out.", code="student_passed_out"
                )
            if await _active_tc(db, student.id):
                raise Conflict("A transfer certificate is already issued. Cancel or reissue it.", code="already_issued")
            if student.status == StudentStatus.active.value and not left_on:
                raise Conflict(
                    "This student has not left. Give the leaving date (left_on) or record the leaving first.",
                    code="student_not_leaving",
                )
        elif student.status != StudentStatus.active.value:
            raise Conflict(
                "This certificate is only for a student who is currently studying.", code="student_not_active"
            )
    if is_tc and student.status == StudentStatus.active.value and left_on:
        student.left_on = left_on
    number = await next_number(db, student.school_id, kind, issued_on.year)
    snap = await _snapshot(
        db,
        student,
        kind,
        issued_on=issued_on,
        left_on=left_on,
        body={"reason": reason, "conduct": conduct, "remarks": remarks, "purpose": purpose},
    )
    snap["number"], snap["kind"] = number, kind
    cert = Certificate(
        id=uuid.uuid4(),
        school_id=student.school_id,
        student_id=student.id,
        kind=kind,
        number=number,
        issued_on=issued_on,
        issued_by=actor.id,
        reason=reason,
        snapshot=snap,
        status=CertificateStatus.issued.value,
        replaces_id=replaces.id if replaces else None,
    )
    db.add(cert)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "certificate.reissued" if replaces else "certificate.issued",
        f"{TITLE[kind]} {number} issued to {student_label(student)}"
        + (f" (replaces {replaces.number})" if replaces else ""),
        entity_type="certificate",
        entity_id=cert.id,
        entity_label=number,
        sensitive=True,
    )
    if is_tc:
        await mark_tc_issued(db, actor, student, tc_number=number)
    await _notify_certificate_issued(db, cert, student)
    return cert


async def get_certificate_or_404(db: AsyncSession, cert_id: uuid.UUID) -> Certificate:
    c = await db.get(Certificate, cert_id)
    if c is None:
        raise NotFound("Certificate not found.")
    return c


async def cancel_certificate(db: AsyncSession, actor: Actor, cert: Certificate, reason: str) -> Certificate:
    if cert.status == CertificateStatus.cancelled.value:
        raise Conflict("This certificate is already cancelled.", code="already_cancelled")
    cert.status, cert.cancelled_at, cert.cancelled_by, cert.cancel_reason = (
        CertificateStatus.cancelled.value,
        utcnow(),
        actor.id,
        reason,
    )
    student = await db.get(Student, cert.student_id)
    changes = [change("Status", CertificateStatus.issued.value, CertificateStatus.cancelled.value)]
    if student and cert.kind == CertificateKind.transfer.value and student.tc_number == cert.number:
        student.tc_number = None  # the student stays `tc_issued`; rejoin or issue a new TC
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "certificate.cancelled",
        f"{TITLE[cert.kind]} {cert.number} cancelled: {reason}",
        entity_type="certificate",
        entity_id=cert.id,
        entity_label=cert.number,
        changes=changes,
        sensitive=True,
    )
    await db.flush()
    return cert


async def reissue_certificate(
    db: AsyncSession,
    actor: Actor,
    cert: Certificate,
    *,
    reason: str,
    issued_on: date | None,
    conduct: str | None,
    remarks: str | None,
    purpose: str | None,
) -> Certificate:
    """Cancels the old one and issues a new one with a new number (the old number is never reused)."""
    student = await db.get(Student, cert.student_id)
    if student is None:
        raise NotFound("Student not found.")
    old_snap = cert.snapshot or {}
    await cancel_certificate(db, actor, cert, f"Reissued: {reason}")
    return await issue_certificate(
        db,
        actor,
        student,
        cert.kind,
        issued_on=issued_on,
        reason=reason,
        conduct=conduct or old_snap.get("conduct"),
        remarks=remarks or old_snap.get("remarks"),
        purpose=purpose or old_snap.get("purpose"),
        left_on=date.fromisoformat(old_snap["left_on"]) if old_snap.get("left_on") else None,
        replaces=cert,
    )


# ------------------------------------------------------------------ reads
def _out(c: Certificate, s: Student, issuer: str | None) -> CertificateOut:
    return CertificateOut(
        id=c.id,
        student_id=c.student_id,
        student_name=full_name(s),
        scholar_no=s.scholar_no,
        kind=c.kind,
        number=c.number,
        issued_on=c.issued_on,
        issued_by=c.issued_by,
        issued_by_name=issuer,
        reason=c.reason,
        status=c.status,
        cancelled_at=c.cancelled_at,
        cancel_reason=c.cancel_reason,
        replaces_id=c.replaces_id,
        snapshot=c.snapshot,
    )


async def certificate_out(db: AsyncSession, c: Certificate) -> CertificateOut:
    s = await db.get(Student, c.student_id)
    u = await db.get(User, c.issued_by)
    return _out(c, s, u.name if u else None)


async def list_certificates(
    db: AsyncSession,
    *,
    student_id: uuid.UUID | None,
    kind: str | None,
    status: str | None,
    q: str | None,
    limit: int,
    offset: int,
) -> tuple[list[CertificateOut], int]:
    stmt = (
        select(Certificate, Student, User.name)
        .join(Student, Student.id == Certificate.student_id)
        .outerjoin(User, User.id == Certificate.issued_by)
    )
    if student_id:
        stmt = stmt.where(Certificate.student_id == student_id)
    if kind:
        stmt = stmt.where(Certificate.kind == kind)
    if status:
        stmt = stmt.where(Certificate.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Certificate.number.ilike(like),
                Student.scholar_no.ilike(like),
                Student.first_name.ilike(like),
                Student.last_name.ilike(like),
            )
        )
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Certificate.created_at.desc()).limit(limit).offset(offset))).all()
    return [_out(c, s, n) for c, s, n in rows], total or 0


async def issue_from_body(db: AsyncSession, actor: Actor, student: Student, body: CertificateIn) -> Certificate:
    return await issue_certificate(
        db,
        actor,
        student,
        body.kind.value,
        issued_on=body.issued_on,
        reason=body.reason,
        conduct=body.conduct,
        remarks=body.remarks,
        purpose=body.purpose,
        left_on=body.left_on,
    )


# ------------------------------------------------------------------ student documents
def _doc_out(d: StudentDocument, a: Attachment) -> DocumentOut:
    return DocumentOut(
        id=d.id,
        student_id=d.student_id,
        kind=d.kind,
        attachment_id=d.attachment_id,
        filename=a.filename,
        content_type=a.content_type,
        size_bytes=a.size_bytes,
        note=d.note,
        created_at=d.created_at,
    )


async def add_document(db: AsyncSession, actor: Actor, student: Student, body: DocumentIn) -> DocumentOut:
    a = await db.get(Attachment, body.attachment_id)
    if a is None or a.purpose != "student_document":
        raise NotFound("File not found.")
    if a.status != "ready":
        raise AppError("The file upload is not confirmed yet.", code="file_not_ready")
    if await db.scalar(select(StudentDocument.id).where(StudentDocument.attachment_id == a.id)):
        raise Conflict("This file is already attached to a record.", code="file_in_use")
    d = StudentDocument(
        id=uuid.uuid4(),
        school_id=student.school_id,
        student_id=student.id,
        kind=body.kind.value,
        attachment_id=a.id,
        note=body.note,
        added_by=actor.id,
    )
    db.add(d)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student_document.added",
        f"{body.kind.value} added to {student_label(student)}: {a.filename}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
    )
    await db.refresh(d)
    return _doc_out(d, a)


async def list_documents(db: AsyncSession, actor: Actor, student: Student) -> list[DocumentOut]:
    rows = (
        await db.execute(
            select(StudentDocument, Attachment)
            .join(Attachment, Attachment.id == StudentDocument.attachment_id)
            .where(StudentDocument.student_id == student.id)
            .order_by(StudentDocument.created_at)
        )
    ).all()
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student_document.listed",
        f"Documents of {student_label(student)} viewed",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
    )
    return [_doc_out(d, a) for d, a in rows]


async def _doc(db: AsyncSession, student: Student, doc_id: uuid.UUID) -> tuple[StudentDocument, Attachment]:
    row = (
        await db.execute(
            select(StudentDocument, Attachment)
            .join(Attachment, Attachment.id == StudentDocument.attachment_id)
            .where(StudentDocument.id == doc_id, StudentDocument.student_id == student.id)
        )
    ).first()
    if not row:
        raise NotFound("Document not found.")
    return row


async def document_url(db: AsyncSession, actor: Actor, student: Student, doc_id: uuid.UUID, ttl: int) -> str:
    d, a = await _doc(db, student, doc_id)
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student_document.opened",
        f"{d.kind} of {student_label(student)} opened: {a.filename}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
    )
    return await get_storage().download_url(a.storage_key, a.filename, ttl)


async def delete_document(db: AsyncSession, actor: Actor, student: Student, doc_id: uuid.UUID) -> None:
    d, a = await _doc(db, student, doc_id)
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "student_document.removed",
        f"{d.kind} of {student_label(student)} removed: {a.filename}",
        entity_type="student",
        entity_id=student.id,
        entity_label=full_name(student),
        sensitive=True,
    )
    key = a.storage_key
    await db.delete(d)
    await db.flush()
    await db.delete(a)
    await db.flush()
    await get_storage().delete(key)


# ------------------------------------------------------------------ notification hooks
async def _notify_certificate_issued(db: AsyncSession, cert: Certificate, student: Student) -> None:
    """Tell the child's parents (guardian_user_ids_of_student(db, student.id)) that `cert.kind` certificate
    `cert.number` is ready. Parents read it at GET /parent/children/{id}/certificates."""
    # NOTIFY: certificate issued. Wired by the notifications module; does nothing for now.
    return None
