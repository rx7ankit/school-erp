"""Opening balances (dues from before the school used Scool) and a student's fee summary."""

import re
import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import today_ist, utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.enums import AuditCategory, ImportStatus
from app.models.fees import OpeningBalance
from app.models.student import ImportJob, ImportRow, Student
from app.schemas.fees import OpeningBalanceIn, OpeningBalanceOut, StudentFees
from app.services import fee_invoices as inv_svc
from app.services import fees as base
from app.services.audit import Actor, change, log_audit
from app.services.sheets import read_table
from app.services.student_import import parse_date
from app.services.students import full_name, student_label

KIND = "opening_balances"
ALIASES = {
    "scholar_no": "scholar_no",
    "scholar_number": "scholar_no",
    "admission_no": "scholar_no",
    "amount": "amount",
    "amount_owed": "amount",
    "amount_owed_rs": "amount",
    "dues": "amount",
    "balance": "amount",
    "as_of": "as_of",
    "as_of_date": "as_of",
    "as_on": "as_of",
    "date": "as_of",
    "note": "note",
    "remarks": "note",
}
REQUIRED = ["scholar_no", "amount", "as_of"]
_RUPEES = re.compile(r"^\d{1,9}(\.\d{1,2})?$")


def rupees_to_paise(v: Any) -> int:
    """'1500', '1500.5' or '1,500.50' to integer paise, without floats."""
    s = str(v).replace(",", "").replace("₹", "").strip()
    if not _RUPEES.match(s):
        raise ValueError(f"'{v}' is not an amount in rupees")
    r, _, ps = s.partition(".")
    paise = int(r) * 100 + int((ps + "00")[:2])
    if paise <= 0:
        raise ValueError("The amount must be more than 0")
    return paise


async def set_opening_balance(db: AsyncSession, actor: Actor, body: OpeningBalanceIn) -> OpeningBalance:
    assert actor.school_id and actor.id
    stu = await base.get_or_404(db, Student, body.student_id, "Student")
    year = await base.year_or_current(db, body.academic_year_id)
    row = await db.scalar(
        select(OpeningBalance)
        .where(OpeningBalance.student_id == stu.id, OpeningBalance.academic_year_id == year.id)
        .with_for_update()
    )
    if row and row.used_invoice_id:
        raise Conflict("This opening balance is already on an invoice and is locked.", code="opening_balance_locked")
    if row is None:
        row = OpeningBalance(
            school_id=actor.school_id,
            student_id=stu.id,
            academic_year_id=year.id,
            amount_paise=body.amount_paise,
            as_of_on=body.as_of_on,
            note=body.note,
            imported_by=actor.id,
        )
        db.add(row)
        ch = [change("Amount (paise)", "", body.amount_paise)]
    else:
        ch = [change("Amount (paise)", row.amount_paise, body.amount_paise)]
        row.amount_paise, row.as_of_on, row.note, row.imported_by = (
            body.amount_paise,
            body.as_of_on,
            body.note,
            actor.id,
        )
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "opening_balance.set",
        f"Opening balance of ₹{base.rupees(body.amount_paise)} for {student_label(stu)} ({year.name})",
        entity_type="student",
        entity_id=stu.id,
        entity_label=full_name(stu),
        changes=ch,
        sensitive=True,
    )
    return row


async def list_balances(db: AsyncSession, year_id: uuid.UUID | None) -> list[OpeningBalanceOut]:
    year = await base.year_or_current(db, year_id)
    rows = (
        await db.execute(
            select(OpeningBalance, Student)
            .join(Student, Student.id == OpeningBalance.student_id)
            .where(OpeningBalance.academic_year_id == year.id)
            .order_by(Student.first_name, Student.scholar_no)
        )
    ).all()
    return [
        OpeningBalanceOut(
            id=o.id,
            student_id=s.id,
            student_name=full_name(s),
            scholar_no=s.scholar_no,
            academic_year_id=o.academic_year_id,
            amount_paise=o.amount_paise,
            as_of_on=o.as_of_on,
            note=o.note,
            locked=o.used_invoice_id is not None,
            used_invoice_id=o.used_invoice_id,
        )
        for o, s in rows
    ]


# ------------------------------------------------------------------ Excel import: check, then import
async def _check_row(db: AsyncSession, raw: dict, seen: set[str], year_id: uuid.UUID) -> tuple[dict | None, str | None]:
    sn = str(raw.get("scholar_no") or "").strip()
    if not sn:
        return None, "Scholar No is missing"
    if sn in seen:
        return None, f"Scholar No {sn} appears twice in this file"
    stu = await db.scalar(select(Student).where(Student.scholar_no == sn))
    if stu is None:
        return None, f"No student with Scholar No {sn}"
    try:
        paise = rupees_to_paise(raw.get("amount"))
    except ValueError as e:
        return None, str(e)
    try:
        as_of = parse_date(raw.get("as_of"))
    except ValueError as e:
        return None, str(e)
    if as_of is None:
        return None, "As-of date is missing"
    if as_of > today_ist():
        return None, "As-of date is in the future"
    if await db.scalar(
        select(OpeningBalance.id).where(
            OpeningBalance.student_id == stu.id,
            OpeningBalance.academic_year_id == year_id,
            OpeningBalance.used_invoice_id.is_not(None),
        )
    ):
        return None, "Already on an invoice, so it is locked"
    seen.add(sn)
    return {"student_id": stu.id, "amount_paise": paise, "as_of_on": as_of, "note": raw.get("note")}, None


