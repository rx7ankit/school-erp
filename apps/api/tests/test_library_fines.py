"""A library fine of a student is a real fee invoice: dues, payments, receipts, reports, parents, carry-forward."""

import uuid
from datetime import timedelta

from conftest import API, add_staff
from feekit import get, invoices, pay, run
from rolloverkit import world as school_world
from sqlalchemy import select, update

from app.core.clock import today_ist
from app.db.session import make_session
from app.models.fees import FeeHead, FeeInvoice
from app.models.library import LibraryLoan
from app.models.notification import Notification

L = f"{API}/library"
TODAY = today_ist()
RANGE = {"date_from": (TODAY - timedelta(days=1)).isoformat(), "date_to": (TODAY + timedelta(days=1)).isoformat()}


async def setup(client, school, mail, fine=500):
    w = await school_world(client, school, mail)
    h = w["h"]
    r = await client.put(f"{L}/settings", headers=h, json={"loan_days": 7, "fine_per_day_paise": fine})
    assert r.status_code == 200, r.text
    book = (
        await client.post(f"{L}/books", headers=h, json={"title": "Wings of Fire", "author": "Kalam", "copies": 3})
    ).json()
    w["book"] = book
    return w


async def lend(client, h, copy, days_late, **who):
    r = await client.post(f"{L}/loans", headers=h, json={"copy_id": copy["id"], **who})
    assert r.status_code == 201, r.text
    loan = r.json()
    async with make_session(bypass=True) as s:
        await s.execute(
            update(LibraryLoan)
            .where(LibraryLoan.id == uuid.UUID(loan["id"]))
            .values(due_on=TODAY - timedelta(days=days_late))
        )
        await s.commit()
    return loan


async def give_back(client, h, loan, status=200, **body):
    r = await client.post(f"{L}/loans/{loan['id']}/return", headers=h, json=body)
    assert r.status_code == status, r.text
    return r.json()


async def loans_of(client, h, student_id):
    r = await client.get(f"{L}/loans", headers=h, params={"status": "all", "student_id": student_id})
    return r.json()["items"]


async def fine_invoices(client, h, student_id):
    return [i for i in await invoices(client, h, student_id=student_id) if i["period_label"].startswith("Library fine")]


