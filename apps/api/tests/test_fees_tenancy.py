"""Fees of one school are invisible to another, in the API and in Postgres itself."""

import uuid

import pytest
from conftest import API
from feekit import get, invoices, pay, post, put, run, school_with_fees
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError
from studentkit import enrol

from app.db.session import make_session
from app.models import fees as m

MODELS = (
    m.FeeHead,
    m.FeeStructure,
    m.TransportRoute,
    m.StudentFeeOption,
    m.FeeConcession,
    m.StudentConcession,
    m.FeeLateRule,
    m.FeeSettings,
    m.FeeCounter,
    m.FeeInvoiceRun,
    m.FeeInvoice,
    m.FeeInvoiceItem,
    m.FeeCarryForward,
    m.FeePayment,
    m.FeeReminder,
    m.OpeningBalance,
)


async def fill(client, h, tag):
    s = await school_with_fees(client, h, students=(tag,))
    tr = (await post(client, h, "/fees/heads", {"name": "Transport", "scope": "optional"}, 201)).json()
    route = (await post(client, h, "/fees/routes", {"name": f"R-{tag}", "amount_paise": 500}, 201)).json()
    sid = s["students"][0]["id"]
    await put(client, h, f"/fees/students/{sid}/options", {"fee_head_id": tr["id"], "route_id": route["id"]})
    con = (await post(client, h, "/fees/concessions", {"name": "C", "kind": "percent", "value": 10}, 201)).json()
    await post(client, h, f"/fees/students/{sid}/concessions", {"concession_id": con["id"]}, 201)
    await put(client, h, "/fees/opening-balances", {"student_id": sid, "amount_paise": 1000, "as_of_on": "2026-01-01"})
    await put(client, h, "/fees/settings", {"auto_first_invoice": False, "first_invoice_due_days": 5})
    await post(client, h, "/fees/late-rules", {"amount_paise": 100}, 201)
    await run(client, h, "P1", due="2026-01-10")
    await run(client, h, "P2", due="2026-02-10")  # carries P1 forward
    inv = [i for i in await invoices(client, h) if i["status"] != "closed"][0]
    p = await pay(client, h, inv["id"], 100)
    await post(client, h, "/fees/late-fees/apply", {"as_of": "2026-06-01"}, 200)
    await post(client, h, "/fees/reminders/send", {}, 200)
    return s, inv, p


async def test_other_schools_fees_are_invisible_through_the_api(client, school_a, school_b):
    ha, hb = school_a["headers"], school_b["headers"]
    sa, inv_a, pay_a = await fill(client, ha, "Alpha")
    sb, inv_b, pay_b = await fill(client, hb, "Beta")
    # lists only hold own rows
    assert {i["student_name"].split()[0] for i in await invoices(client, ha)} == {"Alpha"}
    assert {i["student_name"].split()[0] for i in await invoices(client, hb)} == {"Beta"}
    assert [x["name"] for x in await get(client, ha, "/fees/routes")] == ["R-Alpha"]
    assert (await get(client, ha, "/fees/payments"))["total"] == 1
    assert (await get(client, ha, "/fees/reports/dues"))["students"] == 1
    assert len(await get(client, ha, "/fees/reminders")) == 1
    # ids of the other school give 404 on every route
    bid, bpay, bstu = inv_b["id"], pay_b["id"], sb["students"][0]["id"]
    for method, url, body in [
        ("get", f"/fees/invoices/{bid}", None),
        ("post", f"/fees/invoices/{bid}/payments", {"amount_paise": 5, "mode": "cash"}),
        ("post", f"/fees/invoices/{bid}/waive-late-fee", {"reason": "because"}),
        ("get", f"/fees/payments/{bpay}", None),
        ("post", f"/fees/payments/{bpay}/cancel", {"reason": "because"}),
        ("get", f"/fees/students/{bstu}", None),
        ("get", f"/fees/students/{bstu}/options", None),
        ("put", f"/fees/students/{bstu}/options", {"fee_head_id": sa["tuition"]["id"], "amount_paise": 5}),
        ("get", f"/fees/students/{bstu}/concessions", None),
        ("put", "/fees/opening-balances", {"student_id": bstu, "amount_paise": 5, "as_of_on": "2026-01-01"}),
        ("patch", f"/fees/heads/{sb['tuition']['id']}", {"name": "Hacked"}),
        (
            "put",
            "/fees/structures",
            {"class_id": sb["cls"]["id"], "fee_head_id": sa["tuition"]["id"], "amount_paise": 5},
        ),
        (
            "put",
            "/fees/structures",
            {"class_id": sa["cls"]["id"], "fee_head_id": sb["tuition"]["id"], "amount_paise": 5},
        ),
    ]:
        r = await getattr(client, method)(f"{API}{url}", headers=ha, **({"json": body} if body is not None else {}))
        assert r.status_code == 404, (method, url, r.text)
    # a run for another school's class or year does nothing there
    r = await post(
        client, ha, "/fees/invoice-runs", {"period_label": "X", "due_on": "2026-03-01", "class_ids": [sb["cls"]["id"]]}
    )
    assert r.status_code == 201 and r.json()["invoices_created"] == 0
    # school B's data is unchanged
    assert (await get(client, hb, f"/fees/invoices/{bid}"))["payments"][0]["id"] == bpay
    # each school has its own receipt and invoice numbering
    assert pay_a["receipt_no"] == pay_b["receipt_no"] == "RCP-000001"
    assert inv_a["invoice_no"].startswith("INV-")


