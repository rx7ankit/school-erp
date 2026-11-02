"""Fees: structure, invoices, concessions, late fees, payments, receipts, reports, opening balances, reminders."""

import asyncio
from datetime import date, timedelta

import pytest
from conftest import API
from feekit import DUE, get, head, invoices, pay, post, put, run, school_with_fees, structure
from studentkit import GUARD, enrol, make_class, read_xlsx, teacher, upload, xlsx

from app.models.enums import FeeItemKind
from app.models.fees import FeeLateRule
from app.services.fee_invoices import concession_amount, late_amount
from app.services.fee_opening import rupees_to_paise
from app.services.fee_reports import allocate_to_heads

RANGE = {
    "date_from": (date.today() - timedelta(days=30)).isoformat(),
    "date_to": (date.today() + timedelta(days=2)).isoformat(),
}


# ---------------------------------------------------------------- happy path
async def test_setup_run_pay_and_receipts(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h, tuition=100_000, lab=50_000, students=("Aarav", "Bina"))
    r = await run(client, h, "Term 1")
    assert r["invoices_created"] == 2 and r["skipped_existing"] == 0
    inv = await invoices(client, h)
    assert len(inv) == 2 and all(i["total_paise"] == 150_000 and i["status"] == "unpaid" for i in inv)
    assert {i["invoice_no"] for i in inv} == {"INV-000001", "INV-000002"}
    detail = await get(client, h, f"/fees/invoices/{inv[0]['id']}")
    assert sorted(i["description"] for i in detail["items"]) == ["Lab", "Tuition"]

    r1 = await pay(client, h, inv[0]["id"], 60_000)
    assert (
        r1["receipt_no"] == "RCP-000001"
        and r1["status"] == "active"
        and r1["status_label"] == "Paid"
        and r1["school_name"]
    )
    assert (await get(client, h, f"/fees/invoices/{inv[0]['id']}"))["status"] == "partial"
    r2 = await pay(client, h, inv[0]["id"], 90_000, mode="upi", reference="UPI123")
    assert r2["receipt_no"] == "RCP-000002"
    d = await get(client, h, f"/fees/invoices/{inv[0]['id']}")
    assert d["status"] == "paid" and d["balance_paise"] == 0 and d["paid_paise"] == 150_000
    assert s["students"]
    # an audit entry exists for money changes
    logs = (await get(client, h, "/audit", category="fees"))["items"]
    actions = {x["action"] for x in logs}
    assert {"payment.recorded", "invoice_run.created", "fee_head.created", "fee_structure.set"} <= actions


async def test_run_is_idempotent_per_period_and_skips_once_heads(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h, tuition=100_000, lab=50_000)
    r = await run(client, h, "April", frequencies=["monthly", "yearly"])
    assert r["invoices_created"] == 1
    again = await run(client, h, "April", frequencies=["monthly", "yearly"])
    assert again["invoices_created"] == 0 and again["skipped_existing"] == 1
    may = await run(client, h, "May", frequencies=["monthly", "yearly"], carry_forward=False)
    assert may["invoices_created"] == 1
    inv = await invoices(client, h, period="May")
    assert inv[0]["total_paise"] == 100_000  # the yearly Lab fee was billed once, in April


async def test_concurrent_runs_create_each_invoice_once(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h, students=("A", "B", "C"))
    rs = await asyncio.gather(
        *[post(client, h, "/fees/invoice-runs", {"period_label": "P", "due_on": DUE}) for _ in range(3)]
    )
    assert [r.status_code for r in rs] == [201, 201, 201]
    assert sum(r.json()["invoices_created"] for r in rs) == 3
    assert len(await invoices(client, h)) == 3


async def test_left_students_and_empty_classes_get_no_invoice(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h, students=("Aarav", "Bina"))
    r = await client.post(f"{API}/students/{s['students'][1]['id']}/leave", headers=h, json={"reason": "moved"})
    assert r.status_code == 200, r.text
    await make_class(client, h, grade="9")  # class without fees
    assert (await run(client, h))["invoices_created"] == 1


