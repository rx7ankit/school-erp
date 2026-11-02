"""Fees for parents: invoices, dues and receipts of their own children (a child who left stays readable)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, parent_child, parent_children, require_parent
from app.core.principal import Principal
from app.models.enums import StudentStatus
from app.models.fees import FeePayment
from app.models.student import Student
from app.schemas.fees import InvoiceDetail, ParentChildFees, Receipt, StudentFees
from app.services import fee_invoices as inv_svc
from app.services import fee_opening as open_svc
from app.services import fee_payments as pay_svc
from app.services.students import full_name

router = APIRouter(prefix="/parent", tags=["parent-fees"])


@router.get("/fees", response_model=list[ParentChildFees])
async def my_children_fees(
    ids: list[uuid.UUID] = Depends(parent_children),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    """What is due for each child, for the child switcher."""
    out = []
    for s in (await db.scalars(select(Student).where(Student.id.in_(ids)).order_by(Student.first_name))).all():
        f = await open_svc.student_fees(db, s)
        upcoming = [r.due_on for r in f.invoices if r.balance_paise > 0]
        out.append(
            ParentChildFees(
                student_id=s.id,
                student_name=full_name(s),
                read_only=s.status != StudentStatus.active.value,
                balance_paise=f.balance_paise,
                opening_balance_paise=f.opening_balance_paise,
                due_paise=f.due_paise,
                overdue_paise=f.overdue_paise,
                next_due_on=min(upcoming) if upcoming else None,
            )
        )
    return out


@router.get("/children/{student_id}/fees", response_model=StudentFees)
async def child_fees(
    s: Student = Depends(parent_child), p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    return await open_svc.student_fees(db, s)


@router.get("/children/{student_id}/fees/invoices/{invoice_id}", response_model=InvoiceDetail)
async def child_invoice(
    invoice_id: uuid.UUID,
    s: Student = Depends(parent_child),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    return await inv_svc.invoice_detail(db, invoice_id, student_id=s.id, for_parent=True)


@router.get("/children/{student_id}/fees/receipts", response_model=list[Receipt])
async def child_receipts(
    s: Student = Depends(parent_child), p: Principal = Depends(require_parent), db: AsyncSession = Depends(db_session)
):
    """Every receipt of the child, newest first. A cancelled one says 'Cancelled by school'."""
    ids = (
        await db.scalars(
            select(FeePayment.id)
            .where(FeePayment.student_id == s.id)
            .order_by(FeePayment.received_at.desc(), FeePayment.id.desc())
        )
    ).all()
    return [await pay_svc.receipt(db, i, for_parent=True) for i in ids]


@router.get("/children/{student_id}/fees/receipts/{payment_id}", response_model=Receipt)
async def child_receipt(
    payment_id: uuid.UUID,
    s: Student = Depends(parent_child),
    p: Principal = Depends(require_parent),
    db: AsyncSession = Depends(db_session),
):
    return await pay_svc.receipt(db, payment_id, student_id=s.id, for_parent=True)
