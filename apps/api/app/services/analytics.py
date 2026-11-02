"""School analytics (erd v4): everything is computed from existing records with cheap SQL, nothing is stored.

Scope (who sees what):
  students, attendance   admin, `academic.manage` and `fees.manage` see the whole school; other teachers only the
                         classes they are assigned to (the same rule as the student list).
  results                admin and `academic.manage` see every class; other teachers the classes they are assigned to.
  teacher-wise results   admin, `academic.manage` and `staff.manage` see every teacher; a teacher only their own row.
  fees                   admin and `fees.manage` only.
  staff attendance       admin and `staff.manage` only (a teacher sees their own at
                         /attendance/analytics/teachers).
There is no per-subject attendance (it is marked once a day per class): "subject-wise" means results by subject.
"""

import uuid
from collections import defaultdict
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist
from app.core.errors import Forbidden, NotFound
from app.core.principal import Principal
from app.models.academic import ClassStaff, SchoolClass
from app.models.attendance import AttendanceDay, AttendanceRecord, StaffAttendance
from app.models.enums import ClassRole, EnrollmentStatus, Permission, StudentStatus, UserKind
from app.models.fees import FeeInvoice, FeeInvoiceItem, FeePayment
from app.models.results import Exam, ExamPublication, ExamSubject, Result
from app.models.student import Enrollment, Student
from app.models.user import User
from app.schemas.analytics import (
    ClassCount,
    ClassDues,
    ClassResult,
    CountRow,
    Dashboard,
    DashboardAttendance,
    DashboardFees,
    DashboardResults,
    DashboardRollover,
    DashboardStaff,
    FeesAnalytics,
    ResultsAnalytics,
    StaffAttendanceAnalytics,
    StudentsAnalytics,
    SubjectResult,
    TeacherClassResult,
    TeacherResult,
    TeacherResults,
)
from app.services import fees as fee_base
from app.services.attendance import not_holiday, pct, unit_columns
from app.services.attendance_analytics import scoped_classes
from app.services.results import class_sheet, load_bands
from app.services.students import class_label, current_year_or_none, visible_class_ids

PAID = fee_base.PaymentStatus.active.value


# ------------------------------------------------------------------ who may see what
def _is_admin_or(p: Principal, *permissions: Permission) -> bool:
    return p.is_staff and (p.is_admin or any(p.has(x.value) for x in permissions))


def can_see_fees(p: Principal) -> bool:
    return _is_admin_or(p, Permission.fees)


def can_see_staff(p: Principal) -> bool:
    return _is_admin_or(p, Permission.staff)


def can_see_teacher_wise(p: Principal) -> bool:
    return _is_admin_or(p, Permission.academic, Permission.staff)


def results_scope(p: Principal) -> set[uuid.UUID] | None:
    """None = every class (admin, academic.manage). Otherwise the classes the teacher is assigned to."""
    if _is_admin_or(p, Permission.academic):
        return None
    return {a.class_id for a in p.assignments}


def scope_name(p: Principal) -> str:
    return "school" if visible_class_ids(p) is None else "my_classes"


def _pct(x: float | None) -> float | None:
    return None if x is None else round(x, 2)


# ------------------------------------------------------------------ students
async def students(db: AsyncSession, p: Principal) -> StudentsAnalytics:
    year = await current_year_or_none(db)
    classes = await scoped_classes(db, p)
    ids = [c.id for c in classes]
    base = (
        select(Enrollment.class_id, Student.gender, Student.category)
        .join(Student, Student.id == Enrollment.student_id)
        .where(
            Enrollment.class_id.in_(ids),
            Enrollment.status == EnrollmentStatus.active.value,
            Student.status == StudentStatus.active.value,
        )
        .subquery()
    )
    per_class = dict((await db.execute(select(base.c.class_id, func.count()).group_by(base.c.class_id))).all())
    gender_of, category_of = func.coalesce(base.c.gender, "unknown"), func.coalesce(base.c.category, "unknown")
    gender = (await db.execute(select(gender_of, func.count()).group_by(gender_of).order_by(gender_of))).all()
    category = (await db.execute(select(category_of, func.count()).group_by(category_of).order_by(category_of))).all()
    left = (
        await db.scalar(
            select(func.count())
            .select_from(Enrollment)
            .where(Enrollment.class_id.in_(ids), Enrollment.status == EnrollmentStatus.left.value)
        )
        or 0
    )
    school_wide = visible_class_ids(p) is None
    passed_out = (
        await db.scalar(
            select(func.count()).select_from(Student).where(Student.status == StudentStatus.passed_out.value)
        )
        if school_wide
        else 0
    )
    return StudentsAnalytics(
        scope=scope_name(p),
        year=year.name if year else None,
        active=sum(per_class.values()),
        by_class=[
            ClassCount(class_id=c.id, class_label=class_label(c), students=per_class.get(c.id, 0), capacity=c.capacity)
            for c in classes
        ],
        by_gender=[CountRow(key=k, count=n) for k, n in gender],
        by_category=[CountRow(key=k, count=n) for k, n in category],
        left_this_year=left,
        passed_out=passed_out or 0,
    )


