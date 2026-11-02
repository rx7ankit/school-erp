"""Helpers for the timetable and certificate tests."""

from conftest import API, add_staff, staff_headers
from studentkit import make_class

MON = "2026-11-02"  # a Monday inside the school's current year
TUE = "2026-11-03"
SUN = "2026-11-08"


async def period(client, h, number=1, start="09:00:00", end="09:40:00", name=None):
    r = await client.post(
        f"{API}/timetable/periods",
        headers=h,
        json={"number": number, "name": name or f"Period {number}", "starts_at": start, "ends_at": end},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def subject(client, h, name="Mathematics"):
    r = await client.post(f"{API}/academic/subjects", headers=h, json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


async def staff(client, h, mail, email, perms=None, login=True):
    """A staff member (dict from the API); with login=True also their headers under key `headers`."""
    s = await add_staff(client, h, mail, name=email.split("@")[0].title(), email=email)
    if perms:
        r = await client.put(f"{API}/staff/{s['id']}/permissions", headers=h, json={"permissions": perms})
        assert r.status_code == 200, r.text
    if login:
        s["headers"] = await staff_headers(client, mail, email)
    return s


async def slot(client, h, class_id, weekday, period_id, subject_id, staff_id, expect=201):
    r = await client.post(
        f"{API}/timetable/slots",
        headers=h,
        json={
            "class_id": class_id,
            "weekday": weekday,
            "period_id": period_id,
            "subject_id": subject_id,
            "staff_id": staff_id,
        },
    )
    assert r.status_code == expect, r.text
    return r.json()


async def school_setup(client, h, mail):
    """Class 8-A, Maths, periods 1 and 2, teachers Asha and Bhanu, and a free teacher Chetan."""
    cls = await make_class(client, h)
    maths = await subject(client, h)
    p1, p2 = await period(client, h, 1), await period(client, h, 2, "09:40:00", "10:20:00")
    asha = await staff(client, h, mail, "asha@rps.example")
    bhanu = await staff(client, h, mail, "bhanu@rps.example")
    chetan = await staff(client, h, mail, "chetan@rps.example")
    return {"cls": cls, "maths": maths, "p1": p1, "p2": p2, "asha": asha, "bhanu": bhanu, "chetan": chetan}
