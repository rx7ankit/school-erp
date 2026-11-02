"""Exams, grading, marks, ranks, publishing and report cards.

Rules (erd v2, v6):
* academic.manage (admin) sets up the grading scheme, exams and papers (`exam_subjects`).
* The class teacher enters marks for every paper of the class; a subject teacher only for their own subject, and
  only until the class teacher publishes. Every entry and edit is audited with before and after.
* Parents see nothing until the class teacher publishes (`exam_publications`); unpublishing hides it again.
* Percentage = total marks / total maximum of the class's papers. Absent counts as zero and as a fail.
  Grade = the highest band whose minimum percent is reached. Rank is by total, ties share a rank, and only
  students with every paper entered are ranked.

Helpers other modules may use: `class_sheet`, `student_result`, `grade_for`, `load_bands`.
"""

import math
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.principal import Principal
from app.models.academic import AcademicYear, ClassSubject, SchoolClass, Subject
from app.models.enums import AuditCategory, ClassRole, EnrollmentStatus, Permission
from app.models.results import (
    Exam,
    ExamPublication,
    ExamSubject,
    GradeBand,
    GradingScheme,
    ReportRemark,
    Result,
)
from app.models.results import (
    ReportCard as ReportCardRow,
)
from app.models.school import School
from app.models.student import Enrollment, Student
from app.schemas.results import (
    BandIn,
    BandOut,
    ClassSheet,
    ExamClassStatus,
    ExamOut,
    MarkCell,
    MarkIn,
    PaperIn,
    PaperOut,
    ParentExamRow,
    RemarkIn,
    ReportCard,
    SchemeOut,
    StudentResult,
    StudentRow,
)
from app.services.attendance import period_stats_for_enrollment
from app.services.audit import Actor, change, log_audit
from app.services.messages_i18n import render
from app.services.notifications import notify_guardians_of_student
from app.services.students import class_label, full_name


# ------------------------------------------------------------------ lookups
async def get_exam_or_404(db: AsyncSession, exam_id: uuid.UUID) -> Exam:
    e = await db.get(Exam, exam_id)
    if e is None:
        raise NotFound("Exam not found.")
    return e


async def get_class_or_404(db: AsyncSession, class_id: uuid.UUID) -> SchoolClass:
    c = await db.get(SchoolClass, class_id)
    if c is None:
        raise NotFound("Class not found.")
    return c


def can_view_class(p: Principal, class_id: uuid.UUID) -> bool:
    """Academic managers see every class, other staff only classes they are assigned to."""
    return p.has(Permission.academic.value) or p.is_assigned_to(class_id)


def assert_can_view_class(p: Principal, class_id: uuid.UUID) -> None:
    if not can_view_class(p, class_id):
        raise Forbidden("You are not assigned to this class.", code="not_your_class")


def editable_subjects(p: Principal, class_id: uuid.UUID) -> set[uuid.UUID] | None:
    """None = every subject (class teacher, admin). A set = only those subjects (subject teacher), empty = none."""
    if p.is_class_teacher_of(class_id):
        return None
    return {
        a.subject_id
        for a in p.assignments
        if a.class_id == class_id and a.role == ClassRole.subject_teacher.value and a.subject_id
    }


def exam_out(e: Exam) -> ExamOut:
    return ExamOut.model_validate(e)


# ------------------------------------------------------------------ grading
async def load_bands(db: AsyncSession) -> list[tuple[int, str]]:
    """Bands of the active grading scheme, highest minimum first. Empty if the school has none yet."""
    rows = await db.execute(
        select(GradeBand.min_percent, GradeBand.grade)
        .join(GradingScheme, GradingScheme.id == GradeBand.scheme_id)
        .where(GradingScheme.is_active)
        .order_by(GradeBand.min_percent.desc())
    )
    return [(r[0], r[1]) for r in rows.all()]


def grade_for(percentage: float | Decimal | None, bands: list[tuple[int, str]]) -> str | None:
    if percentage is None:
        return None
    for minimum, grade in bands:  # highest first
        if percentage >= minimum:
            return grade
    return None


def check_bands(bands: list[BandIn]) -> None:
    mins = [b.min_percent for b in bands]
    if len(set(mins)) != len(mins):
        raise AppError("Two grades have the same minimum percent.", code="duplicate_band", status=422)
    if 0 not in mins:
        raise AppError("Add a grade that starts at 0 so every mark gets a grade.", code="band_zero_missing", status=422)


async def scheme_out(db: AsyncSession, s: GradingScheme) -> SchemeOut:
    bands = (
        await db.scalars(select(GradeBand).where(GradeBand.scheme_id == s.id).order_by(GradeBand.min_percent.desc()))
    ).all()
    return SchemeOut(id=s.id, name=s.name, is_active=s.is_active, bands=[BandOut.model_validate(b) for b in bands])


