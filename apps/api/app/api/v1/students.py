import uuid

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission, require_staff
from app.core.clock import today_ist
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.academic import SchoolClass
from app.models.enums import AuditCategory, Permission
from app.models.student import Guardian, ImportJob, ImportRow, StudentGuardian
from app.schemas.common import Page
from app.schemas.students import (
    EnrolIn,
    EventOut,
    GuardianAddIn,
    GuardianLinkPatch,
    GuardianOut,
    ImportCommitIn,
    ImportCommitOut,
    ImportJobOut,
    ImportRowOut,
    LeaveIn,
    PhotoIn,
    RejoinIn,
    StudentDetail,
    StudentListItem,
    StudentPatch,
    StudentStatusFilter,
    TransferIn,
)
from app.services import guardians as gsvc
from app.services import student_import as imp
from app.services import students as svc
from app.services.audit import log_audit
from app.services.enrolment import STUDENT_COLUMNS, EnrolResult, check_guardians, enrol_student, send_new_logins
from app.services.sheets import MAX_BYTES, XLSX
from app.services.student_views import history, list_items, set_photo, student_detail

router = APIRouter(prefix="/students", tags=["students"])
manage = require_permission(Permission.academic.value)


def _xlsx(content: bytes, name: str) -> Response:
    return Response(content, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})


async def _visible(db: AsyncSession, p: Principal, student_id: uuid.UUID):
    s = await svc.get_student_or_404(db, student_id)
    await svc.assert_can_view_student(db, p, s)
    return s


def _filter(q, class_id, grade, status, year_id) -> svc.StudentFilter:
    return svc.StudentFilter(q=q, class_id=class_id, grade=grade, status=status, year_id=year_id)