async def test_return_with_fine_creates_one_invoice_and_payments_move_the_status(client, school_a, mail):
    w = await setup(client, school_a, mail)
    h, aarav = w["h"], w["kids"]["Aarav"]["id"]
    loan = await lend(client, h, w["book"]["copies"][0], 4, student_id=aarav)
    out = await give_back(client, h, loan)
    assert out["fine_paise"] == 2_000 and out["fine_status"] == "unpaid" and out["fine_paid"] is False
    assert out["fine_invoice_id"] and out["fine_invoice_no"] and out["fine_balance_paise"] == 2_000
    inv = await fine_invoices(client, h, aarav)
    assert len(inv) == 1 and inv[0]["id"] == out["fine_invoice_id"] and inv[0]["total_paise"] == 2_000
    assert inv[0]["due_on"] == (TODAY + timedelta(days=7)).isoformat()
    detail = await get(client, h, f"/fees/invoices/{inv[0]['id']}")
    assert [(i["kind"], i["description"], i["amount_paise"]) for i in detail["items"]] == [
        ("fee", "Library fine", 2_000)
    ]
    # part payment, then the rest
    p1 = await pay(client, h, inv[0]["id"], 500)
    row = (await loans_of(client, h, aarav))[0]
    assert row["fine_status"] == "partial" and row["fine_paid"] is False and row["fine_balance_paise"] == 1_500
    await pay(client, h, inv[0]["id"], 1_500)
    row = (await loans_of(client, h, aarav))[0]
    assert row["fine_status"] == "paid" and row["fine_paid"] is True and row["fine_balance_paise"] == 0
    receipt = await get(client, h, f"/fees/payments/{p1['id']}")
    assert receipt["amount_paise"] == 500
    # the head is a system head, hidden from structures and options, and cannot be edited
    heads = {x["name"]: x for x in await get(client, h, "/fees/heads")}
    assert heads["Library fine"]["is_system"] is True
    r = await client.put(
        f"{API}/fees/structures",
        headers=h,
        json={
            "class_id": w["cls"]["8"]["id"],
            "fee_head_id": heads["Library fine"]["id"],
            "amount_paise": 100,
            "frequency": "term",
        },
    )
    assert r.status_code == 422
    r = await client.patch(f"{API}/fees/heads/{heads['Library fine']['id']}", headers=h, json={"name": "X"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "system_head"


async def test_fine_shows_in_dues_collection_by_head_parent_fees_and_notification(client, school_a, mail):
    w = await setup(client, school_a, mail)
    h, aarav = w["h"], w["kids"]["Aarav"]["id"]
    ph = w["parents"]["Aarav"]
    out = await give_back(client, h, await lend(client, h, w["book"]["copies"][0], 3, student_id=aarav))
    assert out["fine_paise"] == 1_500
    dues = await get(client, h, "/fees/reports/dues")
    assert dues["total_due_paise"] == 1_500 and dues["students"] == 1
    await pay(client, h, out["fine_invoice_id"], 1_000)
    heads = {
        r["label"]: r["amount_paise"]
        for r in (await get(client, h, "/fees/reports/collection", **RANGE, group_by="head"))["rows"]
    }
    assert heads == {"Library fine": 1_000}
    fees = await get(client, ph, f"/parent/children/{aarav}/fees")
    assert fees["balance_paise"] == 500
    assert fees["invoices"][0]["id"] == out["fine_invoice_id"] and fees["invoices"][0]["status"] == "partial"
    lib = await get(client, ph, f"/parent/children/{aarav}/library")
    assert lib["current"] == [] and len(lib["fines"]) == 1
    f = lib["fines"][0]
    assert (f["fine_paise"], f["fine_status"], f["fine_paid"], f["balance_paise"]) == (1_500, "partial", False, 500)
    await pay(client, h, out["fine_invoice_id"], 500)
    lib = await get(client, ph, f"/parent/children/{aarav}/library")
    assert lib["fines"][0]["fine_paid"] is True
    # bilingual notification for the parent, once
    async with make_session(bypass=True) as s:
        rows = (await s.scalars(select(Notification).where(Notification.title == "Library fine"))).all()
    assert len(rows) == 1
    assert '"Wings of Fire"' in rows[0].body and "Aarav" in rows[0].body and "₹1,500" not in rows[0].body
    assert "₹15" in rows[0].body
    # another family's child stays invisible
    other = w["kids"]["Chirag"]["id"]
    r = await client.get(f"{API}/parent/children/{other}/library", headers=ph)
    assert r.status_code == 404


async def test_waived_fine_and_no_fine_create_no_invoice_and_fine_override_is_billed(client, school_a, mail):
    w = await setup(client, school_a, mail)
    h, aarav = w["h"], w["kids"]["Aarav"]["id"]
    copies = w["book"]["copies"]
    out = await give_back(
        client, h, await lend(client, h, copies[0], 5, student_id=aarav), waive_fine=True, waive_reason="Sick"
    )
    assert out["fine_status"] == "waived" and out["fine_invoice_id"] is None
    out = await give_back(client, h, await lend(client, h, copies[1], 0, student_id=aarav))
    assert out["fine_status"] == "none" and out["fine_invoice_id"] is None
    assert await fine_invoices(client, h, aarav) == []
    # a lost book with a replacement charge is billed even when on time
    out = await give_back(
        client, h, await lend(client, h, copies[2], 0, student_id=aarav), condition="lost", fine_paise=30_000
    )
    assert out["fine_status"] == "unpaid" and out["fine_balance_paise"] == 30_000
    assert len(await fine_invoices(client, h, aarav)) == 1


async def test_double_return_does_not_duplicate_and_same_book_twice_gets_two_invoices(client, school_a, mail):
    w = await setup(client, school_a, mail)
    h, aarav = w["h"], w["kids"]["Aarav"]["id"]
    copy = w["book"]["copies"][0]
    loan = await lend(client, h, copy, 2, student_id=aarav)
    await give_back(client, h, loan)
    again = await give_back(client, h, loan, status=409)
    assert again["error"]["code"] == "loan_closed"
    assert len(await fine_invoices(client, h, aarav)) == 1
    out2 = await give_back(client, h, await lend(client, h, copy, 1, student_id=aarav))
    invs = await fine_invoices(client, h, aarav)
    assert len(invs) == 2 and len({i["invoice_no"] for i in invs}) == 2 and out2["fine_invoice_id"]
    assert len({i["period_label"] for i in invs}) == 2


async def test_staff_borrower_gets_no_invoice(client, school_a, mail):
    w = await setup(client, school_a, mail)
    h = w["h"]
    staff = await add_staff(client, h, mail, email="lib.user@rps.example", name="Lib User")
    out = await give_back(client, h, await lend(client, h, w["book"]["copies"][0], 3, staff_id=staff["id"]))
    assert out["fine_paise"] == 1_500 and out["fine_status"] == "manual" and out["fine_invoice_id"] is None
    assert out["fine_balance_paise"] == 1_500
    assert (await get(client, h, "/fees/reports/dues"))["total_due_paise"] == 0
    assert await invoices(client, h) == []


async def test_invoice_runs_never_include_it_and_no_late_fee_is_added(client, school_a, mail):
    w = await setup(client, school_a, mail)
    h, aarav = w["h"], w["kids"]["Aarav"]["id"]
    out = await give_back(client, h, await lend(client, h, w["book"]["copies"][0], 3, student_id=aarav))
    r = await client.post(f"{API}/fees/late-rules", headers=h, json={"grace_days": 0, "amount_paise": 1_000})
    assert r.status_code == 201, r.text
    async with make_session(bypass=True) as s:
        await s.execute(update(FeeInvoice).values(due_on=TODAY - timedelta(days=30)))
        await s.commit()
    r = await client.post(f"{API}/fees/late-fees/apply", headers=h, json={})
    assert r.status_code == 200, r.text
    detail = await get(client, h, f"/fees/invoices/{out['fine_invoice_id']}")
    assert detail["total_paise"] == 1_500 and [i["kind"] for i in detail["items"]] == ["fee"]
    # a normal run bills tuition only; the fine invoice is carried forward into it as previous dues
    await run(client, h, "Term 1", frequencies=["term"])
    mine = [i for i in await invoices(client, h, student_id=aarav) if i["period_label"] == "Term 1"]
    d = await get(client, h, f"/fees/invoices/{mine[0]['id']}")
    assert [(i["kind"], i["amount_paise"]) for i in d["items"]] == [("fee", 100_000), ("previous_dues", 1_500)]
    row = (await loans_of(client, h, aarav))[0]
    assert row["fine_status"] == "closed" and row["fine_balance_paise"] == 0
    async with make_session(bypass=True) as s:
        heads = (await s.scalars(select(FeeHead).where(FeeHead.name == "Library fine"))).all()
    assert len(heads) == 1


async def test_other_school_cannot_see_the_fine_invoice_or_head(client, school_a, school_b, mail):
    w = await setup(client, school_a, mail)
    h, aarav = w["h"], w["kids"]["Aarav"]["id"]
    out = await give_back(client, h, await lend(client, h, w["book"]["copies"][0], 3, student_id=aarav))
    hb = school_b["headers"]
    r = await client.get(f"{API}/fees/invoices/{out['fine_invoice_id']}", headers=hb)
    assert r.status_code == 404
    assert await get(client, hb, "/fees/heads") == []
    assert (await get(client, hb, "/fees/reports/dues"))["total_due_paise"] == 0
    async with make_session(bypass=True) as s:
        head = await s.scalar(select(FeeHead).where(FeeHead.name == "Library fine"))
        assert head is not None and head.school_id is not None