async def test_a_parent_never_sees_another_schools_fees(client, school_a, school_b, mail):
    from studentkit import parent_headers

    sa, inv_a, _ = await fill(client, school_a["headers"], "Alpha")
    sb, inv_b, _ = await fill(client, school_b["headers"], "Beta")
    ph = await parent_headers(client, mail, "alpha@fam.example")
    assert [c["student_name"] for c in await get(client, ph, "/parent/fees")] == ["Alpha Sharma"]
    for url in (
        f"/parent/children/{sb['students'][0]['id']}/fees",
        f"/parent/children/{sb['students'][0]['id']}/fees/invoices/{inv_b['id']}",
    ):
        assert (await client.get(f"{API}{url}", headers=ph)).status_code == 404
    assert enrol and sa


async def test_postgres_itself_hides_other_schools_for_every_fee_table(client, school_a, school_b):
    await fill(client, school_a["headers"], "Alpha")
    await fill(client, school_b["headers"], "Beta")
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    for me in (a_id, b_id):
        s = make_session(school_id=me)
        try:
            for model in MODELS:
                rows = (await s.scalars(select(model))).all()
                assert rows, model.__tablename__
                assert {r.school_id for r in rows} == {me}, model.__tablename__
        finally:
            await s.close()
    nobody = make_session()
    try:
        for model in MODELS:
            assert (await nobody.scalars(select(model))).all() == [], model.__tablename__
    finally:
        await nobody.close()


@pytest.mark.parametrize(
    "build",
    [
        lambda b: m.FeeHead(school_id=b, name="Sneaky", scope="class"),
        lambda b: m.TransportRoute(school_id=b, name="Sneaky", amount_paise=1),
        lambda b: m.FeeCounter(school_id=b, kind="receipt", last_seq=999),
        lambda b: m.FeeConcession(school_id=b, name="Sneaky", kind="percent", value=5),
    ],
)
async def test_postgres_blocks_writing_fee_tables_into_another_school(client, school_a, school_b, build):
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=a_id)
    try:
        s.add(build(b_id))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()


async def test_cancelled_payment_cannot_lose_its_reason_in_the_database(client, school_a):
    """The CHECK constraint refuses a cancelled payment without who, when and why."""
    from sqlalchemy import text

    h = school_a["headers"]
    await school_with_fees(client, h)
    await run(client, h)
    p = await pay(client, h, (await invoices(client, h))[0]["id"], 100)
    s = make_session(school_id=uuid.UUID(school_a["school"]["id"]))
    try:
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.execute(text("update fee_payments set status = 'cancelled' where id = :i"), {"i": p["id"]})
    finally:
        await s.rollback()
        await s.close()
