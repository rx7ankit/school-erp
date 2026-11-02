from conftest import API
from sqlalchemy import func, select
from studentkit import make_class, parent_headers, read_xlsx, teacher, upload, xlsx

from app.db.session import system_session
from app.models.student import Student

HEAD = [
    "Scholar No",
    "First Name",
    "Last Name",
    "Class",
    "Date of Birth",
    "Guardian Name",
    "Guardian Mobile",
    "Guardian Email",
]


def good(n, cls="8-A", email=None, scholar=None):
    return [
        scholar if scholar is not None else f"S{n}",
        f"Kid{n}",
        "Singh",
        cls,
        "15/06/2014",
        f"Parent{n}",
        f"98765432{n:02d}",
        email,
    ]


async def count_students() -> int:
    async with system_session() as db:
        return await db.scalar(select(func.count()).select_from(Student))


async def test_dry_run_reports_each_row_and_writes_nothing(client, school_a):
    h = school_a["headers"]
    await make_class(client, h)
    rows = [
        good(1),
        good(2, cls="12-Z"),  # no such class
        good(3, scholar="S1"),  # same scholar number as row 1
        ["S4", "", "X", "8-A", "31/02/2014", "", "123", "not-mail"],  # many problems
    ]
    r = await client.post(f"{API}/students/import", headers=h, files=upload(xlsx(rows, HEAD)))
    assert r.status_code == 201, r.text
    job = r.json()
    assert (job["total_rows"], job["ok_rows"], job["error_rows"], job["status"]) == (4, 1, 3, "validated")
    by_row = {x["row_no"]: x for x in job["rows"]}
    assert by_row[2]["ok"] is True
    assert "does not exist" in by_row[3]["error"]
    assert "already used" in by_row[4]["error"]
    e = by_row[5]["error"]
    assert "First name is missing" in e and "not a date" in e and "Guardian name is missing" in e and "not valid" in e
    assert await count_students() == 0
    # commit refuses while rows have problems, and still writes nothing
    r = await client.post(f"{API}/students/import/{job['id']}/commit", headers=h, json={})
    assert r.status_code == 409 and r.json()["error"]["code"] == "import_has_errors"
    assert len(r.json()["error"]["details"]) == 3 and await count_students() == 0
    assert (await client.get(f"{API}/students/import/{job['id']}", headers=h)).json()["status"] == "validated"


async def test_commit_imports_the_valid_file_once(client, school_a, mail):
    h = school_a["headers"]
    await make_class(client, h)
    await make_class(client, h, "8", "B")
    rows = [good(1, email="p@example.com"), good(2, cls="8 b", email="P@example.com"), good(3, scholar="")]
    job = (
        await client.post(
            f"{API}/students/import", headers=h, params={"create_logins": "true"}, files=upload(xlsx(rows, HEAD))
        )
    ).json()
    assert job["error_rows"] == 0
    assert await count_students() == 0  # validated only
    r = await client.post(f"{API}/students/import/{job['id']}/commit", headers=h, json={"send_login": True})
    assert r.status_code == 200, r.text
    assert r.json() == {"job_id": job["id"], "imported": 3, "skipped": 0, "logins_created": 1, "sent": 1, "failed": 0}
    assert await count_students() == 3
    listed = (await client.get(f"{API}/students", headers=h)).json()["items"]
    assert {x["class_label"] for x in listed} == {"8-A", "8-B"}
    ph = await parent_headers(client, mail, "p@example.com")
    assert len((await client.get(f"{API}/parent/children", headers=ph)).json()) == 2  # same email, one login
    s1 = next(x for x in listed if x["scholar_no"] == "S1")
    d = (await client.get(f"{API}/students/{s1['id']}", headers=h)).json()
    assert d["dob"] == "2014-06-15" and d["history"][0]["reason"] == "Excel import"
    again = await client.post(f"{API}/students/import/{job['id']}/commit", headers=h, json={})
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_imported"
    assert await count_students() == 3
    log = (await client.get(f"{API}/audit", headers=h, params={"action": "students.imported"})).json()["items"]
    assert len(log) == 1 and "3 students" in log[0]["summary"]


async def test_skip_errors_imports_only_the_valid_rows(client, school_a):
    h = school_a["headers"]
    await make_class(client, h)
    rows = [good(1), good(2, cls="Nope"), good(3)]
    job = (await client.post(f"{API}/students/import", headers=h, files=upload(xlsx(rows, HEAD)))).json()
    r = await client.post(f"{API}/students/import/{job['id']}/commit", headers=h, json={"skip_errors": True})
    assert r.json()["imported"] == 2 and r.json()["skipped"] == 1 and await count_students() == 2


async def test_commit_checks_again_if_the_school_changed_since_the_dry_run(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h)
    job = (
        await client.post(f"{API}/students/import", headers=h, files=upload(xlsx([good(1, scholar="77")], HEAD)))
    ).json()
    assert job["error_rows"] == 0
    await client.post(
        f"{API}/students",
        headers=h,
        json={
            "first_name": "Early",
            "scholar_no": "77",
            "class_id": c["id"],
            "guardians": [{"name": "P", "phone": "9999999999"}],
        },
    )
    r = await client.post(f"{API}/students/import/{job['id']}/commit", headers=h, json={})
    assert r.status_code == 409 and "already used" in r.json()["error"]["details"][0]["error"]
    assert await count_students() == 1


