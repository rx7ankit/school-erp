"""Teacher-wise and subject-wise analytics (one coherent view), computed with a handful of grouped queries.

Who is a teacher: an active staff member with at least one `class_staff` assignment (class teacher or subject teacher)
in the chosen academic year. The admin or an accountant without an assignment never appears; an admin who also teaches
appears with their real assignments only (`attendance_analytics.teaching_assignments`).

Numbers (all computed on read, nothing stored):
  class attendance   the attendance % (half days = 0.5, holidays excluded, as everywhere) of a class in from..to. For a
                     class teacher it is "their" class; for a subject teacher it is the attendance of the classes they
                     teach. `class_attendance_percentage` = classes they are class teacher of, units-weighted;
                     `taught_attendance_percentage` = every class they teach.
  results            the same rule as `services.analytics.teacher_results`: built from `results.class_sheet`, so
                     every entered mark counts, published or not (`published` is returned per row). A subject
                     teacher: marks of their subject in that class (average of marks/max, pass = at or above the paper's
                     pass mark). A class teacher: students with every paper entered (total percentage, passed
                     every paper).
  improvement        average minus the same figure in the previous exam of the same year (the exam before it by end
                     date, then creation), in percentage points; null when either side is missing.
  staff attendance   from `staff_attendance`: present / days recorded.
  feedback           only from requests that have closed AND have share_with_teachers; the latest such request that
                     rated them in this year. Only the average and the response count are returned, never comments,
                     guardians or students. Everyone (admin included) is held to the same rule.
Who sees what: admin, `academic.manage` and `staff.manage` see every teacher; any other teacher only their own row.
Subject-wise: admin and `academic.manage` see every class, any other teacher the classes they are assigned to.
"""

import uuid
from collections import defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist
from app.core.errors import NotFound
from app.core.principal import Principal
from app.models.academic import AcademicYear, SchoolClass, Subject
from app.models.attendance import AttendanceDay, AttendanceRecord, StaffAttendance
from app.models.enums import ClassRole, FeedbackStatus
from app.models.results import Exam, ExamPublication, ExamSubject, FeedbackRequest, FeedbackResponse, FeedbackTarget
from app.models.user import StaffProfile
from app.schemas.analytics import (
    ClassFigure,
    SubjectWise,
    SubjectWiseRow,
    TeacherAssignmentOut,
    TeacherFeedbackOut,
    TeacherStaffAttendance,
    TeacherSubjectOut,
    TeacherWise,
    TeacherWiseRow,
)
from app.services.analytics import _mean, _rate, _sheets, can_see_teacher_wise, results_scope
from app.services.attendance import not_holiday, pct, unit_columns
from app.services.attendance_analytics import teaching_assignments
from app.services.feedback import effective_status
from app.services.results import class_sheet, load_bands
from app.services.students import class_label, current_year_or_none

R, D = AttendanceRecord, AttendanceDay


async def _year(db: AsyncSession, year_id: uuid.UUID | None) -> AcademicYear | None:
    if year_id:
        y = await db.get(AcademicYear, year_id)
        if y is None:
            raise NotFound("Academic year not found.")
        return y
    return await current_year_or_none(db)


async def _exams_of(db: AsyncSession, year_id: uuid.UUID, class_ids: set[uuid.UUID]) -> list[Exam]:
    """Exams of the year that have papers in these classes, oldest first (end date, then creation)."""
    if not class_ids:
        return []
    return list(
        (
            await db.scalars(
                select(Exam)
                .where(
                    Exam.academic_year_id == year_id,
                    Exam.id.in_(select(ExamSubject.exam_id).where(ExamSubject.class_id.in_(class_ids))),
                )
                .order_by(Exam.ends_on.asc().nulls_first(), Exam.created_at.asc())
            )
        ).all()
    )


async def _pick(
    db: AsyncSession, year: AcademicYear, exam_id: uuid.UUID | None, class_ids: set[uuid.UUID]
) -> tuple[Exam | None, Exam | None]:
    """(the asked exam or the latest of the year, the exam before it)."""
    exams = await _exams_of(db, year.id, class_ids)
    if exam_id:
        exam = await db.get(Exam, exam_id)
        if exam is None or exam.academic_year_id != year.id:
            raise NotFound("Exam not found.")
        ids = [e.id for e in exams]
        i = ids.index(exam.id) if exam.id in ids else 0
        return exam, (exams[i - 1] if exam.id in ids and i > 0 else None)
    if not exams:
        return None, None
    return exams[-1], (exams[-2] if len(exams) > 1 else None)


