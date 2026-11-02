"""Notification hooks for fees, wired to the notifications service.

Each hook runs inside the caller's transaction, after the change is flushed, so the inbox rows commit or roll back
with it. A child who has left gets no fee notifications (the default of `notify_guardians_of_student`).
"""

import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import rupees
from app.models.fees import FeeInvoice, FeePayment
from app.models.student import Student
from app.services.messages_i18n import Msg, render, short_date_hi
from app.services.notifications import notify_guardians_of_student


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
            **render(
                "fee_invoice", name=stu.first_name, period=inv.period_label, amount=rupees(total), due=inv.due_on
            ).kw(),
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
        **render(
            "fee_payment", name=stu.first_name, amount=rupees(payment.amount_paise), receipt=payment.receipt_no
        ).kw(),
        data={"payment_id": payment.id, "invoice_id": payment.invoice_id, "amount_paise": payment.amount_paise},
        dedupe_key=f"payment:{payment.id}",
    )


async def _notify_reminder(
    db: AsyncSession, student_id: uuid.UUID, name: str, balance: int, due_on: date | None
) -> None:
    """ "Fee reminder: ₹X is due for {Name} by {date}". The caller already limits reminders to once per 3 days
    per child."""
    await notify_guardians_of_student(
        db,
        student_id,
        kind="fee_reminder",
        **reminder_msg(name, balance, due_on).kw(),
    )


def reminder_msg(name: str, balance: int, due_on: date | None) -> Msg:
    by = (f" by {due_on:%d-%m-%Y}", f" ({short_date_hi(due_on)} तक)") if due_on else ("", "")
    return render("fee_reminder", name=name, amount=rupees(balance), by=by)