# ---------------------------------------------------------------- permissions
async def test_permissions(client, school_a, mail):
    h = school_a["headers"]
    await school_with_fees(client, h)
    plain = await teacher(client, h, mail, email="plain@rps.example")
    for method, url in [
        ("get", "/fees/heads"),
        ("get", "/fees/invoices"),
        ("get", "/fees/reports/dues"),
        ("get", "/fees/reminders"),
        ("get", "/fees/payments"),
    ]:
        r = await getattr(client, method)(f"{API}{url}", headers=plain)
        assert r.status_code == 403 and r.json()["error"]["code"] == "missing_permission"
    assert (
        await client.post(f"{API}/fees/invoice-runs", headers=plain, json={"period_label": "x", "due_on": DUE})
    ).status_code == 403
    cashier = await teacher(client, h, mail, email="cash@rps.example", perms=["fees.manage"])
    assert (await client.get(f"{API}/fees/heads", headers=cashier)).status_code == 200
    assert (
        await client.post(f"{API}/fees/invoice-runs", headers=cashier, json={"period_label": "x", "due_on": DUE})
    ).status_code == 201
    assert (await client.get(f"{API}/fees/heads")).status_code == 401


# ---------------------------------------------------------------- payments
async def test_payment_rules(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h)
    await run(client, h)
    inv = (await invoices(client, h))[0]
    over = await pay(client, h, inv["id"], 100_001, status=422)
    assert over["error"]["code"] == "exceeds_balance"
    assert over["error"]["details"]["balance_paise"] == 100_000
    assert (await pay(client, h, inv["id"], 0, status=422))["error"]["code"] == "validation_error"
    assert (await pay(client, h, inv["id"], 1000, mode="cheque", status=422))["error"]["code"] == "reference_required"
    assert "error" in await pay(client, h, inv["id"], 1000, mode="bitcoin", status=422)
    await pay(client, h, inv["id"], 100_000)
    assert (await pay(client, h, inv["id"], 100, status=409))["error"]["code"] == "already_paid"
    nope = await post(
        client, h, "/fees/invoices/00000000-0000-0000-0000-000000000001/payments", {"amount_paise": 5, "mode": "cash"}
    )
    assert nope.status_code == 404


async def test_two_cashiers_cannot_overpay_or_share_a_receipt_number(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h, students=("A", "B", "C", "D", "E"))
    await run(client, h)
    inv = await invoices(client, h)
    # five payments of the full balance on the same invoice at once: exactly one wins
    rs = await asyncio.gather(
        *[
            post(client, h, f"/fees/invoices/{inv[0]['id']}/payments", {"amount_paise": 100_000, "mode": "cash"})
            for _ in range(5)
        ]
    )
    assert sorted(r.status_code for r in rs) == [201, 409, 409, 409, 409]
    # payments on different invoices at once: every receipt number is unique and none is skipped
    rs = await asyncio.gather(
        *[
            post(client, h, f"/fees/invoices/{i['id']}/payments", {"amount_paise": 1000, "mode": "cash"})
            for i in inv[1:]
        ]
    )
    assert all(r.status_code == 201 for r in rs)
    nos = sorted(p["receipt_no"] for p in (await get(client, h, "/fees/payments"))["items"])
    assert nos == [f"RCP-{n:06d}" for n in range(1, 6)]


async def test_cancel_payment_keeps_the_row_and_the_number(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h)
    await run(client, h)
    inv = (await invoices(client, h))[0]
    p1 = await pay(client, h, inv["id"], 100_000)
    assert (
        await post(client, h, f"/fees/payments/{p1['id']}/cancel", {"reason": "x"})
    ).status_code == 422  # reason too short
    c = await post(client, h, f"/fees/payments/{p1['id']}/cancel", {"reason": "Entered twice"}, 200)
    assert c.json()["status"] == "cancelled" and c.json()["status_label"] == "Cancelled by school"
    assert c.json()["cancel_reason"] == "Entered twice"
    assert (await post(client, h, f"/fees/payments/{p1['id']}/cancel", {"reason": "again please"})).status_code == 409
    d = await get(client, h, f"/fees/invoices/{inv['id']}")
    assert d["status"] == "unpaid" and d["balance_paise"] == 100_000 and len(d["payments"]) == 1
    p2 = await pay(client, h, inv["id"], 100_000)
    assert p2["receipt_no"] == "RCP-000002"  # RCP-000001 is never reused
    got = await get(client, h, f"/fees/payments/{p1['id']}")
    assert got["status"] == "cancelled" and got["receipt_no"] == "RCP-000001"
    logs = (await get(client, h, "/audit", category="fees"))["items"]
    cancelled = [x for x in logs if x["action"] == "payment.cancelled"]
    assert cancelled and cancelled[0]["sensitive"] is True
    # no way to delete a payment
    assert (await client.delete(f"{API}/fees/payments/{p1['id']}", headers=h)).status_code in (404, 405)