# ---------------------------------------------------------------- list, create, export
@router.get("", response_model=Page[StudentListItem])
async def list_students(
    q: str | None = None,
    class_id: uuid.UUID | None = None,
    grade: str | None = None,
    status: StudentStatusFilter = "active",
    year_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Admin, academic and fees staff see every student; a teacher sees the classes they are assigned to."""
    stmt = await svc.students_query(db, p, _filter(q, class_id, grade, status, year_id))
    total = await db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = (await db.execute(stmt.limit(limit).offset(offset))).all()
    return Page(items=await list_items(db, [tuple(r) for r in rows]), total=total)


@router.post("", response_model=StudentDetail, status_code=201)
async def enrol_directly(
    body: EnrolIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Direct enrolment, no application: student, guardians, enrollment and history in one transaction."""
    actor = request_actor(p, request)
    result = await enrol_student(
        db,
        actor,
        fields=body.model_dump(include=set(STUDENT_COLUMNS)),
        class_id=body.class_id,
        guardians=body.guardians,
        admitted_on=body.admitted_on,
        scholar_no=body.scholar_no,
        roll_no=body.roll_no,
        create_login=body.create_parent_login or body.send_login,
        send_login=body.send_login,
        fee_options=body.fee_options,
    )
    return await student_detail(db, result.student)


@router.get("/export")
async def export_students(
    request: Request,
    q: str | None = None,
    class_id: uuid.UUID | None = None,
    grade: str | None = None,
    status: StudentStatusFilter = "active",
    year_id: uuid.UUID | None = None,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Excel file filtered exactly like the list, limited to what the caller may see. Audited."""
    f = _filter(q, class_id, grade, status, year_id)
    rows = [tuple(r) for r in (await db.execute(await svc.students_query(db, p, f))).all()]
    content = await imp.export_xlsx(db, rows)
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "students.exported",
        f"Exported {len(rows)} students to Excel ({imp.filter_text(f)})",
        entity_label="Students",
        sensitive=True,
    )
    return _xlsx(content, f"students-{today_ist().isoformat()}.xlsx")


# ---------------------------------------------------------------- import
@router.get("/import/template")
async def import_template(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    year = await svc.current_year_or_none(db)
    labels = []
    if year:
        classes = (
            await db.scalars(
                select(SchoolClass)
                .where(SchoolClass.academic_year_id == year.id)
                .order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section)
            )
        ).all()
        labels = [svc.class_label(c) for c in classes]
    return _xlsx(imp.template_xlsx(labels), "students-import-template.xlsx")


def _job_out(job: ImportJob, rows: list[ImportRow]) -> ImportJobOut:
    return ImportJobOut(
        id=job.id,
        file_name=job.file_name,
        status=job.status,
        total_rows=job.total_rows,
        ok_rows=job.ok_rows,
        error_rows=job.error_rows,
        imported_at=job.imported_at,
        rows=[ImportRowOut(row_no=r.row_no, ok=r.error is None, error=r.error, data=r.data) for r in rows],
    )


@router.post("/import", response_model=ImportJobOut, status_code=201)
async def import_validate(
    request: Request,
    file: UploadFile = File(...),
    year_id: uuid.UUID | None = None,
    create_logins: bool = False,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Dry run: reads the .xlsx/.csv and reports every row's problems. Nothing is imported until you commit the job."""
    data = await file.read(MAX_BYTES + 1)
    job, rows = await imp.validate_upload(
        db,
        request_actor(p, request),
        data=data,
        filename=file.filename or "students.xlsx",
        year_id=year_id,
        create_logins=create_logins,
    )
    return _job_out(job, rows)


@router.get("/import/{job_id}", response_model=ImportJobOut)
async def import_status(job_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    job = await db.get(ImportJob, job_id)
    if job is None:
        raise NotFound("Import not found.")
    rows = (await db.scalars(select(ImportRow).where(ImportRow.job_id == job.id).order_by(ImportRow.row_no))).all()
    return _job_out(job, list(rows))


@router.post("/import/{job_id}/commit", response_model=ImportCommitOut)
async def import_commit(
    job_id: uuid.UUID,
    request: Request,
    body: ImportCommitIn | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Imports in one transaction. Rows are checked again; any problem rejects the lot unless `skip_errors`."""
    body = body or ImportCommitIn()
    job, res = await imp.commit_job(
        db, request_actor(p, request), job_id, skip_errors=body.skip_errors, send_login=body.send_login
    )
    return ImportCommitOut(
        job_id=job.id,
        imported=res.imported,
        skipped=res.skipped,
        logins_created=res.logins_created,
        sent=res.sent,
        failed=res.failed,
    )


# ---------------------------------------------------------------- one student
@router.get("/{student_id}", response_model=StudentDetail)
async def get_student(
    student_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    return await student_detail(db, await _visible(db, p, student_id))


@router.get("/{student_id}/history", response_model=list[EventOut])
async def student_history(
    student_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    s = await _visible(db, p, student_id)
    return await history(db, s.id)


@router.patch("/{student_id}", response_model=StudentDetail)
async def edit_student(
    student_id: uuid.UUID,
    body: StudentPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await svc.get_student_or_404(db, student_id)
    await svc.edit_student(db, request_actor(p, request), s, body.model_dump(exclude_unset=True))
    return await student_detail(db, s)


@router.post("/{student_id}/leave", response_model=StudentDetail)
async def leave(
    student_id: uuid.UUID,
    body: LeaveIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Marks the student as left: closes the enrollment, keeps history. Parent login becomes read-only."""
    s = await svc.get_student_or_404(db, student_id)
    await svc.mark_left(db, request_actor(p, request), s, left_on=body.left_on, reason=body.reason)
    return await student_detail(db, s)


@router.post("/{student_id}/rejoin", response_model=StudentDetail)
async def rejoin(
    student_id: uuid.UUID,
    body: RejoinIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await svc.get_student_or_404(db, student_id)
    await svc.rejoin(db, request_actor(p, request), s, class_id=body.class_id, on=body.on, reason=body.reason)
    return await student_detail(db, s)


@router.post("/{student_id}/transfer", response_model=StudentDetail)
async def transfer(
    student_id: uuid.UUID,
    body: TransferIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Move to another section or class in the same academic year."""
    s = await svc.get_student_or_404(db, student_id)
    await svc.transfer(
        db, request_actor(p, request), s, class_id=body.class_id, effective_on=body.effective_on, reason=body.reason
    )
    return await student_detail(db, s)


@router.put("/{student_id}/photo", response_model=StudentDetail)
async def put_photo(
    student_id: uuid.UUID,
    body: PhotoIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Upload through `/files/upload-url` with purpose `student_photo`, confirm it, then set it here."""
    s = await svc.get_student_or_404(db, student_id)
    await set_photo(db, request_actor(p, request), s, body.file_id)
    return await student_detail(db, s)


@router.delete("/{student_id}/photo", response_model=StudentDetail)
async def delete_photo(
    student_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    s = await svc.get_student_or_404(db, student_id)
    await set_photo(db, request_actor(p, request), s, None)
    return await student_detail(db, s)


# ---------------------------------------------------------------- guardians of a student
@router.post("/{student_id}/guardians", response_model=list[GuardianOut], status_code=201)
async def add_guardian(
    student_id: uuid.UUID,
    body: GuardianAddIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Adds a parent or guardian (or attaches an existing one, e.g. a sibling's parent). The same email as an
    existing guardian reuses that guardian, so siblings share one parent login."""
    s = await svc.get_student_or_404(db, student_id)
    actor = request_actor(p, request)
    check_guardians([body], need_email=body.create_login or body.send_login)
    g, _ = await gsvc.resolve_guardian(db, s.school_id, body)
    await gsvc.link_guardian(
        db, s, g, relation=body.relation, is_primary=body.is_primary, is_emergency=body.is_emergency
    )
    await gsvc.ensure_primary(db, s)
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "guardian.linked",
        f"Added guardian {g.name} to {svc.student_label(s)}",
        entity_type="student",
        entity_id=s.id,
        entity_label=svc.full_name(s),
    )
    if body.create_login or body.send_login:
        user, created = await gsvc.ensure_parent_login(db, g)
        res = EnrolResult(s, None, [g], [user] if created else [], [user])  # type: ignore[arg-type]
        if body.send_login:
            await send_new_logins(db, actor, res)
    await db.flush()
    return await gsvc.guardians_of_student(db, s.id)


@router.patch("/{student_id}/guardians/{guardian_id}", response_model=list[GuardianOut])
async def edit_guardian_link(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    body: GuardianLinkPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await svc.get_student_or_404(db, student_id)
    link = await db.get(StudentGuardian, (student_id, guardian_id))
    if link is None:
        raise NotFound("That guardian is not linked to this student.")
    g = await db.get(Guardian, guardian_id)
    assert g
    await gsvc.link_guardian(
        db,
        s,
        g,
        relation=body.relation or link.relation,
        is_primary=link.is_primary if body.is_primary is None else body.is_primary,
        is_emergency=link.is_emergency if body.is_emergency is None else body.is_emergency,
    )
    if body.is_primary is False:
        await gsvc.ensure_primary(db, s)
    return await gsvc.guardians_of_student(db, s.id)


@router.delete("/{student_id}/guardians/{guardian_id}", response_model=list[GuardianOut])
async def remove_guardian(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await svc.get_student_or_404(db, student_id)
    g = await db.get(Guardian, guardian_id)
    if g is None:
        raise NotFound("Guardian not found.")
    await gsvc.unlink_guardian(db, request_actor(p, request), s, g)
    return await gsvc.guardians_of_student(db, s.id)
