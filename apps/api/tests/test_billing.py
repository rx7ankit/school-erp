"""Platform billing: monthly invoices from active student counts, payments, revenue stats, the school's own view."""

from datetime import timedelta

import pytest
from conftest import API, new_school
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError, ProgrammingError
from studentkit import GUARD, enrol, make_class, teacher

from app.core.clock import today_ist
from app.db.session import make_session, system_session
from app.models.school import PlatformInvoice
from app.services import billing

LAST = billing.previous_month(today_ist())
MONTH = billing.month_key(LAST)
LAST_DAY = billing.last_day(LAST)


async def activate(client, owner, school, price=None):
    body = {"status": "active", **({"price_per_student_paise": price} if price is not None else {})}
    r = await client.patch(f"{API}/owner/schools/{school['school']['id']}", headers=owner, json=body)
    assert r.status_code == 200, r.text


async def students(client, school, n, tag="a"):
    c = await make_class(client, school["headers"], grade="5")
    return [
        await enrol(
            client,
            school["headers"],
            c["id"],
            first=f"Kid{i}{tag}",
            guardians=[{**GUARD, "email": f"{tag}{i}@p.example"}],
        )
        for i in range(n)
    ]


async def generate(client, owner, month=MONTH, status=200):
    r = await client.post(f"{API}/owner/billing/invoices/generate", headers=owner, json={"month": month})
    assert r.status_code == status, r.text
    return r.json()


async def listing(client, owner, **params):
    r = await client.get(f"{API}/owner/billing/invoices", headers=owner, params=params)
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------ money maths
async def test_invoice_is_active_students_times_price_in_paise(client, owner, school_a, school_b):
    await activate(client, owner, school_a)  # default Rs 10
    await activate(client, owner, school_b, price=1550)  # a special price
    await students(client, school_a, 3, "a")
    kids = await students(client, school_b, 4, "b")
    await client.post(f"{API}/students/{kids[0]['id']}/leave", headers=school_b["headers"], json={"reason": "moved"})
    out = await generate(client, owner)
    assert out["created"] == 2 and out["amount_paise"] == 3 * 1000 + 3 * 1550  # leavers do not count
    rows = {r["school_name"]: r for r in (await listing(client, owner))["items"]}
    a, b = rows["Rewa Public School"], rows["Satna Vidya Mandir"]
    assert (a["active_students"], a["price_per_student_paise"], a["amount_paise"]) == (3, 1000, 3000)
    assert (b["active_students"], b["price_per_student_paise"], b["amount_paise"]) == (3, 1550, 4650)
    assert a["month"] == MONTH and a["status"] == "due" and a["overdue"] is False
    assert a["due_on"] == (LAST_DAY + timedelta(days=15)).isoformat()


async def test_generating_twice_creates_nothing_new(client, owner, school_a):
    await activate(client, owner, school_a)
    await students(client, school_a, 2)
    first = await generate(client, owner)
    again = await generate(client, owner)
    assert first["created"] == 1 and again["created"] == 0 and again["skipped_existing"] == 1
    assert (await listing(client, owner))["total"] == 1
    # the database itself refuses a second invoice for the month
    async with system_session() as db:
        inv = await db.scalar(select(PlatformInvoice))
        db.add(
            PlatformInvoice(
                school_id=inv.school_id,
                period_on=inv.period_on,
                active_students=1,
                price_per_student_paise=1,
                amount_paise=1,
                due_on=inv.due_on,
                status="due",
            )
        )
        with pytest.raises(IntegrityError):
            await db.flush()
        await db.rollback()


async def test_trial_and_empty_schools_are_not_billed_and_the_month_must_have_ended(client, owner, school_a, school_b):
    await students(client, school_a, 2)  # still on trial
    await activate(client, owner, school_b)  # active, no students
    out = await generate(client, owner)
    assert (out["created"], out["skipped_trial"], out["skipped_empty"]) == (0, 1, 1)
    this_month = billing.month_key(today_ist().replace(day=1))
    r = await client.post(f"{API}/owner/billing/invoices/generate", headers=owner, json={"month": this_month})
    assert r.status_code == 409 and r.json()["error"]["code"] == "month_not_ended"
    r = await client.post(f"{API}/owner/billing/invoices/generate", headers=owner, json={"month": "2026-13"})
    assert r.status_code == 422


async def test_the_count_on_the_last_day_of_the_month_is_used(client, owner, school_a):
    await activate(client, owner, school_a)
    kids = await students(client, school_a, 3)
    async with system_session() as db:
        assert await billing.record_usage(db, LAST_DAY) >= 1  # 3 active on the last day
    await client.post(f"{API}/students/{kids[0]['id']}/leave", headers=school_a["headers"], json={"reason": "x"})
    await generate(client, owner)
    inv = (await listing(client, owner))["items"][0]
    assert inv["active_students"] == 3 and inv["amount_paise"] == 3000  # not 2: the day's record wins


