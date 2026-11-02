"""What a parent sees of fees: only their own children, receipts included, cancelled ones labelled."""

from conftest import API
from feekit import get, invoices, pay, post, run, school_with_fees
from studentkit import enrol, parent_headers


async def setup(client, h, mail):
    s = await school_with_fees(client, h, students=("Aarav", "Bina"))
    await run(client, h, "April", due="2026-01-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, h)}
    ph = await parent_headers(client, mail, "aarav@fam.example")
    return s, inv, ph


async def test_parent_sees_dues_invoices_and_receipts_of_own_child(client, school_a, mail):
    h = school_a["headers"]
    s, inv, ph = await setup(client, h, mail)
    aarav = s["students"][0]["id"]
    p1 = await pay(client, h, inv["Aarav"]["id"], 40_000)
    summary = await get(client, ph, "/parent/fees")
    assert [c["student_name"] for c in summary] == ["Aarav Sharma"]
    assert summary[0]["due_paise"] == 60_000 and summary[0]["overdue_paise"] == 60_000
    assert summary[0]["read_only"] is False and summary[0]["next_due_on"] == "2026-01-10"
    f = await get(client, ph, f"/parent/children/{aarav}/fees")
    assert f["balance_paise"] == 60_000 and f["invoices"][0]["status"] == "partial"
    d = await get(client, ph, f"/parent/children/{aarav}/fees/invoices/{inv['Aarav']['id']}")
    assert d["items"][0]["description"] == "Tuition" and d["payments"][0]["receipt_no"] == p1["receipt_no"]
    rs = await get(client, ph, f"/parent/children/{aarav}/fees/receipts")
    assert [r["receipt_no"] for r in rs] == ["RCP-000001"] and rs[0]["status_label"] == "Paid"
    one = await get(client, ph, f"/parent/children/{aarav}/fees/receipts/{p1['id']}")
    assert one["amount_paise"] == 40_000 and one["school_name"] and one["class_label"] == "8-A"


async def test_cancelled_receipt_says_cancelled_by_school_and_hides_the_reason(client, school_a, mail):
    h = school_a["headers"]
    s, inv, ph = await setup(client, h, mail)
    aarav = s["students"][0]["id"]
    p1 = await pay(client, h, inv["Aarav"]["id"], 40_000)
    await post(client, h, f"/fees/payments/{p1['id']}/cancel", {"reason": "cheque bounced"}, 200)
    r = await get(client, ph, f"/parent/children/{aarav}/fees/receipts/{p1['id']}")
    assert r["status"] == "cancelled" and r["status_label"] == "Cancelled by school"
    assert r["cancel_reason"] is None
    d = await get(client, ph, f"/parent/children/{aarav}/fees/invoices/{inv['Aarav']['id']}")
    assert d["payments"][0]["cancel_reason"] is None and d["payments"][0]["cancelled_by_name"] is None
    assert "cheque bounced" not in str(d) and d["balance_paise"] == 100_000


async def test_another_familys_child_is_404_everywhere(client, school_a, mail):
    h = school_a["headers"]
    s, inv, ph = await setup(client, h, mail)
    bina = s["students"][1]["id"]
    pb = await pay(client, h, inv["Bina"]["id"], 1000)
    for url in (
        f"/parent/children/{bina}/fees",
        f"/parent/children/{bina}/fees/invoices/{inv['Bina']['id']}",
        f"/parent/children/{bina}/fees/receipts",
        f"/parent/children/{bina}/fees/receipts/{pb['id']}",
    ):
        assert (await client.get(f"{API}{url}", headers=ph)).status_code == 404, url
    # my own child, but another child's invoice or receipt id
    aarav = s["students"][0]["id"]
    assert (
        await client.get(f"{API}/parent/children/{aarav}/fees/invoices/{inv['Bina']['id']}", headers=ph)
    ).status_code == 404
    assert (await client.get(f"{API}/parent/children/{aarav}/fees/receipts/{pb['id']}", headers=ph)).status_code == 404


async def test_parent_cannot_use_staff_routes_and_staff_cannot_use_parent_routes(client, school_a, mail):
    h = school_a["headers"]
    s, inv, ph = await setup(client, h, mail)
    for url in ("/fees/invoices", "/fees/reports/dues", "/fees/heads", "/fees/payments"):
        assert (await client.get(f"{API}{url}", headers=ph)).status_code == 403
    assert (
        await client.post(
            f"{API}/fees/invoices/{inv['Aarav']['id']}/payments", headers=ph, json={"amount_paise": 5, "mode": "cash"}
        )
    ).status_code == 403
    assert (await client.get(f"{API}/parent/fees", headers=h)).status_code == 403
    assert (await client.get(f"{API}/parent/children/{s['students'][0]['id']}/fees", headers=h)).status_code == 403


async def test_siblings_share_one_parent_login(client, school_a, mail):
    h = school_a["headers"]
    s = await school_with_fees(client, h, students=("Aarav",))
    twin = await enrol(
        client,
        h,
        s["cls"]["id"],
        first="Twin",
        guardians=[{"name": "Rakesh Sharma", "phone": "9876543210", "email": "aarav@fam.example"}],
    )
    await run(client, h)
    ph = await parent_headers(client, mail, "aarav@fam.example")
    names = sorted(c["student_name"] for c in await get(client, ph, "/parent/fees"))
    assert names == ["Aarav Sharma", "Twin Sharma"] and twin


async def test_child_who_left_stays_readable_with_dues(client, school_a, mail):
    h = school_a["headers"]
    s, inv, ph = await setup(client, h, mail)
    aarav = s["students"][0]["id"]
    await pay(client, h, inv["Aarav"]["id"], 40_000)
    assert (await client.post(f"{API}/students/{aarav}/leave", headers=h, json={"reason": "moved"})).status_code == 200
    summary = await get(client, ph, "/parent/fees")
    assert summary[0]["read_only"] is True and summary[0]["due_paise"] == 60_000
    assert len(await get(client, ph, f"/parent/children/{aarav}/fees/receipts")) == 1
    # fees staff can still take the remaining payment for a child who left
    await pay(client, h, inv["Aarav"]["id"], 60_000)
    assert (await get(client, ph, "/parent/fees"))[0]["due_paise"] == 0
    # but no new invoice is made for them
    assert (await run(client, h, "May"))["invoices_created"] == 1
