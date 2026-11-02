"""Timetable, substitute, certificate and document data of one school is invisible to another."""

import uuid

import pytest
from conftest import API
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError
from studentkit import GUARD, enrol, make_class
from timekit import MON, slot

from app.db.session import make_session
from app.models.certificate import Certificate, CertificateCounter
from app.models.timetable import Period, StaffAbsence, Substitution, TimetableSlot


async def build(client, school, mail, email_prefix):
    h = school["headers"]
    cls = await make_class(client, h)
    r = await client.post(f"{API}/academic/subjects", headers=h, json={"name": "Maths"})
    maths = r.json()
    p = (
        await client.post(
            f"{API}/timetable/periods",
            headers=h,
            json={"number": 1, "name": "P1", "starts_at": "09:00:00", "ends_at": "09:40:00"},
        )
    ).json()
    t = (
        await client.post(
            f"{API}/staff",
            headers=h,
            json={
                "name": f"T {email_prefix}",
                "email": f"{email_prefix}@x.example",
                "designation": "T",
                "send_login": False,
            },
        )
    ).json()
    sl = await slot(client, h, cls["id"], 1, p["id"], maths["id"], t["id"])
    await client.post(f"{API}/timetable/absences", headers=h, json={"staff_id": t["id"], "absent_on": MON})
    s = await enrol(
        client, h, cls["id"], first=email_prefix.title(), guardians=[{**GUARD, "email": f"{email_prefix}@p.example"}]
    )
    cert = (
        await client.post(f"{API}/certificates", headers=h, json={"student_id": s["id"], "kind": "bonafide"})
    ).json()
    return {"cls": cls, "period": p, "teacher": t, "slot": sl, "student": s, "cert": cert, "subject": maths}


async def test_other_schools_data_is_invisible_through_the_api(client, school_a, school_b, mail):
    a, b = await build(client, school_a, mail, "alpha"), await build(client, school_b, mail, "beta")
    ha, hb = school_a["headers"], school_b["headers"]
    assert (await client.get(f"{API}/timetable/classes/{b['cls']['id']}", headers=ha)).status_code == 404
    assert (await client.get(f"{API}/timetable/classes/{a['cls']['id']}", headers=ha)).json()["slots"][0]["id"] == a[
        "slot"
    ]["id"]
    assert len((await client.get(f"{API}/timetable/periods", headers=ha)).json()) == 1
    assert (
        await client.patch(f"{API}/timetable/periods/{b['period']['id']}", headers=ha, json={"name": "x"})
    ).status_code == 404
    assert (await client.delete(f"{API}/timetable/periods/{b['period']['id']}", headers=ha)).status_code == 404
    assert (
        await client.patch(
            f"{API}/timetable/slots/{b['slot']['id']}", headers=ha, json={"staff_id": a["teacher"]["id"]}
        )
    ).status_code == 404
    assert (await client.delete(f"{API}/timetable/slots/{b['slot']['id']}", headers=ha)).status_code == 404
    # cannot build a slot from another school's period, class, subject or teacher
    body = {
        "class_id": a["cls"]["id"],
        "weekday": 2,
        "period_id": a["period"]["id"],
        "subject_id": a["subject"]["id"],
        "staff_id": a["teacher"]["id"],
    }
    for key, val in (
        ("class_id", b["cls"]["id"]),
        ("period_id", b["period"]["id"]),
        ("subject_id", b["subject"]["id"]),
        ("staff_id", b["teacher"]["id"]),
    ):
        assert (await client.post(f"{API}/timetable/slots", headers=ha, json={**body, key: val})).status_code == 404, (
            key
        )
    # absence and cover
    assert (
        await client.post(
            f"{API}/timetable/absences", headers=ha, json={"staff_id": b["teacher"]["id"], "absent_on": MON}
        )
    ).status_code == 404
    assert (await client.get(f"{API}/timetable/staff/{b['teacher']['id']}", headers=ha)).status_code == 404
    cover = (await client.get(f"{API}/timetable/cover", headers=ha, params={"on": MON})).json()
    assert [c["slot"]["id"] for c in cover] == [a["slot"]["id"]]
    assert (
        await client.post(
            f"{API}/timetable/substitutions",
            headers=ha,
            json={"slot_id": b["slot"]["id"], "covers_on": MON, "substitute_staff_id": a["teacher"]["id"]},
        )
    ).status_code == 404
    # certificates and documents
    assert (await client.get(f"{API}/certificates/{b['cert']['id']}", headers=ha)).status_code == 404
    assert (
        await client.post(f"{API}/certificates/{b['cert']['id']}/cancel", headers=ha, json={"reason": "abc"})
    ).status_code == 404
    assert (
        await client.post(f"{API}/certificates/{b['cert']['id']}/reissue", headers=ha, json={"reason": "abc"})
    ).status_code == 404
    assert (
        await client.post(
            f"{API}/certificates", headers=ha, json={"student_id": b["student"]["id"], "kind": "bonafide"}
        )
    ).status_code == 404
    assert [c["id"] for c in (await client.get(f"{API}/certificates", headers=ha)).json()["items"]] == [a["cert"]["id"]]
    assert (await client.get(f"{API}/students/{b['student']['id']}/documents", headers=ha)).status_code == 404
    # numbering is per school: both schools start at 001
    assert a["cert"]["number"] == b["cert"]["number"]
    assert hb


async def test_postgres_itself_hides_other_schools(client, school_a, school_b, mail):
    await build(client, school_a, mail, "alpha")
    await build(client, school_b, mail, "beta")
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    models = (Period, TimetableSlot, StaffAbsence, Certificate, CertificateCounter)
    for me in (a_id, b_id):
        s = make_session(school_id=me)
        try:
            for model in models:
                rows = (await s.scalars(select(model))).all()
                assert rows, model.__tablename__
                assert {r.school_id for r in rows} == {me}, model.__tablename__
        finally:
            await s.close()
    nobody = make_session()
    try:
        for model in (*models, Substitution):
            assert (await nobody.scalars(select(model))).all() == [], model.__tablename__
    finally:
        await nobody.close()


@pytest.mark.parametrize(
    "build_row",
    [
        lambda b: Period(
            school_id=b,
            number=5,
            name="Sneaky",
            starts_at=__import__("datetime").time(8),
            ends_at=__import__("datetime").time(9),
        ),
        lambda b: CertificateCounter(school_id=b, kind="bonafide", year=2026, last=99),
    ],
)
async def test_postgres_blocks_writing_into_another_school(client, school_a, school_b, build_row):
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=a_id)
    try:
        s.add(build_row(b_id))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()
