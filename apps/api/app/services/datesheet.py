"""Exam date sheet (erd v5): academic.manage publishes, per class a date and start time for each subject.
Parents of the classes it covers see it once published."""

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.academic import ClassSubject, SchoolClass, Subject
from app.models.enums import AuditCategory
from app.models.results import Exam, ExamPaper, ExamSchedule
from app.models.student import Enrollment
from app.schemas.results import ParentSchedule, SchedulePaperIn, SchedulePaperOut
from app.services.audit import Actor, log_audit
from app.services.students import class_label


async def get_schedule_or_404(db: AsyncSession, schedule_id: uuid.UUID) -> ExamSchedule:
    s = await db.get(ExamSchedule, schedule_id)
    if s is None:
        raise NotFound("Date sheet not found.")
    return s


async def create_schedule(db: AsyncSession, actor: Actor, name: str, exam_id: uuid.UUID | None) -> ExamSchedule:
    if exam_id is not None and await db.get(Exam, exam_id) is None:
        raise NotFound("Exam not found.")
    s = ExamSchedule(school_id=actor.school_id, name=name.strip(), exam_id=exam_id, created_by=actor.id)
    db.add(s)
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "datesheet.created",
        f"Created exam date sheet {s.name}",
        entity_type="exam_schedule",
        entity_id=s.id,
        entity_label=s.name,
    )
    return s


async def set_papers(db: AsyncSession, actor: Actor, s: ExamSchedule, papers: list[SchedulePaperIn]) -> None:
    """Replaces every paper of the sheet. A published sheet can be corrected in place (parents see the change)."""
    keys = {(p.class_id, p.subject_id) for p in papers}
    if len(keys) != len(papers):
        raise AppError("A class has the same subject twice.", code="duplicate_paper", status=422)
    classes = {
        c.id: c
        for c in (await db.scalars(select(SchoolClass).where(SchoolClass.id.in_({p.class_id for p in papers})))).all()
    }
    subjects = {
        x.id: x for x in (await db.scalars(select(Subject).where(Subject.id.in_({p.subject_id for p in papers})))).all()
    }
    studied = set((await db.execute(select(ClassSubject.class_id, ClassSubject.subject_id))).all())
    for p in papers:
        if p.class_id not in classes or p.subject_id not in subjects:
            raise NotFound("Class or subject not found.")
        if (p.class_id, p.subject_id) not in studied:
            raise AppError(
                f"{subjects[p.subject_id].name} is not a subject of class {class_label(classes[p.class_id])}.",
                code="subject_not_in_class",
                status=422,
            )
    await db.execute(delete(ExamPaper).where(ExamPaper.schedule_id == s.id))
    for p in papers:
        db.add(
            ExamPaper(
                school_id=actor.school_id,
                schedule_id=s.id,
                class_id=p.class_id,
                subject_id=p.subject_id,
                paper_on=p.paper_on,
                starts_at=p.starts_at,
            )
        )
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "datesheet.papers_set",
        f"Set {len(papers)} papers on date sheet {s.name}" + (" (published)" if s.published_at else ""),
        entity_type="exam_schedule",
        entity_id=s.id,
        entity_label=s.name,
    )


async def _notify_datesheet_published(db: AsyncSession, s: ExamSchedule, class_ids: list[uuid.UUID]) -> None:
    """NOTIFY: exam date sheet published. For every active student of `class_ids`, notify each parent login from
    `guardians.guardian_user_ids_of_student(db, student_id)` (type `exam`): "Date sheet for {s.name} is out".
    Does nothing until the notifications service is wired."""
    return None


async def publish(db: AsyncSession, actor: Actor, s: ExamSchedule) -> None:
    if s.published_at is not None:
        raise Conflict("This date sheet is already published.", code="already_published")
    class_ids = list(
        (await db.scalars(select(ExamPaper.class_id).where(ExamPaper.schedule_id == s.id).distinct())).all()
    )
    if not class_ids:
        raise Conflict("Add at least one paper before publishing.", code="no_papers")
    s.published_at = utcnow()
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "datesheet.published",
        f"Published exam date sheet {s.name}",
        entity_type="exam_schedule",
        entity_id=s.id,
        entity_label=s.name,
    )
    await db.flush()
    await _notify_datesheet_published(db, s, class_ids)


async def unpublish(db: AsyncSession, actor: Actor, s: ExamSchedule) -> None:
    if s.published_at is None:
        raise Conflict("This date sheet is not published.", code="not_published")
    s.published_at = None
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "datesheet.unpublished",
        f"Unpublished exam date sheet {s.name}",
        entity_type="exam_schedule",
        entity_id=s.id,
        entity_label=s.name,
    )


async def delete_schedule(db: AsyncSession, actor: Actor, s: ExamSchedule) -> None:
    if s.published_at is not None:
        raise Conflict("Unpublish the date sheet before deleting it.", code="published")
    await db.execute(delete(ExamPaper).where(ExamPaper.schedule_id == s.id))
    await db.delete(s)
    log_audit(
        db,
        actor,
        AuditCategory.academic,
        "datesheet.deleted",
        f"Deleted exam date sheet {s.name}",
        entity_type="exam_schedule",
        entity_id=s.id,
        entity_label=s.name,
    )


async def paper_count(db: AsyncSession, schedule_id: uuid.UUID) -> int:
    return await db.scalar(select(func.count()).select_from(ExamPaper).where(ExamPaper.schedule_id == schedule_id)) or 0


async def items(
    db: AsyncSession, schedule_id: uuid.UUID, class_ids: set[uuid.UUID] | None = None
) -> list[SchedulePaperOut]:
    q = (
        select(ExamPaper, SchoolClass, Subject.name)
        .join(SchoolClass, SchoolClass.id == ExamPaper.class_id)
        .join(Subject, Subject.id == ExamPaper.subject_id)
        .where(ExamPaper.schedule_id == schedule_id)
        .order_by(
            ExamPaper.paper_on, ExamPaper.starts_at, SchoolClass.display_order, SchoolClass.grade, SchoolClass.section
        )
    )
    if class_ids is not None:
        q = q.where(ExamPaper.class_id.in_(class_ids))
    return [
        SchedulePaperOut(
            class_id=c.id,
            class_name=class_label(c),
            subject_id=e.subject_id,
            subject=name,
            paper_on=e.paper_on,
            starts_at=e.starts_at,
        )
        for e, c, name in (await db.execute(q)).all()
    ]


async def for_child(db: AsyncSession, student_id: uuid.UUID) -> list[ParentSchedule]:
    """Published date sheets with the papers of the classes this child is enrolled in."""
    class_ids = set((await db.scalars(select(Enrollment.class_id).where(Enrollment.student_id == student_id))).all())
    if not class_ids:
        return []
    sheets = (
        await db.scalars(
            select(ExamSchedule)
            .where(
                ExamSchedule.published_at.is_not(None),
                ExamSchedule.id.in_(select(ExamPaper.schedule_id).where(ExamPaper.class_id.in_(class_ids))),
            )
            .order_by(ExamSchedule.published_at.desc())
        )
    ).all()
    return [
        ParentSchedule(id=s.id, name=s.name, published_at=s.published_at, items=await items(db, s.id, class_ids))
        for s in sheets
    ]
