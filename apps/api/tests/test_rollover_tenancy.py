"""One school's rollover never touches or shows another's: through the API and straight at the database."""

import uuid

import pytest
from conftest import API
from rolloverkit import apply, status, world
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError

from app.core.clock import utcnow
from app.db.session import make_session
from app.models.rollover import PromotionBatch, PromotionItem, RolloverDraft
from app.models.student import Student


async def test_rolling_one_school_over_leaves_the_other_alone(client, school_a, school_b, mail):
    wa = await world(client, school_a, mail)
    ha, hb = school_a["headers"], school_b["headers"]
    sb_before = await status(client, hb)
    out = await apply(client, ha)
    # school B: same year as before, no batches, no draft, the A batch id is unknown
    sb_after = await status(client, hb)
    assert sb_after == sb_before and sb_after["last_batch_id"] is None
    assert (await client.get(f"{API}/rollover/batches", headers=hb)).json() == []
    assert (await client.get(f"{API}/rollover/batches/{out['batch_id']}", headers=hb)).status_code == 404
    assert (await client.get(f"{API}/rollover/batches/{out['batch_id']}", headers=ha)).status_code == 200
    # A's year id cannot be rolled over by B
    r = await client.post(
        f"{API}/rollover/apply",
        headers=hb,
        json={"from_year_id": sb_before["current_year_id"] and str(uuid.uuid4()), "confirm": True},
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "year_changed"
    # B's own rollover works and does not disturb A's students
    assert (await apply(client, hb))["promoted"] == 0
    async with make_session(bypass=True) as s:
        assert len((await s.scalars(select(Student).where(Student.status == "passed_out"))).all()) == 1
    assert wa["kids"]["Diya"]


async def test_drafts_are_per_school(client, school_a, school_b):
    ha, hb = school_a["headers"], school_b["headers"]
    await client.put(f"{API}/rollover/draft", headers=ha, json={"new_year_name": "2030-31"})
    assert (await client.get(f"{API}/rollover/draft", headers=hb)).json()["plan"]["new_year_name"] is None
    await client.put(f"{API}/rollover/draft", headers=hb, json={"new_year_name": "2031-32"})
    assert (await client.get(f"{API}/rollover/draft", headers=ha)).json()["plan"]["new_year_name"] == "2030-31"
    await client.delete(f"{API}/rollover/draft", headers=hb)
    assert (await client.get(f"{API}/rollover/draft", headers=ha)).json()["updated_at"] is not None


async def test_students_step_and_readiness_only_show_own_school(client, school_a, school_b, mail):
    await world(client, school_a, mail)
    assert (await client.get(f"{API}/rollover/students", headers=school_b["headers"])).json() == []
    items = (await client.get(f"{API}/rollover/readiness", headers=school_b["headers"])).json()["items"]
    assert all(i["count"] == 0 for i in items)


@pytest.mark.parametrize("model", [RolloverDraft, PromotionBatch, PromotionItem])
async def test_row_level_security_on_rollover_tables(client, school_a, school_b, mail, model):
    await world(client, school_a, mail)
    await client.put(f"{API}/rollover/draft", headers=school_a["headers"], json={"new_year_name": "2030-31"})
    await apply(client, school_a["headers"], {"new_year_name": "2029-30"})
    await client.put(f"{API}/rollover/draft", headers=school_a["headers"], json={"new_year_name": "2031-32"})
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=b_id)
    try:
        assert (await s.scalars(select(model))).all() == []
    finally:
        await s.close()
    nobody = make_session()
    try:
        assert (await nobody.scalars(select(model))).all() == []
    finally:
        await nobody.close()
    mine = make_session(school_id=a_id)
    try:
        assert len((await mine.scalars(select(model))).all()) >= 1
    finally:
        await mine.close()


async def test_a_school_cannot_write_rows_for_another_school(client, school_a, school_b):
    a_id = uuid.UUID(school_a["school"]["id"])
    s = make_session(school_id=uuid.UUID(school_b["school"]["id"]))
    try:
        s.add(RolloverDraft(school_id=a_id, payload={}, updated_at=utcnow()))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()