async def test_capacity_counts_rows_in_the_same_file(client, school_a):
    h = school_a["headers"]
    await make_class(client, h, capacity=2)
    job = (
        await client.post(f"{API}/students/import", headers=h, files=upload(xlsx([good(1), good(2), good(3)], HEAD)))
    ).json()
    assert job["ok_rows"] == 2 and "is full" in job["rows"][2]["error"]


async def test_csv_and_bad_files(client, school_a):
    h = school_a["headers"]
    await make_class(client, h)
    csv = b"First Name,Class,Guardian Name,Mobile\nAsha,8-A,Meena,9876543210\n"
    job = (await client.post(f"{API}/students/import", headers=h, files={"file": ("s.csv", csv, "text/csv")})).json()
    assert job["ok_rows"] == 1
    r = await client.post(
        f"{API}/students/import", headers=h, files={"file": ("s.csv", b"First Name,Class\nA,8-A\n", "text/csv")}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "missing_columns"
    r = await client.post(f"{API}/students/import", headers=h, files={"file": ("s.xlsx", b"not excel", "text/plain")})
    assert r.status_code == 422 and r.json()["error"]["code"] == "unreadable_file"
    r = await client.post(f"{API}/students/import", headers=h, files={"file": ("s.pdf", b"x", "application/pdf")})
    assert r.status_code == 422


async def test_template_and_permissions(client, school_a, mail):
    h = school_a["headers"]
    await make_class(client, h)
    r = await client.get(f"{API}/students/import/template", headers=h)
    assert r.status_code == 200 and "spreadsheetml" in r.headers["content-type"]
    rows = read_xlsx(r.content)
    assert rows[0][:4] == ["Scholar No", "First Name", "Last Name", "Class"] and rows[1][3] == "8-A"
    # the template itself imports cleanly
    job = (await client.post(f"{API}/students/import", headers=h, files=upload(r.content))).json()
    assert job["error_rows"] == 0 and job["ok_rows"] == 1
    t = await teacher(client, h, mail, "tchr@rps.example")
    assert (await client.get(f"{API}/students/import/template", headers=t)).status_code == 403
    assert (await client.post(f"{API}/students/import", headers=t, files=upload(r.content))).status_code == 403
    assert (await client.post(f"{API}/students/import/{job['id']}/commit", headers=t, json={})).status_code == 403


async def test_export_follows_the_list_filters_and_is_audited(client, school_a, mail):
    h = school_a["headers"]
    a, b = await make_class(client, h, "8", "A"), await make_class(client, h, "8", "B")
    job = (
        await client.post(
            f"{API}/students/import", headers=h, files=upload(xlsx([good(1), good(2, "8-B"), good(3, "8-B")], HEAD))
        )
    ).json()
    await client.post(f"{API}/students/import/{job['id']}/commit", headers=h, json={})
    r = await client.get(f"{API}/students/export", headers=h, params={"class_id": b["id"]})
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    rows = read_xlsx(r.content)
    assert rows[0][:3] == ["Scholar No", "Name", "Class"] and len(rows) == 3
    assert {x[2] for x in rows[1:]} == {"8-B"} and rows[1][10] == "Parent2"
    await client.patch(
        f"{API}/students/{(await client.get(f'{API}/students', headers=h, params={'q': 'Kid3'})).json()['items'][0]['id']}",
        headers=h,
        json={"first_name": "=HYPERLINK(1)"},
    )
    rows = read_xlsx((await client.get(f"{API}/students/export", headers=h, params={"class_id": b["id"]})).content)
    assert any(str(x[1]).startswith("'=HYPERLINK") for x in rows[1:])  # text that looks like a formula is neutralised
    log = (await client.get(f"{API}/audit", headers=h, params={"category": "exports"})).json()["items"]
    assert log[0]["action"] == "students.exported" and "2 students" in log[0]["summary"]
    # a teacher exports only what they can see
    t = await teacher(client, h, mail, "t8a@rps.example", class_id=a["id"])
    mine = read_xlsx((await client.get(f"{API}/students/export", headers=t)).content)
    assert len(mine) == 2 and mine[1][2] == "8-A"


async def test_each_commit_endpoint_refuses_the_other_kind_of_import(client, school_a):
    h = school_a["headers"]
    await make_class(client, h)
    stu = (await client.post(f"{API}/students/import", headers=h, files=upload(xlsx([good(1)], HEAD)))).json()
    # an opening-balance job (kind opening_balances) made by the fees module
    ob_rows = [[stu["rows"][0]["data"].get("scholar_no") or "S1", "100", "30/06/2026"]]
    ob = await client.post(
        f"{API}/fees/opening-balances/import",
        headers=h,
        files=upload(xlsx(ob_rows, ["Scholar No", "Amount Owed", "As Of Date"])),
    )
    assert ob.status_code == 201, ob.text
    r = await client.post(f"{API}/students/import/{ob.json()['id']}/commit", headers=h, json={})
    assert r.status_code == 409 and r.json()["error"]["code"] == "wrong_import_kind"
    r = await client.post(f"{API}/fees/opening-balances/import/{stu['id']}/commit", headers=h, json={})
    assert r.status_code == 409 and r.json()["error"]["code"] == "wrong_import_kind"
    assert await count_students() == 0  # nothing was imported by the wrong endpoint
    # the right endpoints still work
    assert (await client.post(f"{API}/students/import/{stu['id']}/commit", headers=h, json={})).status_code == 200
