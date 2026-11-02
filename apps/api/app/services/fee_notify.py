"""Notification hooks for fees, wired to the notifications service.

Each hook runs inside the caller's transaction, after the change is flushed, so the inbox rows commit or roll back
with it. A child who has left gets no fee notifications (the default of `notify_guardians_of_student`).
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import rupees
from app.models.fees import FeeInvoice, FeePayment
from app.models.student import Student
from app.services.notifications import notify_guardians_of_student
from app.services.notify_helpers import short_date


async def _notify_invoice_issued(db: AsyncSession, issued: Sequence[tuple[uuid.UUID, uuid.UUID, int]]) -> None:
    """issued: (student_id, invoice_id, total_paise) for every invoice a run or an enrolment created."""
    if not issued:
        return
    invoices = {
        i.id: i for i in (await db.scalars(select(FeeInvoice).where(FeeInvoice.id.in_([x[1] for x in issued])))).all()
    }
    for student_id, invoice_id, total in issued:
        inv = invoices.get(invoice_id)
        if inv is None or total <= 0:
            continue
        stu = await db.get(Student, student_id)
        if stu is None:
            continue
        await notify_guardians_of_student(
            db,
            student_id,
            kind="fee_invoice",
            title="New fee invoice",
            body=(
                f"{stu.first_name}: fee invoice {inv.period_label} of {rupees(total)} "
                f"is due by {short_date(inv.due_on)}."
            ),
            data={"invoice_id": invoice_id, "amount_paise": total, "due_on": inv.due_on},
            dedupe_key=f"invoice:{invoice_id}",
        )


async def _notify_payment_received(db: AsyncSession, payment: FeePayment) -> None:
    stu = await db.get(Student, payment.student_id)
    if stu is None:
        return
    await notify_guardians_of_student(
        db,
        payment.student_id,
        kind="fee_payment",
        title="Payment received",
        body=f"{rupees(payment.amount_paise)} received for {stu.first_name}, receipt {payment.receipt_no}.",
        data={"payment_id": payment.id, "invoice_id": payment.invoice_id, "amount_paise": payment.amount_paise},
        dedupe_key=f"payment:{payment.id}",
    )


async def _notify_reminder(db: AsyncSession, student_id: uuid.UUID, text: str) -> None:
    """`text` is the reminder message ("Fee reminder: ₹X is due for {Name} by {date}"). The caller already limits
    reminders to once per 3 days per child."""
    await notify_guardians_of_student(db, student_id, kind="fee_reminder", title="Fee reminder", body=text)
