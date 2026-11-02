"""Scheduled jobs: late fees for every school, platform invoices, notification cleanup, and the runner."""

import json
from datetime import timedelta

from conftest import API
from feekit import invoices, post, run, school_with_fees
from sqlalchemy import select, text

from app.core.clock import today_ist, utcnow
from app.db.session import make_session, system_session
from app.jobs import run as runner
from app.jobs import tasks
from app.models.notification import Notification
from app.models.school import PlatformInvoice
from app.services import billing
from app.services.notifications import notify


async def test_late_fee_job_covers_every_school_and_is_idempotent(client, school_a, school_b):
    for school, name in ((school_a, "A"), (school_b, "B")):
        h = school["headers"]
        await school_with_fees(client, h, students=(f"Kid{name}",), emails=False)
        await post(client, h, "/fees/late-rules", {"amount_paise": 500}, 201)
        await run(client, h, "April", due=(today_ist() - timedelta(days=10)).isoformat())
    first = await tasks.late_fees()
    assert first == {"schools": 2, "failed": 0, "invoices_updated": 2}
    for school in (school_a, school_b):
        inv = (await invoices(client, school["headers"]))[0]
        assert inv["total_paise"] == 100_000 + 500
    again = await tasks.late_fees()
    assert again["invoices_updated"] == 0 and again["failed"] == 0


async def test_a_suspended_school_is_skipped_and_a_failure_does_not_stop_the_others(
    client, owner, school_a, school_b, monkeypatch
):
    for school in (school_a, school_b):
        h = school["headers"]
        await school_with_fees(client, h, students=("Kid",), emails=False)
        await post(client, h, "/fees/late-rules", {"amount_paise": 500}, 201)
        await run(client, h, "April", due=(today_ist() - timedelta(days=10)).isoformat())
    await client.patch(f"{API}/owner/schools/{school_b['school']['id']}", headers=owner, json={"status": "suspended"})
    assert (await tasks.late_fees())["schools"] == 1

    await client.patch(f"{API}/owner/schools/{school_b['school']['id']}", headers=owner, json={"status": "active"})
    real = tasks.apply_late_fees
    calls = []

    async def flaky(db, actor, as_of):
        calls.append(actor.school_id)
        if len(calls) == 1:
            raise RuntimeError("boom")
        return await real(db, actor, as_of)

    monkeypatch.setattr(tasks, "apply_late_fees", flaky)
    out = await tasks.late_fees()
    assert out["failed"] == 1 and out["schools"] == 1


async def test_platform_invoice_job_records_usage_and_bills_last_month_once(client, owner, school_a):
    await client.patch(f"{API}/owner/schools/{school_a['school']['id']}", headers=owner, json={"status": "active"})
    from studentkit import GUARD, enrol, make_class

    c = await make_class(client, school_a["headers"])
    for i in range(2):
        await enrol(
            client, school_a["headers"], c["id"], first=f"K{i}", guardians=[{**GUARD, "email": f"k{i}@x.example"}]
        )
    first = await tasks.platform_invoices()
    assert first["created"] == 1 and first["amount_paise"] == 2000
    assert (await tasks.platform_invoices())["created"] == 0
    async with system_session() as db:
        inv = await db.scalar(select(PlatformInvoice))
        assert inv.period_on == billing.previous_month(today_ist())
        usage = (await db.execute(text("select active_students from school_usage_daily"))).scalars().all()
    assert usage == [2]
    assert (await tasks.record_usage()) == {"schools": 1}


async def test_notification_cleanup_removes_only_rows_older_than_90_days(client, school_a):
    sid = school_a["school"]["id"]
    me = (await client.get(f"{API}/auth/me", headers=school_a["headers"])).json()["id"]
    import uuid

    db = make_session(school_id=uuid.UUID(sid))
    try:
        ids = await notify(db, user_ids=[uuid.UUID(me)], kind="notice", title="old", body="", school_id=uuid.UUID(sid))
        ids += await notify(
            db, user_ids=[uuid.UUID(me)], kind="notice", title="edge", body="", school_id=uuid.UUID(sid)
        )
        ids += await notify(db, user_ids=[uuid.UUID(me)], kind="notice", title="new", body="", school_id=uuid.UUID(sid))
        for nid, days in zip(ids, (91, 89, 1), strict=True):
            await db.execute(
                text("update notifications set created_at = :t where id = :i"),
                {"t": utcnow() - timedelta(days=days), "i": nid},
            )
        await db.commit()
    finally:
        await db.close()
    assert await tasks.notification_cleanup() == {"deleted": 1}
    async with system_session() as s:
        left = sorted((await s.scalars(select(Notification.title))).all())
    assert left == ["edge", "new"]


async def test_the_runner_prints_json_and_returns_exit_codes(capsys, client, school_a):
    assert await runner.run(["notification-cleanup"]) == 0
    line = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert line == {"job": "notification-cleanup", "ok": True, "deleted": 0}
    assert runner.main(["nope"]) == 2  # usage errors never start the event loop
    assert runner.main([]) == 2
    assert await runner.run(list(tasks.JOBS)) == 0
    names = [json.loads(x)["job"] for x in capsys.readouterr().out.strip().splitlines() if x.startswith("{")]
    assert names == list(tasks.JOBS)


async def test_the_runner_reports_a_failing_job_with_exit_code_1(capsys, client, school_a, monkeypatch):
    async def broken():
        raise RuntimeError("nope")

    monkeypatch.setitem(tasks.JOBS, "record-usage", broken)
    assert await runner.run(["record-usage"]) == 1
    assert json.loads(capsys.readouterr().out.strip().splitlines()[-1]) == {
        "job": "record-usage",
        "ok": False,
        "error": "nope",
    }