# ------------------------------------------------------------------ fees
async def fees(db: AsyncSession, p: Principal) -> FeesAnalytics:
    if not can_see_fees(p):
        raise Forbidden("You do not have access to this.", code="missing_permission", details={"needs": "fees.manage"})
    year = await current_year_or_none(db)
    today = today_ist()
    billed = collected = carried_in = this_month = 0
    if year:
        billed = int(
            await db.scalar(
                select(func.coalesce(func.sum(FeeInvoiceItem.amount_paise), 0))
                .join(FeeInvoice, FeeInvoice.id == FeeInvoiceItem.invoice_id)
                .where(FeeInvoice.academic_year_id == year.id, FeeInvoiceItem.kind != "previous_dues")
            )
            or 0
        )
        carried_in = int(
            await db.scalar(
                select(func.coalesce(func.sum(FeeInvoiceItem.amount_paise), 0))
                .join(FeeInvoice, FeeInvoice.id == FeeInvoiceItem.invoice_id)
                .where(FeeInvoice.academic_year_id == year.id, FeeInvoiceItem.kind == "previous_dues")
            )
            or 0
        )
        pay = (
            select(func.coalesce(func.sum(FeePayment.amount_paise), 0))
            .join(FeeInvoice, FeeInvoice.id == FeePayment.invoice_id)
            .where(FeePayment.status == PAID, FeeInvoice.academic_year_id == year.id)
        )
        collected = int(await db.scalar(pay) or 0)
        start, end = fee_base.ist_bounds(today.replace(day=1), today)
        this_month = int(await db.scalar(pay.where(FeePayment.received_at >= start, FeePayment.received_at < end)) or 0)

    m = fee_base.invoice_money().where(FeeInvoice.closed_at.is_(None)).subquery()
    bal = m.c.total - m.c.paid
    dues, overdue, n_students = (
        await db.execute(
            select(
                func.coalesce(func.sum(bal), 0),
                func.coalesce(func.sum(case((m.c.due_on < today, bal), else_=0)), 0),
                func.count(func.distinct(m.c.student_id)),
            ).where(bal > 0)
        )
    ).one()
    by_class = (
        await db.execute(
            select(SchoolClass, func.count(func.distinct(m.c.student_id)), func.sum(bal))
            .select_from(m)
            .join(Enrollment, Enrollment.id == m.c.enrollment_id)
            .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
            .where(bal > 0)
            .group_by(SchoolClass.id)
            .order_by(func.sum(bal).desc())
            .limit(5)
        )
    ).all()
    base = billed + carried_in
    return FeesAnalytics(
        year=year.name if year else None,
        billed_paise=billed,
        collected_paise=collected,
        collected_this_month_paise=this_month,
        dues_paise=int(dues),
        overdue_paise=int(overdue),
        dues_students=int(n_students),
        collection_percentage=min(100.0, round(collected * 100 / base, 2)) if base > 0 else None,
        top_dues_classes=[
            ClassDues(class_id=c.id, class_label=class_label(c), students=int(n), dues_paise=int(v))
            for c, n, v in by_class
        ],
    )


# ------------------------------------------------------------------ results
async def pick_exam(db: AsyncSession, exam_id: uuid.UUID | None, class_ids: list[uuid.UUID]) -> Exam | None:
    """The asked exam, or the latest exam of the current year that has papers in these classes."""
    if exam_id:
        exam = await db.get(Exam, exam_id)
        if exam is None:
            raise NotFound("Exam not found.")
        return exam
    year = await current_year_or_none(db)
    if year is None or not class_ids:
        return None
    return await db.scalar(
        select(Exam)
        .where(
            Exam.academic_year_id == year.id,
            Exam.id.in_(select(ExamSubject.exam_id).where(ExamSubject.class_id.in_(class_ids))),
        )
        .order_by(Exam.ends_on.desc().nulls_last(), Exam.created_at.desc())
        .limit(1)
    )