def _bands_text(bands: list[tuple[int, str]]) -> str:
    return ", ".join(f"{g} from {m}%" for m, g in bands)


async def _name_free(db: AsyncSession, name: str, except_id: uuid.UUID | None = None) -> None:
    q = select(GradingScheme.id).where(func.lower(GradingScheme.name) == name.lower())
    if except_id:
        q = q.where(GradingScheme.id != except_id)
    if await db.scalar(q):
        raise Conflict("A grading scheme with this name already exists.", code="scheme_exists")


async def create_scheme(
    db: AsyncSession, actor: Actor, name: str, bands: list[BandIn], make_active: bool
) -> GradingScheme:
    check_bands(bands)
    name = name.strip()
    await _name_free(db, name)
    s = GradingScheme(school_id=actor.school_id, name=name, is_active=False)
    db.add(s)
    await db.flush()
    for b in bands:
        db.add(GradeBand(school_id=actor.school_id, scheme_id=s.id, min_percent=b.min_percent, grade=b.grade))
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "grading.created",
        f"Created grading scheme {name}",
        entity_type="grading_scheme",
        entity_id=s.id,
        entity_label=name,
        sensitive=True,
    )
    if make_active:
        await activate_scheme(db, actor, s)
    return s


async def update_scheme(
    db: AsyncSession, actor: Actor, s: GradingScheme, name: str | None, bands: list[BandIn] | None
) -> None:
    changes = []
    if name is not None and name.strip() != s.name:
        await _name_free(db, name.strip(), s.id)
        changes.append(change("name", s.name, name.strip()))
        s.name = name.strip()
    if bands is not None:
        check_bands(bands)
        old = [(b.min_percent, b.grade) for b in (await scheme_out(db, s)).bands]
        new = sorted(((b.min_percent, b.grade) for b in bands), reverse=True)
        if old != new:
            changes.append(change("grades", _bands_text(old), _bands_text(new)))
            await db.execute(delete(GradeBand).where(GradeBand.scheme_id == s.id))
            for m, g in new:
                db.add(GradeBand(school_id=actor.school_id, scheme_id=s.id, min_percent=m, grade=g))
    if changes:
        await db.flush()
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            "grading.changed",
            f"Changed grading scheme {s.name}" + (" (active)" if s.is_active else ""),
            entity_type="grading_scheme",
            entity_id=s.id,
            entity_label=s.name,
            changes=changes,
            sensitive=True,
        )


async def activate_scheme(db: AsyncSession, actor: Actor, s: GradingScheme) -> None:
    if s.is_active:
        return
    others = (await db.scalars(select(GradingScheme).where(GradingScheme.is_active))).all()
    for o in others:
        o.is_active = False
    await db.flush()  # the one-active index needs the old one off first
    s.is_active = True
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "grading.activated",
        f"Grading scheme {s.name} is now the active one",
        entity_type="grading_scheme",
        entity_id=s.id,
        entity_label=s.name,
        changes=[change("active scheme", others[0].name if others else "", s.name)],
        sensitive=True,
    )


# ------------------------------------------------------------------ exams and papers
def _default_pass(max_marks: int, given: int | None) -> int:
    pm = math.ceil(max_marks * 0.33) if given is None else given
    if pm > max_marks:
        raise AppError("Pass marks cannot be more than the maximum.", code="pass_above_max", status=422)
    return pm


async def create_exam(db: AsyncSession, actor: Actor, name: str, year: AcademicYear, starts_on, ends_on) -> Exam:
    _check_dates(starts_on, ends_on)
    if await db.scalar(select(Exam.id).where(Exam.academic_year_id == year.id, func.lower(Exam.name) == name.lower())):
        raise Conflict("An exam with this name already exists in this year.", code="exam_exists")
    e = Exam(
        school_id=actor.school_id, academic_year_id=year.id, name=name.strip(), starts_on=starts_on, ends_on=ends_on
    )
    db.add(e)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "exam.created",
        f"Created exam {e.name} ({year.name})",
        entity_type="exam",
        entity_id=e.id,
        entity_label=e.name,
    )
    return e


def _check_dates(starts_on: date | None, ends_on: date | None) -> None:
    if starts_on and ends_on and ends_on < starts_on:
        raise AppError("The exam cannot end before it starts.", code="bad_dates", status=422)


