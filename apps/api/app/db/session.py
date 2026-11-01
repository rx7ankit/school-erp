"""Database sessions.

Per-school isolation is enforced twice:
  1. services always filter by the school in the token
  2. Postgres row level security rejects any row of another school, even if (1) has a bug

The school is passed to Postgres with set_config() at the start of every transaction.
`bypass` is for the few system jobs and platform-owner calls that legitimately cross schools.
"""

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True, pool_size=10, max_overflow=10)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(AsyncSession.sync_session_class, "after_begin")
def _apply_tenant(session, transaction, connection):  # noqa: ANN001
    school_id = session.info.get("school_id")
    bypass = session.info.get("bypass", False)
    connection.execute(
        text("select set_config('app.school_id', :sid, true), set_config('app.bypass_rls', :bp, true)"),
        {"sid": str(school_id) if school_id else "", "bp": "on" if bypass else "off"},
    )


def make_session(*, school_id: uuid.UUID | None = None, bypass: bool = False) -> AsyncSession:
    s = SessionLocal()
    s.info["school_id"] = school_id
    s.info["bypass"] = bypass
    return s


@asynccontextmanager
async def system_session() -> AsyncIterator[AsyncSession]:
    """Crosses schools. Only for login, the platform owner, and background jobs."""
    s = make_session(bypass=True)
    try:
        yield s
        await s.commit()
    except Exception:
        await s.rollback()
        raise
    finally:
        await s.close()
