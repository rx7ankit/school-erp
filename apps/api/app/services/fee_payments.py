"""Payments (instalments), cancellation, receipts."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utcnow
from app.core.errors import AppError, Conflict, NotFound
from app.models.academic import SchoolClass
from app.models.enums import AuditCategory, PaymentMode, PaymentStatus
from app.models.fees import FeeInvoice, FeePayment
from app.models.school import School
from app.models.student import Enrollment, Student
from app.schemas.fees import PaymentIn, Receipt
from app.services import fees as base
from app.services.audit import Actor, change, log_audit
from app.services.fee_notify import _notify_payment_received
from app.services.students import class_label, full_name, student_label


async def record_payment(db: AsyncSession, actor: Actor, invoice_id: uuid.UUID, body: PaymentIn) -> FeePayment:
    """Offline payment (cash, cheque, UPI, bank transfer) or the reference of an online one. The invoice row is
    locked, so two cashiers cannot both overpay it, and the receipt number is allocated last."""
    assert actor.school_id and actor.id
    inv = await db.scalar(select(FeeInvoice).where(FeeInvoice.id == invoice_id).with_for_update())
    if inv is None:
        raise NotFound("Invoice not found.")
    if inv.closed_at:
        raise Conflict(
            "This invoice was carried forward. Take the payment on the newer invoice.", code="invoice_closed"
        )
    if body.mode != PaymentMode.cash.value and not (body.reference and body.reference.strip()):
        raise AppError(
            "A reference (cheque, UPI or transaction number) is needed.", code="reference_required", status=422
        )
    m = base.invoice_money().where(FeeInvoice.id == inv.id).subquery()
    total, paid = (await db.execute(select(m.c.total, m.c.paid))).one()
    balance = total - paid
    if balance <= 0:
        raise Conflict("This invoice is already paid.", code="already_paid")
    if body.amount_paise > balance:
        raise AppError(
            f"The amount is more than the balance of ₹{base.rupees(balance)}.",
            code="exceeds_balance",
            status=422,
            details={"balance_paise": balance},
        )
    (seq,) = await base.next_numbers(db, actor.school_id, "receipt")
    pay = FeePayment(
        school_id=actor.school_id,
        invoice_id=inv.id,
        student_id=inv.student_id,
        amount_paise=body.amount_paise,
        mode=body.mode,
        reference=(body.reference or "").strip() or None,
        note=body.note,
        receipt_no=base.receipt_no(seq),
        received_at=utcnow(),
        received_by=actor.id,
    )
    db.add(pay)
    await db.flush()
    stu = await db.get(Student, inv.student_id)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "payment.recorded",
        f"Received ₹{base.rupees(body.amount_paise)} ({body.mode}) from {student_label(stu)} against {inv.invoice_no}, "
        f"receipt {pay.receipt_no}",
        entity_type="fee_payment",
        entity_id=pay.id,
        entity_label=pay.receipt_no,
        changes=[change("Balance (paise)", balance, balance - body.amount_paise)],
    )
    await _notify_payment_received(db, pay)
    return pay


async def cancel_payment(db: AsyncSession, actor: Actor, payment_id: uuid.UUID, reason: str) -> FeePayment:
    """The payment stays in the table (status cancelled, who, when, why). The receipt number is never reused."""
    assert actor.id
    pay = await db.scalar(select(FeePayment).where(FeePayment.id == payment_id).with_for_update())
    if pay is None:
        raise NotFound("Payment not found.")
    if pay.status == PaymentStatus.cancelled.value:
        raise Conflict("This payment is already cancelled.", code="already_cancelled")
    inv = await db.scalar(select(FeeInvoice).where(FeeInvoice.id == pay.invoice_id).with_for_update())
    if inv is not None and inv.closed_at:
        raise Conflict(
            "This invoice was carried forward, so its payments can no longer be cancelled.", code="invoice_closed"
        )
    pay.status, pay.cancelled_at, pay.cancelled_by, pay.cancel_reason = (
        PaymentStatus.cancelled.value,
        utcnow(),
        actor.id,
        reason.strip(),
    )
    await db.flush()
    stu = await db.get(Student, pay.student_id)
    log_audit(
        db,
        actor,
        AuditCategory.fees,
        "payment.cancelled",
        f"Cancelled receipt {pay.receipt_no} of ₹{base.rupees(pay.amount_paise)} "
        f"for {student_label(stu)}: {reason.strip()}",
        entity_type="fee_payment",
        entity_id=pay.id,
        entity_label=pay.receipt_no,
        changes=[change("Status", "active", "cancelled")],
        sensitive=True,
    )
    return pay


async def receipt(
    db: AsyncSession, payment_id: uuid.UUID, *, student_id: uuid.UUID | None = None, for_parent: bool = False
) -> Receipt:
    stmt = select(FeePayment).where(FeePayment.id == payment_id)
    if student_id:
        stmt = stmt.where(FeePayment.student_id == student_id)
    pay = await db.scalar(stmt)
    if pay is None:
        raise NotFound("Receipt not found.")
    inv = await db.get(FeeInvoice, pay.invoice_id)
    stu = await db.get(Student, pay.student_id)
    enr = await db.get(Enrollment, inv.enrollment_id)
    cls = await db.get(SchoolClass, enr.class_id) if enr else None
    school = await db.get(School, pay.school_id)
    names = await base.user_names(db, {pay.received_by})
    cancelled = pay.status == PaymentStatus.cancelled.value
    return Receipt(
        id=pay.id,
        receipt_no=pay.receipt_no,
        invoice_id=inv.id,
        invoice_no=inv.invoice_no,
        period_label=inv.period_label,
        student_id=stu.id,
        student_name=full_name(stu),
        scholar_no=stu.scholar_no,
        class_label=class_label(cls) if cls else None,
        amount_paise=pay.amount_paise,
        mode=pay.mode,
        reference=pay.reference,
        received_at=pay.received_at,
        received_by_name=names.get(pay.received_by),
        status=pay.status,
        status_label="Cancelled by school" if cancelled else "Paid",
        cancelled_at=pay.cancelled_at,
        cancel_reason=None if for_parent else pay.cancel_reason,
        school_name=school.name if school else "",
    )
