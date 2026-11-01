"""Time rules, same as the web app:
* moments (`*_at`) are stored in UTC (timestamptz) and sent as ISO 8601 UTC
* calendar dates (`*_on`) are plain school dates in IST and carry no zone
"""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def utcnow() -> datetime:
    return datetime.now(UTC)


def today_ist(now: datetime | None = None) -> date:
    return (now or utcnow()).astimezone(IST).date()