async def update_exam(db: AsyncSession, actor: Actor, e: Exam, values: dict) -> None:
    changes = []
    starts, ends = values.get("starts_on", e.starts_on), values.get("ends_on", e.ends_on)
    _check_dates(starts, ends)
    for f, v in values.items():
        if f == "name" and v is not None:
            v = v.strip()
            if v.lower() != e.name.lower() and await db.scalar(
                select(Exam.id).where(Exam.academic_year_id == e.academic_year_id, func.lower(Exam.name) == v.lower())
            ):
                raise Conflict("An exam with this name already exists in this year.", code="exam_exists")
        if v != getattr(e, f):
            changes.append(change(f, getattr(e, f), v))
            setattr(e, f, v)
    if changes:
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            "exam.changed",
            f"Changed exam {e.name}",
            entity_type="exam",
            entity_id=e.id,
            entity_label=e.name,
            changes=changes,
        )


async def delete_exam(db: AsyncSession, actor: Actor, e: Exam) -> None:
    has_marks = await db.scalar(
        select(Result.id)
        .join(ExamSubject, ExamSubject.id == Result.exam_subject_id)
        .where(ExamSubject.exam_id == e.id)
        .limit(1)
    )
    if has_marks or await db.scalar(select(ExamPublication.id).where(ExamPublication.exam_id == e.id).limit(1)):
        raise Conflict("This exam already has marks, so it cannot be deleted.", code="exam_has_marks")
    await db.execute(delete(ExamSubject).where(ExamSubject.exam_id == e.id))
    await db.delete(e)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "exam.deleted",
        f"Deleted exam {e.name}",
        entity_type="exam",
        entity_id=e.id,
        entity_label=e.name,
    )


async def set_papers(
    db: AsyncSession, actor: Actor, exam: Exam, class_ids: list[uuid.UUID], papers: list[PaperIn]
) -> list[ExamSubject]:
    """Replace the papers of these classes with `papers`. A paper that already has marks cannot be removed or
    set below a mark; a class whose results are published cannot be changed until it is unpublished."""
    if len({p.subject_id for p in papers}) != len(papers):
        raise AppError("A subject is listed twice.", code="duplicate_subject", status=422)
    subjects = {
        s.id: s for s in (await db.scalars(select(Subject).where(Subject.id.in_([p.subject_id for p in papers])))).all()
    }
    if len(subjects) != len(papers):
        raise NotFound("Subject not found.")
    out: list[ExamSubject] = []
    for cid in dict.fromkeys(class_ids):
        cls = await get_class_or_404(db, cid)
        if cls.academic_year_id != exam.academic_year_id:
            raise AppError(
                f"Class {class_label(cls)} is not in this exam's academic year.", code="wrong_year", status=422
            )
        if await db.scalar(
            select(ExamPublication.id).where(ExamPublication.exam_id == exam.id, ExamPublication.class_id == cid)
        ):
            raise Conflict(
                f"Results of {class_label(cls)} are published. Unpublish them before changing papers.",
                code="published_locked",
            )
        studied = set((await db.scalars(select(ClassSubject.subject_id).where(ClassSubject.class_id == cid))).all())
        for p in papers:
            if p.subject_id not in studied:
                raise AppError(
                    f"{subjects[p.subject_id].name} is not a subject of class {class_label(cls)}.",
                    code="subject_not_in_class",
                    status=422,
                )
        existing = {
            e.subject_id: e
            for e in (
                await db.scalars(select(ExamSubject).where(ExamSubject.exam_id == exam.id, ExamSubject.class_id == cid))
            ).all()
        }
        wanted = {p.subject_id: p for p in papers}
        changes = []
        for sid, e in existing.items():
            highest = await db.scalar(select(func.max(Result.marks_obtained)).where(Result.exam_subject_id == e.id))
            has_rows = await db.scalar(select(Result.id).where(Result.exam_subject_id == e.id).limit(1))
            if sid not in wanted:
                if has_rows:
                    raise Conflict(
                        f"{await _subject_name(db, sid)} already has marks in "
                        f"{class_label(cls)}, so the paper cannot be removed.",
                        code="paper_has_marks",
                    )
                await db.delete(e)
                changes.append(change(f"{class_label(cls)} paper", await _subject_name(db, sid), "removed"))
            else:
                w = wanted[sid]
                pm = _default_pass(w.max_marks, w.pass_marks)
                if highest is not None and highest > w.max_marks:
                    raise Conflict(
                        f"A mark is already above {w.max_marks}, so the maximum cannot be lowered.",
                        code="marks_above_max",
                    )
                if (e.max_marks, e.pass_marks) != (w.max_marks, pm):
                    changes.append(
                        change(
                            f"{class_label(cls)} {subjects[sid].name} max/pass",
                            f"{e.max_marks}/{e.pass_marks}",
                            f"{w.max_marks}/{pm}",
                        )
                    )
                    e.max_marks, e.pass_marks = w.max_marks, pm
                out.append(e)
        for sid, w in wanted.items():
            if sid not in existing:
                pm = _default_pass(w.max_marks, w.pass_marks)
                e = ExamSubject(
                    school_id=actor.school_id,
                    exam_id=exam.id,
                    class_id=cid,
                    subject_id=sid,
                    max_marks=w.max_marks,
                    pass_marks=pm,
                )
                db.add(e)
                out.append(e)
                changes.append(change(f"{class_label(cls)} paper", "", f"{subjects[sid].name} ({w.max_marks})"))
        if changes:
            await db.flush()
            log_audit(
                db,
                actor,
                AuditCategory.academic,
                "exam.papers_changed",
                f"Changed the papers of {exam.name} for class {class_label(cls)}",
                entity_type="exam",
                entity_id=exam.id,
                entity_label=exam.name,
                changes=changes,
            )
    await db.flush()
    return out


