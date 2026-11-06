"""Teacher-wise and subject-wise analytics: who counts as a teacher, the numbers, who sees what, feedback gating,
tenancy and the audited export."""

from datetime import timedelta

import pytest
from attkit import day, mark, rec
from conftest import API
from resultskit import enr_ids, put_marks, sheet, world
from studentkit import GUARD, enrol, make_class, read_xlsx, teacher

from app.core.clock import today_ist


@pytest.fixture
async def w(client, school_a, mail):
    """Class 8-A (Aarav 80/40, Bhumi 30/10, Chirag 60/30; Maths /100, English /50), its three teachers, an unrelated
    teacher, and attendance marked today: Aarav present, Bhumi absent, Chirag present/absent."""
    w = await world(client, school_a, mail)
    sh = await sheet(client, w["heads"]["ct"], w)
    e = enr_ids(sh)
    entries = []
    for kid, (m, en) in {"Aarav": (80, 40), "Bhumi": (30, 10), "Chirag": (60, 30)}.items():
        entries.append({"enrollment_id": e[kid], "subject_id": w["subj"]["Mathematics"]["id"], "marks_obtained": m})
        entries.append({"enrollment_id": e[kid], "subject_id": w["subj"]["English"]["id"], "marks_obtained": en})
    assert (await put_marks(client, w["heads"]["ct"], w, entries)).status_code == 200
    ids = {k: s["id"] for k, s in w["students"].items()}
    await mark(
        client,
        w["heads"]["ct"],
        w["class"]["id"],
        day(0),
        [rec(ids["Aarav"]), rec(ids["Bhumi"], "absent", "absent"), rec(ids["Chirag"], "present", "absent")],
    )
    return w


async def get(client, h, url="/analytics/teachers", status=200, **params):
    r = await client.get(f"{API}{url}", headers=h, params=params)
    assert r.status_code == status, r.text
    return r.json()


def by_name(d):
    return {t["name"]: t for t in d["teachers"]}


async def admin_id(client, h):
    r = await client.get(f"{API}/staff", headers=h, params={"limit": 100})
    return next(s["id"] for s in r.json()["items"] if s["email"] == "meera@rps.example")


async def test_only_staff_with_an_assignment_are_teachers(client, w, mail):
    h = w["h"]
    await teacher(client, h, mail, "clerk@rps.example")  # no class: an accountant, a clerk
    d = await get(client, h)
    assert set(by_name(d)) == {"Class Teacher", "Maths Teacher", "English Teacher"}  # no admin, no clerk, no "other"
    # the older endpoints agree
    old = await get(client, h, "/attendance/analytics/teachers")
    assert {r["name"] for r in old} == {"Class Teacher", "Maths Teacher", "English Teacher"}
    assert {t["name"] for t in (await get(client, h, "/analytics/results/teachers"))["teachers"]} == set(by_name(d))


async def test_an_admin_who_teaches_appears_with_the_real_assignments(client, w):
    h = w["h"]
    c9 = await make_class(client, h, grade="9")
    sid = await admin_id(client, h)
    r = await client.put(f"{API}/academic/classes/{c9['id']}/class-teacher", headers=h, json={"staff_id": sid})
    assert r.status_code == 200, r.text
    d = await get(client, h)
    row = by_name(d)["Meera Rao"]
    assert [(a["class_label"], a["role"]) for a in row["assignments"]] == [("9-A", "class_teacher")]
    assert row["results"] == []  # the exam has no papers for 9-A
    old = {r["name"]: r for r in await get(client, h, "/attendance/analytics/teachers")}
    assert old["Meera Rao"]["class_teacher_of"] == ["9-A"]


