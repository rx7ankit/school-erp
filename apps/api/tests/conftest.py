"""Test harness: a real PostgreSQL database (migrations applied fresh) and a real Redis, no mocks for either."""

import asyncio
import os
import re
import subprocess
import sys
from pathlib import Path

# Must be set before the app is imported.
os.environ.update(
    ENV="test",
    DATABASE_URL=os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://scool:scool@localhost:5432/scool_test"),
    REDIS_URL=os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15"),
    EMAIL_BACKEND="memory",
    ARGON_TIME_COST="1",
    ARGON_MEMORY_KIB="64",
    JWT_SECRET="test-secret-test-secret-test-secret-123",
)

import asyncpg  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def pytest_sessionstart(session):
    """Fresh schema + migrations once per run."""
    dsn = os.environ["DATABASE_URL"].replace("+asyncpg", "")

    async def reset():
        c = await asyncpg.connect(dsn)
        try:
            await c.execute("drop schema public cascade; create schema public")
        finally:
            await c.close()

    asyncio.run(reset())
    r = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "heads"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"alembic failed:\n{r.stdout}\n{r.stderr}")


from app.core.security import hash_password  # noqa: E402
from app.db.redis import redis  # noqa: E402
from app.db.session import system_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enums import UserKind  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.email import MemoryEmailSender, set_sender  # noqa: E402

API = "/api/v1"
OWNER_EMAIL, OWNER_PASSWORD = "owner@krevo.tech", "Owner#12345"
STRONG = "Better#Pass99"


@pytest_asyncio.fixture(autouse=True)
async def clean():
    """Empty every table and the Redis db before each test."""
    from app.services.notifications import flush_pushes

    await flush_pushes()  # a push from the previous test must not hold locks while we truncate
    async with system_session() as db:
        from sqlalchemy import text

        names = (
            (
                await db.execute(
                    text("select tablename from pg_tables where schemaname='public' and tablename <> 'alembic_version'")
                )
            )
            .scalars()
            .all()
        )
        await db.execute(text("truncate " + ", ".join(names) + " restart identity cascade"))
    await redis.flushdb()
    mail = MemoryEmailSender()
    set_sender(mail)
    yield mail
    set_sender(None)


@pytest.fixture
def mail(clean) -> MemoryEmailSender:
    return clean


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def make_owner() -> None:
    async with system_session() as db:
        db.add(
            User(
                kind=UserKind.owner.value,
                name="Krevo Owner",
                email=OWNER_EMAIL,
                is_admin=True,
                must_change_password=False,
                password_hash=await hash_password(OWNER_PASSWORD),
            )
        )


async def sign_in(client: AsyncClient, email: str, password: str) -> dict:
    r = await client.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def bearer(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def temp_password_from(mail: MemoryEmailSender, to: str) -> str:
    m = mail.last_to(to)
    assert m, f"no email sent to {to}"
    found = re.search(r"Temporary password: (\S+)", m.body)
    assert found
    return found.group(1)


@pytest_asyncio.fixture
async def owner(client):
    await make_owner()
    return bearer(await sign_in(client, OWNER_EMAIL, OWNER_PASSWORD))


async def new_school(client, owner_headers, mail, name="Rewa Public School", admin_email="meera@rps.example") -> dict:
    """Owner creates a school, the admin opens the emailed login and picks their own password. Returns admin headers."""
    r = await client.post(
        f"{API}/owner/schools",
        headers=owner_headers,
        json={"name": name, "city": "Rewa", "admin_name": "Meera Rao", "admin_email": admin_email},
    )
    assert r.status_code == 201, r.text
    school = r.json()
    tmp = temp_password_from(mail, admin_email)
    t = await sign_in(client, admin_email, tmp)
    assert t["must_change_password"] is True
    h = bearer(t)
    r = await client.post(
        f"{API}/auth/change-password", headers=h, json={"current_password": tmp, "new_password": STRONG}
    )
    assert r.status_code == 204, r.text
    return {"school": school, "headers": bearer(await sign_in(client, admin_email, STRONG)), "email": admin_email}


@pytest_asyncio.fixture
async def school_a(client, owner, mail):
    return await new_school(client, owner, mail)


@pytest_asyncio.fixture
async def school_b(client, owner, mail):
    return await new_school(client, owner, mail, name="Satna Vidya Mandir", admin_email="admin@svm.example")


async def add_staff(
    client, headers, mail, *, name="Rajiv Mishra", email="rajiv@rps.example", send=True, **extra
) -> dict:
    r = await client.post(
        f"{API}/staff",
        headers=headers,
        json={"name": name, "email": email, "designation": "Teacher", "send_login": send, **extra},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def staff_headers(client, mail, email: str, new_password: str = STRONG) -> dict:
    """Signs a new staff member in with the emailed password and chooses their own."""
    tmp = temp_password_from(mail, email)
    h = bearer(await sign_in(client, email, tmp))
    r = await client.post(
        f"{API}/auth/change-password", headers=h, json={"current_password": tmp, "new_password": new_password}
    )
    assert r.status_code == 204, r.text
    return bearer(await sign_in(client, email, new_password))