async def _subject_name(db: AsyncSession, subject_id: uuid.UUID) -> str:
    return await db.scalar(select(Subject.name).where(Subject.id == subject_id)) or "Subject"


async def papers_of(
    db: AsyncSession,
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    editable: set[uuid.UUID] | None = None,
    locked: bool = False,
) -> list[PaperOut]:
    """Papers of one class. `can_edit` says whether the caller may enter marks (None = all subjects)."""
    rows = (
        await db.execute(
            select(ExamSubject, Subject.name)
            .join(Subject, Subject.id == ExamSubject.subject_id)
            .where(ExamSubject.exam_id == exam_id, ExamSubject.class_id == class_id)
            .order_by(Subject.name)
        )
    ).all()
    out = []
    for e, name in rows:
        if editable is None:
            can = True
        else:
            can = e.subject_id in editable and not locked
        out.append(
            PaperOut(
                id=e.id,
                class_id=e.class_id,
                subject_id=e.subject_id,
                subject=name,
                max_marks=e.max_marks,
                pass_marks=e.pass_marks,
                can_edit=can,
            )
        )
    return out


async def class_statuses(db: AsyncSession, p: Principal, exam: Exam) -> list[ExamClassStatus]:
    classes = (
        await db.scalars(
            select(SchoolClass)
            .where(SchoolClass.id.in_(select(ExamSubject.class_id).where(ExamSubject.exam_id == exam.id)))
            .order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section)
        )
    ).all()
    out = []
    for c in classes:
        if not can_view_class(p, c.id):
            continue
        papers = await db.scalar(
            select(func.count())
            .select_from(ExamSubject)
            .where(ExamSubject.exam_id == exam.id, ExamSubject.class_id == c.id)
        )
        students = await db.scalar(
            select(func.count())
            .select_from(Enrollment)
            .where(
                Enrollment.class_id == c.id,
                Enrollment.academic_year_id == exam.academic_year_id,
                Enrollment.status == EnrollmentStatus.active.value,
            )
        )
        entered = await db.scalar(
            select(func.count())
            .select_from(Result)
            .join(ExamSubject, ExamSubject.id == Result.exam_subject_id)
            .join(Enrollment, Enrollment.id == Result.enrollment_id)
            .where(
                ExamSubject.exam_id == exam.id,
                ExamSubject.class_id == c.id,
                Enrollment.status == EnrollmentStatus.active.value,
            )
        )
        pub = await db.scalar(
            select(ExamPublication.published_at).where(
                ExamPublication.exam_id == exam.id, ExamPublication.class_id == c.id
            )
        )
        out.append(
            ExamClassStatus(
                class_id=c.id,
                class_name=class_label(c),
                papers=papers or 0,
                students=students or 0,
                entered=entered or 0,
                expected=(papers or 0) * (students or 0),
                published_at=pub,
            )
        )
    return out


# ------------------------------------------------------------------ marks entry
def _mark_text(marks: Decimal | None, absent: bool) -> str:
    if absent:
        return "absent"
    return "" if marks is None else format(marks.normalize(), "f")