def _figures(sheet) -> dict[uuid.UUID | None, tuple[float | None, float | None, int]]:
    """{subject_id: (average %, pass %, students)}; the key None is the whole class (students with every paper)."""
    out: dict[uuid.UUID | None, tuple[float | None, float | None, int]] = {}
    done = [s for s in sheet.students if s.complete and s.percentage is not None]
    out[None] = (_mean([s.percentage for s in done]), _rate(sum(1 for s in done if s.passed), len(done)), len(done))
    maxes = {x.subject_id: x.max_marks for x in sheet.papers}
    for sid, mx in maxes.items():
        cells = [c for s in sheet.students for c in s.marks if c.subject_id == sid and c.entered]
        out[sid] = (
            _mean([(c.marks_obtained or 0) * 100 / mx for c in cells]),
            _rate(sum(1 for c in cells if c.passed), len(cells)),
            len(cells),
        )
    return out


def _diff(a: float | None, b: float | None) -> float | None:
    return None if a is None or b is None else round(a - b, 2)


async def _feedback(
    db: AsyncSession, staff_ids: list[uuid.UUID], class_ids: set[uuid.UUID]
) -> dict[uuid.UUID, TeacherFeedbackOut]:
    """Per teacher: average and count of the latest closed, shared request that rated them. No per-parent data."""
    if not staff_ids or not class_ids:
        return {}
    reqs = (
        await db.scalars(
            select(FeedbackRequest)
            .where(
                FeedbackRequest.share_with_teachers,
                FeedbackRequest.status != FeedbackStatus.draft.value,
                FeedbackRequest.id.in_(
                    select(FeedbackTarget.request_id).where(
                        FeedbackTarget.staff_id.in_(staff_ids), FeedbackTarget.class_id.in_(class_ids)
                    )
                ),
            )
            .order_by(FeedbackRequest.closes_on.desc(), FeedbackRequest.created_at.desc())
        )
    ).all()
    today = today_ist()
    closed = [r for r in reqs if effective_status(r, today) == FeedbackStatus.closed.value]
    if not closed:
        return {}
    # guardian_id and student_id are deliberately not selected
    rows = (
        await db.execute(
            select(
                FeedbackTarget.request_id,
                FeedbackTarget.staff_id,
                func.count(FeedbackResponse.id).label("n"),
                func.avg(FeedbackResponse.rating).label("avg"),
            )
            .select_from(FeedbackTarget)
            .outerjoin(FeedbackResponse, FeedbackResponse.target_id == FeedbackTarget.id)
            .where(
                FeedbackTarget.request_id.in_([r.id for r in closed]),
                FeedbackTarget.staff_id.in_(staff_ids),
                FeedbackTarget.class_id.in_(class_ids),
            )
            .group_by(FeedbackTarget.request_id, FeedbackTarget.staff_id)
        )
    ).all()
    by = {(r.request_id, r.staff_id): r for r in rows}
    out: dict[uuid.UUID, TeacherFeedbackOut] = {}
    for req in closed:  # newest first: the first request that rated the teacher wins
        for sid in staff_ids:
            r = by.get((req.id, sid))
            if r is not None and sid not in out:
                out[sid] = TeacherFeedbackOut(
                    request_id=req.id,
                    title=req.title,
                    average_rating=round(float(r.avg), 2) if r.avg is not None else None,
                    responses=int(r.n),
                )
    return out


