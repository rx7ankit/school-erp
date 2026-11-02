"""Student import from Excel/CSV, the template, and the Excel export.

Two steps, like the ERD says: `validate_upload` reads the file and saves a job with a result for every row
(nothing about students is written), then `commit_job` imports. Commit checks every row again inside its own
transaction, so it is all or nothing (or all valid rows when `skip_errors`)."""

import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.errors import Conflict, NotFound
from app.models.academic import AcademicYear, SchoolClass
from app.models.enums import AuditCategory, EnrollmentStatus, ImportStatus, YearStatus
from app.models.student import Enrollment, ImportJob, ImportRow, Student
from app.schemas.students import GuardianIn
from app.services.audit import Actor, log_audit
from app.services.enrolment import enrol_student
from app.services.guardians import find_guardian_by_email, norm_email, school_name, send_parent_login
from app.services.schools import email_taken
from app.services.sheets import build_xlsx, read_table
from app.services.students import StudentFilter, class_label, full_name, guardian_summary_map

COLUMNS = [
    ("scholar_no", "Scholar No"),
    ("first_name", "First Name"),
    ("last_name", "Last Name"),
    ("class", "Class"),
    ("roll_no", "Roll No"),
    ("dob", "Date of Birth"),
    ("gender", "Gender"),
    ("admitted_on", "Admission Date"),
    ("category", "Category"),
    ("blood_group", "Blood Group"),
    ("samagra_id", "Samagra ID"),
    ("pen", "PEN"),
    ("address", "Address"),
    ("previous_school", "Previous School"),
    ("medical_notes", "Medical Notes"),
    ("emergency_name", "Emergency Contact"),
    ("emergency_phone", "Emergency Phone"),
    ("guardian_name", "Guardian Name"),
    ("guardian_relation", "Guardian Relation"),
    ("guardian_phone", "Guardian Mobile"),
    ("guardian_email", "Guardian Email"),
    ("guardian2_name", "Guardian 2 Name"),
    ("guardian2_relation", "Guardian 2 Relation"),
    ("guardian2_phone", "Guardian 2 Mobile"),
    ("guardian2_email", "Guardian 2 Email"),
]
ALIASES = {
    "class_section": "class",
    "grade": "class",
    "class_sec": "class",
    "scholar_number": "scholar_no",
    "scholar": "scholar_no",
    "admission_no": "scholar_no",
    "date_of_birth": "dob",
    "admission_date": "admitted_on",
    "admitted": "admitted_on",
    "mobile": "guardian_phone",
    "guardian_mobile": "guardian_phone",
    "guardian_2_mobile": "guardian2_phone",
    "guardian_2_name": "guardian2_name",
    "guardian_2_email": "guardian2_email",
    "guardian_2_relation": "guardian2_relation",
    "emergency_contact": "emergency_name",
    "father_name": "guardian_name",
    "samagra": "samagra_id",
    "pen_no": "pen",
    "roll": "roll_no",
}
REQUIRED = ("first_name", "class", "guardian_name", "guardian_phone")
_email = TypeAdapter(EmailStr)
CATEGORIES = {"general": "General", "obc": "OBC", "sc": "SC", "st": "ST", "ews": "EWS"}
GENDERS = {
    "m": "male",
    "male": "male",
    "boy": "male",
    "f": "female",
    "female": "female",
    "girl": "female",
    "other": "other",
}
RELATIONS = {"father": "father", "mother": "mother", "guardian": "guardian", "other": "other"}


def parse_date(v: Any) -> date | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"'{s}' is not a date (use DD/MM/YYYY)")


def _key(text: str) -> str:
    return re.sub(r"[\s\-/_.]+", "", str(text)).lower()


@dataclass
class ImportCtx:
    year: AcademicYear
    classes: dict[str, SchoolClass]
    taken: set[str]
    create_logins: bool
    seen: set[str] = field(default_factory=set)
    filled: dict[uuid.UUID, int] = field(default_factory=dict)  # active students per class, rising as rows are accepted
    email_ok: dict[str, bool] = field(default_factory=dict)


