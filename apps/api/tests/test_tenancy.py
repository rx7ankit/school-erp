"""One school must never see another's data. Checked through the API and straight against Postgres."""

import uuid

import pytest
from conftest import API, add_staff
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, ProgrammingError

from app.db.session import make_session, system_session
from app.models.audit import AuditLog
from app.models.student import Student
from app.models.user import StaffProfile


async def test_staff_lists_are_separate(client, school_a, school_b, mail):
    await add_staff(client, school_a["headers"], mail, email="a1@rps.example", name="Alpha One")
    await add_staff(client, school_b["headers"], mail, email="b1@svm.example", name="Beta One")
    a = {s["email"] for s in (await client.get(f"{API}/staff", headers=school_a["headers"])).json()["items"]}
    b = {s["email"] for s in (await client.get(f"{API}/staff", headers=school_b["headers"])).json()["items"]}
    assert "a1@rps.example" in a and "b1@svm.example" not in a
    assert "b1@svm.example" in b and "a1@rps.example" not in b


async def test_other_schools_records_are_not_found_by_id(client, school_a, school_b, mail):
    other = await add_staff(client, school_b["headers"], mail, email="b2@svm.example")
    r = await client.patch(f"{API}/staff/{other['id']}", headers=school_a["headers"], json={"name": "Hacked"})
    assert r.status_code == 404
    r = await client.put(
        f"{API}/staff/{other['id']}/permissions", headers=school_a["headers"], json={"permissions": ["fees.manage"]}
    )
    assert r.status_code == 404


async def test_audit_logs_are_separate(client, school_a, school_b, mail):
    await add_staff(client, school_a["headers"], mail, email="a3@rps.example", name="Secret Staffer")
    items = (await client.get(f"{API}/audit", headers=school_b["headers"], params={"limit": 200})).json()["items"]
    assert not any("Secret Staffer" in i["summary"] for i in items)


async def test_postgres_itself_hides_other_schools(client, school_a, school_b, mail):
    """Even a query with no WHERE clause only returns the caller's school, because of row level security."""
    await add_staff(client, school_a["headers"], mail, email="a4@rps.example")
    await add_staff(client, school_b["headers"], mail, email="b4@svm.example")
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    for me, other in ((a_id, b_id), (b_id, a_id)):
        s = make_session(school_id=me)
        try:
            schools = {r.school_id for r in (await s.scalars(select(StaffProfile))).all()}
            assert schools == {me}
            assert other not in schools
        finally:
            await s.close()


async def test_postgres_blocks_writing_into_another_school(client, school_a, school_b):
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=a_id)
    try:
        s.add(Student(school_id=b_id, scholar_no="X1", first_name="Sneaky"))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()


async def test_no_school_means_no_rows(client, school_a):
    s = make_session()  # no school, no bypass
    try:
        assert (await s.scalars(select(StaffProfile))).all() == []
        assert (await s.execute(text("select count(*) from users"))).scalar() == 0
        assert (await s.execute(text("select count(*) from schools"))).scalar() == 0
    finally:
        await s.close()


async def test_school_admin_cannot_use_owner_routes(client, school_a):
    assert (await client.get(f"{API}/owner/schools", headers=school_a["headers"])).status_code == 403
    assert (await client.get(f"{API}/owner/stats", headers=school_a["headers"])).status_code == 403


async def test_audit_trail_cannot_be_changed_or_deleted(client, school_a):
    async with system_session() as db:
        with pytest.raises((DBAPIError, ProgrammingError)) as e:
            await db.execute(text("update audit_logs set summary = 'edited'"))
        assert "append-only" in str(e.value)
    async with system_session() as db:
        with pytest.raises((DBAPIError, ProgrammingError)):
            await db.execute(text("delete from audit_logs"))
    async with system_session() as db:
        assert (await db.scalar(select(AuditLog).limit(1))) is not None