async def teacher_wise(
    db: AsyncSession,
    p: Principal,
    year_id: uuid.UUID | None,
    from_on: date,
    to_on: date,
    exam_id: uuid.UUID | None,
) -> TeacherWise:
    see_all = can_see_teacher_wise(p)
    year = await _year(db, year_id)
    empty = TeacherWise(
        year_id=year.id if year else None,
        year=year.name if year else None,
        from_on=from_on,
        to_on=to_on,
        exam_id=None,
        exam=None,
        previous_exam=None,
        scope="school" if see_all else "me",
        teachers=[],
    )
    if year is None:
        return empty
    rows = await teaching_assignments(db, p.school_id, year.id, None if see_all else p.user_id)
    if not rows:
        return empty
    classes = {c.id: c for _, _, c in rows}
    staff_ids = list(dict.fromkeys(u.id for u, _, _ in rows))
    all_year_classes = set(
        (await db.scalars(select(SchoolClass.id).where(SchoolClass.academic_year_id == year.id))).all()
    )

    subject_names = dict(
        (
            await db.execute(
                select(Subject.id, Subject.name).where(
                    Subject.id.in_({a.subject_id for _, a, _ in rows if a.subject_id})
                )
            )
        ).all()
    )
    designation = dict(
        (
            await db.execute(
                select(StaffProfile.user_id, StaffProfile.designation).where(StaffProfile.user_id.in_(staff_ids))
            )
        ).all()
    )

    # class attendance: one grouped query for every class that has a teacher
    units = {
        r.class_id: r
        for r in (
            await db.execute(
                select(D.class_id, *unit_columns())
                .select_from(R)
                .join(D, D.id == R.attendance_day_id)
                .where(D.class_id.in_(list(classes)), D.day_on.between(from_on, to_on), not_holiday())
                .group_by(D.class_id)
            )
        ).all()
    }

    # results: class sheets of the classes that have a teacher, for this exam and the previous one
    exam, previous = await _pick(db, year, exam_id, all_year_classes)
    sheets, prev_sheets, published = {}, {}, set()
    if exam is not None:
        bands = await load_bands(db)
        wanted = list(classes.values())
        sheets = {c.id: _figures(sh) for c, sh in await _sheets_with(db, exam, wanted, bands)}
        if previous is not None:
            prev_sheets = {c.id: _figures(sh) for c, sh in await _sheets_with(db, previous, wanted, bands)}
        published = set(
            (await db.scalars(select(ExamPublication.class_id).where(ExamPublication.exam_id == exam.id))).all()
        )

    # staff attendance
    counts: dict[tuple[uuid.UUID, str], int] = {
        (r.staff_id, r.status): int(r.n)
        for r in (
            await db.execute(
                select(StaffAttendance.staff_id, StaffAttendance.status, func.count().label("n"))
                .where(StaffAttendance.staff_id.in_(staff_ids), StaffAttendance.day_on.between(from_on, to_on))
                .group_by(StaffAttendance.staff_id, StaffAttendance.status)
            )
        ).all()
    }
    feedback = await _feedback(db, staff_ids, all_year_classes)

    by_staff: dict[uuid.UUID, list[tuple]] = defaultdict(list)
    names: dict[uuid.UUID, str] = {}
    for u, a, c in rows:
        by_staff[u.id].append((a, c))
        names[u.id] = u.name

    def weighted(items: list[tuple[float | None, int]]) -> float | None:
        w = [(v, n) for v, n in items if v is not None and n]
        total = sum(n for _, n in w)
        return round(sum(v * n for v, n in w) / total, 2) if total else None

    out: list[TeacherWiseRow] = []
    for sid in sorted(by_staff, key=lambda i: names[i].lower()):
        assigns, results = [], []
        own_n = own_p = all_n = all_p = 0
        avg_items, prev_items, pass_items = [], [], []
        for a, c in by_staff[sid]:
            u_ = units.get(c.id)
            n, present = (int(u_.n), int(u_.present)) if u_ else (0, 0)
            all_n, all_p = all_n + n, all_p + present
            is_ct = a.role == ClassRole.class_teacher.value
            if is_ct:
                own_n, own_p = own_n + n, own_p + present
            assigns.append(
                TeacherAssignmentOut(
                    class_id=c.id,
                    class_label=class_label(c),
                    role=a.role,
                    subject_id=a.subject_id,
                    subject=subject_names.get(a.subject_id) if a.subject_id else None,
                    attendance_percentage=pct(present, n),
                )
            )
            key = None if is_ct else a.subject_id
            fig = sheets.get(c.id, {}).get(key)
            if exam is None or fig is None:
                continue  # the class has no paper (for this subject) in the exam
            prev = prev_sheets.get(c.id, {}).get(key)
            avg, rate, students = fig
            results.append(
                TeacherSubjectOut(
                    class_id=c.id,
                    class_label=class_label(c),
                    subject_id=key,
                    subject=subject_names.get(key) if key else None,
                    students=students,
                    average_percentage=avg,
                    pass_rate=rate,
                    previous_average_percentage=prev[0] if prev else None,
                    improvement=_diff(avg, prev[0] if prev else None),
                    published=c.id in published,
                )
            )
            avg_items.append((avg, students))
            pass_items.append((rate, students))
            prev_items.append((prev[0] if prev else None, students))
        results.sort(key=lambda r: (r.class_label, r.subject or ""))
        assigns.sort(key=lambda a: (a.role != ClassRole.class_teacher.value, a.class_label, a.subject or ""))
        avg_all = weighted(avg_items)
        # improvement compares like with like: only rows that have a previous figure on both sides
        both = [
            (a_[0], p_[0], a_[1])
            for a_, p_ in zip(avg_items, prev_items, strict=True)
            if a_[0] is not None and p_[0] is not None
        ]
        prev_avg = weighted([(p_, n) for _, p_, n in both])
        marked = sum(counts.get((sid, k), 0) for k in ("present", "absent", "leave"))
        present_days = counts.get((sid, "present"), 0)
        out.append(
            TeacherWiseRow(
                staff_id=sid,
                name=names[sid],
                designation=designation.get(sid, "") or "",
                assignments=assigns,
                class_attendance_percentage=pct(own_p, own_n),
                taught_attendance_percentage=pct(all_p, all_n),
                results=results,
                average_percentage=avg_all,
                pass_rate=weighted(pass_items),
                previous_average_percentage=prev_avg,
                improvement=_diff(weighted([(a_, n) for a_, _, n in both]), prev_avg),
                staff_attendance=TeacherStaffAttendance(
                    days_marked=marked,
                    days_present=present_days,
                    days_absent=counts.get((sid, "absent"), 0),
                    days_leave=counts.get((sid, "leave"), 0),
                    percentage=round(present_days * 100 / marked, 2) if marked else None,
                ),
                feedback=feedback.get(sid),
            )
        )
    return empty.model_copy(
        update={
            "exam_id": exam.id if exam else None,
            "exam": exam.name if exam else None,
            "previous_exam": previous.name if previous else None,
            "teachers": out,
        }
    )


