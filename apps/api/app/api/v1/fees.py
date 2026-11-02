"""Fees for staff. Everything here needs `fees.manage` (the admin passes)."""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_permission
from app.core.clock import today_ist
from app.core.errors import AppError
from app.core.principal import Principal
from app.models.academic import SchoolClass
from app.models.enums import AuditCategory, Permission
from app.models.fees import (
    FeeConcession,
    FeeHead,
    FeeInvoiceRun,
    FeeLateRule,
    FeePayment,
    FeeStructure,
    StudentConcession,
    StudentFeeOption,
    TransportRoute,
)
from app.schemas.common import Page
from app.schemas.fees import (
    CancelIn,
    CollectionReport,
    ConcessionIn,
    ConcessionOut,
    ConcessionPatch,
    DuesReport,
    HeadIn,
    HeadOut,
    HeadPatch,
    InvoiceDetail,
    InvoiceRow,
    LateApplyIn,
    LateApplyOut,
    LateRuleIn,
    LateRuleOut,
    OpeningBalanceIn,
    OpeningBalanceOut,
    OpeningCommitIn,
    OpeningCommitOut,
    OpeningImportOut,
    OpeningImportRowOut,
    OptionIn,
    OptionOut,
    PaymentIn,
    PaymentOut,
    Receipt,
    ReminderRow,
    ReminderSendIn,
    ReminderSendOut,
    RouteIn,
    RouteOut,
    RoutePatch,
    RunIn,
    RunOut,
    SettingsIn,
    SettingsOut,
    StructureCopyIn,
    StructureIn,
    StructureOut,
    StudentConcessionIn,
    StudentConcessionOut,
    StudentFees,
    WaiveIn,
)
from app.services import fee_invoices as inv_svc
from app.services import fee_opening as open_svc
from app.services import fee_payments as pay_svc
from app.services import fee_reports as rep_svc
from app.services import fees as svc
from app.services.audit import log_audit
from app.services.sheets import MAX_BYTES, XLSX
from app.services.students import class_label, get_student_or_404

router = APIRouter(prefix="/fees", tags=["fees"])
manage = require_permission(Permission.fees.value)


