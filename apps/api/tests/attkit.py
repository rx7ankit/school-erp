"""Helpers for the attendance and leave tests."""

from datetime import timedelta

from conftest import API
from studentkit import GUARD, enrol, make_class, parent_headers, teacher

from app.core.clock import today_ist

TODAY = today_ist()


def day(offset: int = 0) -> str:
    return (TODAY - timedelta(days=offset)).isoformat()


def rec(student_id, first="present", second="present", **extra) -> dict:
    return {"student_id": student_id, "first_half": first, "second_half": second, **extra}


async def classroom(client, school, mail, email="t1@rps.example", grade="8", n=3, parents=True, tag=""):
    """A class with a class teacher and `n` students. Returns (class, teacher headers, students, parent headers)."""
    h = school["headers"]
    c = await make_class(client, h, grade=grade)
    th = await teacher(client, h, mail, email, class_id=c["id"])
    names = ["Aarav", "Bhavna", "Chirag", "Divya"][:n]
    kids = []
    for nm in names:
        g = {**GUARD, "email": f"{nm.lower()}.parent{grade}{tag}@example.com", "name": f"Parent {nm}"}
        kids.append(await enrol(client, h, c["id"], first=nm, guardians=[g], send_login=parents))
    ph = None
    if parents:
        ph = await parent_headers(client, mail, f"aarav.parent{grade}{tag}@example.com")
    return c, th, kids, ph


async def mark(client, th, class_id, day_on, records, expect=200):
    r = await client.put(f"{API}/attendance/classes/{class_id}/days/{day_on}", headers=th, json={"records": records})
    assert r.status_code == expect, r.text
    return r.json()
