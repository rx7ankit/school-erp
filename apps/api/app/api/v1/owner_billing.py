"""Platform billing for the Krevo team: monthly invoices per school, payments, export and revenue."""

import uuid

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, request_actor, require_owner
from app.core.principal import Principal
from app.schemas.billing import GenerateIn, GenerateOut, MarkPaidIn, PlatformInvoiceOut, RevenueStats
from app.schemas.common import Page
from app.services import billing as svc
from app.services.sheets import XLSX, build_xlsx

router = APIRouter(prefix="/owner/billing", tags=["owner-billing"])

MONTH = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("/invoices", response_model=Page[PlatformInvoiceOut])
async def invoices(
    school_id: uuid.UUID | None = None,
    month: str | None = MONTH,
    status: str | None = Query(default=None, pattern="^(due|paid)$"),
    overdue: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    p: Principal = Depends(require_owner),
    db: AsyncSession = Depends(db_session),
):
    q = svc.invoices_query(school_id, month, status, overdue)
    return Page(items=await svc.list_invoices(db, q, limit=limit, offset=offset), total=await svc.count_invoices(db, q))


@router.post("/invoices/generate", response_model=GenerateOut)
async def generate(
    body: GenerateIn, request: Request, p: Principal = Depends(require_owner), db: AsyncSession = Depends(db_session)
):
    """Creates the invoices of a finished month for every paying school. Safe to repeat: existing ones are skipped."""
    month = svc.parse_month(body.month) if body.month else None
    return await svc.generate_month(db, month, request_actor(p, request))


@router.post("/invoices/{invoice_id}/mark-paid", response_model=PlatformInvoiceOut)
async def mark_paid(
    invoice_id: uuid.UUID,
    body: MarkPaidIn,
    request: Request,
    p: Principal = Depends(require_owner),
    db: AsyncSession = Depends(db_session),
):
    return await svc.mark_paid(
        db,
        request_actor(p, request),
        invoice_id,
        mode=body.payment_mode,
        reference=body.reference,
        paid_on=body.paid_on,
    )


@router.get("/invoices/export")
async def export(
    school_id: uuid.UUID | None = None,
    month: str | None = MONTH,
    status: str | None = Query(default=None, pattern="^(due|paid)$"),
    overdue: bool | None = None,
    p: Principal = Depends(require_owner),
    db: AsyncSession = Depends(db_session),
):
    rows = await svc.list_invoices(db, svc.invoices_query(school_id, month, status, overdue))
    data = build_xlsx(
        [
            (
                "Invoices",
                [
                    "School",
                    "Month",
                    "Active students",
                    "Price (Rs)",
                    "Amount (Rs)",
                    "Due on",
                    "Status",
                    "Paid at",
                    "Mode",
                    "Reference",
                ],
                [
                    [
                        r.school_name,
                        r.month,
                        r.active_students,
                        r.price_per_student_paise / 100,
                        r.amount_paise / 100,
                        r.due_on,
                        "overdue" if r.overdue else r.status,
                        r.paid_at.replace(tzinfo=None) if r.paid_at else None,
                        r.payment_mode,
                        r.reference,
                    ]
                    for r in rows
                ],
            )
        ]
    )
    return Response(
        data, media_type=XLSX, headers={"Content-Disposition": 'attachment; filename="krevo-invoices.xlsx"'}
    )


@router.get("/stats", response_model=RevenueStats)
async def stats(p: Principal = Depends(require_owner), db: AsyncSession = Depends(db_session)):
    """MRR, ARR, billed, collected, due and overdue, billed and collected by month, new schools by month."""
    return await svc.revenue_stats(db)