async def build_ctx(db: AsyncSession, year_id: uuid.UUID | None, create_logins: bool) -> ImportCtx:
    year = await db.get(AcademicYear, year_id) if year_id else None
    if year is None:
        year = await db.scalar(select(AcademicYear).where(AcademicYear.status == YearStatus.current.value))
    if year is None:
        raise Conflict("There is no current academic year. Create one first.", code="no_current_year")
    if year.status == YearStatus.completed.value:
        raise Conflict("That academic year is completed.", code="year_completed")
    classes = (await db.scalars(select(SchoolClass).where(SchoolClass.academic_year_id == year.id))).all()
    cmap: dict[str, SchoolClass] = {}
    for c in classes:
        cmap[_key(class_label(c))] = c
    counts = dict(
        (
            await db.execute(
                select(Enrollment.class_id, func.count())
                .where(Enrollment.academic_year_id == year.id, Enrollment.status == EnrollmentStatus.active.value)
                .group_by(Enrollment.class_id)
            )
        ).all()
    )
    taken = set((await db.scalars(select(Student.scholar_no))).all())
    return ImportCtx(year, cmap, taken, create_logins, filled=dict(counts))


def _s(v: Any) -> str | None:
    if v is None:
        return None
    s = v.isoformat() if isinstance(v, date) else str(v).strip()
    return s or None


def jsonable(rec: dict[str, Any]) -> dict[str, Any]:
    return {k: _s(v) for k, v in rec.items() if k in dict(COLUMNS)}


async def _guardian(
    ctx: ImportCtx, db: AsyncSession, raw: dict, prefix: str, errors: list[str], required: bool
) -> GuardianIn | None:
    p = prefix
    name, phone, email, rel = raw.get(f"{p}name"), raw.get(f"{p}phone"), raw.get(f"{p}email"), raw.get(f"{p}relation")
    label = "Guardian 2" if p == "guardian2_" else "Guardian"
    if not any((name, phone, email)) and not required:
        return None
    if not name:
        errors.append(f"{label} name is missing")
    digits = re.sub(r"\D", "", phone or "")
    if not phone:
        errors.append(f"{label} mobile is missing")
    elif len(digits) < 10:
        errors.append(f"{label} mobile '{phone}' looks wrong")
    em = None
    if email:
        try:
            em = norm_email(str(_email.validate_python(email)))
        except ValidationError:
            errors.append(f"{label} email '{email}' is not valid")
    if em and ctx.create_logins and em not in ctx.email_ok:
        known = await find_guardian_by_email(db, em)
        ctx.email_ok[em] = bool(known) or not await email_taken(db, em)
    if em and ctx.create_logins and not ctx.email_ok.get(em, True):
        errors.append(f"{label} email {em} already belongs to another login")
    relation = (
        RELATIONS.get((rel or "").strip().lower(), "other") if rel else ("father" if p == "guardian_" else "other")
    )
    if rel and rel.strip().lower() not in RELATIONS:
        errors.append(f"{label} relation '{rel}' should be father, mother, guardian or other")
    if not name:
        return None
    return GuardianIn(name=name, phone=phone, email=em, relation=relation, is_primary=p == "guardian_")  # type: ignore[arg-type]


async def validate_row(db: AsyncSession, ctx: ImportCtx, raw: dict[str, Any]) -> tuple[dict | None, str | None]:
    """Returns (clean row, None) or (None, "problem; problem"). On success the row is counted in `ctx`, so later
    rows in the same file see its scholar number and its seat."""
    errors: list[str] = []
    clean: dict[str, Any] = {}
    first = _s(raw.get("first_name"))
    if not first:
        errors.append("First name is missing")
    clean["first_name"], clean["last_name"] = first, _s(raw.get("last_name")) or ""

    scholar = _s(raw.get("scholar_no"))
    if scholar:
        if scholar in ctx.taken or scholar in ctx.seen:
            errors.append(f"Scholar number {scholar} is already used")
    clean["scholar_no"] = scholar

    cls = None
    cname = _s(raw.get("class"))
    if not cname:
        errors.append("Class is missing")
    else:
        cls = ctx.classes.get(_key(cname))
        if cls is None:
            errors.append(f"Class '{cname}' does not exist in {ctx.year.name}")
        elif ctx.filled.get(cls.id, 0) >= cls.capacity:
            errors.append(f"Class {class_label(cls)} is full ({cls.capacity})")

    for col in ("dob", "admitted_on"):
        try:
            clean[col] = parse_date(raw.get(col))
        except ValueError as e:
            errors.append(f"{col.replace('_', ' ').title()}: {e}")
    g = _s(raw.get("gender"))
    if g:
        clean["gender"] = GENDERS.get(g.lower())
        if not clean["gender"]:
            errors.append(f"Gender '{g}' should be male, female or other")
    cat = _s(raw.get("category"))
    if cat:
        clean["category"] = CATEGORIES.get(cat.lower())
        if not clean["category"]:
            errors.append(f"Category '{cat}' should be General, OBC, SC, ST or EWS")
    sam, pen = _s(raw.get("samagra_id")), _s(raw.get("pen"))
    if sam and not re.fullmatch(r"\d{8}", sam):
        errors.append("Samagra ID must be 8 digits")
    if pen and len(pen) != 11:
        errors.append("PEN must be 11 characters")
    roll = _s(raw.get("roll_no"))
    if roll:
        if roll.isdigit() and int(roll) > 0:
            clean["roll_no"] = int(roll)
        else:
            errors.append("Roll number must be a number")
    for col in ("address", "blood_group", "previous_school", "medical_notes", "emergency_name", "emergency_phone"):
        clean[col] = _s(raw.get(col))
    if clean.get("blood_group") and len(clean["blood_group"]) > 5:
        errors.append("Blood group is too long")
    clean["samagra_id"], clean["pen"] = sam, pen

    guardians = []
    g1 = await _guardian(ctx, db, raw, "guardian_", errors, True)
    if g1:
        guardians.append(g1)
    g2 = await _guardian(ctx, db, raw, "guardian2_", errors, False)
    if g2:
        guardians.append(g2)

    if errors:
        return None, "; ".join(errors)
    assert cls
    if scholar:
        ctx.seen.add(scholar)
    ctx.filled[cls.id] = ctx.filled.get(cls.id, 0) + 1
    clean["class_id"], clean["guardians"] = cls.id, guardians
    return clean, None


