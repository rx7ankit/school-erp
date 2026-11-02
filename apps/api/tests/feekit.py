"""Helpers for the fees tests."""

from conftest import API
from studentkit import GUARD, enrol, make_class

DUE = "2026-12-10"


async def post(client, h, url, body=None, status=None, **kw):
    r = await client.post(f"{API}{url}", headers=h, json=body if body is not None else {}, **kw)
    if status:
        assert r.status_code == status, r.text
    return r


async def put(client, h, url, body, status=200):
    r = await client.put(f"{API}{url}", headers=h, json=body)
    assert r.status_code == status, r.text
    return r.json()


async def get(client, h, url, status=200, **params):
    r = await client.get(f"{API}{url}", headers=h, params=params)
    assert r.status_code == status, r.text
    return r.json()


async def head(client, h, name="Tuition", scope="class") -> dict:
    r = await post(client, h, "/fees/heads", {"name": name, "scope": scope}, 201)
    return r.json()


async def structure(client, h, class_id, head_id, amount, frequency="monthly") -> dict:
    return await put(
        client,
        h,
        "/fees/structures",
        {"class_id": class_id, "fee_head_id": head_id, "amount_paise": amount, "frequency": frequency},
    )


async def school_with_fees(client, h, tuition=100_000, lab=None, students=("Aarav",), emails=True):
    """A class 8-A with Tuition (monthly) and optional Lab (yearly), and some enrolled students."""
    cls = await make_class(client, h)
    t = await head(client, h, "Tuition")
    await structure(client, h, cls["id"], t["id"], tuition)
    lab_head = None
    if lab:
        lab_head = await head(client, h, "Lab")
        await structure(client, h, cls["id"], lab_head["id"], lab, "yearly")
    studs = []
    for name in students:
        g = {**GUARD, "email": f"{name.lower()}@fam.example"} if emails else GUARD
        studs.append(
            await enrol(client, h, cls["id"], first=name, guardians=[g], create_parent_login=emails, send_login=emails)
        )
    return {"cls": cls, "tuition": t, "lab": lab_head, "students": studs}


async def run(client, h, period="April", due=DUE, status=201, **extra):
    r = await post(client, h, "/fees/invoice-runs", {"period_label": period, "due_on": due, **extra}, status)
    return r.json()


async def invoices(client, h, **params):
    return (await get(client, h, "/fees/invoices", **params))["items"]


async def pay(client, h, invoice_id, amount, mode="cash", status=201, **extra):
    r = await post(
        client, h, f"/fees/invoices/{invoice_id}/payments", {"amount_paise": amount, "mode": mode, **extra}, status
    )
    return r.json()
