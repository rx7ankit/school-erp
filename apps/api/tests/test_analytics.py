"""Analytics and the dashboard: numbers, and who sees what (admin, class teacher, subject teacher, fees, staff)."""

import pytest
from attkit import day, mark, rec
from conftest import API, add_staff
from feekit import head, pay, run, structure
from resultskit import enr_ids, put_marks, sheet, world
from studentkit import GUARD, enrol, make_class, parent_headers, teacher

from app.services.analytics import can_see_fees


@pytest.fixture
async def w(client, school_a, mail):
    """Class 8-A with three students, teachers, an exam; plus class 9-A with its own teacher and one student."""
    w = await world(client, school_a, mail)
    h = w["h"]
    c9 = await make_class(client, h, grade="9")
    w["c9"] = c9
    w["t9"] = await teacher(client, h, mail, "t9@rps.example", class_id=c9["id"])
    w["k9"] = await enrol(client, h, c9["id"], first="Zoya", guardians=[{**GUARD, "email": "zoya@fam.example"}])
    return w


async def get(client, h, url, status=200, **params):
    r = await client.get(f"{API}{url}", headers=h, params=params)
    assert r.status_code == status, r.text
    return r.json()


async def marks(client, w):
    """Aarav 80/40, Bhumi 30/10 (fails both), Chirag 60/30. Maths out of 100, English out of 50."""
    await put_marks(client, w["heads"]["ct"], w, [])  # no-op, keeps the helper imported
    sh = await sheet(client, w["heads"]["ct"], w)
    e = enr_ids(sh)
    entries = []
    for kid, (m, en) in {"Aarav": (80, 40), "Bhumi": (30, 10), "Chirag": (60, 30)}.items():
        entries.append({"enrollment_id": e[kid], "subject_id": w["subj"]["Mathematics"]["id"], "marks_obtained": m})
        entries.append({"enrollment_id": e[kid], "subject_id": w["subj"]["English"]["id"], "marks_obtained": en})
    r = await put_marks(client, w["heads"]["ct"], w, entries)
    assert r.status_code == 200, r.text


# ------------------------------------------------------------------ students
async def test_students_admin_sees_the_school_and_a_teacher_only_their_classes(client, w):
    a = await get(client, w["h"], "/analytics/students")
    assert a["scope"] == "school" and a["active"] == 4
    assert {c["class_label"]: c["students"] for c in a["by_class"]} == {"8-A": 3, "9-A": 1}
    t = await get(client, w["heads"]["ct"], "/analytics/students")
    assert t["scope"] == "my_classes" and t["active"] == 3 and [c["class_label"] for c in t["by_class"]] == ["8-A"]
    other = await get(client, w["heads"]["other"], "/analytics/students")  # not assigned anywhere
    assert other["active"] == 0 and other["by_class"] == []
    assert {g["key"] for g in a["by_gender"]} == {"unknown"}


# ------------------------------------------------------------------ attendance
async def test_attendance_analytics_and_class_scope(client, w):
    c8 = w["class"]["id"]
    ids = {k: s["id"] for k, s in w["students"].items()}
    await mark(
        client,
        w["heads"]["ct"],
        c8,
        day(0),
        [rec(ids["Aarav"]), rec(ids["Bhumi"], "absent", "absent"), rec(ids["Chirag"], "present", "absent")],
    )
    await mark(client, w["t9"], w["c9"]["id"], day(0), [rec(w["k9"]["id"])])
    a = await get(client, w["h"], "/analytics/attendance", from_on=day(0), to_on=day(0))
    assert a["overall_percentage"] == 62.5  # (2+0+1+2) halves of 8
    assert {r["class_label"]: r["percentage"] for r in a["by_class"]} == {"8-A": 50.0, "9-A": 100.0}
    assert a["students_below_threshold"] == 2
    mine = await get(client, w["heads"]["ct"], "/analytics/attendance", from_on=day(0), to_on=day(0))
    assert mine["overall_percentage"] == 50.0 and [r["class_label"] for r in mine["by_class"]] == ["8-A"]
    await get(client, w["heads"]["ct"], "/analytics/attendance", status=404, class_id=w["c9"]["id"])


