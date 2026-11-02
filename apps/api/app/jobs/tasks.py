"""Scheduled jobs. Each one is safe to run twice (idempotent) and to run late. Run them with
`python -m app.jobs.run <job>`; see the README for the cron lines."""

import logging
from collections.abc import Awaitable, Callable
from datetime import timedelta

from sqlalchemy import delete, select

from app.core.clock import today_ist, utcnow
from app.db.session import make_session, system_session
from app.models.enums import SchoolStatus
from app.models.notification import Notification
from app.models.school import School
from app.services import billing
from app.services.audit import Actor
from app.services.fee_invoices import apply_late_fees

log = logging.getLogger("scool.jobs")

NOTIFICATION_KEEP_DAYS = 90


async def late_fees() -> dict:
    """Adds or raises the late fee on overdue invoices, school by school (one transaction each, so one school's
    problem never stops the others). Trial and active schools only."""
    async with system_session() as db:
        schools = (
            await db.execute(
                select(School.id, School.name)
                .where(School.status != SchoolStatus.suspended.value)
                .order_by(School.name)
            )
        ).all()
    done = failed = invoices = 0
    for school_id, name in schools:
        db = make_session(school_id=school_id)
        try:
            n, _ = await apply_late_fees(db, Actor(None, "Late fee job", "System", school_id), today_ist())
            await db.commit()
            invoices += n
            done += 1
        except Exception:
            await db.rollback()
            failed += 1
            log.exception("late fees failed for %s", name)
        finally:
            await db.close()
    return {"schools": done, "failed": failed, "invoices_updated": invoices}


async def record_usage() -> dict:
    """Stores today's active student count of every school (the monthly invoice uses the last day of the month)."""
    async with system_session() as db:
        return {"schools": await billing.record_usage(db)}


async def platform_invoices() -> dict:
    """Records today's usage, then creates last month's invoices for every paying school (skips existing ones)."""
    async with system_session() as db:
        await billing.record_usage(db)
        out = await billing.generate_month(db)
    return out.model_dump()


async def notification_cleanup() -> dict:
    """Deletes notifications older than 90 days (the inbox keeps three months)."""
    cutoff = utcnow() - timedelta(days=NOTIFICATION_KEEP_DAYS)
    async with system_session() as db:
        res = await db.execute(delete(Notification).where(Notification.created_at < cutoff))
        return {"deleted": res.rowcount or 0}


async def library_reminders() -> dict:
    """Reminds parents of children with an overdue library book, once per loan every 3 days (school by school)."""
    from app.services.library import send_overdue_reminders

    async with system_session() as db:
        schools = (
            await db.execute(select(School.id, School.name).where(School.status != SchoolStatus.suspended.value))
        ).all()
    done = failed = reminders = 0
    for school_id, name in schools:
        db = make_session(school_id=school_id)
        try:
            reminders += await send_overdue_reminders(db, today_ist())
            await db.commit()
            done += 1
        except Exception:
            await db.rollback()
            failed += 1
            log.exception("library reminders failed for %s", name)
        finally:
            await db.close()
    return {"schools": done, "failed": failed, "reminders": reminders}


JOBS: dict[str, Callable[[], Awaitable[dict]]] = {
    "late-fees": late_fees,
    "record-usage": record_usage,
    "platform-invoices": platform_invoices,
    "notification-cleanup": notification_cleanup,
    "library-reminders": library_reminders,
}