class _YearOf:
    def __init__(self, academic_year_id: uuid.UUID):
        self.academic_year_id = academic_year_id


async def _classes_in_scope(db: AsyncSession, scope: set[uuid.UUID] | None, exam: Exam | _YearOf) -> list[SchoolClass]:
    """Classes of the exam's (or the given) year, limited to the scope."""
    stmt = (
        select(SchoolClass)
        .where(SchoolClass.academic_year_id == exam.academic_year_id)
        .order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section)
    )
    if scope is not None:
        stmt = stmt.where(SchoolClass.id.in_(scope))
    return list((await db.scalars(stmt)).all())


async def _sheets(db: AsyncSession, exam: Exam, classes: list[SchoolClass]):
    """The results service's class sheets for classes that have papers in this exam."""
    with_papers = set((await db.scalars(select(ExamSubject.class_id).where(ExamSubject.exam_id == exam.id))).all())
    bands = await load_bands(db)
    return [(c, await class_sheet(db, exam, c, None, bands)) for c in classes if c.id in with_papers]


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def _rate(passed: int, n: int) -> float | None:
    return round(passed * 100 / n, 2) if n else None


async def results(db: AsyncSession, p: Principal, exam_id: uuid.UUID | None) -> ResultsAnalytics:
    scope = results_scope(p)
    year = await current_year_or_none(db)
    current = await _classes_in_scope(db, scope, _YearOf(year.id)) if year else []
    exam = await pick_exam(db, exam_id, [c.id for c in current])
    if exam is None:
        return ResultsAnalytics(
            exam_id=None, exam=None, scope="school" if scope is None else "my_classes", students=0,
            average_percentage=None, pass_rate=None, by_subject=[], by_class=[], grade_spread=[],
        )  # fmt: skip
    classes = await _classes_in_scope(db, scope, exam)
    published = set(
        (await db.scalars(select(ExamPublication.class_id).where(ExamPublication.exam_id == exam.id))).all()
    )
    subj_pct: dict[uuid.UUID, list[float]] = defaultdict(list)
    subj_pass: dict[uuid.UUID, list[bool]] = defaultdict(list)
    names: dict[uuid.UUID, str] = {}
    by_class, all_pct, all_pass = [], [], []
    spread: dict[str, int] = defaultdict(int)
    for c, sheet in await _sheets(db, exam, classes):
        maxes = {x.subject_id: x.max_marks for x in sheet.papers}
        for x in sheet.papers:
            names[x.subject_id] = x.subject
        done = [s for s in sheet.students if s.complete and s.percentage is not None]
        for s in sheet.students:
            for cell in s.marks:
                if cell.entered:
                    mx = maxes.get(cell.subject_id)
                    if mx:
                        subj_pct[cell.subject_id].append((cell.marks_obtained or 0) * 100 / mx)
                        subj_pass[cell.subject_id].append(bool(cell.passed))
        for s in done:
            all_pct.append(s.percentage)
            all_pass.append(bool(s.passed))
            if s.grade:
                spread[s.grade] += 1
        by_class.append(
            ClassResult(
                class_id=c.id,
                class_label=class_label(c),
                students=len(done),
                average_percentage=_mean([s.percentage for s in done]),
                pass_rate=_rate(sum(1 for s in done if s.passed), len(done)),
                published=c.id in published,
            )
        )
    by_subject = [
        SubjectResult(
            subject_id=sid,
            subject=names[sid],
            students=len(v),
            average_percentage=_mean(v),
            pass_rate=_rate(sum(subj_pass[sid]), len(v)),
        )
        for sid, v in subj_pct.items()
    ]
    by_subject.sort(key=lambda s: s.subject.lower())
    bands = [g for _, g in await load_bands(db)]
    order = {g: i for i, g in enumerate(bands)}
    return ResultsAnalytics(
        exam_id=exam.id,
        exam=exam.name,
        scope="school" if scope is None else "my_classes",
        students=len(all_pct),
        average_percentage=_mean(all_pct),
        pass_rate=_rate(sum(all_pass), len(all_pass)),
        by_subject=by_subject,
        by_class=by_class,
        grade_spread=[CountRow(key=g, count=n) for g, n in sorted(spread.items(), key=lambda kv: order.get(kv[0], 99))],
    )


