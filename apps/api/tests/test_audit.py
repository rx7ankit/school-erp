from datetime import UTC, datetime

from conftest import API, add_staff, staff_headers

from app.db.session import system_session
from app.models.audit import AuditLog


async def put_event(school_id, at: datetime, **kw):
    async with system_session() as db:
        db.add(
            AuditLog(
                school_id=school_id,
                at=at,
                actor_name=kw.get("actor", "Meera Rao"),
                actor_role="Admin",
                category=kw.get("category", "fees"),
                action=kw.get("action", "payment.recorded"),
                summary=kw.get("summary", "Recorded something"),
                sensitive=kw.get("sensitive", False),
            )
        )


async def test_only_people_and_access_can_read_the_audit_log(client, school_a, mail):
    await add_staff(client, school_a["headers"], mail, email="x@rps.example")
    th = await staff_headers(client, mail, "x@rps.example")
    r = await client.get(f"{API}/audit", headers=th)
    assert r.status_code == 403 and r.json()["error"]["code"] == "missing_permission"
    assert (await client.get(f"{API}/audit", headers=school_a["headers"])).status_code == 200


async def test_setup_actions_write_to_the_log_with_the_actor(client, school_a, mail):
    await add_staff(client, school_a["headers"], mail, email="y@rps.example", name="Yash Soni")
    items = (await client.get(f"{API}/audit", headers=school_a["headers"], params={"q": "Yash"})).json()["items"]
    assert {i["action"] for i in items} >= {"staff.added", "login.sent"}
    assert all(i["actor_name"] == "Meera Rao" for i in items)


async def test_login_is_recorded_and_so_is_a_failed_attempt(client, school_a):
    await client.post(f"{API}/auth/login", json={"email": school_a["email"], "password": "Wrong#Pass1"})
    items = (
        await client.get(f"{API}/audit", headers=school_a["headers"], params={"category": "security", "limit": 50})
    ).json()["items"]
    actions = [i["action"] for i in items]
    assert "login.success" in actions and "login.failed" in actions and "password.changed" in actions
    failed = next(i for i in items if i["action"] == "login.failed")
    assert failed["sensitive"] is True and failed["actor_name"] == "Unknown"


async def test_filters_search_and_paging(client, school_a):
    sid = school_a["school"]["id"]
    t0 = datetime(2026, 10, 1, 6, 0, tzinfo=UTC)
    for i in range(30):
        await put_event(
            sid,
            t0.replace(day=1 + i % 28),
            summary=f"Recorded payment {i}",
            actor="Suresh Tiwari",
            sensitive=i % 5 == 0,
            category="fees" if i % 2 else "attendance",
            action="payment.recorded" if i % 2 else "attendance.saved",
        )
    h = school_a["headers"]
    allr = (await client.get(f"{API}/audit", headers=h, params={"limit": 10})).json()
    assert len(allr["items"]) == 10 and allr["total"] >= 30
    assert allr["items"][0]["at"] >= allr["items"][-1]["at"]  # newest first
    sens = (await client.get(f"{API}/audit", headers=h, params={"sensitive": True, "actor": "Suresh Tiwari"})).json()
    assert sens["total"] == 6 and all(i["sensitive"] for i in sens["items"])
    q = (await client.get(f"{API}/audit", headers=h, params={"q": "payment 7"})).json()
    assert q["total"] == 1 and q["items"][0]["summary"].endswith("7")
    cat = (
        await client.get(f"{API}/audit", headers=h, params={"category": "attendance", "actor": "Suresh Tiwari"})
    ).json()
    assert cat["total"] == 15
    page2 = (await client.get(f"{API}/audit", headers=h, params={"limit": 10, "offset": 10})).json()
    assert page2["items"][0]["id"] != allr["items"][0]["id"]


async def test_date_filters_use_the_school_day_in_ist_not_utc(client, school_a):
    """19:00 UTC on 1 Nov is 00:30 IST on 2 Nov. It belongs to 2 Nov for the school."""
    sid = school_a["school"]["id"]
    await put_event(sid, datetime(2026, 11, 1, 19, 0, tzinfo=UTC), summary="Late evening event")
    h = school_a["headers"]
    nov2 = (
        await client.get(
            f"{API}/audit", headers=h, params={"date_from": "2026-11-02", "date_to": "2026-11-02", "q": "Late evening"}
        )
    ).json()
    nov1 = (
        await client.get(
            f"{API}/audit", headers=h, params={"date_from": "2026-11-01", "date_to": "2026-11-01", "q": "Late evening"}
        )
    ).json()
    assert nov2["total"] == 1 and nov1["total"] == 0


async def test_options_list_people_and_actions(client, school_a, mail):
    await add_staff(client, school_a["headers"], mail, email="z@rps.example")
    o = (await client.get(f"{API}/audit/options", headers=school_a["headers"])).json()
    assert "Meera Rao" in o["actors"] and "staff.added" in o["actions"]