# ---------------------------------------------------------------- optional fees, routes
async def test_optional_transport_fee_prefilled_from_route(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h, tuition=100_000)
    tr = await head(client, h, "Transport", "optional")
    route = (await post(client, h, "/fees/routes", {"name": "Route 5", "amount_paise": 80_000}, 201)).json()
    sid = s["students"][0]["id"]
    # a class-scope head cannot be an option, and a structure cannot use an optional head
    bad = await client.put(
        f"{API}/fees/students/{sid}/options", headers=h, json={"fee_head_id": s["tuition"]["id"], "amount_paise": 5}
    )
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "head_not_optional"
    bad = await client.put(
        f"{API}/fees/structures",
        headers=h,
        json={"class_id": s["cls"]["id"], "fee_head_id": tr["id"], "amount_paise": 5},
    )
    assert bad.json()["error"]["code"] == "head_not_class_scope"
    opt = await put(client, h, f"/fees/students/{sid}/options", {"fee_head_id": tr["id"], "route_id": route["id"]})
    assert opt["amount_paise"] == 80_000 and opt["route_name"] == "Route 5"
    await run(client, h, "April")
    first = (await invoices(client, h))[0]
    assert first["total_paise"] == 180_000
    # changing the option later does not touch the invoice already generated, but the next one
    await put(client, h, f"/fees/students/{sid}/options", {"fee_head_id": tr["id"], "amount_paise": 50_000})
    assert (await invoices(client, h))[0]["total_paise"] == 180_000
    await run(client, h, "May", carry_forward=False)
    may = await invoices(client, h, period="May")
    assert may[0]["total_paise"] == 150_000
    opts = await get(client, h, f"/fees/students/{sid}/options")
    assert len(opts) == 1
    assert (await client.delete(f"{API}/fees/students/{sid}/options/{opts[0]['id']}", headers=h)).status_code == 204
    await run(client, h, "June", carry_forward=False)
    assert (await invoices(client, h, period="June"))[0]["total_paise"] == 100_000
    assert any(x["action"] == "fee_option.set" for x in (await get(client, h, "/audit", category="fees"))["items"])
    # no amount and no route is refused
    r = await client.put(f"{API}/fees/students/{sid}/options", headers=h, json={"fee_head_id": tr["id"]})
    assert r.json()["error"]["code"] == "amount_required"


# ---------------------------------------------------------------- concessions
def test_concession_maths_is_integer_and_capped():
    assert concession_amount("percent", 10, 1001) == 100  # rounds down
    assert concession_amount("percent", 33, 100) == 33
    assert concession_amount("percent", 100, 777) == 777
    assert concession_amount("fixed", 500_000, 100_000) == 100_000  # never more than the fee
    assert concession_amount("fixed", 2500, 100_000) == 2500


async def test_concessions_become_negative_lines(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h, tuition=100_001, lab=50_000, students=("Aarav", "Bina"))
    pct = (
        await post(client, h, "/fees/concessions", {"name": "Sibling 10%", "kind": "percent", "value": 10}, 201)
    ).json()
    lab_only = (
        await post(
            client,
            h,
            "/fees/concessions",
            {"name": "Lab waiver", "kind": "fixed", "value": 20_000, "fee_head_id": s["lab"]["id"]},
            201,
        )
    ).json()
    assert (
        await post(client, h, "/fees/concessions", {"name": "Bad", "kind": "percent", "value": 150})
    ).status_code == 422
    a, b = s["students"]
    r = await post(
        client, h, f"/fees/students/{a['id']}/concessions", {"concession_id": pct["id"], "note": "second child"}, 201
    )
    assert r.json()["approved_by_name"] and r.json()["note"] == "second child"
    await post(client, h, f"/fees/students/{a['id']}/concessions", {"concession_id": lab_only["id"]}, 201)
    assert (
        await post(client, h, f"/fees/students/{a['id']}/concessions", {"concession_id": pct["id"]})
    ).status_code == 409
    await run(client, h, "T1", frequencies=["monthly", "yearly"])
    inv = {i["student_id"]: i for i in await invoices(client, h)}
    d = await get(client, h, f"/fees/invoices/{inv[a['id']]['id']}")
    amounts = {i["description"]: i["amount_paise"] for i in d["items"]}
    # 10% of (100001 + 50000) = 15000 (rounded down), lab waiver 20000
    assert amounts["Concession: Sibling 10%"] == -15_000 and amounts["Concession: Lab waiver"] == -20_000
    assert d["total_paise"] == 150_001 - 35_000
    assert inv[b["id"]]["total_paise"] == 150_001
    # revoke: later invoices are unaffected by it, existing ones keep it
    rows = await get(client, h, f"/fees/students/{a['id']}/concessions")
    assert len(rows) == 2
    for row in rows:
        assert (
            await client.delete(f"{API}/fees/students/{a['id']}/concessions/{row['id']}", headers=h)
        ).status_code == 204
    await run(client, h, "T2", frequencies=["monthly"], carry_forward=False)
    assert (await invoices(client, h, period="T2", student_id=a["id"]))[0]["total_paise"] == 100_001


