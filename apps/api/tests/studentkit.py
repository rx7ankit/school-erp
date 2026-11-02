"""Helpers for the student, admission and parent tests."""

import io

from conftest import API, add_staff, bearer, sign_in, staff_headers, temp_password_from
from openpyxl import Workbook, load_workbook

GUARD = {"name": "Rakesh Sharma", "phone": "9876543210", "relation": "father"}


async def make_class(client, h, grade="8", section="A", capacity=40) -> dict:
    r = await client.post(
        f"{API}/academic/classes", headers=h, json={"grade": grade, "section": section, "capacity": capacity}
    )
    assert r.status_code == 201, r.text
    return r.json()


async def enrol(client, h, class_id, first="Aarav", last="Sharma", guardians=None, **extra) -> dict:
    body = {
        "first_name": first,
        "last_name": last,
        "class_id": class_id,
        "guardians": guardians if guardians is not None else [GUARD],
        **extra,
    }
    r = await client.post(f"{API}/students", headers=h, json=body)
    assert r.status_code == 201, r.text
    return r.json()


async def teacher(client, admin_h, mail, email="t1@rps.example", class_id=None, perms=None):
    """A staff member, signed in. With class_id they become that class's teacher; perms are permission keys."""
    s = await add_staff(client, admin_h, mail, email=email, name=email.split("@")[0])
    if perms:
        r = await client.put(f"{API}/staff/{s['id']}/permissions", headers=admin_h, json={"permissions": perms})
        assert r.status_code == 200, r.text
    if class_id:
        r = await client.put(
            f"{API}/academic/classes/{class_id}/class-teacher", headers=admin_h, json={"staff_id": s["id"]}
        )
        assert r.status_code == 200, r.text
    return await staff_headers(client, mail, email)


async def parent_headers(client, mail, email, password="Parent#Pass9") -> dict:
    tmp = temp_password_from(mail, email)
    t = await sign_in(client, email, tmp)
    assert t["kind"] == "parent" and t["must_change_password"] is True
    h = bearer(t)
    r = await client.post(
        f"{API}/auth/change-password", headers=h, json={"current_password": tmp, "new_password": password}
    )
    assert r.status_code == 204, r.text
    return bearer(await sign_in(client, email, password))


def xlsx(rows: list[list], headers: list[str] | None = None) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(
        headers
        or [
            "Scholar No",
            "First Name",
            "Last Name",
            "Class",
            "Date of Birth",
            "Guardian Name",
            "Guardian Mobile",
            "Guardian Email",
        ]
    )
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def read_xlsx(content: bytes) -> list[list]:
    wb = load_workbook(io.BytesIO(content))
    return [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]


XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def upload(content: bytes, name="students.xlsx"):
    return {"file": (name, content, XLSX_TYPE)}