# ------------------------------------------------------------------ fees
async def test_fee_analytics_for_admin_and_fees_staff_only(client, w, mail):
    h = w["h"]
    t = await head(client, h)
    await structure(client, h, w["class"]["id"], t["id"], 100_000, "term")
    await run(client, h, "Term 1")
    inv = (await get(client, h, "/fees/invoices"))["items"]
    await pay(client, h, inv[0]["id"], 30_000)
    f = await get(client, h, "/analytics/fees")
    assert (f["billed_paise"], f["collected_paise"], f["collected_this_month_paise"]) == (300_000, 30_000, 30_000)
    assert (f["dues_paise"], f["dues_students"], f["overdue_paise"]) == (270_000, 3, 0)
    assert f["collection_percentage"] == 10.0
    assert f["top_dues_classes"][0]["class_label"] == "8-A" and f["top_dues_classes"][0]["dues_paise"] == 270_000
    cashier = await teacher(client, h, mail, "cash@rps.example", perms=["fees.manage"])
    assert (await get(client, cashier, "/analytics/fees"))["dues_paise"] == 270_000
    for who in ("ct", "maths", "other"):
        r = await client.get(f"{API}/analytics/fees", headers=w["heads"][who])
        assert r.status_code == 403 and r.json()["error"]["code"] == "missing_permission"


# ------------------------------------------------------------------ results
async def test_results_by_subject_class_and_grade(client, w):
    await marks(client, w)
    r = await get(client, w["h"], "/analytics/results")
    assert r["exam"] == "Half-yearly" and r["scope"] == "school" and r["students"] == 3
    subj = {s["subject"]: s for s in r["by_subject"]}
    assert subj["Mathematics"]["average_percentage"] == 56.67 and subj["English"]["average_percentage"] == 53.33
    assert subj["Mathematics"]["pass_rate"] == 66.67 and subj["Mathematics"]["students"] == 3
    assert r["average_percentage"] == 55.56 and r["pass_rate"] == 66.67  # Bhumi failed
    assert [(c["class_label"], c["students"], c["published"]) for c in r["by_class"]] == [("8-A", 3, False)]
    assert {g["key"]: g["count"] for g in r["grade_spread"]} == {"A": 1, "B": 1, "D": 1}  # 80, 60, 26.67