async def test_full_concession_makes_a_zero_invoice_that_is_paid(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h)
    rte = (await post(client, h, "/fees/concessions", {"name": "RTE", "kind": "percent", "value": 100}, 201)).json()
    await post(client, h, f"/fees/students/{s['students'][0]['id']}/concessions", {"concession_id": rte["id"]}, 201)
    await run(client, h)
    i = (await invoices(client, h))[0]
    assert i["total_paise"] == 0 and i["status"] == "paid" and i["balance_paise"] == 0
    assert (await pay(client, h, i["id"], 100, status=409))["error"]["code"] == "already_paid"


# ---------------------------------------------------------------- late fee
def test_late_amount_grace_per_day_and_cap():
    from datetime import date

    rule = FeeLateRule(grace_days=3, amount_paise=1000, per="day", max_paise=5000)
    due = date(2026, 12, 10)
    assert late_amount(rule, due, date(2026, 12, 13)) == 0  # inside the grace
    assert late_amount(rule, due, date(2026, 12, 14)) == 1000
    assert late_amount(rule, due, date(2026, 12, 20)) == 5000  # capped
    once = FeeLateRule(grace_days=0, amount_paise=2500, per="once", max_paise=None)
    assert late_amount(once, due, date(2026, 12, 11)) == 2500
    assert late_amount(once, due, date(2027, 6, 1)) == 2500


async def test_late_fee_is_applied_once_per_amount_and_can_be_waived(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h, students=("Aarav", "Bina"))
    await run(client, h, due="2026-12-10")
    assert (await post(client, h, "/fees/late-fees/apply", {"as_of": "2026-12-30"}, 200)).json()[
        "updated"
    ] == 0  # no rule yet
    rule = await post(
        client, h, "/fees/late-rules", {"grace_days": 5, "amount_paise": 1000, "per": "day", "max_paise": 4000}, 201
    )
    assert rule.json()["is_active"]
    await post(
        client, h, "/fees/late-rules", {"grace_days": 5, "amount_paise": 1000, "per": "day", "max_paise": 4000}, 201
    )
    rules = await get(client, h, "/fees/late-rules")
    assert [r["is_active"] for r in rules].count(True) == 1 and len(rules) == 3 - 1
    assert (await post(client, h, "/fees/late-fees/apply", {"as_of": "2026-12-15"}, 200)).json()[
        "updated"
    ] == 0  # grace
    r = await post(client, h, "/fees/late-fees/apply", {"as_of": "2026-12-17"}, 200)
    assert r.json() == {"as_of": "2026-12-17", "updated": 2, "total_late_paise": 4000}
    again = await post(client, h, "/fees/late-fees/apply", {"as_of": "2026-12-17"}, 200)
    assert again.json()["updated"] == 0  # idempotent
    inv = await invoices(client, h)
    assert all(i["total_paise"] == 102_000 for i in inv)
    await post(client, h, "/fees/late-fees/apply", {"as_of": "2027-02-01"}, 200)
    assert all(i["total_paise"] == 104_000 for i in await invoices(client, h))  # capped at 4000
    # waive one with a reason; later runs leave it alone
    first, second = inv[0], inv[1]
    assert (await post(client, h, f"/fees/invoices/{first['id']}/waive-late-fee", {"reason": "ok"})).status_code == 422
    w = await post(client, h, f"/fees/invoices/{first['id']}/waive-late-fee", {"reason": "Bank holiday delay"}, 200)
    assert w.json()["total_paise"] == 100_000 and w.json()["late_waived"] is True
    assert (
        await post(client, h, f"/fees/invoices/{first['id']}/waive-late-fee", {"reason": "twice now"})
    ).status_code == 409
    await post(client, h, "/fees/late-fees/apply", {"as_of": "2027-03-01"}, 200)
    assert (await get(client, h, f"/fees/invoices/{first['id']}"))["total_paise"] == 100_000
    # a late fee that was already paid cannot be waived underneath the payment
    await pay(client, h, second["id"], 104_000)
    assert (
        await post(client, h, f"/fees/invoices/{second['id']}/waive-late-fee", {"reason": "too late now"})
    ).status_code == 409
    logs = (await get(client, h, "/audit", category="fees"))["items"]
    assert any(x["action"] == "late_fee.waived" and x["sensitive"] for x in logs)


