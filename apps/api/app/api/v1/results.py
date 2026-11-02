"""Grading scheme, exams, papers, marks, publishing, result sheets, report cards (staff) and a parent's results."""

import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, request_actor, require_parent, require_permission, require_staff
from app.core.clock import today_ist
from app.core.errors import Conflict, NotFound
from app.core.principal import Principal
from app.models.academic import AcademicYear
from app.models.enums import AuditCategory, Permission
from app.models.results import Exam, GradingScheme
from app.models.student import Student
from app.schemas.common import Page
from app.schemas.results import (
    ChangedOut,
    ClassSheet,
    ExamClassStatus,
    ExamIn,
    ExamOut,
    ExamPatch,
    MarksIn,
    MarksSaved,
    PaperOut,
    PapersIn,
    ParentExamRow,
    PublishedOut,
    RemarksIn,
    ReportCard,
    SchemeIn,
    SchemeOut,
    SchemePatch,
    StudentResult,
)
from app.services import results as svc
from app.services.audit import log_audit
from app.services.sheets import XLSX, build_xlsx
from app.services.students import current_year_or_none, get_student_or_404
from app.services.years import assert_class_year_writable, assert_year_writable

router = APIRouter(tags=["results"])
parent_router = APIRouter(prefix="/parent", tags=["parent"])
manage = require_permission(Permission.academic.value)


# ---------------------------------------------------------------- grading scheme
async def _scheme(db: AsyncSession, scheme_id: uuid.UUID) -> GradingScheme:
    s = await db.get(GradingScheme, scheme_id)
    if s is None:
        raise NotFound("Grading scheme not found.")
    return s


@router.get("/grading-schemes", response_model=list[SchemeOut])
async def list_schemes(p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)):
    rows = (await db.scalars(select(GradingScheme).order_by(GradingScheme.is_active.desc(), GradingScheme.name))).all()
    return [await svc.scheme_out(db, s) for s in rows]