async def test_results_are_limited_to_the_teachers_classes(client, w):
    await marks(client, w)
    assert (await get(client, w["heads"]["maths"], "/analytics/results"))["students"] == 3  # assigned to 8-A
    nobody = await get(client, w["heads"]["other"], "/analytics/results")
    assert nobody["exam"] is None and nobody["by_class"] == [] and nobody["scope"] == "my_classes"
    t9 = await get(client, w["t9"], "/analytics/results")
    assert t9["exam"] is None  # the exam has no papers for 9-A
    bad = await client.get(
        f"{API}/analytics/results", headers=w["h"], params={"exam_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert bad.status_code == 404


async def test_teacher_wise_results_each_teacher_sees_only_their_row(client, w, mail):
    await marks(client, w)
    all_rows = await get(client, w["h"], "/analytics/results/teachers")
    by = {t["name"]: t for t in all_rows["teachers"]}
    assert set(by) == {"Class Teacher", "Maths Teacher", "English Teacher"}
    assert (
        by["Maths Teacher"]["average_percentage"] == 56.67
        and by["Maths Teacher"]["classes"][0]["subject"] == "Mathematics"
    )
    assert (
        by["English Teacher"]["average_percentage"] == 53.33
        and by["English Teacher"]["classes"][0]["pass_rate"] == 66.67
    )
    assert by["Class Teacher"]["average_percentage"] == 55.56 and by["Class Teacher"]["classes"][0]["subject"] is None
    mine = await get(client, w["heads"]["maths"], "/analytics/results/teachers")
    assert [t["name"] for t in mine["teachers"]] == ["Maths Teacher"]
    assert (await get(client, w["heads"]["other"], "/analytics/results/teachers"))["teachers"] == []
    hr = await teacher(client, w["h"], mail, "hr@rps.example", perms=["academic.manage"])
    assert len((await get(client, hr, "/analytics/results/teachers"))["teachers"]) == 3
    acad = await teacher(client, w["h"], mail, "acad@rps.example", perms=["academic.manage"])
    assert len((await get(client, acad, "/analytics/results/teachers"))["teachers"]) == 3


# ------------------------------------------------------------------ staff attendance
async def test_staff_attendance_for_admin_and_staff_managers(client, w, mail):
    h = w["h"]
    staff = w["staff"]
    r = await client.put(
        f"{API}/attendance/staff/{day(0)}",
        headers=h,
        json={
            "records": [
                {"staff_id": staff["ct"]["id"], "status": "present"},
                {"staff_id": staff["maths"]["id"], "status": "absent"},
            ]
        },
    )
    assert r.status_code == 200, r.text
    a = await get(client, h, "/analytics/staff-attendance")
    assert (a["marked_today"], a["present_today"], a["absent_today"], a["days_marked"]) == (2, 1, 1, 2)
    assert a["present_percentage"] == 50.0 and a["active_staff"] >= 5
    hr = await teacher(client, h, mail, "hr@rps.example", perms=["academic.manage"])
    assert (await get(client, hr, "/analytics/staff-attendance"))["days_marked"] == 2
    assert (await client.get(f"{API}/analytics/staff-attendance", headers=w["heads"]["ct"])).status_code == 403


# ------------------------------------------------------------------ dashboard
async def test_dashboard_blocks_follow_permissions(client, w, mail):
    h = w["h"]
    await marks(client, w)
    ids = {k: s["id"] for k, s in w["students"].items()}
    await mark(
        client, w["heads"]["ct"], w["class"]["id"], day(0), [rec(ids["Aarav"]), rec(ids["Bhumi"]), rec(ids["Chirag"])]
    )
    d = await get(client, h, "/dashboard")
    assert d["scope"] == "school" and d["students"] == 4 and d["classes"] == 2
    assert (
        d["attendance"]["today_percentage"] == 100.0
        and d["attendance"]["classes_marked_today"] == 1
        and d["attendance"]["classes_total"] == 2
    )
    assert d["results"] == {"exam": "Half-yearly", "average_percentage": 55.56}
    assert d["fees"] is not None and d["staff"] is not None and d["rollover"]["current_year"]
    t = await get(client, w["heads"]["ct"], "/dashboard")
    assert t["scope"] == "my_classes" and t["students"] == 3 and t["classes"] == 1
    assert t["fees"] is None and t["staff"] is None and t["rollover"] is None
    cashier = await teacher(client, h, mail, "cash@rps.example", perms=["fees.manage"])
    c = await get(client, cashier, "/dashboard")
    assert c["fees"] is not None and c["staff"] is None and c["scope"] == "school"
    acad = await teacher(client, h, mail, "acad@rps.example", perms=["academic.manage"])
    assert (await get(client, acad, "/dashboard"))["rollover"] is not None


async def test_dashboard_works_for_an_empty_school(client, school_a):
    d = await get(client, school_a["headers"], "/dashboard")
    assert d["students"] == 0 and d["attendance"]["today_percentage"] is None and d["results"]["exam"] is None
    assert d["fees"]["dues_paise"] == 0


async def test_parents_and_the_owner_cannot_use_analytics(client, w, mail, owner):
    await client.post(f"{API}/parents/send-login", headers=w["h"], json={})
    parent = await parent_headers(client, mail, "aarav@fam.example")
    for url in (
        "/dashboard",
        "/analytics/students",
        "/analytics/fees",
        "/analytics/results",
        "/analytics/results/teachers",
    ):
        assert (await client.get(f"{API}{url}", headers=parent)).status_code == 403, url
        assert (await client.get(f"{API}{url}", headers=owner)).status_code == 403, url
    assert (await client.get(f"{API}/dashboard")).status_code == 401


async def test_another_schools_numbers_never_leak(client, w, school_b, mail):
    hb = school_b["headers"]
    cb = await make_class(client, hb, grade="6")
    await enrol(client, hb, cb["id"], first="Beta", guardians=[{**GUARD, "email": "beta@x.example"}])
    await add_staff(client, hb, mail, email="bt@svm.example", name="B Teacher")
    a = await get(client, w["h"], "/analytics/students")
    b = await get(client, hb, "/analytics/students")
    assert a["active"] == 4 and b["active"] == 1 and [c["class_label"] for c in b["by_class"]] == ["6-A"]
    assert (await get(client, hb, "/analytics/results"))["exam"] is None
    assert (await get(client, hb, "/analytics/fees"))["dues_paise"] == 0
    assert (await get(client, hb, "/dashboard"))["students"] == 1
    assert (await get(client, hb, "/analytics/results/teachers"))["teachers"] == []
    _ = can_see_fees
