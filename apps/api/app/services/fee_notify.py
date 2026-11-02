"""Notification hooks for fees. They do nothing yet: the notifications service will be wired in here.

Each hook runs inside the caller's transaction, after the change is flushed. Guardian logins to notify:
`app.services.guardians.guardian_user_ids_of_student(db, student_id)`. A child who has left gets no fee notifications.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fees import FeePayment


async def _notify_invoice_issued(db: AsyncSession, issued: Sequence[tuple[uuid.UUID, uuid.UUID, int]]) -> None:
    """issued: (student_id, invoice_id, total_paise) for every invoice a run or an enrolment created."""
    # NOTIFY: type `fee_invoice` to the guardians of each student: "Fee invoice {period} of ₹X is due by {date}".


async def _notify_payment_received(db: AsyncSession, payment: FeePayment) -> None:
    # NOTIFY: type `fee_payment` to the guardians of payment.student_id: "₹X received, receipt {receipt_no}".
    # Also call this again with a cancelled payment if the school wants "payment cancelled" messages.
    ...


async def _notify_reminder(db: AsyncSession, student_id: uuid.UUID, text: str) -> None:
    # NOTIFY: type `fee_reminder` (push) to the guardians of student_id with `text`
    # ("Fee reminder: ₹X is due for {Name} by {date}"). Already limited to once per 3 days per child.
    ...
