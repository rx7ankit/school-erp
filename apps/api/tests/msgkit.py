"""A small school for the messaging tests: class 8-A (class teacher, maths teacher, two families) and 8-B."""

from conftest import API, add_staff, staff_headers
from studentkit import GUARD, enrol, make_class, parent_headers

from app.services.push import MemoryPushSender, set_push_sender


def new_push() -> MemoryPushSender:
    s = MemoryPushSender()
    set_push_sender(s)
    return s


async def world(client, admin_h, mail) -> dict:
    h = admin_h
    a = await make_class(client, h, "8", "A")
    b = await make_class(client, h, "8", "B")
    maths = (await client.post(f"{API}/academic/subjects", headers=h, json={"name": "Mathematics"})).json()
    eng = (await client.post(f"{API}/academic/subjects", headers=h, json={"name": "English"})).json()
    for c in (a, b):
        await client.put(
            f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": [maths["id"], eng["id"]]}
        )
    staff = {}
    for key, name in (
        ("ct", "Rajiv Mishra"),
        ("mt", "Sunita Dwivedi"),
        ("bt", "Bhanu Pratap"),
        ("free", "Free Teacher"),
        ("ct2", "Neha Gupta"),
    ):
        s = await add_staff(client, h, mail, email=f"{key}@rps.example", name=name)
        staff[key] = {"id": s["id"], "h": await staff_headers(client, mail, f"{key}@rps.example")}

    async def put(path, sid):
        r = await client.put(f"{API}/academic/classes/{path}", headers=h, json={"staff_id": sid})
        assert r.status_code == 200, r.text

    await put(f"{a['id']}/class-teacher", staff["ct"]["id"])
    await put(f"{a['id']}/subject-teachers/{maths['id']}", staff["mt"]["id"])
    await put(f"{b['id']}/class-teacher", staff["bt"]["id"])
    g1 = {**GUARD, "email": "rakesh@example.com"}
    g2 = {**GUARD, "name": "Mohan", "email": "mohan@example.com"}
    g3 = {**GUARD, "name": "Sunil", "email": "sunil@example.com"}
    aarav = await enrol(client, h, a["id"], first="Aarav", guardians=[g1])
    other = await enrol(client, h, a["id"], first="Other", guardians=[g2])
    bkid = await enrol(client, h, b["id"], first="Bkid", guardians=[g3])
    assert (await client.post(f"{API}/parents/send-login", headers=h, json={})).status_code == 200
    parents = {
        "rakesh": await parent_headers(client, mail, "rakesh@example.com"),
        "mohan": await parent_headers(client, mail, "mohan@example.com"),
        "sunil": await parent_headers(client, mail, "sunil@example.com"),
    }
    return dict(
        a=a, b=b, maths=maths, eng=eng, staff=staff, aarav=aarav, other=other, bkid=bkid, parents=parents, admin=h
    )