async def test_numbers_on_a_small_dataset(client, w):
    d = await get(client, w["h"])
    assert d["exam"] == "Half-yearly" and d["previous_exam"] is None and d["scope"] == "school"
    t = by_name(d)
    maths, eng, ct = t["Maths Teacher"], t["English Teacher"], t["Class Teacher"]
    # attendance: 3 records, 3 of 6 halves present
    assert ct["class_attendance_percentage"] == 50.0 and ct["assignments"][0]["role"] == "class_teacher"
    assert maths["class_attendance_percentage"] is None and maths["taught_attendance_percentage"] == 50.0
    assert (
        maths["assignments"][0]["subject"] == "Mathematics" and maths["assignments"][0]["attendance_percentage"] == 50.0
    )
    assert maths["designation"] == "Teacher"
    # subject average and pass %: Maths 80,30,60 (pass 33); English 80,20,60 (pass mark 17)
    r = maths["results"][0]
    assert (r["subject"], r["students"], r["average_percentage"], r["pass_rate"]) == ("Mathematics", 3, 56.67, 66.67)
    assert r["improvement"] is None and r["published"] is False
    assert (eng["average_percentage"], eng["pass_rate"]) == (53.33, 66.67)
    # the class teacher: whole class, total percentage 80, 26.67, 60
    assert ct["results"][0]["subject"] is None and ct["average_percentage"] == 55.56 and ct["pass_rate"] == 66.67
    assert ct["staff_attendance"] == {
        "days_marked": 0, "days_present": 0, "days_absent": 0, "days_leave": 0, "percentage": None,
    }  # fmt: skip
    assert ct["feedback"] is None


async def test_improvement_against_the_previous_exam(client, w):
    h = w["h"]
    r = await client.post(
        f"{API}/exams", headers=h, json={"name": "Annual", "ends_on": (today_ist() + timedelta(days=30)).isoformat()}
    )
    exam2 = r.json()
    papers = [{"subject_id": w["subj"]["Mathematics"]["id"], "max_marks": 100, "pass_marks": 33}]
    assert (
        await client.put(
            f"{API}/exams/{exam2['id']}/papers", headers=h, json={"class_ids": [w["class"]["id"]], "papers": papers}
        )
    ).status_code == 200
    w2 = {**w, "exam": exam2}
    e = enr_ids(await sheet(client, w["heads"]["ct"], w2))
    entries = [
        {"enrollment_id": e[k], "subject_id": w["subj"]["Mathematics"]["id"], "marks_obtained": m}
        for k, m in {"Aarav": 90, "Bhumi": 50, "Chirag": 70}.items()
    ]
    assert (await put_marks(client, w["heads"]["ct"], w2, entries)).status_code == 200
    d = await get(client, h)  # latest exam by end date
    assert d["exam"] == "Annual" and d["previous_exam"] == "Half-yearly"
    maths = by_name(d)["Maths Teacher"]
    r0 = maths["results"][0]
    assert (r0["average_percentage"], r0["previous_average_percentage"], r0["improvement"]) == (70.0, 56.67, 13.33)
    assert maths["improvement"] == 13.33 and r0["pass_rate"] == 100.0
    assert by_name(d)["English Teacher"]["results"] == []  # no English paper in this exam
    old = await get(client, h, exam_id=w["exam"]["id"])  # asking for the first exam: nothing before it
    assert old["exam"] == "Half-yearly" and old["previous_exam"] is None
    await get(client, h, status=404, exam_id="00000000-0000-0000-0000-000000000000")


async def test_staff_attendance_is_each_teachers_own(client, w):
    h = w["h"]
    sheet_ = (await client.get(f"{API}/attendance/staff", headers=h)).json()
    maths = next(x for x in sheet_ if x["name"] == "Maths Teacher")
    r = await client.put(
        f"{API}/attendance/staff/{day(0)}",
        headers=h,
        json={"records": [{"staff_id": maths["staff_id"], "status": "absent"}]},
    )
    assert r.status_code == 200, r.text
    row = by_name(await get(client, h))["Maths Teacher"]
    assert row["staff_attendance"]["days_absent"] == 1 and row["staff_attendance"]["percentage"] == 0.0