async def save_marks(
    db: AsyncSession, actor: Actor, p: Principal, exam: Exam, cls: SchoolClass, entries: list[MarkIn]
) -> tuple[int, int]:
    """Enter or edit marks. Returns (saved, cleared). Marks of a subject can be entered by the class teacher or that
    subject's teacher; after publication only the class teacher may change them (audited as a sensitive edit)."""
    scope = editable_subjects(p, cls.id)
    if scope is not None and not scope:
        raise Forbidden("Only the class teacher or the subject teacher can enter marks.", code="not_your_class")
    published = await db.scalar(
        select(ExamPublication.id).where(ExamPublication.exam_id == exam.id, ExamPublication.class_id == cls.id)
    )
    if published and scope is not None:
        raise Forbidden("The results are published. Only the class teacher can change them.", code="published_locked")
    papers = {
        e.subject_id: e
        for e in (
            await db.scalars(select(ExamSubject).where(ExamSubject.exam_id == exam.id, ExamSubject.class_id == cls.id))
        ).all()
    }
    seen: set[tuple] = set()
    for m in entries:
        if (m.enrollment_id, m.subject_id) in seen:
            raise AppError("The same student and subject appears twice.", code="duplicate_entry", status=422)
        seen.add((m.enrollment_id, m.subject_id))
        if m.subject_id not in papers:
            raise AppError("This exam has no paper for that subject in this class.", code="no_such_paper", status=422)
        if scope is not None and m.subject_id not in scope:
            raise Forbidden("You can only enter marks for your own subject.", code="not_your_subject")
        if m.absent and m.marks_obtained is not None:
            raise AppError("An absent student cannot have marks.", code="absent_with_marks", status=422)
        if m.marks_obtained is not None and m.marks_obtained > papers[m.subject_id].max_marks:
            raise AppError(
                f"Marks cannot be more than {papers[m.subject_id].max_marks}.",
                code="marks_above_max",
                status=422,
                details={"enrollment_id": str(m.enrollment_id), "subject_id": str(m.subject_id)},
            )
    ids = {m.enrollment_id for m in entries}
    people = {
        e.id: (e, s)
        for e, s in (
            await db.execute(
                select(Enrollment, Student)
                .join(Student, Student.id == Enrollment.student_id)
                .where(Enrollment.id.in_(ids))
            )
        ).all()
    }
    for i in ids:
        row = people.get(i)
        if (
            row is None
            or row[0].class_id != cls.id
            or row[0].academic_year_id != exam.academic_year_id
            or row[0].status != EnrollmentStatus.active.value
        ):
            raise AppError("A student is not an active member of this class.", code="student_not_in_class", status=422)
    existing = {
        (r.enrollment_id, r.exam_subject_id): r
        for r in (
            await db.scalars(
                select(Result).where(
                    Result.enrollment_id.in_(ids), Result.exam_subject_id.in_([e.id for e in papers.values()])
                )
            )
        ).all()
    }
    subj_name = {s.id: s.name for s in (await db.scalars(select(Subject).where(Subject.id.in_(papers.keys())))).all()}
    bands = await load_bands(db)
    now = utcnow()
    saved = cleared = 0
    changes: list[dict] = []
    edited_existing = False
    for m in entries:
        paper = papers[m.subject_id]
        row = existing.get((m.enrollment_id, paper.id))
        who = f"{full_name(people[m.enrollment_id][1])} / {subj_name[m.subject_id]}"
        remarks = (m.remarks or "").strip() or None
        if m.marks_obtained is None and not m.absent:
            if row is not None:
                changes.append(change(who, _mark_text(row.marks_obtained, row.absent), ""))
                await db.delete(row)
                cleared += 1
                edited_existing = True
            continue
        marks = None if m.absent else m.marks_obtained.quantize(Decimal("0.01"), ROUND_HALF_UP)
        pct = Decimal(0) if marks is None else marks * 100 / paper.max_marks
        grade = grade_for(pct, bands)
        if row is None:
            db.add(
                Result(
                    school_id=actor.school_id,
                    exam_subject_id=paper.id,
                    enrollment_id=m.enrollment_id,
                    marks_obtained=marks,
                    absent=m.absent,
                    grade=grade,
                    remarks=remarks,
                    entered_by=actor.id,
                    entered_at=now,
                )
            )
            changes.append(change(who, "", _mark_text(marks, m.absent)))
            saved += 1
        elif (row.marks_obtained, row.absent, row.remarks) != (marks, m.absent, remarks):
            changes.append(change(who, _mark_text(row.marks_obtained, row.absent), _mark_text(marks, m.absent)))
            row.marks_obtained, row.absent, row.remarks, row.grade = marks, m.absent, remarks, grade
            row.entered_by, row.entered_at = actor.id, now
            saved += 1
            edited_existing = True
    if changes:
        await db.flush()
        after_publish = bool(published)
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            "results.edited" if (edited_existing or after_publish) else "results.entered",
            f"{'Edited' if edited_existing or after_publish else 'Entered'} marks of {exam.name} for class "
            f"{class_label(cls)}{' after publication' if after_publish else ''} ({len(changes)} changes)",
            entity_type="exam",
            entity_id=exam.id,
            entity_label=f"{exam.name} {class_label(cls)}",
            changes=changes,
            sensitive=after_publish,
        )
    return saved, cleared