@router.post("/grading-schemes", response_model=SchemeOut, status_code=201)
async def add_scheme(
    body: SchemeIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    s = await svc.create_scheme(db, request_actor(p, request), body.name, body.bands, body.make_active)
    return await svc.scheme_out(db, s)


@router.patch("/grading-schemes/{scheme_id}", response_model=SchemeOut)
async def edit_scheme(
    scheme_id: uuid.UUID,
    body: SchemePatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    s = await _scheme(db, scheme_id)
    await svc.update_scheme(db, request_actor(p, request), s, body.name, body.bands)
    return await svc.scheme_out(db, s)


@router.post("/grading-schemes/{scheme_id}/activate", response_model=SchemeOut)
async def activate_scheme(
    scheme_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    s = await _scheme(db, scheme_id)
    await svc.activate_scheme(db, request_actor(p, request), s)
    return await svc.scheme_out(db, s)


# ---------------------------------------------------------------- exams and papers
@router.get("/exams", response_model=Page[ExamOut])
async def list_exams(
    year_id: uuid.UUID | None = None, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    """Exams of one academic year (default: the current one)."""
    if year_id is None:
        year = await current_year_or_none(db)
        year_id = year.id if year else None
    q = select(Exam).order_by(Exam.starts_on.nulls_last(), Exam.name)
    if year_id:
        q = q.where(Exam.academic_year_id == year_id)
    rows = (await db.scalars(q)).all()
    return Page(items=rows, total=len(rows))


@router.post("/exams", response_model=ExamOut, status_code=201)
async def add_exam(
    body: ExamIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    if body.academic_year_id:
        year = await db.get(AcademicYear, body.academic_year_id)
    else:
        year = await current_year_or_none(db)
        if year is None:
            raise Conflict("There is no current academic year. Create one first.", code="no_current_year")
    if year is None:
        raise NotFound("Academic year not found.")
    return await svc.create_exam(db, request_actor(p, request), body.name, year, body.starts_on, body.ends_on)


@router.patch("/exams/{exam_id}", response_model=ExamOut)
async def edit_exam(
    exam_id: uuid.UUID,
    body: ExamPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    e = await svc.get_exam_or_404(db, exam_id)
    await svc.update_exam(db, request_actor(p, request), e, body.model_dump(exclude_unset=True))
    return e


@router.delete("/exams/{exam_id}", status_code=204)
async def remove_exam(
    exam_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    await svc.delete_exam(db, request_actor(p, request), await svc.get_exam_or_404(db, exam_id))
    return Response(status_code=204)


@router.put("/exams/{exam_id}/papers", response_model=list[PaperOut])
async def set_papers(
    exam_id: uuid.UUID,
    body: PapersIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """The subjects, maximum and pass marks of this exam for the given classes (replaces what was there)."""
    exam = await svc.get_exam_or_404(db, exam_id)
    await assert_year_writable(db, exam.academic_year_id)
    await svc.set_papers(db, request_actor(p, request), exam, body.class_ids, body.papers)
    out = []
    for cid in dict.fromkeys(body.class_ids):
        out += await svc.papers_of(db, exam.id, cid)
    return out


@router.get("/exams/{exam_id}/classes", response_model=list[ExamClassStatus])
async def exam_classes(
    exam_id: uuid.UUID, p: Principal = Depends(require_staff), db: AsyncSession = Depends(db_session)
):
    """Classes that have papers in this exam, with how much marks entry is done and whether it is published.
    Academic managers see every class, other staff the classes they are assigned to."""
    return await svc.class_statuses(db, p, await svc.get_exam_or_404(db, exam_id))


# ---------------------------------------------------------------- marks, remarks, publishing
async def _exam_class(db: AsyncSession, p: Principal, exam_id: uuid.UUID, class_id: uuid.UUID):
    exam = await svc.get_exam_or_404(db, exam_id)
    cls = await svc.get_class_or_404(db, class_id)
    svc.assert_can_view_class(p, cls.id)
    return exam, cls


@router.get("/exams/{exam_id}/classes/{class_id}/sheet", response_model=ClassSheet)
async def class_result_sheet(
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """The class result sheet and the marks entry grid in one: every student with marks per paper, total,
    percentage, grade, rank and remark. `papers[].can_edit` says which columns the caller may fill."""
    exam, cls = await _exam_class(db, p, exam_id, class_id)
    return await svc.class_sheet(db, exam, cls, p)


@router.put("/exams/{exam_id}/classes/{class_id}/marks", response_model=MarksSaved)
async def enter_marks(
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    body: MarksIn,
    request: Request,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Class teacher: any subject. Subject teacher: their own subject, until the results are published.
    An entry with no marks and not absent clears that mark. Audited with before and after."""
    exam, cls = await _exam_class(db, p, exam_id, class_id)
    await assert_class_year_writable(db, cls)
    saved, cleared = await svc.save_marks(db, request_actor(p, request), p, exam, cls, body.entries)
    return MarksSaved(saved=saved, cleared=cleared)


@router.put("/exams/{exam_id}/classes/{class_id}/remarks", response_model=ChangedOut)
async def write_remarks(
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    body: RemarksIn,
    request: Request,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Report card remarks, class teacher only. An empty remark removes it."""
    exam, cls = await _exam_class(db, p, exam_id, class_id)
    await assert_class_year_writable(db, cls)
    return ChangedOut(changed=await svc.save_remarks(db, request_actor(p, request), p, exam, cls, body.remarks))


@router.post("/exams/{exam_id}/classes/{class_id}/publish", response_model=PublishedOut)
async def publish_results(
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Class teacher releases the results to the parents of the class. Every student needs every paper entered."""
    exam, cls = await _exam_class(db, p, exam_id, class_id)
    sheet = await svc.publish(db, request_actor(p, request), p, exam, cls)
    return PublishedOut(published_at=sheet.published_at)


@router.post("/exams/{exam_id}/classes/{class_id}/unpublish", status_code=204)
async def unpublish_results(
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    exam, cls = await _exam_class(db, p, exam_id, class_id)
    await svc.unpublish(db, request_actor(p, request), p, exam, cls)
    return Response(status_code=204)


@router.get("/exams/{exam_id}/classes/{class_id}/export")
async def export_class_results(
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Excel class result sheet (same visibility as the sheet). Audited under exports."""
    exam, cls = await _exam_class(db, p, exam_id, class_id)
    sheet = await svc.class_sheet(db, exam, cls)
    headers, rows = svc.sheet_table(sheet)
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "results.exported",
        f"Exported {exam.name} results of class {sheet.class_name} to Excel ({len(rows)} students)",
        entity_label=f"{exam.name} {sheet.class_name}",
        sensitive=True,
    )
    name = f"results-{exam.name}-{sheet.class_name}-{today_ist().isoformat()}.xlsx".replace(" ", "-")
    return Response(
        build_xlsx([(f"{sheet.class_name} {exam.name}", headers, rows)]),
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# ---------------------------------------------------------------- one student (staff)
async def _staff_enrollment(db: AsyncSession, p: Principal, exam_id: uuid.UUID, student_id: uuid.UUID):
    exam = await svc.get_exam_or_404(db, exam_id)
    student = await get_student_or_404(db, student_id)
    enr = await svc.enrollment_for_exam(db, exam, student.id)
    svc.assert_can_view_class(p, enr.class_id)
    return exam, enr


@router.get("/exams/{exam_id}/students/{student_id}/result", response_model=StudentResult)
async def student_result_sheet(
    exam_id: uuid.UUID,
    student_id: uuid.UUID,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    exam, enr = await _staff_enrollment(db, p, exam_id, student_id)
    return (await svc.student_result(db, exam, enr))[0]


@router.get("/exams/{exam_id}/students/{student_id}/report-card", response_model=ReportCard)
async def student_report_card(
    exam_id: uuid.UUID,
    student_id: uuid.UUID,
    p: Principal = Depends(require_staff),
    db: AsyncSession = Depends(db_session),
):
    """Report card as JSON for the client to print (draft marks included for staff)."""
    exam, enr = await _staff_enrollment(db, p, exam_id, student_id)
    return await svc.report_card(db, exam, enr)


# ---------------------------------------------------------------- parent
@parent_router.get("/children/{student_id}/results", response_model=list[ParentExamRow])
async def child_results(
    s: Student = Depends(parent_child), p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    """Published exams of the child only. A child who has left stays readable."""
    return await svc.parent_exams(db, s.id)


@parent_router.get("/children/{student_id}/results/{exam_id}", response_model=StudentResult)
async def child_result(
    exam_id: uuid.UUID,
    s: Student = Depends(parent_child),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    exam = await svc.get_exam_or_404(db, exam_id)
    enr = await svc.enrollment_for_exam(db, exam, s.id)
    return (await svc.student_result(db, exam, enr, require_published=True))[0]


@parent_router.get("/children/{student_id}/results/{exam_id}/report-card", response_model=ReportCard)
async def child_report_card(
    exam_id: uuid.UUID,
    s: Student = Depends(parent_child),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    exam = await svc.get_exam_or_404(db, exam_id)
    enr = await svc.enrollment_for_exam(db, exam, s.id)
    return await svc.report_card(db, exam, enr, require_published=True)