async def test_scoping_a_teacher_sees_only_their_row_managers_see_all(client, w, mail):
    mine = await get(client, w["heads"]["maths"])
    assert [t["name"] for t in mine["teachers"]] == ["Maths Teacher"] and mine["scope"] == "me"
    assert (await get(client, w["heads"]["other"]))["teachers"] == []  # no assignment: no row at all
    for email, perm in (("hr@rps.example", "academic.manage"), ("acad@rps.example", "academic.manage")):
        hd = await teacher(client, w["h"], mail, email, perms=[perm])
        d = await get(client, hd)
        assert len(d["teachers"]) == 3 and d["scope"] == "school"
    # someone else's staff id cannot be asked for: there is no such filter, and the export follows the same scope
    r = await client.get(f"{API}/analytics/teachers/export", headers=w["heads"]["maths"])
    assert [row[0] for row in read_xlsx(r.content)[1:]] == ["Maths Teacher"]


async def test_feedback_is_hidden_until_closed_and_shared(client, w, mail):
    from resultskit import parent_of

    h = w["h"]
    pa = await parent_of(client, mail, "Aarav")
    body = {
        "title": "Term 1", "class_ids": [w["class"]["id"]],
        "closes_on": (today_ist() + timedelta(days=7)).isoformat(), "share_with_teachers": False,
    }  # fmt: skip
    req = (await client.post(f"{API}/feedback", headers=h, json=body)).json()
    rows = (await client.get(f"{API}/parent/feedback", headers=pa)).json()
    tid = {t["teacher"]: t["target_id"] for t in rows[0]["targets"]}["Maths Teacher"]
    kid = w["students"]["Aarav"]["id"]
    r = await client.put(
        f"{API}/parent/feedback/targets/{tid}/children/{kid}", headers=pa, json={"rating": 4, "comment": "Great"}
    )
    assert r.status_code == 204
    assert by_name(await get(client, h))["Maths Teacher"]["feedback"] is None  # open
    await client.post(f"{API}/feedback/{req['id']}/close", headers=h)
    assert by_name(await get(client, h))["Maths Teacher"]["feedback"] is None  # closed but not shared, even for admin
    assert (await get(client, w["heads"]["maths"]))["teachers"][0]["feedback"] is None
    # shared + closed
    req2 = (
        await client.post(f"{API}/feedback", headers=h, json={**body, "title": "Term 2", "share_with_teachers": True})
    ).json()
    rows = (await client.get(f"{API}/parent/feedback", headers=pa)).json()
    tid2 = {t["teacher"]: t["target_id"] for t in rows[0]["targets"]}["Maths Teacher"]
    assert (
        await client.put(
            f"{API}/parent/feedback/targets/{tid2}/children/{kid}", headers=pa, json={"rating": 5, "comment": "Secret"}
        )
    ).status_code == 204
    assert by_name(await get(client, h))["Maths Teacher"]["feedback"] is None  # shared but still open
    await client.post(f"{API}/feedback/{req2['id']}/close", headers=h)
    fb = by_name(await get(client, h))["Maths Teacher"]["feedback"]
    assert fb == {"request_id": req2["id"], "title": "Term 2", "average_rating": 5.0, "responses": 1}
    own = (await get(client, w["heads"]["maths"]))["teachers"][0]["feedback"]
    assert own == fb
    text = (await client.get(f"{API}/analytics/teachers", headers=h)).text.lower()
    assert "secret" not in text and "guardian" not in text and "parent of" not in text
    assert (await client.get(f"{API}/analytics/teachers/export", headers=h)).content.count(b"Secret") == 0