async def teacher_results(db: AsyncSession, p: Principal, exam_id: uuid.UUID | None) -> TeacherResults:
    """Per teacher: the average result of the subject they teach in each class (class teachers: the class overall).
    Admin, academic.manage and staff.manage see everyone; any other teacher only their own row."""
    see_all = can_see_teacher_wise(p)
    year = await current_year_or_none(db)
    all_classes = (
        list((await db.scalars(select(SchoolClass).where(SchoolClass.academic_year_id == year.id))).all())
        if year
        else []
    )
    exam = await pick_exam(db, exam_id, [c.id for c in all_classes])
    if exam is None:
        return TeacherResults(exam_id=None, exam=None, teachers=[])
    stmt = (
        select(ClassStaff, User.name)
        .join(User, User.id == ClassStaff.staff_id)
        .join(SchoolClass, SchoolClass.id == ClassStaff.class_id)
        .where(
            SchoolClass.academic_year_id == exam.academic_year_id,
            User.kind == UserKind.staff.value,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    if not see_all:
        stmt = stmt.where(ClassStaff.staff_id == p.user_id)
    assigned = (await db.execute(stmt)).all()
    wanted = {a.class_id for a, _ in assigned}
    sheets = {c.id: sheet for c, sheet in await _sheets(db, exam, [c for c in all_classes if c.id in wanted])}
    labels = {c.id: class_label(c) for c in all_classes}
    subj_names = {x.subject_id: x.subject for sh in sheets.values() for x in sh.papers}
    out: dict[uuid.UUID, TeacherResult] = {}
    weights: dict[uuid.UUID, list[tuple[float, int]]] = defaultdict(list)
    for a, name in sorted(assigned, key=lambda r: (r[1].lower(), labels.get(r[0].class_id, ""))):
        sheet = sheets.get(a.class_id)
        if sheet is None:
            continue
        if a.role == ClassRole.class_teacher.value:
            done = [s for s in sheet.students if s.complete and s.percentage is not None]
            avg, rate, n = (
                _mean([s.percentage for s in done]),
                _rate(sum(1 for s in done if s.passed), len(done)),
                len(done),
            )
            subject_id = None
        else:
            maxes = {x.subject_id: x.max_marks for x in sheet.papers}
            mx = maxes.get(a.subject_id)
            if not mx:
                continue
            cells = [c for s in sheet.students for c in s.marks if c.subject_id == a.subject_id and c.entered]
            avg = _mean([(c.marks_obtained or 0) * 100 / mx for c in cells])
            rate, n, subject_id = _rate(sum(1 for c in cells if c.passed), len(cells)), len(cells), a.subject_id
        row = out.setdefault(
            a.staff_id, TeacherResult(staff_id=a.staff_id, name=name, average_percentage=None, classes=[])
        )
        row.classes.append(
            TeacherClassResult(
                class_id=a.class_id,
                class_label=labels.get(a.class_id, ""),
                subject_id=subject_id,
                subject=subj_names.get(subject_id) if subject_id else None,
                students=n,
                average_percentage=avg,
                pass_rate=rate,
            )
        )
        if avg is not None and n:
            weights[a.staff_id].append((avg, n))
    for sid, row in out.items():
        w = weights.get(sid, [])
        total = sum(n for _, n in w)
        row.average_percentage = round(sum(a * n for a, n in w) / total, 2) if total else None
    return TeacherResults(exam_id=exam.id, exam=exam.name, teachers=sorted(out.values(), key=lambda t: t.name.lower()))


# ------------------------------------------------------------------ staff attendance
async def staff_attendance(db: AsyncSession, p: Principal, from_on: date, to_on: date) -> StaffAttendanceAnalytics:
    if not can_see_staff(p):
        raise Forbidden("You do not have access to this.", code="missing_permission", details={"needs": "staff.manage"})
    today = today_ist()
    S = StaffAttendance
    active = (
        await db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.kind == UserKind.staff.value, User.is_active.is_(True), User.deleted_at.is_(None))
        )
        or 0
    )
    period = dict(
        (
            await db.execute(select(S.status, func.count()).where(S.day_on.between(from_on, to_on)).group_by(S.status))
        ).all()
    )
    now = dict((await db.execute(select(S.status, func.count()).where(S.day_on == today).group_by(S.status))).all())
    marked = sum(period.values())
    return StaffAttendanceAnalytics(
        from_on=from_on,
        to_on=to_on,
        active_staff=active,
        marked_today=sum(now.values()),
        present_today=now.get("present", 0),
        absent_today=now.get("absent", 0),
        leave_today=now.get("leave", 0),
        days_marked=marked,
        days_present=period.get("present", 0),
        days_absent=period.get("absent", 0),
        days_leave=period.get("leave", 0),
        present_percentage=round(period.get("present", 0) * 100 / marked, 2) if marked else None,
    )


