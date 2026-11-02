"""One school's library is invisible to another, through the API and straight in Postgres."""

import uuid

import pytest
from conftest import API
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError
from studentkit import enrol, make_class

from app.db.session import make_session
from app.models.library import LibraryBook, LibraryCopy, LibraryCounter, LibraryLoan, LibrarySettings

L = f"{API}/library"


async def build(client, school, tag):
    h = school["headers"]
    cls = await make_class(client, h)
    s = await enrol(
        client, h, cls["id"], first=tag, guardians=[{"name": "G", "phone": "9876543210", "email": f"{tag}@p.example"}]
    )
    await client.put(f"{L}/settings", headers=h, json={"loan_days": 7, "fine_per_day_paise": 100})
    book = (await client.post(f"{L}/books", headers=h, json={"title": f"Book {tag}", "copies": 1})).json()
    loan = (
        await client.post(f"{L}/loans", headers=h, json={"copy_id": book["copies"][0]["id"], "student_id": s["id"]})
    ).json()
    return {"student": s, "book": book, "copy": book["copies"][0], "loan": loan}


async def test_api_isolation(client, school_a, school_b):
    a, b = await build(client, school_a, "alpha"), await build(client, school_b, "beta")
    ha = school_a["headers"]
    assert [x["title"] for x in (await client.get(f"{L}/books", headers=ha)).json()["items"]] == ["Book alpha"]
    assert (await client.get(f"{L}/books/{b['book']['id']}", headers=ha)).status_code == 404
    assert (await client.patch(f"{L}/books/{b['book']['id']}", headers=ha, json={"title": "x"})).status_code == 404
    assert (await client.delete(f"{L}/books/{b['book']['id']}", headers=ha)).status_code == 404
    assert (await client.post(f"{L}/books/{b['book']['id']}/copies", headers=ha, json={})).status_code == 404
    assert (await client.patch(f"{L}/copies/{b['copy']['id']}", headers=ha, json={"status": "lost"})).status_code == 404
    assert (await client.get(f"{L}/copies/lookup", headers=ha, params={"accession_no": "LIB-00001"})).json()[
        "book_id"
    ] == a["book"]["id"]
    assert [
        x["id"] for x in (await client.get(f"{L}/loans", headers=ha, params={"status": "all"})).json()["items"]
    ] == [a["loan"]["id"]]
    for tail in ("return", "renew"):
        assert (await client.post(f"{L}/loans/{b['loan']['id']}/{tail}", headers=ha)).status_code == 404
    # cannot lend own copy to the other school's student, or the other school's copy to own student
    assert (
        await client.post(f"{L}/loans", headers=ha, json={"copy_id": a["copy"]["id"], "student_id": b["student"]["id"]})
    ).status_code == 404
    assert (
        await client.post(f"{L}/loans", headers=ha, json={"copy_id": b["copy"]["id"], "student_id": a["student"]["id"]})
    ).status_code == 404
    # accession numbers and settings are per school
    assert a["copy"]["accession_no"] == b["copy"]["accession_no"] == "LIB-00001"
    assert (
        await client.get(f"{L}/loans", headers=ha, params={"student_id": b["student"]["id"], "status": "all"})
    ).json()["total"] == 0


async def test_postgres_itself_hides_other_schools(client, school_a, school_b):
    await build(client, school_a, "alpha")
    await build(client, school_b, "beta")
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    models = (LibrarySettings, LibraryBook, LibraryCopy, LibraryCounter, LibraryLoan)
    for me in (a_id, b_id):
        s = make_session(school_id=me)
        try:
            for model in models:
                rows = (await s.scalars(select(model))).all()
                assert rows and {r.school_id for r in rows} == {me}, model.__tablename__
        finally:
            await s.close()
    nobody = make_session()
    try:
        for model in models:
            assert (await nobody.scalars(select(model))).all() == [], model.__tablename__
    finally:
        await nobody.close()


@pytest.mark.parametrize(
    "build_row",
    [
        lambda b: LibraryBook(school_id=b, title="Sneaky"),
        lambda b: LibraryCounter(school_id=b, last=1),
        lambda b: LibrarySettings(school_id=b, loan_days=3, fine_per_day_paise=0),
    ],
)
async def test_cannot_write_into_another_school(client, school_a, school_b, build_row):
    await build(client, school_a, "alpha")
    s = make_session(school_id=uuid.UUID(school_a["school"]["id"]))
    try:
        s.add(build_row(uuid.UUID(school_b["school"]["id"])))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()