async def test_subject_wise(client, w, mail):
    h = w["h"]
    c9 = await make_class(client, h, grade="9")
    papers = [{"subject_id": w["subj"]["Mathematics"]["id"], "max_marks": 100, "pass_marks": 33}]
    await client.put(
        f"{API}/academic/classes/{c9['id']}/subjects", headers=h, json={"subject_ids": [w["subj"]["Mathematics"]["id"]]}
    )
    t9 = await teacher(client, h, mail, "t9@rps.example", class_id=c9["id"])
    k9 = await enrol(client, h, c9["id"], first="Zoya", guardians=[{**GUARD, "email": "zoya@fam.example"}])
    await client.put(
        f"{API}/exams/{w['exam']['id']}/papers", headers=h, json={"class_ids": [c9["id"]], "papers": papers}
    )
    sh = (await client.get(f"{API}/exams/{w['exam']['id']}/classes/{c9['id']}/sheet", headers=t9)).json()
    entry = {
        "enrollment_id": sh["students"][0]["enrollment_id"],
        "subject_id": w["subj"]["Mathematics"]["id"],
        "marks_obtained": 100,
    }
    r = await client.put(
        f"{API}/exams/{w['exam']['id']}/classes/{c9['id']}/marks", headers=t9, json={"entries": [entry]}
    )
    assert r.status_code == 200, r.text
    _ = k9
    d = await get(client, h, "/analytics/subjects")
    sub = {s["subject"]: s for s in d["subjects"]}
    m = sub["Mathematics"]
    assert d["scope"] == "school" and m["students"] == 4 and m["average_percentage"] == 67.5  # (80+30+60+100)/4
    assert m["pass_rate"] == 75.0
    assert (m["best_class"]["class_label"], m["best_class"]["average_percentage"]) == ("9-A", 100.0)
    assert (m["weakest_class"]["class_label"], m["weakest_class"]["average_percentage"]) == ("8-A", 56.67)
    assert sub["English"]["best_class"] is None and sub["English"]["average_percentage"] == 53.33
    # scoped for other teachers
    mine = await get(client, w["heads"]["maths"], "/analytics/subjects")
    assert mine["scope"] == "my_classes" and {s["subject"] for s in mine["subjects"]} == {"Mathematics", "English"}
    assert [c["class_label"] for c in mine["subjects"][1]["classes"]] == ["8-A"]
    assert (await get(client, t9, "/analytics/subjects"))["subjects"][0]["classes"][0]["class_label"] == "9-A"
    assert (await get(client, w["heads"]["other"], "/analytics/subjects"))["subjects"] == []


async def test_another_school_never_appears_and_parents_are_refused(client, w, school_b, mail):
    hb = school_b["headers"]
    cb = await make_class(client, hb, grade="6")
    await teacher(client, hb, mail, "bt@svm.example", class_id=cb["id"])
    assert set(by_name(await get(client, hb))) == {"bt"}
    assert "bt" not in by_name(await get(client, w["h"]))
    assert (await get(client, hb, "/analytics/subjects"))["subjects"] == []
    await get(client, hb, status=404, year_id=(await get(client, w["h"]))["year_id"])  # not B's academic year
    await get(client, hb, status=404, exam_id=w["exam"]["id"])
    assert (await client.get(f"{API}/analytics/teachers")).status_code == 401
    await client.post(f"{API}/parents/send-login", headers=w["h"], json={})
    from resultskit import parent_of

    pa = await parent_of(client, mail, "Aarav")
    for url in ("/analytics/teachers", "/analytics/teachers/export", "/analytics/subjects"):
        assert (await client.get(f"{API}{url}", headers=pa)).status_code == 403, url


async def test_export_is_an_excel_file_and_audited(client, w):
    h = w["h"]
    r = await client.get(f"{API}/analytics/teachers/export", headers=h)
    assert r.status_code == 200 and "spreadsheet" in r.headers["content-type"]
    rows = read_xlsx(r.content)
    assert rows[0][0] == "Teacher" and {x[0] for x in rows[1:]} == {"Class Teacher", "Maths Teacher", "English Teacher"}
    maths = next(x for x in rows if x[0] == "Maths Teacher")
    assert maths[5] == 56.67 and maths[6] == 66.67 and "8-A (Mathematics)" in maths[2]
    logs = (await client.get(f"{API}/audit", headers=h, params={"action": "analytics.teachers_exported"})).json()[
        "items"
    ]
    assert len(logs) == 1 and logs[0]["category"] == "exports"