async def save_remarks(
    db: AsyncSession, actor: Actor, p: Principal, exam: Exam, cls: SchoolClass, items: list[RemarkIn]
) -> int:
    if not p.is_class_teacher_of(cls.id):
        raise Forbidden("Only the class teacher writes report card remarks.", code="class_teacher_only")
    ids = {i.enrollment_id for i in items}
    people = {
        e.id: (e, s)
        for e, s in (
            await db.execute(
                select(Enrollment, Student)
                .join(Student, Student.id == Enrollment.student_id)
                .where(Enrollment.id.in_(ids))
            )
        ).all()
    }
    for i in ids:
        row = people.get(i)
        if row is None or row[0].class_id != cls.id or row[0].academic_year_id != exam.academic_year_id:
            raise AppError("A student is not in this class.", code="student_not_in_class", status=422)
    existing = {
        r.enrollment_id: r
        for r in (
            await db.scalars(
                select(ReportRemark).where(ReportRemark.exam_id == exam.id, ReportRemark.enrollment_id.in_(ids))
            )
        ).all()
    }
    changes = []
    for it in items:
        text = it.remark.strip()
        row = existing.get(it.enrollment_id)
        name = full_name(people[it.enrollment_id][1])
        if row is None and text:
            db.add(
                ReportRemark(school_id=actor.school_id, exam_id=exam.id, enrollment_id=it.enrollment_id, remark=text)
            )
            changes.append(change(f"{name} remark", "", text))
        elif row is not None and not text:
            changes.append(change(f"{name} remark", row.remark, ""))
            await db.delete(row)
        elif row is not None and row.remark != text:
            changes.append(change(f"{name} remark", row.remark, text))
            row.remark = text
    if changes:
        await db.flush()
        log_audit(
            db,
            actor,
            AuditCategory.academic,
            "results.remarks_changed",
            f"Changed report card remarks of {exam.name} for class {class_label(cls)}",
            entity_type="exam",
            entity_id=exam.id,
            entity_label=f"{exam.name} {class_label(cls)}",
            changes=changes,
        )
    return len(changes)


# ------------------------------------------------------------------ sheets (computation)
def _f(d: Decimal | None) -> float | None:
    return None if d is None else float(d)


async def class_sheet(
    db: AsyncSession,
    exam: Exam,
    cls: SchoolClass,
    p: Principal | None = None,
    bands: list[tuple[int, str]] | None = None,
) -> ClassSheet:
    """Marks, totals, percentage, grade, pass and rank of every student of a class in an exam. With a principal the
    papers carry `can_edit`."""
    bands = await load_bands(db) if bands is None else bands
    pub = await db.scalar(
        select(ExamPublication.published_at).where(
            ExamPublication.exam_id == exam.id, ExamPublication.class_id == cls.id
        )
    )
    editable = editable_subjects(p, cls.id) if p is not None else set()
    papers = await papers_of(db, exam.id, cls.id, editable, locked=pub is not None)
    results: dict[tuple[uuid.UUID, uuid.UUID], Result] = {}
    if papers:
        for r in (await db.scalars(select(Result).where(Result.exam_subject_id.in_([x.id for x in papers])))).all():
            results[(r.enrollment_id, r.exam_subject_id)] = r
    people = (
        await db.execute(
            select(Enrollment, Student)
            .join(Student, Student.id == Enrollment.student_id)
            .where(Enrollment.class_id == cls.id, Enrollment.academic_year_id == exam.academic_year_id)
            .order_by(Enrollment.roll_no.nulls_last(), Student.first_name, Student.last_name)
        )
    ).all()
    remarks = {
        r.enrollment_id: r.remark
        for r in (await db.scalars(select(ReportRemark).where(ReportRemark.exam_id == exam.id))).all()
    }
    max_total = sum(x.max_marks for x in papers)
    rows: list[StudentRow] = []
    totals: list[Decimal] = []
    for enr, stu in people:
        has_any = any((enr.id, x.id) in results for x in papers)
        if enr.status == EnrollmentStatus.left.value and not has_any:
            continue
        cells, total, entered, ok = [], Decimal(0), 0, True
        for x in papers:
            r = results.get((enr.id, x.id))
            if r is None:
                cells.append(
                    MarkCell(
                        subject_id=x.subject_id,
                        marks_obtained=None,
                        absent=False,
                        entered=False,
                        grade=None,
                        passed=None,
                        remarks=None,
                    )
                )
                continue
            entered += 1
            marks = r.marks_obtained
            total += marks or Decimal(0)
            pct = Decimal(0) if marks is None else marks * 100 / x.max_marks
            passed = (not r.absent) and marks is not None and marks >= x.pass_marks
            ok = ok and passed
            cells.append(
                MarkCell(
                    subject_id=x.subject_id,
                    marks_obtained=_f(marks),
                    absent=r.absent,
                    entered=True,
                    grade=grade_for(pct, bands),
                    passed=passed,
                    remarks=r.remarks,
                )
            )
        complete = bool(papers) and entered == len(papers)
        pct = (total * 100 / max_total).quantize(Decimal("0.01"), ROUND_HALF_UP) if max_total and has_any else None
        rows.append(
            StudentRow(
                enrollment_id=enr.id,
                student_id=stu.id,
                scholar_no=stu.scholar_no,
                name=full_name(stu),
                roll_no=enr.roll_no,
                marks=cells,
                total=float(total),
                max_total=max_total,
                percentage=_f(pct),
                grade=grade_for(pct, bands) if complete else None,
                passed=ok if complete else None,
                complete=complete,
                rank=None,
                remark=remarks.get(enr.id),
            )
        )
        if complete and enr.status != EnrollmentStatus.left.value:
            totals.append(total)
    for row in rows:
        if row.complete:
            row.rank = 1 + sum(1 for t in totals if float(t) > row.total)
    return ClassSheet(
        exam=exam_out(exam),
        class_id=cls.id,
        class_name=class_label(cls),
        papers=papers,
        students=rows,
        published_at=pub,
        grading=[BandOut(min_percent=m, grade=g) for m, g in bands],
    )