def _xlsx(content: bytes, name: str) -> Response:
    return Response(content, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ---------------------------------------------------------------- heads and structure
@router.get("/heads", response_model=list[HeadOut])
async def list_heads(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return (await db.scalars(select(FeeHead).order_by(FeeHead.name))).all()


@router.post("/heads", response_model=HeadOut, status_code=201)
async def create_head(
    body: HeadIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await svc.create_head(db, request_actor(p, request), body)


@router.patch("/heads/{head_id}", response_model=HeadOut)
async def edit_head(
    head_id: uuid.UUID,
    body: HeadPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    head = await svc.get_or_404(db, FeeHead, head_id, "Fee head")
    return await svc.edit_head(db, request_actor(p, request), head, body)


async def _structure_out(db: AsyncSession, rows: list[FeeStructure]) -> list[StructureOut]:
    classes = {c.id: c for c in (await db.scalars(select(SchoolClass))).all()}
    heads = {h.id: h for h in (await db.scalars(select(FeeHead))).all()}
    return [
        StructureOut(
            id=r.id,
            class_id=r.class_id,
            class_label=class_label(classes[r.class_id]),
            fee_head_id=r.fee_head_id,
            head_name=heads[r.fee_head_id].name,
            amount_paise=r.amount_paise,
            frequency=r.frequency,
        )
        for r in rows
    ]


@router.get("/structures", response_model=list[StructureOut])
async def list_structures(
    class_id: uuid.UUID | None = None,
    year_id: uuid.UUID | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """What each class pays. `year_id` defaults to the current year when no class is given."""
    stmt = select(FeeStructure).join(SchoolClass, SchoolClass.id == FeeStructure.class_id)
    if class_id:
        stmt = stmt.where(FeeStructure.class_id == class_id)
    else:
        stmt = stmt.where(SchoolClass.academic_year_id == (await svc.year_or_current(db, year_id)).id)
    rows = (await db.scalars(stmt.order_by(SchoolClass.display_order, SchoolClass.grade, SchoolClass.section))).all()
    return await _structure_out(db, list(rows))


@router.put("/structures", response_model=StructureOut)
async def set_structure(
    body: StructureIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Sets (adds or changes) the amount of one head for one class."""
    row = await svc.set_structure(db, request_actor(p, request), body)
    return (await _structure_out(db, [row]))[0]


@router.post("/structures/copy")
async def copy_structure(
    body: StructureCopyIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return {"copied": await svc.copy_structure(db, request_actor(p, request), body.from_class_id, body.to_class_id)}


@router.delete("/structures/{structure_id}", status_code=204)
async def delete_structure(
    structure_id: uuid.UUID, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    await svc.delete_structure(
        db, request_actor(p, request), await svc.get_or_404(db, FeeStructure, structure_id, "Fee line")
    )


# ---------------------------------------------------------------- transport routes and optional fees
@router.get("/routes", response_model=list[RouteOut])
async def list_routes(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return (await db.scalars(select(TransportRoute).order_by(TransportRoute.name))).all()


@router.post("/routes", response_model=RouteOut, status_code=201)
async def create_route(
    body: RouteIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await svc.create_route(db, request_actor(p, request), body)


@router.patch("/routes/{route_id}", response_model=RouteOut)
async def edit_route(
    route_id: uuid.UUID,
    body: RoutePatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    return await svc.edit_route(
        db, request_actor(p, request), await svc.get_or_404(db, TransportRoute, route_id, "Route"), body
    )


async def _options_out(db: AsyncSession, rows: list[StudentFeeOption]) -> list[OptionOut]:
    heads = {h.id: h.name for h in (await db.scalars(select(FeeHead))).all()}
    routes = {r.id: r.name for r in (await db.scalars(select(TransportRoute))).all()}
    return [
        OptionOut(
            id=o.id,
            student_id=o.student_id,
            academic_year_id=o.academic_year_id,
            fee_head_id=o.fee_head_id,
            head_name=heads.get(o.fee_head_id, ""),
            route_id=o.route_id,
            route_name=routes.get(o.route_id) if o.route_id else None,
            amount_paise=o.amount_paise,
            frequency=o.frequency,
            note=o.note,
        )
        for o in rows
    ]


@router.get("/students/{student_id}/options", response_model=list[OptionOut])
async def list_options(
    student_id: uuid.UUID,
    year_id: uuid.UUID | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    await get_student_or_404(db, student_id)
    year = await svc.year_or_current(db, year_id)
    rows = (
        await db.scalars(
            select(StudentFeeOption).where(
                StudentFeeOption.student_id == student_id, StudentFeeOption.academic_year_id == year.id
            )
        )
    ).all()
    return await _options_out(db, list(rows))


@router.put("/students/{student_id}/options", response_model=OptionOut)
async def set_option(
    student_id: uuid.UUID,
    body: OptionIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Student takes (or changes) an optional fee such as transport. Only invoices not yet generated change."""
    row = await svc.set_option(db, request_actor(p, request), student_id, body)
    return (await _options_out(db, [row]))[0]


@router.delete("/students/{student_id}/options/{option_id}", status_code=204)
async def remove_option(
    student_id: uuid.UUID,
    option_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    await svc.remove_option(db, request_actor(p, request), student_id, option_id)


# ---------------------------------------------------------------- concessions
@router.get("/concessions", response_model=list[ConcessionOut])
async def list_concessions(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return (await db.scalars(select(FeeConcession).order_by(FeeConcession.name))).all()


@router.post("/concessions", response_model=ConcessionOut, status_code=201)
async def create_concession(
    body: ConcessionIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await svc.create_concession(db, request_actor(p, request), body)


@router.patch("/concessions/{concession_id}", response_model=ConcessionOut)
async def edit_concession(
    concession_id: uuid.UUID,
    body: ConcessionPatch,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    c = await svc.get_or_404(db, FeeConcession, concession_id, "Concession")
    if body.name and body.name.strip() != c.name:
        if await svc._unique(db, FeeConcession, FeeConcession.name, body.name.strip(), except_id=c.id):
            raise AppError("A concession with that name already exists.", code="concession_exists", status=409)
        c.name = body.name.strip()
    if body.is_active is not None:
        c.is_active = body.is_active
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.fees,
        "concession.updated",
        f"Updated concession {c.name}",
        entity_type="fee_concession",
        entity_id=c.id,
        entity_label=c.name,
    )
    return c


async def _student_concessions(db: AsyncSession, student_id: uuid.UUID, year_id: uuid.UUID | None):
    stmt = (
        select(StudentConcession, FeeConcession)
        .join(FeeConcession, FeeConcession.id == StudentConcession.concession_id)
        .where(StudentConcession.student_id == student_id)
    )
    if year_id:
        stmt = stmt.where(StudentConcession.academic_year_id == year_id)
    rows = (await db.execute(stmt.order_by(FeeConcession.name))).all()
    names = await svc.user_names(db, {sc.approved_by for sc, _ in rows})
    return [
        StudentConcessionOut(
            id=sc.id,
            student_id=sc.student_id,
            concession_id=c.id,
            concession_name=c.name,
            kind=c.kind,
            value=c.value,
            academic_year_id=sc.academic_year_id,
            approved_by=sc.approved_by,
            approved_by_name=names.get(sc.approved_by) if sc.approved_by else None,
            note=sc.note,
        )
        for sc, c in rows
    ]


@router.get("/students/{student_id}/concessions", response_model=list[StudentConcessionOut])
async def student_concessions(
    student_id: uuid.UUID,
    year_id: uuid.UUID | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    await get_student_or_404(db, student_id)
    return await _student_concessions(db, student_id, year_id)


@router.post("/students/{student_id}/concessions", response_model=StudentConcessionOut, status_code=201)
async def assign_concession(
    student_id: uuid.UUID,
    body: StudentConcessionIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Gives a concession for a year. It appears as a negative line on invoices generated from now on."""
    row = await svc.assign_concession(
        db, request_actor(p, request), student_id, body.concession_id, body.academic_year_id, body.note
    )
    return next(x for x in await _student_concessions(db, student_id, None) if x.id == row.id)


@router.delete("/students/{student_id}/concessions/{row_id}", status_code=204)
async def revoke_concession(
    student_id: uuid.UUID,
    row_id: uuid.UUID,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    await svc.revoke_concession(db, request_actor(p, request), student_id, row_id)


# ---------------------------------------------------------------- late fee and settings
@router.get("/late-rules", response_model=list[LateRuleOut])
async def late_rules(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return (await db.scalars(select(FeeLateRule).order_by(FeeLateRule.created_at.desc()))).all()


@router.post("/late-rules", response_model=LateRuleOut, status_code=201)
async def set_late_rule(
    body: LateRuleIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """The new rule becomes the active one; the old one is kept for history."""
    return await svc.set_late_rule(db, request_actor(p, request), body)


@router.post("/late-fees/apply", response_model=LateApplyOut)
async def apply_late_fees(
    body: LateApplyIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Adds the late fee line to overdue invoices. Safe to repeat. Should also run once a day from a worker."""
    as_of = body.as_of or today_ist()
    n, total = await inv_svc.apply_late_fees(db, request_actor(p, request), as_of)
    return LateApplyOut(as_of=as_of, updated=n, total_late_paise=total)


@router.get("/settings", response_model=SettingsOut)
async def get_settings(p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    s = await svc.get_settings(db)
    return SettingsOut(
        auto_first_invoice=s.auto_first_invoice if s else False,
        first_invoice_due_days=s.first_invoice_due_days if s else 15,
    )


@router.put("/settings", response_model=SettingsOut)
async def put_settings(
    body: SettingsIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await svc.set_settings(db, request_actor(p, request), body)


# ---------------------------------------------------------------- invoice runs and invoices
@router.post("/invoice-runs", response_model=RunOut, status_code=201)
async def generate(
    body: RunIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    """Bulk invoices for a period. Running it again for the same period creates nothing twice."""
    run, _ = await inv_svc.run_invoices(db, request_actor(p, request), body)
    return (await _runs_out(db, [run]))[0]


async def _runs_out(db: AsyncSession, runs: list[FeeInvoiceRun]) -> list[RunOut]:
    names = await svc.user_names(db, {r.created_by for r in runs})
    return [
        RunOut(
            id=r.id,
            academic_year_id=r.academic_year_id,
            period_label=r.period_label,
            due_on=r.due_on,
            frequencies=list(r.frequencies or []),
            invoices_created=r.invoices_created,
            skipped_existing=r.skipped_existing,
            skipped_no_fees=r.skipped_no_fees,
            created_by=r.created_by,
            created_by_name=names.get(r.created_by),
            created_at=r.created_at,
        )
        for r in runs
    ]


@router.get("/invoice-runs", response_model=list[RunOut])
async def list_runs(
    limit: int = Query(50, ge=1, le=200), p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    rows = (await db.scalars(select(FeeInvoiceRun).order_by(FeeInvoiceRun.created_at.desc()).limit(limit))).all()
    return await _runs_out(db, list(rows))


@router.get("/invoices", response_model=Page[InvoiceRow])
async def list_invoices(
    student_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
    year_id: uuid.UUID | None = None,
    status: str | None = Query(None, pattern="^(unpaid|partial|paid|closed)$"),
    period: str | None = None,
    run_id: uuid.UUID | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    stmt = inv_svc.invoices_query(
        student_id=student_id, class_id=class_id, year_id=year_id, status=status, period=period, q=q, run_id=run_id
    )
    total = (
        await db.scalar(
            select(func.count()).select_from(stmt.order_by(None).with_only_columns(inv_svc.FeeInvoice.id).subquery())
        )
        or 0
    )
    return Page(items=await inv_svc.list_rows(db, stmt, limit=limit, offset=offset), total=total)


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
async def invoice(invoice_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    return await inv_svc.invoice_detail(db, invoice_id)


@router.post("/invoices/{invoice_id}/waive-late-fee", response_model=InvoiceDetail)
async def waive_late(
    invoice_id: uuid.UUID,
    body: WaiveIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    await inv_svc.waive_late_fee(db, request_actor(p, request), invoice_id, body.reason)
    return await inv_svc.invoice_detail(db, invoice_id)


@router.get("/students/{student_id}", response_model=StudentFees)
async def student_fees(student_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """A student's invoices, balance and opening balance in one view (left students too)."""
    return await open_svc.student_fees(db, await get_student_or_404(db, student_id))


# ---------------------------------------------------------------- payments and receipts
@router.post("/invoices/{invoice_id}/payments", response_model=Receipt, status_code=201)
async def record_payment(
    invoice_id: uuid.UUID,
    body: PaymentIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Records an instalment (cash, cheque, UPI, bank transfer, online reference) and returns its receipt."""
    pay = await pay_svc.record_payment(db, request_actor(p, request), invoice_id, body)
    return await pay_svc.receipt(db, pay.id)


@router.get("/payments", response_model=Page[PaymentOut])
async def list_payments(
    date_from: date | None = None,
    date_to: date | None = None,
    mode: str | None = None,
    status: str | None = Query(None, pattern="^(active|cancelled)$"),
    student_id: uuid.UUID | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    stmt = select(FeePayment)
    if date_from or date_to:
        start, end = svc.ist_bounds(date_from or date_to, date_to or date_from)  # type: ignore[arg-type]
        if date_from and not date_to:
            end = start + timedelta(days=36500)
        if date_to and not date_from:
            start = end - timedelta(days=36500)
        stmt = stmt.where(FeePayment.received_at >= start, FeePayment.received_at < end)
    if mode:
        stmt = stmt.where(FeePayment.mode == mode)
    if status:
        stmt = stmt.where(FeePayment.status == status)
    if student_id:
        stmt = stmt.where(FeePayment.student_id == student_id)
    if q:
        stmt = stmt.where(
            FeePayment.receipt_no.ilike(f"%{q.strip()}%") | (FeePayment.reference.ilike(f"%{q.strip()}%"))
        )
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        await db.scalars(stmt.order_by(FeePayment.received_at.desc(), FeePayment.id.desc()).limit(limit).offset(offset))
    ).all()
    return Page(items=await inv_svc.payment_outs(db, list(rows)), total=total)


@router.get("/payments/{payment_id}", response_model=Receipt)
async def get_receipt(payment_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)):
    """The receipt as JSON (the PDF is rendered elsewhere, on demand)."""
    return await pay_svc.receipt(db, payment_id)


@router.post("/payments/{payment_id}/cancel", response_model=Receipt)
async def cancel_payment(
    payment_id: uuid.UUID,
    body: CancelIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Wrong entry? The payment stays, marked cancelled with who, when and why. The receipt number is not reused."""
    await pay_svc.cancel_payment(db, request_actor(p, request), payment_id, body.reason)
    return await pay_svc.receipt(db, payment_id)


# ---------------------------------------------------------------- reports
@router.get("/reports/dues", response_model=DuesReport)
async def dues_report(
    class_id: uuid.UUID | None = None,
    year_id: uuid.UUID | None = None,
    as_of: date | None = None,
    overdue_only: bool = False,
    min_due_paise: int = Query(0, ge=0),
    active_only: bool = False,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Defaulters: who owes what. Students who left stay in unless `active_only`."""
    return await rep_svc.dues(
        db,
        as_of=as_of,
        class_id=class_id,
        year_id=year_id,
        overdue_only=overdue_only,
        min_due_paise=min_due_paise,
        active_only=active_only,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get("/reports/dues/export")
async def dues_export(
    request: Request,
    class_id: uuid.UUID | None = None,
    year_id: uuid.UUID | None = None,
    as_of: date | None = None,
    overdue_only: bool = False,
    min_due_paise: int = Query(0, ge=0),
    active_only: bool = False,
    q: str | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    rep = await rep_svc.dues(
        db,
        as_of=as_of,
        class_id=class_id,
        year_id=year_id,
        overdue_only=overdue_only,
        min_due_paise=min_due_paise,
        active_only=active_only,
        q=q,
        limit=None,
    )
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "export.fee_dues",
        f"Exported fee dues ({len(rep.items)} students)",
        entity_type="export",
    )
    return _xlsx(rep_svc.dues_xlsx(rep), f"fee-dues-{rep.as_of:%Y%m%d}.xlsx")


@router.get("/reports/collection", response_model=CollectionReport)
async def collection(
    date_from: date,
    date_to: date,
    group_by: str = Query("day", pattern="^(day|head|class|mode)$"),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Money received between two IST dates, by day, fee head, class or payment mode. Cancelled payments are
    shown separately and never counted."""
    return await rep_svc.collection(db, date_from, date_to, group_by)


@router.get("/reports/collection/export")
async def collection_export(
    request: Request,
    date_from: date,
    date_to: date,
    group_by: str = Query("day", pattern="^(day|head|class|mode)$"),
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    rep = await rep_svc.collection(db, date_from, date_to, group_by)
    log_audit(
        db,
        request_actor(p, request),
        AuditCategory.exports,
        "export.fee_collection",
        f"Exported fee collection {date_from:%d-%m-%Y} to {date_to:%d-%m-%Y} by {group_by}",
        entity_type="export",
    )
    return _xlsx(rep_svc.collection_xlsx(rep), f"fee-collection-{date_from:%Y%m%d}-{date_to:%Y%m%d}.xlsx")


# ---------------------------------------------------------------- reminders
@router.get("/reminders", response_model=list[ReminderRow])
async def reminders(
    overdue_only: bool = False,
    class_id: uuid.UUID | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Who to remind: active students with a balance, and whether they were reminded in the last 3 days."""
    return await rep_svc.reminder_list(db, overdue_only=overdue_only, class_id=class_id)


@router.post("/reminders/send", response_model=ReminderSendOut)
async def send_reminders(
    body: ReminderSendIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await rep_svc.send_reminders(
        db, request_actor(p, request), student_ids=body.student_ids, overdue_only=body.overdue_only, email=body.email
    )


# ---------------------------------------------------------------- opening balances
@router.get("/opening-balances", response_model=list[OpeningBalanceOut])
async def opening_balances(
    year_id: uuid.UUID | None = None, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return await open_svc.list_balances(db, year_id)


@router.put("/opening-balances", response_model=OpeningBalanceOut)
async def set_opening_balance(
    body: OpeningBalanceIn, request: Request, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    row = await open_svc.set_opening_balance(db, request_actor(p, request), body)
    return next(x for x in await open_svc.list_balances(db, row.academic_year_id) if x.id == row.id)


@router.get("/opening-balances/template")
async def opening_template(p: Principal = Depends(manage)):
    return _xlsx(open_svc.template_xlsx(), "opening-balances-template.xlsx")


def _job_out(job, rows) -> OpeningImportOut:
    return OpeningImportOut(
        id=job.id,
        file_name=job.file_name,
        status=job.status,
        total_rows=job.total_rows,
        ok_rows=job.ok_rows,
        error_rows=job.error_rows,
        imported_at=job.imported_at,
        rows=[OpeningImportRowOut(row_no=r.row_no, ok=r.error is None, error=r.error, data=r.data) for r in rows],
    )


@router.post("/opening-balances/import", response_model=OpeningImportOut, status_code=201)
async def opening_import(
    request: Request,
    file: UploadFile = File(...),
    year_id: uuid.UUID | None = None,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Step 1: check the file (Scholar No, Amount Owed in rupees, As Of Date). Nothing is saved yet."""
    data = await file.read(MAX_BYTES + 1)
    job, rows = await open_svc.validate_upload(
        db, request_actor(p, request), data=data, filename=file.filename or "file.xlsx", year_id=year_id
    )
    return _job_out(job, rows)


@router.get("/opening-balances/import/{job_id}", response_model=OpeningImportOut)
async def opening_import_status(
    job_id: uuid.UUID, p: Principal = Depends(manage), db: AsyncSession = Depends(db_session)
):
    return _job_out(*await open_svc.get_job(db, job_id))


@router.post("/opening-balances/import/{job_id}/commit", response_model=OpeningCommitOut)
async def opening_import_commit(
    job_id: uuid.UUID,
    body: OpeningCommitIn,
    request: Request,
    p: Principal = Depends(manage),
    db: AsyncSession = Depends(db_session),
):
    """Step 2: import. Same student and year again replaces the value until the first invoice uses it."""
    job, ok, bad = await open_svc.commit_job(db, request_actor(p, request), job_id, skip_errors=body.skip_errors)
    return OpeningCommitOut(job_id=job.id, imported=ok, skipped=bad)