async def _sheets_with(db: AsyncSession, exam: Exam, classes: list[SchoolClass], bands):
    with_papers = set((await db.scalars(select(ExamSubject.class_id).where(ExamSubject.exam_id == exam.id))).all())
    return [(c, await class_sheet(db, exam, c, None, bands)) for c in classes if c.id in with_papers]


async def subject_wise(
    db: AsyncSession, p: Principal, year_id: uuid.UUID | None, exam_id: uuid.UUID | None
) -> SubjectWise:
    """Per subject across classes: average, pass %, and the best and weakest class. Admin and `academic.manage` see
    every class; any other teacher the classes they are assigned to."""
    scope = results_scope(p)
    name = "school" if scope is None else "my_classes"
    year = await _year(db, year_id)
    if year is None:
        return SubjectWise(year_id=None, exam_id=None, exam=None, scope=name, subjects=[])
    stmt = select(SchoolClass).where(SchoolClass.academic_year_id == year.id)
    if scope is not None:
        stmt = stmt.where(SchoolClass.id.in_(scope))
    classes = list(
        (await db.scalars(stmt.order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section))).all()
    )
    exam, _ = await _pick(db, year, exam_id, {c.id for c in classes})
    if exam is None:
        return SubjectWise(year_id=year.id, exam_id=None, exam=None, scope=name, subjects=[])
    sheets = await _sheets(db, exam, classes)
    names: dict[uuid.UUID, str] = {}
    per: dict[uuid.UUID, list[ClassFigure]] = defaultdict(list)
    pooled: dict[uuid.UUID, tuple[list[float], list[bool]]] = defaultdict(lambda: ([], []))
    for c, sh in sheets:
        maxes = {x.subject_id: x.max_marks for x in sh.papers}
        for x in sh.papers:
            names[x.subject_id] = x.subject
            cells = [cell for s in sh.students for cell in s.marks if cell.subject_id == x.subject_id and cell.entered]
            if not cells:
                continue
            pcts = [(cell.marks_obtained or 0) * 100 / maxes[x.subject_id] for cell in cells]
            passes = [bool(cell.passed) for cell in cells]
            pooled[x.subject_id][0].extend(pcts)
            pooled[x.subject_id][1].extend(passes)
            per[x.subject_id].append(
                ClassFigure(
                    class_id=c.id,
                    class_label=class_label(c),
                    students=len(cells),
                    average_percentage=_mean(pcts),
                    pass_rate=_rate(sum(passes), len(passes)),
                )
            )
    rows = []
    for sid, (pcts, passes) in pooled.items():
        figs = per[sid]
        ranked = sorted(figs, key=lambda f: (f.average_percentage or 0, f.class_label))
        rows.append(
            SubjectWiseRow(
                subject_id=sid,
                subject=names[sid],
                students=len(pcts),
                average_percentage=_mean(pcts),
                pass_rate=_rate(sum(passes), len(passes)),
                best_class=ranked[-1] if len(ranked) > 1 else None,
                weakest_class=ranked[0] if len(ranked) > 1 else None,
                classes=figs,
            )
        )
    rows.sort(key=lambda r: r.subject.lower())
    return SubjectWise(year_id=year.id, exam_id=exam.id, exam=exam.name, scope=name, subjects=rows)