# ------------------------------------------------------------------ step 1: validate
async def validate_upload(
    db: AsyncSession,
    actor: Actor,
    *,
    data: bytes,
    filename: str,
    year_id: uuid.UUID | None,
    create_logins: bool,
) -> tuple[ImportJob, list[ImportRow]]:
    assert actor.id and actor.school_id
    table = read_table(data, filename, aliases=ALIASES, required=REQUIRED)
    ctx = await build_ctx(db, year_id, create_logins)
    job = ImportJob(
        school_id=actor.school_id,
        kind="students",
        file_name=filename[:200],
        status=ImportStatus.validated.value,
        created_by=actor.id,
        options={"year_id": str(ctx.year.id), "create_logins": create_logins},
    )
    db.add(job)
    await db.flush()
    rows = []
    for row_no, rec in table:
        raw = jsonable(rec)
        _, err = await validate_row(db, ctx, raw)
        row = ImportRow(school_id=actor.school_id, job_id=job.id, row_no=row_no, data=raw, error=err)
        db.add(row)
        rows.append(row)
    job.total_rows = len(rows)
    job.error_rows = sum(1 for r in rows if r.error)
    job.ok_rows = job.total_rows - job.error_rows
    await db.flush()
    return job, rows


# ------------------------------------------------------------------ step 2: commit
@dataclass
class CommitResult:
    imported: int = 0
    skipped: int = 0
    logins_created: int = 0
    sent: int = 0
    failed: int = 0