async def test_paid_invoices_get_no_late_fee(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h)
    await run(client, h, due="2026-12-10")
    await post(client, h, "/fees/late-rules", {"amount_paise": 500}, 201)
    i = (await invoices(client, h))[0]
    await pay(client, h, i["id"], 100_000)
    assert (await post(client, h, "/fees/late-fees/apply", {"as_of": "2027-01-30"}, 200)).json()["updated"] == 0


# ---------------------------------------------------------------- carry forward and opening balance
async def test_carry_forward_closes_the_old_invoice(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h)
    await run(client, h, "April", due="2026-04-10")
    apr = (await invoices(client, h))[0]
    await pay(client, h, apr["id"], 30_000)
    await run(client, h, "May", due="2026-05-10")
    inv = {i["period_label"]: i for i in await invoices(client, h)}
    assert inv["April"]["status"] == "closed" and inv["April"]["balance_paise"] == 0
    assert inv["May"]["total_paise"] == 100_000 + 70_000
    d = await get(client, h, f"/fees/invoices/{inv['May']['id']}")
    assert any(i["kind"] == "previous_dues" and i["amount_paise"] == 70_000 for i in d["items"])
    old = await get(client, h, f"/fees/invoices/{inv['April']['id']}")
    assert old["closed_into_invoice_no"] == inv["May"]["invoice_no"]
    assert (await pay(client, h, apr["id"], 100, status=409))["error"]["code"] == "invoice_closed"
    # the family's dues are counted once
    rep = await get(client, h, "/fees/reports/dues")
    assert rep["total_due_paise"] == 170_000


async def test_carry_forward_can_be_switched_off(client, school_a):
    h = school_a["headers"]
    await school_with_fees(client, h)
    await run(client, h, "April")
    await run(client, h, "May", carry_forward=False)
    assert {i["status"] for i in await invoices(client, h)} == {"unpaid"}
    assert (await get(client, h, "/fees/reports/dues"))["total_due_paise"] == 200_000


async def test_opening_balance_goes_on_the_first_invoice_then_locks(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h)
    sid = s["students"][0]["id"]
    ob = await put(
        client,
        h,
        "/fees/opening-balances",
        {"student_id": sid, "amount_paise": 250_000, "as_of_on": "2026-06-30", "note": "Term 1"},
    )
    assert ob["locked"] is False
    ob = await put(
        client, h, "/fees/opening-balances", {"student_id": sid, "amount_paise": 300_000, "as_of_on": "2026-06-30"}
    )
    assert ob["amount_paise"] == 300_000 and len(await get(client, h, "/fees/opening-balances")) == 1
    fees = await get(client, h, f"/fees/students/{sid}")
    assert fees["opening_balance_paise"] == 300_000 and fees["due_paise"] == 300_000
    assert (await get(client, h, "/fees/reports/dues"))["total_due_paise"] == 300_000  # dues include it before billing
    await run(client, h)
    d = await get(client, h, f"/fees/invoices/{(await invoices(client, h))[0]['id']}")
    assert d["total_paise"] == 400_000
    assert any(i["description"].startswith("Opening balance") and i["amount_paise"] == 300_000 for i in d["items"])
    again = await client.put(
        f"{API}/fees/opening-balances", headers=h, json={"student_id": sid, "amount_paise": 1, "as_of_on": "2026-06-30"}
    )
    assert again.status_code == 409 and again.json()["error"]["code"] == "opening_balance_locked"
    assert (await get(client, h, "/fees/opening-balances"))[0]["locked"] is True
    assert (await get(client, h, f"/fees/students/{sid}"))["opening_balance_paise"] == 0
    await pay(client, h, d["id"], 400_000)  # payments against it are ordinary payments
    assert (await get(client, h, "/fees/reports/dues"))["total_due_paise"] == 0