async def enrollment_for_exam(db: AsyncSession, exam: Exam, student_id: uuid.UUID) -> Enrollment:
    e = await db.scalar(
        select(Enrollment).where(
            Enrollment.student_id == student_id, Enrollment.academic_year_id == exam.academic_year_id
        )
    )
    if e is None:
        raise NotFound("This student has no results in this exam.")
    return e


async def student_result(
    db: AsyncSession, exam: Exam, enrollment: Enrollment, *, require_published: bool = False
) -> tuple[StudentResult, ClassSheet]:
    cls = await get_class_or_404(db, enrollment.class_id)
    sheet = await class_sheet(db, exam, cls)
    if not sheet.papers or (require_published and sheet.published_at is None):
        raise NotFound("Results are not available.")
    row = next((r for r in sheet.students if r.enrollment_id == enrollment.id), None)
    if row is None:
        raise NotFound("Results are not available.")
    stu = await db.get(Student, enrollment.student_id)
    res = StudentResult(
        exam=sheet.exam,
        student_id=row.student_id,
        scholar_no=row.scholar_no,
        name=row.name,
        class_name=sheet.class_name,
        roll_no=row.roll_no,
        papers=sheet.papers,
        marks=row.marks,
        total=row.total,
        max_total=row.max_total,
        percentage=row.percentage,
        grade=row.grade,
        passed=row.passed,
        complete=row.complete,
        rank=row.rank,
        class_size=sum(1 for r in sheet.students if r.complete),
        remark=row.remark,
        published_at=sheet.published_at,
    )
    assert stu is not None
    return res, sheet


async def report_card(
    db: AsyncSession, exam: Exam, enrollment: Enrollment, *, require_published: bool = False
) -> ReportCard:
    """Report card as JSON (the PDF is rendered by the client). Attendance covers the academic year so far: from
    its first day to the end of the exam (or today, whichever is earlier; never past the year's end)."""
    res, sheet = await student_result(db, exam, enrollment, require_published=require_published)
    school = await db.get(School, exam.school_id)
    year = await db.get(AcademicYear, exam.academic_year_id)
    attendance = None
    if year is not None:
        to_on = min(exam.ends_on or today_ist(), year.ends_on, max(today_ist(), year.starts_on))
        stats = await period_stats_for_enrollment(db, enrollment.id, year.starts_on, to_on)
        attendance = {**stats.model_dump(), "from_on": year.starts_on, "to_on": to_on}
    return ReportCard(
        **res.model_dump(),
        school_name=school.name if school else "",
        academic_year=year.name if year else "",
        grading=sheet.grading,
        attendance=attendance,
        generated_at=utcnow(),
    )


async def parent_exams(db: AsyncSession, student_id: uuid.UUID) -> list[ParentExamRow]:
    """Published exams of one child (only published ones, newest first)."""
    rows = (
        await db.execute(
            select(Exam, Enrollment, ExamPublication.published_at)
            .join(
                Enrollment,
                (Enrollment.academic_year_id == Exam.academic_year_id) & (Enrollment.student_id == student_id),
            )
            .join(
                ExamPublication,
                (ExamPublication.exam_id == Exam.id) & (ExamPublication.class_id == Enrollment.class_id),
            )
            .order_by(ExamPublication.published_at.desc())
        )
    ).all()
    out = []
    for exam, enr, published_at in rows:
        res, _ = await student_result(db, exam, enr, require_published=True)
        out.append(
            ParentExamRow(
                exam=res.exam,
                class_name=res.class_name,
                published_at=published_at,
                percentage=res.percentage,
                grade=res.grade,
                rank=res.rank,
                passed=res.passed,
            )
        )
    return out


