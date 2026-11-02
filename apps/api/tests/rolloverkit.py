"""Helpers for the rollover tests."""

from conftest import API, add_staff
from studentkit import GUARD, enrol, make_class, parent_headers

from app.core.clock import today_ist


async def world(client, school, mail, with_parents=True):
    """Classes 8-A, 9-A, 12-A with Maths, a class teacher each, a Maths teacher for 8-A, Tuition per class (term),
    and students Aarav and Bhumi (8-A), Chirag (9-A), Diya (12-A), each with a parent login."""
    h = school["headers"]
    cls = {g: await make_class(client, h, grade=g, section="A") for g in ("8", "9", "12")}
    maths = (await client.post(f"{API}/academic/subjects", headers=h, json={"name": "Mathematics"})).json()
    for c in cls.values():
        r = await client.put(
            f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": [maths["id"]]}
        )
        assert r.status_code == 200, r.text
    staff = {}
    for key, g in (("ct8", "8"), ("ct9", "9"), ("ct12", "12")):
        staff[key] = await add_staff(client, h, mail, email=f"{key}@rps.example", name=f"Teacher {key}")
        r = await client.put(
            f"{API}/academic/classes/{cls[g]['id']}/class-teacher", headers=h, json={"staff_id": staff[key]["id"]}
        )
        assert r.status_code == 200, r.text
    staff["maths8"] = await add_staff(client, h, mail, email="maths8@rps.example", name="Maths Eight")
    r = await client.put(
        f"{API}/academic/classes/{cls['8']['id']}/subject-teachers/{maths['id']}",
        headers=h,
        json={"staff_id": staff["maths8"]["id"]},
    )
    assert r.status_code == 200, r.text
    head = (await client.post(f"{API}/fees/heads", headers=h, json={"name": "Tuition", "scope": "class"})).json()
    for g, amount in (("8", 100_000), ("9", 120_000), ("12", 150_000)):
        r = await client.put(
            f"{API}/fees/structures",
            headers=h,
            json={"class_id": cls[g]["id"], "fee_head_id": head["id"], "amount_paise": amount, "frequency": "term"},
        )
        assert r.status_code == 200, r.text
    kids = {}
    for name, g in (("Aarav", "8"), ("Bhumi", "8"), ("Chirag", "9"), ("Diya", "12")):
        guardian = {**GUARD, "name": f"Parent of {name}", "email": f"{name.lower()}@fam.example"}
        kids[name] = await enrol(
            client, h, cls[g]["id"], first=name, last="Sharma", guardians=[guardian], send_login=with_parents
        )
    parents = {}
    if with_parents:
        for name in kids:
            parents[name] = await parent_headers(client, mail, f"{name.lower()}@fam.example")
    return {"h": h, "cls": cls, "maths": maths, "staff": staff, "head": head, "kids": kids, "parents": parents}


async def status(client, h) -> dict:
    r = await client.get(f"{API}/rollover/status", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


async def apply(client, h, plan=None, expect=200, confirm=True):
    st = await status(client, h)
    body = {"from_year_id": st["current_year_id"], "confirm": confirm}
    if plan is not None:
        body["plan"] = plan
    r = await client.post(f"{API}/rollover/apply", headers=h, json=body)
    assert r.status_code == expect, r.text
    return r.json()


async def years(client, h) -> dict:
    items = (await client.get(f"{API}/academic/years", headers=h)).json()["items"]
    return {y["name"]: y for y in items}


async def student_class(client, h, student_id):
    s = (await client.get(f"{API}/students/{student_id}", headers=h)).json()
    return s


def first_term_due() -> str:
    return today_ist().replace(year=today_ist().year + 1, month=4, day=15).isoformat()