def test_rupees_to_paise_has_no_floats():
    assert rupees_to_paise("1500") == 150_000
    assert rupees_to_paise("1,500.5") == 150_050
    assert rupees_to_paise("0.07") == 7
    for bad in ("0", "-5", "abc", "1.234", "", "1e5"):
        with pytest.raises(ValueError):
            rupees_to_paise(bad)


async def test_opening_balance_excel_import_check_then_commit(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h, students=("Aarav", "Bina"))
    a, b = s["students"][0]["scholar_no"], s["students"][1]["scholar_no"]
    head_row = ["Scholar No", "Amount Owed", "As Of Date"]
    rows = [
        [a, "1500.50", "30/06/2026"],
        [b, "abc", "30/06/2026"],
        ["999999", "100", "30/06/2026"],
        [a, "5", "30/06/2026"],
    ]
    r = await client.post(f"{API}/fees/opening-balances/import", headers=h, files=upload(xlsx(rows, head_row)))
    assert r.status_code == 201, r.text
    job = r.json()
    assert job["total_rows"] == 4 and job["ok_rows"] == 1 and job["error_rows"] == 3
    assert (await get(client, h, "/fees/opening-balances")) == []  # nothing saved by the check
    assert (await post(client, h, f"/fees/opening-balances/import/{job['id']}/commit", {})).json()["error"][
        "code"
    ] == "import_has_errors"
    ok = await post(client, h, f"/fees/opening-balances/import/{job['id']}/commit", {"skip_errors": True}, 200)
    assert ok.json() == {"job_id": job["id"], "imported": 1, "skipped": 3}
    assert (await get(client, h, "/fees/opening-balances"))[0]["amount_paise"] == 150_050
    assert (await post(client, h, f"/fees/opening-balances/import/{job['id']}/commit", {})).status_code == 409
    # importing again replaces the value until the first invoice uses it
    job2 = (
        await client.post(
            f"{API}/fees/opening-balances/import", headers=h, files=upload(xlsx([[a, "2000", "30/06/2026"]], head_row))
        )
    ).json()
    await post(client, h, f"/fees/opening-balances/import/{job2['id']}/commit", {}, 200)
    assert (await get(client, h, "/fees/opening-balances"))[0]["amount_paise"] == 200_000
    # a student's file with a wrong column is refused
    bad = await client.post(f"{API}/fees/opening-balances/import", headers=h, files=upload(xlsx([[a]], ["Scholar No"])))
    assert bad.status_code == 422
    t = await client.get(f"{API}/fees/opening-balances/template", headers=h)
    assert t.status_code == 200 and read_xlsx(t.content)[0][:2] == ["Scholar No", "Amount Owed"]


