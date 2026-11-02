"""One school's attendance, holidays and leave are invisible to another."""

import uuid

import pytest
from attkit import classroom, day, mark, rec
from conftest import API
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError

from app.core.clock import utcnow
from app.db.session import make_session
from app.models.attendance import AttendanceDay, AttendanceRecord, Holiday, LeaveRequest, StaffAttendance

MODELS = [Holiday, AttendanceDay, AttendanceRecord, StaffAttendance, LeaveRequest]


async def seed(client, school, mail, email, grade, parent_email_prefix):
    c, th, kids, ph = await classroom(client, school, mail, email=email, grade=grade, n=1, tag=parent_email_prefix)
    await mark(client, th, c["id"], day(0), [rec(kids[0]["id"])])
    await client.post(f"{API}/holidays", headers=school["headers"], json={"title": "H", "from_on": day(3)})
    lv = await client.post(
        f"{API}/parent/children/{kids[0]['id']}/leave", headers=ph, json={"from_on": day(0), "reason": "x"}
    )
    assert lv.status_code == 201, lv.text
    staff = (await client.get(f"{API}/attendance/staff", headers=school["headers"])).json()
    await client.put(
        f"{API}/attendance/staff/{day(0)}",
        headers=school["headers"],
        json={"records": [{"staff_id": staff[0]["staff_id"], "status": "present"}]},
    )
    return c, th, kids, ph, lv.json()


async def test_other_schools_attendance_is_invisible_through_the_api(client, school_a, school_b, mail):
    ca, tha, ka, pha, la = await seed(client, school_a, mail, "ta@rps.example", "8", "a")
    cb, thb, kb, phb, lb = await seed(client, school_b, mail, "tb@svm.example", "8", "b")
    ha, hb = school_a["headers"], school_b["headers"]
    # classes, students, leave of the other school: not found / not allowed
    assert (await client.get(f"{API}/attendance/classes/{cb['id']}/sheet", headers=ha)).status_code == 404
    assert (await client.get(f"{API}/attendance/classes/{cb['id']}/stats", headers=ha)).status_code == 404
    assert (await client.get(f"{API}/attendance/classes/{cb['id']}/days", headers=ha)).status_code == 404
    assert (
        await client.put(
            f"{API}/attendance/classes/{cb['id']}/days/{day(0)}", headers=ha, json={"records": [rec(kb[0]["id"])]}
        )
    ).status_code == 404
    assert (await client.get(f"{API}/attendance/students/{kb[0]['id']}/stats", headers=ha)).status_code == 404
    assert (
        await client.get(f"{API}/attendance/students/{kb[0]['id']}/calendar", headers=ha, params={"month": day(0)[:7]})
    ).status_code == 404
    assert (await client.get(f"{API}/leave/{lb['id']}", headers=ha)).status_code == 404
    assert (
        await client.post(f"{API}/leave/{lb['id']}/decision", headers=ha, json={"decision": "approve"})
    ).status_code == 404
    assert (await client.post(f"{API}/parent/leave/{lb['id']}/cancel", headers=pha)).status_code == 404
    assert (await client.get(f"{API}/parent/children/{kb[0]['id']}/leave", headers=pha)).status_code == 404
    # lists contain only the own school
    assert [x["id"] for x in (await client.get(f"{API}/leave", headers=ha)).json()["items"]] == [la["id"]]
    assert len((await client.get(f"{API}/holidays", headers=ha)).json()) == 1
    hid = (await client.get(f"{API}/holidays", headers=hb)).json()[0]["id"]
    assert (await client.patch(f"{API}/holidays/{hid}", headers=ha, json={"title": "Hacked"})).status_code == 404
    assert (await client.delete(f"{API}/holidays/{hid}", headers=ha)).status_code == 404
    an = (await client.get(f"{API}/attendance/analytics", headers=ha)).json()
    assert [r["class_id"] for r in an["by_class"]] == [ca["id"]]
    rows = (await client.get(f"{API}/attendance/analytics/teachers", headers=ha)).json()
    assert all(r["name"] != "tb" for r in rows)
    staff_b = (await client.get(f"{API}/attendance/staff", headers=hb)).json()[0]["staff_id"]
    r = await client.put(
        f"{API}/attendance/staff/{day(0)}", headers=ha, json={"records": [{"staff_id": staff_b, "status": "absent"}]}
    )
    assert r.json()["error"]["code"] == "not_staff"


async def test_rows_are_isolated_by_postgres_itself(client, school_a, school_b, mail):
    await seed(client, school_a, mail, "ta@rps.example", "8", "a")
    await seed(client, school_b, mail, "tb@svm.example", "8", "b")
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    for me in (a_id, b_id):
        s = make_session(school_id=me)
        try:
            for model in MODELS:
                rows = (await s.scalars(select(model))).all()
                assert rows, model.__tablename__
                assert {r.school_id for r in rows} == {me}, model.__tablename__
        finally:
            await s.close()
    nobody = make_session()
    try:
        for model in MODELS:
            assert (await nobody.scalars(select(model))).all() == [], model.__tablename__
    finally:
        await nobody.close()


@pytest.mark.parametrize(
    "build",
    [
        lambda b: Holiday(school_id=b, title="Sneaky", from_on=utcnow().date(), to_on=utcnow().date()),
        lambda b: StaffAttendance(
            school_id=b,
            staff_id=uuid.uuid4(),
            day_on=utcnow().date(),
            status="present",
            marked_by=uuid.uuid4(),
            marked_at=utcnow(),
        ),
    ],
)
async def test_postgres_blocks_writing_into_another_school(client, school_a, school_b, build):
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=a_id)
    try:
        s.add(build(b_id))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()