async def commit_job(
    db: AsyncSession, actor: Actor, job_id: uuid.UUID, *, skip_errors: bool, send_login: bool
) -> tuple[ImportJob, CommitResult]:
    job = await db.scalar(select(ImportJob).where(ImportJob.id == job_id).with_for_update())
    if job is None:
        raise NotFound("Import not found.")
    if job.status != ImportStatus.validated.value:
        raise Conflict("This import was already committed. Upload the file again.", code="already_imported")
    opts = job.options or {}
    rows = (await db.scalars(select(ImportRow).where(ImportRow.job_id == job.id).order_by(ImportRow.row_no))).all()
    ctx = await build_ctx(
        db, uuid.UUID(opts["year_id"]) if opts.get("year_id") else None, bool(opts.get("create_logins"))
    )
    good, bad = [], []
    for r in rows:  # check again: the school may have changed since the dry run
        clean, err = await validate_row(db, ctx, r.data)
        r.error = err
        (bad if err else good).append((r, clean))
    if bad and not skip_errors:
        raise Conflict(
            f"{len(bad)} rows have problems. Nothing was imported.",
            code="import_has_errors",
            details=[{"row_no": r.row_no, "error": r.error} for r, _ in bad[:100]],
        )
    res = CommitResult(skipped=len(bad))
    users = {}
    for _, c in good:
        fields = {
            k: v for k, v in c.items() if k not in ("class_id", "guardians", "scholar_no", "admitted_on", "roll_no")
        }
        out = await enrol_student(
            db,
            actor,
            fields=fields,
            class_id=c["class_id"],
            guardians=c["guardians"],
            admitted_on=c.get("admitted_on"),
            scholar_no=c.get("scholar_no"),
            roll_no=c.get("roll_no"),
            create_login=bool(opts.get("create_logins")) and any(g.email for g in c["guardians"]),
            reason="Excel import",
            audit=False,
        )
        res.imported += 1
        res.logins_created += len(out.new_users)
        for u in out.login_users:
            users[u.id] = u
    job.status, job.imported_at = ImportStatus.imported.value, utcnow()
    job.ok_rows, job.error_rows = len(good), len(bad)
    log_audit(
        db,
        actor,
        AuditCategory.students,
        "students.imported",
        f"Imported {res.imported} students from {job.file_name}"
        + (f" ({res.skipped} rows skipped)" if res.skipped else ""),
        entity_type="import_job",
        entity_id=job.id,
        entity_label=job.file_name,
        sensitive=True,
    )
    await db.flush()
    if send_login and users:
        school = await school_name(db, actor.school_id) if actor.school_id else ""
        for u in users.values():
            if u.last_login_at is None:
                if await send_parent_login(db, actor, u, school=school, audit=False):
                    res.sent += 1
                else:
                    res.failed += 1
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "login.sent",
            f"Sent login emails to {res.sent} parents after import",
            entity_label="Parents",
        )
    return job, res


# ------------------------------------------------------------------ template and export
def template_xlsx(class_labels: list[str]) -> bytes:
    headers = [h for _, h in COLUMNS]
    example = {
        "scholar_no": "1001",
        "first_name": "Aarav",
        "last_name": "Sharma",
        "class": class_labels[0] if class_labels else "8-A",
        "roll_no": "1",
        "dob": "15/06/2014",
        "gender": "male",
        "admitted_on": "01/04/2026",
        "category": "General",
        "guardian_name": "Rakesh Sharma",
        "guardian_relation": "father",
        "guardian_phone": "9876543210",
        "guardian_email": "rakesh@example.com",
        "address": "12 Civil Lines, Rewa",
    }
    row = [example.get(k, "") for k, _ in COLUMNS]
    notes = [
        ["Column", "Rule"],
        ["Class", "Grade and section as in the school, for example 8-A. Must already exist in the academic year."],
        ["Scholar No", "Optional. Left empty, the next number is given. Must be new."],
        ["First Name, Class, Guardian Name, Guardian Mobile", "Required."],
        ["Guardian Email", "Needed only to create a parent login. The same email on two children is one login."],
        ["Dates", "DD/MM/YYYY or YYYY-MM-DD."],
        ["Gender", "male, female or other."],
        ["Category", "General, OBC, SC, ST or EWS."],
        ["Guardian Relation", "father, mother, guardian or other."],
        ["Samagra ID / PEN", "8 digits / 11 characters."],
        ["Classes in this year", ", ".join(class_labels)],
    ]
    return build_xlsx([("Students", headers, [row]), ("Instructions", notes[0], notes[1:])])


async def export_xlsx(db: AsyncSession, rows: list[tuple[Student, Enrollment | None, SchoolClass | None]]) -> bytes:
    ids = [s.id for s, _, _ in rows]
    gmap = await guardian_summary_map(db, ids)
    headers = [
        "Scholar No", "Name", "Class", "Roll No", "Status", "Gender", "Date of Birth", "Admission Date",
        "Category", "Blood Group", "Guardian", "Guardian Mobile", "Guardian Email", "Address", "Left On",
    ]  # fmt: skip
    body = []
    for s, e, c in rows:
        g = gmap.get(s.id)
        body.append(
            [
                s.scholar_no,
                full_name(s),
                class_label(c) if c else "",
                e.roll_no if e else None,
                s.status,
                s.gender or "",
                s.dob,
                s.admitted_on,
                s.category or "",
                s.blood_group or "",
                g.name if g else "",
                g.phone if g and g.phone else "",
                g.email if g and g.email else "",
                s.address or "",
                s.left_on,
            ]
        )
    return build_xlsx([("Students", headers, body)])


def filter_text(f: StudentFilter) -> str:
    bits = [f"{k}={v}" for k, v in (("search", f.q), ("grade", f.grade), ("status", f.status)) if v]
    return ", ".join(bits) or "all students"