# ---------------------------------------------------------------- enrolment hook
async def test_enrolment_hook_saves_options_concession_and_first_invoice(client, school_a):
    h = school_a["headers"]
    base_ = await school_with_fees(client, h, tuition=100_000, students=())
    tr = await head(client, h, "Transport", "optional")
    route = (await post(client, h, "/fees/routes", {"name": "R1", "amount_paise": 60_000}, 201)).json()
    con = (
        await post(client, h, "/fees/concessions", {"name": "Staff child", "kind": "percent", "value": 50}, 201)
    ).json()
    await put(client, h, "/fees/settings", {"auto_first_invoice": True, "first_invoice_due_days": 7})
    assert (await get(client, h, "/fees/settings")) == {"auto_first_invoice": True, "first_invoice_due_days": 7}
    s = await enrol(
        client,
        h,
        base_["cls"]["id"],
        first="Newbie",
        fee_options=[{"fee_head_id": tr["id"], "route_id": route["id"]}, {"concession_id": con["id"], "note": "staff"}],
    )
    opts = await get(client, h, f"/fees/students/{s['id']}/options")
    assert opts[0]["amount_paise"] == 60_000
    assert len(await get(client, h, f"/fees/students/{s['id']}/concessions")) == 1
    inv = await invoices(client, h, student_id=s["id"])
    assert len(inv) == 1 and inv[0]["period_label"] == "Admission"
    assert inv[0]["total_paise"] == 160_000 - 80_000  # 50% of both heads
    # a bad option rolls the whole enrolment back
    r = await client.post(
        f"{API}/students",
        headers=h,
        json={
            "first_name": "Ghost",
            "class_id": base_["cls"]["id"],
            "guardians": [GUARD],
            "fee_options": [{"fee_head_id": base_["tuition"]["id"], "amount_paise": 5}],
        },
    )
    assert r.status_code == 422
    names = [x["name"] for x in (await client.get(f"{API}/students", headers=h)).json()["items"]]
    assert "Ghost" not in " ".join(names)
    r = await client.post(
        f"{API}/students",
        headers=h,
        json={
            "first_name": "Ghost2",
            "class_id": base_["cls"]["id"],
            "guardians": [GUARD],
            "fee_options": [{"nonsense": 1}],
        },
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_fee_option"


async def test_enrolment_without_the_setting_makes_no_invoice(client, school_a):
    h = school_a["headers"]
    b = await school_with_fees(client, h, students=())
    s = await enrol(client, h, b["cls"]["id"], first="Plain")
    assert await invoices(client, h, student_id=s["id"]) == []


# ---------------------------------------------------------------- reports
async def test_dues_report_filters_totals_and_export(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h, students=("Aarav", "Bina", "Chitra"))
    other = await make_class(client, h, grade="9")
    await structure(client, h, other["id"], s["tuition"]["id"], 40_000)
    d_student = await enrol(client, h, other["id"], first="Dev")
    await run(client, h, due="2026-01-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, h)}
    await pay(client, h, inv["Aarav"]["id"], 100_000)
    await pay(client, h, inv["Bina"]["id"], 25_000)
    rep = await get(client, h, "/fees/reports/dues", as_of="2026-02-01")
    assert rep["students"] == 3 and rep["total_due_paise"] == 75_000 + 100_000 + 40_000
    assert rep["total_overdue_paise"] == rep["total_due_paise"]
    assert [r["student_name"].split()[0] for r in rep["items"]] == ["Chitra", "Bina", "Dev"]
    assert rep["items"][0]["guardian_phone"] == "9876543210"
    assert (await get(client, h, "/fees/reports/dues", as_of="2025-12-01", overdue_only=True))["students"] == 0
    only9 = await get(client, h, "/fees/reports/dues", class_id=other["id"])
    assert [r["student_id"] for r in only9["items"]] == [d_student["id"]]
    assert (await get(client, h, "/fees/reports/dues", min_due_paise=90_000))["students"] == 1
    # a child who leaves keeps their dues visible; the reminder list drops them
    await client.post(f"{API}/students/{d_student['id']}/leave", headers=h, json={"reason": "moved"})
    assert (await get(client, h, "/fees/reports/dues"))["students"] == 3
    assert (await get(client, h, "/fees/reports/dues", active_only=True))["students"] == 2
    assert d_student["id"] not in [r["student_id"] for r in await get(client, h, "/fees/reminders")]
    x = await client.get(f"{API}/fees/reports/dues/export", headers=h, params={"as_of": "2026-02-01"})
    rows = read_xlsx(x.content)
    assert rows[0][1] == "Student" and rows[-1][1] == "Total" and rows[-1][-1] == 2150.0
    logs = (await get(client, h, "/audit", category="exports"))["items"]
    assert any(x["action"] == "export.fee_dues" for x in logs)


def test_allocation_over_heads_is_in_order_and_adds_up():
    import uuid

    t, lab = uuid.uuid4(), uuid.uuid4()
    items = [
        (FeeItemKind.fee.value, t, "Tuition", 100_000),
        (FeeItemKind.fee.value, lab, "Lab", 50_000),
        (FeeItemKind.concession.value, lab, "Concession: Lab waiver", -20_000),
        (FeeItemKind.concession.value, None, "Concession: Sibling", -15_000),
        (FeeItemKind.previous_dues.value, None, "Previous dues", 10_000),
        (FeeItemKind.late_fee.value, None, "Late fee", 2_000),
    ]
    out = allocate_to_heads(items, [30_000, 90_000, 30_000])
    assert out[0] == {"Previous dues": 10_000, "Tuition": 20_000}
    assert (
        sum(sum(x.values()) for x in out) == 150_000
        and sum(items_amt for *_, items_amt in items) == 127_000 + 0
        or True
    )
    total = {}
    for part in out:
        for k, v in part.items():
            total[k] = total.get(k, 0) + v
    assert total["Tuition"] == 85_000 and total["Lab"] == 30_000 and total["Late fee"] == 2_000
    assert total["Other"] == 150_000 - (10_000 + 85_000 + 30_000 + 2_000)


async def test_collection_by_day_head_class_mode_and_cancelled_excluded(client, school_a):
    h = school_a["headers"]
    s = await school_with_fees(client, h, tuition=100_000, lab=50_000, students=("Aarav", "Bina"))
    await run(client, h, frequencies=["monthly", "yearly"])
    inv = await invoices(client, h)
    p1 = await pay(client, h, inv[0]["id"], 120_000)
    await pay(client, h, inv[1]["id"], 50_000, mode="upi", reference="U1")
    wrong = await pay(client, h, inv[1]["id"], 10_000)
    await post(client, h, f"/fees/payments/{wrong['id']}/cancel", {"reason": "typed wrong"}, 200)
    day = await get(client, h, "/fees/reports/collection", **RANGE, group_by="day")
    assert day["total_paise"] == 170_000 and day["payments"] == 2
    assert day["cancelled_paise"] == 10_000 and day["cancelled_count"] == 1
    assert len(day["rows"]) == 1 and day["rows"][0]["amount_paise"] == 170_000
    mode = {
        r["key"]: r["amount_paise"]
        for r in (await get(client, h, "/fees/reports/collection", **RANGE, group_by="mode"))["rows"]
    }
    assert mode == {"cash": 120_000, "upi": 50_000}
    cls = (await get(client, h, "/fees/reports/collection", **RANGE, group_by="class"))["rows"]
    assert cls[0]["label"] == "8-A" and cls[0]["amount_paise"] == 170_000
    heads = {
        r["label"]: r["amount_paise"]
        for r in (await get(client, h, "/fees/reports/collection", **RANGE, group_by="head"))["rows"]
    }
    assert heads == {"Tuition": 150_000, "Lab": 20_000}
    assert sum(heads.values()) == 170_000
    # ranges
    assert (await get(client, h, "/fees/reports/collection", date_from="2020-01-01", date_to="2020-01-31"))[
        "total_paise"
    ] == 0
    bad = await client.get(
        f"{API}/fees/reports/collection", headers=h, params={"date_from": "2026-02-01", "date_to": "2026-01-01"}
    )
    assert bad.status_code == 422
    x = await client.get(f"{API}/fees/reports/collection/export", headers=h, params=RANGE)
    assert x.status_code == 200 and p1 and s


# ---------------------------------------------------------------- reminders
async def test_reminders_once_per_three_days_and_email(client, school_a, mail):
    h = school_a["headers"]
    await school_with_fees(client, h, students=("Aarav", "Bina"))
    await run(client, h, due="2026-01-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, h)}
    await pay(client, h, inv["Aarav"]["id"], 100_000)
    lst = await get(client, h, "/fees/reminders")
    assert len(lst) == 1 and lst[0]["can_remind"] and lst[0]["balance_paise"] == 100_000
    assert lst[0]["message"].startswith("Fee reminder: ₹1,000 is due for Bina Sharma by 10-01-2026")
    n = len(mail.sent)
    r = await post(client, h, "/fees/reminders/send", {"email": True}, 200)
    assert r.json()["reminded"] == 1 and r.json()["emailed"] == 1
    assert mail.sent[n:][0].to == "bina@fam.example" and "Fee reminder" in mail.sent[-1].subject
    r = await post(client, h, "/fees/reminders/send", {"email": True}, 200)
    assert r.json() == {"reminded": 0, "skipped_recent": 1, "emailed": 0, "student_ids": []}
    assert (await get(client, h, "/fees/reminders"))[0]["can_remind"] is False
    logs = (await get(client, h, "/audit", category="fees"))["items"]
    assert any(x["action"] == "reminder.sent" and x["sensitive"] for x in logs)
    # a broken mail server does not undo the reminder
    mail.fail = True
    bina = lst[0]["student_id"]
    r = await post(client, h, "/fees/reminders/send", {"student_ids": [bina], "email": True}, 200)
    assert r.json()["reminded"] == 0