# ------------------------------------------------------------------ the dashboard (one cheap call)
async def dashboard(db: AsyncSession, p: Principal) -> Dashboard:
    from app.services import rollover_plan

    year = await current_year_or_none(db)
    today = today_ist()
    classes = await scoped_classes(db, p)
    ids = [c.id for c in classes]

    n_students = (
        await db.scalar(
            select(func.count())
            .select_from(Enrollment)
            .join(Student, Student.id == Enrollment.student_id)
            .where(
                Enrollment.class_id.in_(ids),
                Enrollment.status == EnrollmentStatus.active.value,
                Student.status == StudentStatus.active.value,
            )
        )
        or 0
    )

    R, D = AttendanceRecord, AttendanceDay

    async def units(from_on: date, to_on: date):
        return (
            await db.execute(
                select(*unit_columns())
                .select_from(R)
                .join(D, D.id == R.attendance_day_id)
                .where(D.class_id.in_(ids), D.day_on.between(from_on, to_on), not_holiday())
            )
        ).one()

    t, mth = await units(today, today), await units(today.replace(day=1), today)
    marked_today = (
        await db.scalar(select(func.count(func.distinct(D.class_id))).where(D.class_id.in_(ids), D.day_on == today))
        or 0
    )
    attendance = DashboardAttendance(
        today_percentage=pct(int(t.present), int(t.n)),
        month_percentage=pct(int(mth.present), int(mth.n)),
        classes_total=len(ids),
        classes_marked_today=marked_today,
    )

    fees_block = None
    if can_see_fees(p):
        f = await fees(db, p)
        fees_block = DashboardFees(
            collected_this_month_paise=f.collected_this_month_paise,
            dues_paise=f.dues_paise,
            overdue_paise=f.overdue_paise,
            dues_students=f.dues_students,
        )

    rscope = results_scope(p)
    exam = await pick_exam(db, None, list(rscope) if rscope is not None else [c.id for c in classes])
    avg = None
    if exam is not None:
        rows = (
            select(Result.marks_obtained, Result.absent, ExamSubject.max_marks)
            .join(ExamSubject, ExamSubject.id == Result.exam_subject_id)
            .where(ExamSubject.exam_id == exam.id)
        )
        if rscope is not None:
            rows = rows.where(ExamSubject.class_id.in_(rscope))
        sub = rows.subquery()
        # total marks over total maximum: the same figure as the results analytics when every paper is entered
        avg = await db.scalar(
            select(func.sum(func.coalesce(sub.c.marks_obtained, 0)) * 100.0 / func.nullif(func.sum(sub.c.max_marks), 0))
        )
    results_block = DashboardResults(
        exam=exam.name if exam else None, average_percentage=_pct(float(avg)) if avg is not None else None
    )

    staff_block = None
    if can_see_staff(p):
        s = await staff_attendance(db, p, today, today)
        staff_block = DashboardStaff(
            active_staff=s.active_staff,
            present_today=s.present_today,
            absent_today=s.absent_today + s.leave_today,
            not_marked_today=max(0, s.active_staff - s.marked_today),
        )

    rollover_block = None
    if _is_admin_or(p, Permission.academic):
        st = await rollover_plan.status(db)
        rollover_block = DashboardRollover(
            show_banner=st.show_banner, days_left=st.days_left, current_year=st.current_year
        )

    return Dashboard(
        scope=scope_name(p),
        year=year.name if year else None,
        students=n_students,
        classes=len(ids),
        attendance=attendance,
        fees=fees_block,
        results=results_block,
        staff=staff_block,
        rollover=rollover_block,
    )