async def validate_upload(db: AsyncSession, actor: Actor, *, data: bytes, filename: str, year_id: uuid.UUID | None):
    assert actor.id and actor.school_id
    year = await base.year_or_current(db, year_id)
    table = read_table(data, filename, aliases=ALIASES, required=REQUIRED)
    job = ImportJob(
        school_id=actor.school_id,
        kind=KIND,
        file_name=filename[:200],
        status=ImportStatus.validated.value,
        created_by=actor.id,
        options={"year_id": str(year.id)},
    )
    db.add(job)
    await db.flush()
    seen: set[str] = set()
    rows = []
    for row_no, rec in table:
        raw = {k: (v.isoformat() if isinstance(v, date) else v) for k, v in rec.items()}
        _, err = await _check_row(db, raw, seen, year.id)
        r = ImportRow(school_id=actor.school_id, job_id=job.id, row_no=row_no, data=raw, error=err)
        db.add(r)
        rows.append(r)
    job.total_rows = len(rows)
    job.error_rows = sum(1 for r in rows if r.error)
    job.ok_rows = job.total_rows - job.error_rows
    await db.flush()
    return job, rows


async def get_job(db: AsyncSession, job_id: uuid.UUID) -> tuple[ImportJob, list[ImportRow]]:
    job = await db.scalar(select(ImportJob).where(ImportJob.id == job_id, ImportJob.kind == KIND))
    if job is None:
        raise NotFound("Import not found.")
    rows = (await db.scalars(select(ImportRow).where(ImportRow.job_id == job.id).order_by(ImportRow.row_no))).all()
    return job, list(rows)


async def commit_job(
    db: AsyncSession, actor: Actor, job_id: uuid.UUID, *, skip_errors: bool
) -> tuple[ImportJob, int, int]:
    job = await db.scalar(select(ImportJob).where(ImportJob.id == job_id).with_for_update())
    if job is None:
        raise NotFound("Import not found.")
    if job.kind != KIND:
        raise Conflict(
            f"This is a {job.kind.replace('_', ' ')} import, not an opening balance import. "
            "Commit it where you uploaded it.",
            code="wrong_import_kind",
        )
    if job.status != ImportStatus.validated.value:
        raise Conflict("This import was already committed. Upload the file again.", code="already_imported")
    year_id = uuid.UUID((job.options or {})["year_id"])
    rows = (await db.scalars(select(ImportRow).where(ImportRow.job_id == job.id).order_by(ImportRow.row_no))).all()
    seen: set[str] = set()
    good, bad = [], 0
    for r in rows:  # check again: the data may have changed since the file was checked
        clean, err = await _check_row(db, r.data, seen, year_id)
        if err:
            bad += 1
            r.error = err
        else:
            good.append(clean)
    if bad and not skip_errors:
        raise AppError(
            f"{bad} rows have errors. Fix the file, or import only the valid rows.",
            code="import_has_errors",
            status=422,
            details={"error_rows": bad},
        )
    for c in good:
        await set_opening_balance(db, actor, OpeningBalanceIn(academic_year_id=year_id, **c))
    job.status, job.imported_at = ImportStatus.imported.value, utcnow()
    job.ok_rows, job.error_rows = len(good), bad
    await db.flush()
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "opening_balance.imported",
        f"Imported {len(good)} opening balances from {job.file_name}" + (f" ({bad} skipped)" if bad else ""),
        entity_type="import_job",
        entity_id=job.id,
        entity_label=job.file_name,
        sensitive=True,
    )
    return job, len(good), bad


def template_xlsx() -> bytes:
    from app.services.sheets import build_xlsx

    return build_xlsx(
        [
            (
                "Opening balances",
                ["Scholar No", "Amount Owed", "As Of Date", "Note"],
                [["1001", "2500.00", date(2026, 6, 30), "Term 1 dues"]],
            )
        ]
    )


# ------------------------------------------------------------------ a student's fees
async def student_fees(db: AsyncSession, student: Student) -> StudentFees:
    rows = await inv_svc.list_rows(db, inv_svc.invoices_query(student_id=student.id))
    today = today_ist()
    open_rows = [r for r in rows if r.status != "closed"]
    opening = (
        await db.scalar(
            select(func.coalesce(func.sum(OpeningBalance.amount_paise), 0)).where(
                OpeningBalance.student_id == student.id, OpeningBalance.used_invoice_id.is_(None)
            )
        )
        or 0
    )
    bal = sum(r.balance_paise for r in open_rows)
    return StudentFees(
        student_id=student.id,
        student_name=full_name(student),
        scholar_no=student.scholar_no,
        status=student.status,
        total_paise=sum(r.total_paise for r in open_rows),
        paid_paise=sum(r.paid_paise for r in open_rows),
        balance_paise=bal,
        opening_balance_paise=int(opening),
        due_paise=bal + int(opening),
        overdue_paise=sum(r.balance_paise for r in open_rows if r.due_on < today),
        invoices=rows,
    )