async def test_a_price_change_only_affects_invoices_not_yet_made(client, owner, school_a):
    await activate(client, owner, school_a)
    await students(client, school_a, 2)
    await generate(client, owner)
    await client.patch(
        f"{API}/owner/schools/{school_a['school']['id']}", headers=owner, json={"price_per_student_paise": 2000}
    )
    assert (await listing(client, owner))["items"][0]["price_per_student_paise"] == 1000
    assert (await client.get(f"{API}/school/billing", headers=school_a["headers"])).json()[
        "price_per_student_paise"
    ] == 2000


# ------------------------------------------------------------------ payments, filters, export
async def test_mark_paid_records_mode_and_reference_once(client, owner, school_a, school_b):
    await activate(client, owner, school_a)
    await activate(client, owner, school_b)
    await students(client, school_a, 2, "a")
    await students(client, school_b, 1, "b")
    await generate(client, owner)
    items = (await listing(client, owner))["items"]
    inv = next(i for i in items if i["school_name"] == "Rewa Public School")
    url = f"{API}/owner/billing/invoices/{inv['id']}/mark-paid"
    r = await client.post(url, headers=owner, json={"payment_mode": "upi"})
    assert r.status_code == 422  # a reference is needed
    r = await client.post(url, headers=owner, json={"payment_mode": "upi", "reference": "UTR123"})
    assert (
        r.status_code == 200
        and r.json()["status"] == "paid"
        and r.json()["reference"] == "UTR123"
        and r.json()["paid_at"]
    )
    r = await client.post(url, headers=owner, json={"payment_mode": "cash"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_paid"
    future = (today_ist() + timedelta(days=3)).isoformat()
    other = next(i for i in items if i["id"] != inv["id"])
    r = await client.post(
        f"{API}/owner/billing/invoices/{other['id']}/mark-paid",
        headers=owner,
        json={"payment_mode": "cash", "paid_on": future},
    )
    assert r.status_code == 422
    assert (await listing(client, owner, status="paid"))["total"] == 1
    assert (await listing(client, owner, status="due"))["total"] == 1
    assert (await listing(client, owner, school_id=school_b["school"]["id"]))["total"] == 1
    assert (await listing(client, owner, month=MONTH))["total"] == 2
    assert (await listing(client, owner, month="2020-01"))["total"] == 0
    # paying is audited in the school's own log as sensitive
    audit = (await client.get(f"{API}/audit?action=platform_invoice.paid", headers=school_a["headers"])).json()
    assert audit["total"] == 1 and audit["items"][0]["sensitive"] is True


async def test_overdue_invoices_are_flagged(client, owner, school_a):
    await activate(client, owner, school_a)
    await students(client, school_a, 1)
    await generate(client, owner)
    async with system_session() as db:
        await db.execute(text("update platform_invoices set due_on = :d"), {"d": today_ist() - timedelta(days=1)})
    row = (await listing(client, owner, overdue="true"))["items"]
    assert len(row) == 1 and row[0]["overdue"] is True
    stats = (await client.get(f"{API}/owner/billing/stats", headers=owner)).json()
    assert stats["overdue_paise"] == 1000 and stats["due_paise"] == 1000 and stats["collected_paise"] == 0


async def test_export_is_an_excel_file(client, owner, school_a):
    from studentkit import read_xlsx

    await activate(client, owner, school_a)
    await students(client, school_a, 2)
    await generate(client, owner)
    r = await client.get(f"{API}/owner/billing/invoices/export", headers=owner)
    assert r.status_code == 200 and "spreadsheetml" in r.headers["content-type"]
    rows = read_xlsx(r.content)
    assert rows[0][0] == "School" and rows[1][0] == "Rewa Public School" and rows[1][4] == 20 and rows[1][6] == "due"


async def test_revenue_stats_and_the_extended_owner_stats(client, owner, school_a, school_b):
    await activate(client, owner, school_a)
    await students(client, school_a, 3)
    await generate(client, owner)
    inv = (await listing(client, owner))["items"][0]
    await client.post(
        f"{API}/owner/billing/invoices/{inv['id']}/mark-paid", headers=owner, json={"payment_mode": "cash"}
    )
    s = (await client.get(f"{API}/owner/billing/stats", headers=owner)).json()
    assert (s["schools_paying"], s["active_students"], s["mrr_paise"], s["arr_paise"]) == (1, 3, 3000, 36000)
    assert (s["billed_paise"], s["collected_paise"], s["due_paise"]) == (3000, 3000, 0)
    assert s["by_month"] == [{"month": MONTH, "billed_paise": 3000, "collected_paise": 3000}]
    assert sum(p["count"] for p in s["new_schools_by_month"]) == 2
    o = (await client.get(f"{API}/owner/stats", headers=owner)).json()
    assert o["collected_paise"] == 3000 and o["due_paise"] == 0 and o["mrr_paise"] == 3000


# ------------------------------------------------------------------ who may do what
async def test_only_the_owner_manages_billing(client, owner, school_a, mail):
    admin = school_a["headers"]
    for method, url in (
        ("get", "/owner/billing/invoices"),
        ("get", "/owner/billing/stats"),
        ("get", "/owner/billing/invoices/export"),
        ("post", "/owner/billing/invoices/generate"),
    ):
        r = await getattr(client, method)(f"{API}{url}", headers=admin, **({"json": {}} if method == "post" else {}))
        assert r.status_code == 403, url


async def test_a_school_sees_its_own_subscription_read_only(client, owner, school_a, school_b, mail):
    await activate(client, owner, school_a)
    await activate(client, owner, school_b)
    await students(client, school_a, 2, "a")
    await students(client, school_b, 5, "b")
    await generate(client, owner)
    b = (await client.get(f"{API}/school/billing", headers=school_a["headers"])).json()
    assert (b["school_status"], b["price_per_student_paise"], b["active_students"]) == ("active", 1000, 2)
    assert b["estimated_monthly_paise"] == 2000 and b["billed_now"] is True and b["outstanding_paise"] == 2000
    assert [(i["month"], i["amount_paise"], i["status"]) for i in b["invoices"]] == [(MONTH, 2000, "due")]
    other = (await client.get(f"{API}/school/billing", headers=school_b["headers"])).json()
    assert other["invoices"][0]["amount_paise"] == 5000  # each school sees only its own
    # read-only: no write routes, and only the admin may look (it is money)
    assert (await client.post(f"{API}/school/billing", headers=school_a["headers"], json={})).status_code == 405
    plain = await teacher(client, school_a["headers"], mail, "plain@rps.example")
    assert (await client.get(f"{API}/school/billing", headers=plain)).status_code == 403
    assert (await client.get(f"{API}/school/billing", headers=owner)).status_code == 403


async def test_trial_school_sees_no_charge(client, owner, school_a):
    await students(client, school_a, 2)
    b = (await client.get(f"{API}/school/billing", headers=school_a["headers"])).json()
    assert b["school_status"] == "trial" and b["billed_now"] is False and b["estimated_monthly_paise"] == 0


# ------------------------------------------------------------------ isolation straight at the database
async def test_rls_isolates_invoices_and_usage(client, owner, school_a, school_b):
    await activate(client, owner, school_a)
    await activate(client, owner, school_b)
    await students(client, school_a, 1, "a")
    await students(client, school_b, 1, "b")
    async with system_session() as db:
        await billing.record_usage(db, LAST_DAY)
    await generate(client, owner)
    a_id, b_id = school_a["school"]["id"], school_b["school"]["id"]
    s = make_session(school_id=a_id)
    try:
        seen = {str(x) for x in (await s.scalars(select(PlatformInvoice.school_id))).all()}
        usage = (await s.execute(text("select school_id from school_usage_daily"))).scalars().all()
        assert seen == {a_id} and {str(u) for u in usage} == {a_id}
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.execute(
                text("insert into school_usage_daily (school_id, day_on, active_students) values (:s, :d, 1)"),
                {"s": b_id, "d": today_ist()},
            )
            await s.flush()
    finally:
        await s.rollback()
        await s.close()
    nobody = make_session()
    try:
        assert (await nobody.scalars(select(PlatformInvoice))).all() == []
    finally:
        await nobody.close()


async def test_owner_second_school_creation_helper_still_works(client, owner, mail):
    # new_school is imported above; make sure schools created later start on trial with the default price
    s = await new_school(client, owner, mail, name="Third School", admin_email="third@x.example")
    b = (await client.get(f"{API}/school/billing", headers=s["headers"])).json()
    assert b["school_status"] == "trial" and b["price_per_student_paise"] == 1000


async def test_owner_can_create_a_school_that_starts_active(client, owner, mail):
    r = await client.post(
        f"{API}/owner/schools",
        headers=owner,
        json={
            "name": "Live Public School",
            "city": "Rewa",
            "admin_name": "Asha Rao",
            "admin_email": "asha@live.example",
            "status": "active",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "active"
    # A school created without a status is simply active.
    r = await client.post(
        f"{API}/owner/schools",
        headers=owner,
        json={
            "name": "Trial Public School",
            "city": "Rewa",
            "admin_name": "Ravi Rao",
            "admin_email": "ravi@trial.example",
        },
    )
    assert r.json()["status"] == "active"
    r = await client.post(
        f"{API}/owner/schools",
        headers=owner,
        json={
            "name": "Bad Status School",
            "city": "Rewa",
            "admin_name": "Zed Rao",
            "admin_email": "zed@bad.example",
            "status": "suspended",
        },
    )
    assert r.status_code == 422