# ------------------------------------------------------------------ publish
async def _notify_results_published(
    db: AsyncSession, exam: Exam, cls: SchoolClass, student_ids: list[uuid.UUID]
) -> None:
    """Results published. For each student id in `student_ids`, send every parent login from
    `guardians.guardian_user_ids_of_student(db, student_id)` a notification of type `result`:
    "Results of {exam.name} are out for {Name}"."""
    for sid in student_ids:
        stu = await db.get(Student, sid)
        if stu is None:
            continue
        await notify_guardians_of_student(
            db,
            sid,
            kind="result",
            **render("result", exam=exam.name, name=stu.first_name).kw(),
            data={"exam_id": exam.id, "class_id": cls.id},
            dedupe_key=f"result:{exam.id}",
        )


async def publish(db: AsyncSession, actor: Actor, p: Principal, exam: Exam, cls: SchoolClass) -> ClassSheet:
    if not p.is_class_teacher_of(cls.id):
        raise Forbidden("Only the class teacher can publish results.", code="class_teacher_only")
    if await db.scalar(
        select(ExamPublication.id).where(ExamPublication.exam_id == exam.id, ExamPublication.class_id == cls.id)
    ):
        raise Conflict("These results are already published.", code="already_published")
    sheet = await class_sheet(db, exam, cls)
    if not sheet.papers:
        raise Conflict("This exam has no papers for this class yet.", code="no_papers")
    left = set(
        (
            await db.scalars(
                select(Enrollment.id).where(
                    Enrollment.class_id == cls.id, Enrollment.status == EnrollmentStatus.left.value
                )
            )
        ).all()
    )
    live = [r for r in sheet.students if r.enrollment_id not in left]
    if not live:
        raise Conflict("This class has no students.", code="no_students")
    missing = [{"student": r.name, "missing": sum(1 for c in r.marks if not c.entered)} for r in live if not r.complete]
    if missing:
        raise Conflict(
            f"Marks are missing for {len(missing)} student(s). Enter marks or mark them absent first.",
            code="marks_incomplete",
            details=missing,
        )
    now = utcnow()
    db.add(
        ExamPublication(
            school_id=actor.school_id, exam_id=exam.id, class_id=cls.id, published_at=now, published_by=actor.id
        )
    )
    for r in live:
        db.add(
            ReportCardRow(
                school_id=actor.school_id,
                enrollment_id=r.enrollment_id,
                exam_id=exam.id,
                published_at=now,
                published_by=actor.id,
            )
        )
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "results.published",
        f"Published {exam.name} results of class {class_label(cls)} ({len(live)} students)",
        entity_type="exam",
        entity_id=exam.id,
        entity_label=f"{exam.name} {class_label(cls)}",
        sensitive=True,
    )
    await db.flush()
    await _notify_results_published(db, exam, cls, [r.student_id for r in live])
    sheet.published_at = now
    return sheet


async def unpublish(db: AsyncSession, actor: Actor, p: Principal, exam: Exam, cls: SchoolClass) -> None:
    if not p.is_class_teacher_of(cls.id):
        raise Forbidden("Only the class teacher can unpublish results.", code="class_teacher_only")
    pub = await db.scalar(
        select(ExamPublication).where(ExamPublication.exam_id == exam.id, ExamPublication.class_id == cls.id)
    )
    if pub is None:
        raise Conflict("These results are not published.", code="not_published")
    await db.delete(pub)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "results.unpublished",
        f"Unpublished {exam.name} results of class {class_label(cls)}",
        entity_type="exam",
        entity_id=exam.id,
        entity_label=f"{exam.name} {class_label(cls)}",
        sensitive=True,
    )


# ------------------------------------------------------------------ Excel
def sheet_table(sheet: ClassSheet) -> tuple[list[str], list[list]]:
    headers = ["Rank", "Roll No", "Scholar No", "Name"]
    for x in sheet.papers:
        headers.append(f"{x.subject} (/{x.max_marks})")
    headers += ["Total", "Maximum", "Percentage", "Grade", "Result", "Remark"]
    rows = []
    for r in sheet.students:
        cells = {c.subject_id: c for c in r.marks}
        line: list = [r.rank, r.roll_no, r.scholar_no, r.name]
        for x in sheet.papers:
            c = cells[x.subject_id]
            line.append("AB" if c.absent else c.marks_obtained)
        result = None if r.passed is None else ("Pass" if r.passed else "Fail")
        line += [r.total, r.max_total, r.percentage, r.grade, result, r.remark]
        rows.append(line)
    return headers, rows
