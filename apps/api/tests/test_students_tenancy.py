"""Students, guardians, admissions and imports of one school are invisible to another."""

import uuid

import pytest
from conftest import API
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError
from studentkit import GUARD, enrol, make_class, upload, xlsx

from app.db.session import make_session
from app.models.student import (
    Admission,
    Enrollment,
    Guardian,
    ImportJob,
    ImportRow,
    Student,
    StudentEvent,
    StudentGuardian,
)

HEAD = ["First Name", "Class", "Guardian Name", "Mobile"]


async def two_schools(client, a, b):
    ca, cb = await make_class(client, a["headers"]), await make_class(client, b["headers"])
    sa = await enrol(client, a["headers"], ca["id"], first="Alpha", guardians=[{**GUARD, "email": "a@x.example"}])
    sb = await enrol(client, b["headers"], cb["id"], first="Beta", guardians=[{**GUARD, "email": "b@x.example"}])
    return ca, cb, sa, sb


async def test_other_schools_students_are_invisible_through_the_api(client, school_a, school_b):
    ca, cb, sa, sb = await two_schools(client, school_a, school_b)
    ha, hb = school_a["headers"], school_b["headers"]
    assert [x["name"] for x in (await client.get(f"{API}/students", headers=ha)).json()["items"]] == ["Alpha Sharma"]
    assert [x["name"] for x in (await client.get(f"{API}/students", headers=hb)).json()["items"]] == ["Beta Sharma"]
    assert (await client.get(f"{API}/students/{sb['id']}", headers=ha)).status_code == 404
    assert (await client.get(f"{API}/students/{sb['id']}/history", headers=ha)).status_code == 404
    assert (await client.patch(f"{API}/students/{sb['id']}", headers=ha, json={"address": "x"})).status_code == 404
    assert (await client.post(f"{API}/students/{sb['id']}/leave", headers=ha, json={"reason": "x"})).status_code == 404
    assert (
        await client.post(f"{API}/students/{sb['id']}/transfer", headers=ha, json={"class_id": ca["id"]})
    ).status_code == 404
    # nor can a student be put into another school's class
    r = await client.post(
        f"{API}/students", headers=ha, json={"first_name": "X", "class_id": cb["id"], "guardians": [GUARD]}
    )
    assert r.status_code == 404
    assert (
        await client.post(f"{API}/students/{sa['id']}/transfer", headers=ha, json={"class_id": cb["id"]})
    ).status_code == 404
    # guardians and parent logins
    gb = sb["guardians"][0]["id"]
    assert (await client.post(f"{API}/parents/{gb}/send-login", headers=ha)).status_code == 404
    assert (await client.patch(f"{API}/parents/{gb}", headers=ha, json={"name": "Hacked"})).status_code == 404
    assert [p["name"] for p in (await client.get(f"{API}/parents", headers=ha)).json()["items"]] == ["Rakesh Sharma"]
    assert (await client.get(f"{API}/parents", headers=ha)).json()["total"] == 1
    r = await client.post(
        f"{API}/students/{sa['id']}/guardians", headers=ha, json={"guardian_id": gb, "relation": "other"}
    )
    assert r.status_code == 404  # cannot attach another school's guardian
    # exports only contain the school's own students
    from studentkit import read_xlsx

    assert [x[1] for x in read_xlsx((await client.get(f"{API}/students/export", headers=ha)).content)[1:]] == [
        "Alpha Sharma"
    ]


async def test_admissions_and_imports_are_separate(client, school_a, school_b):
    ha, hb = school_a["headers"], school_b["headers"]
    ca = await make_class(client, ha)
    adm = {"applicant_name": "Kid", "grade_applied": "8", "guardian_name": "Parent"}
    a = (await client.post(f"{API}/admissions", headers=ha, json=adm)).json()
    assert (await client.get(f"{API}/admissions", headers=hb)).json()["total"] == 0
    assert (await client.get(f"{API}/admissions/{a['id']}", headers=hb)).status_code == 404
    assert (
        await client.post(f"{API}/admissions/{a['id']}/status", headers=hb, json={"status": "approved"})
    ).status_code == 404
    assert (await client.post(f"{API}/admissions/{a['id']}/enrol", headers=hb, json={})).status_code == 404
    job = (
        await client.post(
            f"{API}/students/import", headers=ha, files=upload(xlsx([["Asha", "8-A", "Meena", "9876543210"]], HEAD))
        )
    ).json()
    assert (await client.get(f"{API}/students/import/{job['id']}", headers=hb)).status_code == 404
    assert (await client.post(f"{API}/students/import/{job['id']}/commit", headers=hb, json={})).status_code == 404
    # school B has no class "8-A", so the same file fails there
    other = (
        await client.post(
            f"{API}/students/import", headers=hb, files=upload(xlsx([["Asha", "8-A", "Meena", "9876543210"]], HEAD))
        )
    ).json()
    assert other["error_rows"] == 1 and ca


async def test_a_parent_never_sees_another_schools_child(client, school_a, school_b, mail):
    from studentkit import parent_headers

    ca, cb, sa, sb = await two_schools(client, school_a, school_b)
    await client.post(f"{API}/parents/send-login", headers=school_a["headers"], json={})
    ph = await parent_headers(client, mail, "a@x.example")
    assert [k["name"] for k in (await client.get(f"{API}/parent/children", headers=ph)).json()] == ["Alpha Sharma"]
    assert (await client.get(f"{API}/parent/children/{sb['id']}", headers=ph)).status_code == 404


MODELS = (Student, Guardian, StudentGuardian, Enrollment, StudentEvent, Admission, ImportJob, ImportRow)


async def test_postgres_itself_hides_other_schools_for_every_new_table(client, school_a, school_b):
    ca, cb, sa, sb = await two_schools(client, school_a, school_b)
    ha = school_a["headers"]
    await client.post(
        f"{API}/admissions", headers=ha, json={"applicant_name": "K", "grade_applied": "8", "guardian_name": "P"}
    )
    await client.post(
        f"{API}/students/import", headers=ha, files=upload(xlsx([["Asha", "8-A", "Meena", "9876543210"]], HEAD))
    )
    hb = school_b["headers"]
    await client.post(
        f"{API}/admissions", headers=hb, json={"applicant_name": "K2", "grade_applied": "8", "guardian_name": "P"}
    )
    await client.post(
        f"{API}/students/import", headers=hb, files=upload(xlsx([["Zed", "8-A", "Meena", "9876543210"]], HEAD))
    )
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
        lambda b: Guardian(school_id=b, name="Sneaky"),
        lambda b: Admission(
            school_id=b,
            applicant_name="S",
            grade_applied="1",
            guardian_name="G",
            applied_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
        ),
    ],
)
async def test_postgres_blocks_writing_new_tables_into_another_school(client, school_a, school_b, build):
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=a_id)
    try:
        s.add(build(b_id))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()
