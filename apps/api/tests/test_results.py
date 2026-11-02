import uuid
from datetime import timedelta

import pytest
from conftest import API
from resultskit import BANDS, fill_all, parent_of, put_marks, sheet, world
from sqlalchemy import update
from studentkit import read_xlsx

from app.core.clock import today_ist
from app.db.session import make_session
from app.models.results import Exam

MARKS = {"Aarav": (90, 45), "Bhumi": (90, 45), "Chirag": (40, 20)}  # Aarav and Bhumi tie


def base(w):
    return f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}"


async def audit(client, h, action):
    return (await client.get(f"{API}/audit", headers=h, params={"action": action, "limit": 50})).json()["items"]


# ------------------------------------------------------------------ grading
async def test_grading_scheme_needs_a_zero_band_and_one_is_active(client, school_a):
    h = school_a["headers"]
    r = await client.post(
        f"{API}/grading-schemes", headers=h, json={"name": "Bad", "bands": [{"min_percent": 40, "grade": "P"}]}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "band_zero_missing"
    dup = [{"min_percent": 0, "grade": "F"}, {"min_percent": 0, "grade": "G"}]
    assert (
        await client.post(f"{API}/grading-schemes", headers=h, json={"name": "Bad", "bands": dup})
    ).status_code == 422
    a = (
        await client.post(f"{API}/grading-schemes", headers=h, json={"name": "A", "bands": BANDS, "make_active": True})
    ).json()
    b = (await client.post(f"{API}/grading-schemes", headers=h, json={"name": "B", "bands": BANDS})).json()
    assert a["is_active"] and not b["is_active"] and [x["grade"] for x in a["bands"]][:2] == ["A+", "A"]
    assert (
        await client.post(f"{API}/grading-schemes", headers=h, json={"name": "a", "bands": BANDS})
    ).status_code == 409
    await client.post(f"{API}/grading-schemes/{b['id']}/activate", headers=h)
    schemes = {s["name"]: s["is_active"] for s in (await client.get(f"{API}/grading-schemes", headers=h)).json()}
    assert schemes == {"A": False, "B": True}
    r = await client.patch(
        f"{API}/grading-schemes/{b['id']}",
        headers=h,
        json={"bands": [{"min_percent": 50, "grade": "P"}, {"min_percent": 0, "grade": "F"}]},
    )
    assert [x["grade"] for x in r.json()["bands"]] == ["P", "F"]
    logs = await audit(client, h, "grading.changed")
    assert logs[0]["sensitive"] and logs[0]["changes"][0]["field"] == "grades"


async def test_only_academic_managers_set_up_exams(client, school_a, mail):
    w = await world(client, school_a, mail)
    t = w["heads"]["ct"]
    assert (await client.post(f"{API}/exams", headers=t, json={"name": "Final"})).status_code == 403
    assert (
        await client.post(f"{API}/grading-schemes", headers=t, json={"name": "X", "bands": BANDS})
    ).status_code == 403
    assert (
        await client.put(
            f"{API}/exams/{w['exam']['id']}/papers", headers=t, json={"class_ids": [w["class"]["id"]], "papers": []}
        )
    ).status_code == 403
    assert (await client.get(f"{API}/exams", headers=t)).status_code == 200  # staff can read


async def test_papers_rules(client, school_a, mail):
    w = await world(client, school_a, mail)
    h, ex = w["h"], w["exam"]["id"]
    other = (await client.post(f"{API}/academic/subjects", headers=h, json={"name": "Art"})).json()
    body = {"class_ids": [w["class"]["id"]], "papers": [{"subject_id": other["id"], "max_marks": 20}]}
    r = await client.put(f"{API}/exams/{ex}/papers", headers=h, json=body)
    assert r.status_code == 422 and r.json()["error"]["code"] == "subject_not_in_class"
    maths = w["subj"]["Mathematics"]["id"]
    r = await client.put(
        f"{API}/exams/{ex}/papers",
        headers=h,
        json={"class_ids": [w["class"]["id"]], "papers": [{"subject_id": maths, "max_marks": 50, "pass_marks": 60}]},
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "pass_above_max"
    # default pass mark is 33% rounded up
    r = await client.put(
        f"{API}/exams/{ex}/papers",
        headers=h,
        json={"class_ids": [w["class"]["id"]], "papers": [{"subject_id": maths, "max_marks": 50}]},
    )
    assert r.json()[0]["pass_marks"] == 17
    await client.put(
        f"{API}/exams/{ex}/papers",
        headers=h,
        json={
            "class_ids": [w["class"]["id"]],
            "papers": [
                {"subject_id": maths, "max_marks": 100, "pass_marks": 33},
                {"subject_id": w["subj"]["English"]["id"], "max_marks": 50},
            ],
        },
    )
    await fill_all(client, w, MARKS)
    # a paper with marks can neither be removed nor have its maximum lowered under a mark
    r = await client.put(
        f"{API}/exams/{ex}/papers",
        headers=h,
        json={"class_ids": [w["class"]["id"]], "papers": [{"subject_id": maths, "max_marks": 100}]},
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "paper_has_marks"
    r = await client.put(
        f"{API}/exams/{ex}/papers",
        headers=h,
        json={
            "class_ids": [w["class"]["id"]],
            "papers": [
                {"subject_id": maths, "max_marks": 80},
                {"subject_id": w["subj"]["English"]["id"], "max_marks": 50},
            ],
        },
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "marks_above_max"
    assert (await client.delete(f"{API}/exams/{ex}", headers=h)).status_code == 409
    assert (await client.post(f"{API}/exams", headers=h, json={"name": "half-yearly"})).status_code == 409


# ------------------------------------------------------------------ marks, computation
async def test_marks_entry_by_class_and_subject_teacher(client, school_a, mail):
    w = await world(client, school_a, mail)
    hs = w["heads"]
    e = {
        k: v
        for k, v in zip(
            MARKS, [s["enrollment_id"] for s in (await sheet(client, hs["ct"], w))["students"]], strict=True
        )
    }
    maths, eng = w["subj"]["Mathematics"]["id"], w["subj"]["English"]["id"]
    one = lambda sid, v: [{"enrollment_id": e["Aarav"], "subject_id": sid, "marks_obtained": v}]  # noqa: E731
    assert (await put_marks(client, hs["maths"], w, one(maths, 88))).status_code == 200
    r = await put_marks(client, hs["maths"], w, one(eng, 40))
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_your_subject"
    assert (await put_marks(client, hs["other"], w, one(maths, 10))).status_code == 403
    assert (await client.get(f"{base(w)}/sheet", headers=hs["other"])).status_code == 403
    assert (await put_marks(client, hs["ct"], w, one(eng, 40))).status_code == 200
    # the sheet tells each caller which columns they may fill
    can = {p["subject"]: p["can_edit"] for p in (await sheet(client, hs["maths"], w))["papers"]}
    assert can == {"English": False, "Mathematics": True}
    can = {p["subject"]: p["can_edit"] for p in (await sheet(client, hs["ct"], w))["papers"]}
    assert can == {"English": True, "Mathematics": True}
    logs = await audit(client, w["h"], "results.entered")
    assert logs and logs[-1]["changes"][0]["to"] == "88" and logs[-1]["actor_name"] == "Maths Teacher"


async def test_validation_absent_clear_and_decimals(client, school_a, mail):
    w = await world(client, school_a, mail)
    ct = w["heads"]["ct"]
    e = await fill_all(client, w, MARKS)
    maths, eng = w["subj"]["Mathematics"]["id"], w["subj"]["English"]["id"]
    bad = await put_marks(client, ct, w, [{"enrollment_id": e["Aarav"], "subject_id": maths, "marks_obtained": 101}])
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "marks_above_max"
    neg = await put_marks(client, ct, w, [{"enrollment_id": e["Aarav"], "subject_id": maths, "marks_obtained": -1}])
    assert neg.status_code == 422
    both = await put_marks(
        client, ct, w, [{"enrollment_id": e["Aarav"], "subject_id": maths, "marks_obtained": 5, "absent": True}]
    )
    assert both.status_code == 422 and both.json()["error"]["code"] == "absent_with_marks"
    dup = [{"enrollment_id": e["Aarav"], "subject_id": maths, "marks_obtained": 5}] * 2
    assert (await put_marks(client, ct, w, dup)).json()["error"]["code"] == "duplicate_entry"
    # decimals are kept, absent has no marks, an empty entry clears
    r = await put_marks(
        client,
        ct,
        w,
        [
            {"enrollment_id": e["Aarav"], "subject_id": maths, "marks_obtained": 89.5},
            {"enrollment_id": e["Bhumi"], "subject_id": maths, "absent": True},
            {"enrollment_id": e["Chirag"], "subject_id": eng},
        ],
    )
    assert r.json() == {"saved": 2, "cleared": 1}
    rows = {s["name"].split()[0]: s for s in (await sheet(client, ct, w))["students"]}
    assert rows["Aarav"]["marks"][1]["marks_obtained"] == 89.5 or rows["Aarav"]["marks"][0]["marks_obtained"] == 89.5
    assert rows["Bhumi"]["passed"] is False and rows["Bhumi"]["rank"] is not None  # absent = zero and a fail
    assert rows["Chirag"]["complete"] is False and rows["Chirag"]["rank"] is None and rows["Chirag"]["passed"] is None
    # a student of another class cannot get marks
    other = (await client.post(f"{API}/academic/classes", headers=w["h"], json={"grade": "9", "section": "A"})).json()
    assert other["id"] != w["class"]["id"]


async def test_percentage_grade_pass_and_rank_with_ties(client, school_a, mail):
    w = await world(client, school_a, mail, kids=("Aarav", "Bhumi", "Chirag", "Divya"))
    await fill_all(client, w, {"Aarav": (90, 45), "Bhumi": (90, 45), "Chirag": (40, 20), "Divya": (30, 45)})
    rows = {s["name"].split()[0]: s for s in (await sheet(client, w["heads"]["ct"], w))["students"]}
    a = rows["Aarav"]
    assert (a["total"], a["max_total"], a["percentage"], a["grade"], a["passed"]) == (135, 150, 90.0, "A+", True)
    assert rows["Bhumi"]["rank"] == 1 and a["rank"] == 1  # a tie shares the rank, the next is 3
    assert rows["Chirag"]["rank"] == 4 and rows["Chirag"]["percentage"] == 40.0 and rows["Chirag"]["grade"] == "C"
    d = rows["Divya"]  # 30 in maths is below the pass mark 33: fails overall though 50% in total
    assert d["percentage"] == 50.0 and d["grade"] == "C" and d["passed"] is False and d["rank"] == 3
    cells = {c["subject_id"]: c for c in d["marks"]}
    assert (
        cells[w["subj"]["Mathematics"]["id"]]["passed"] is False
        and cells[w["subj"]["Mathematics"]["id"]]["grade"] == "D"
    )
    # a grade boundary: exactly 75% is an A
    e = {s["name"].split()[0]: s["enrollment_id"] for s in (await sheet(client, w["heads"]["ct"], w))["students"]}
    await put_marks(
        client,
        w["heads"]["ct"],
        w,
        [{"enrollment_id": e["Chirag"], "subject_id": w["subj"]["Mathematics"]["id"], "marks_obtained": 75}],
    )
    cell = next(
        c
        for c in next(
            s for s in (await sheet(client, w["heads"]["ct"], w))["students"] if s["name"].startswith("Chirag")
        )["marks"]
        if c["marks_obtained"] == 75
    )
    assert cell["grade"] == "A"


# ------------------------------------------------------------------ publishing and parents
async def test_publish_flow_and_parent_visibility(client, school_a, mail):
    w = await world(client, school_a, mail)
    hs, ex = w["heads"], w["exam"]["id"]
    aarav = w["students"]["Aarav"]["id"]
    pa = await parent_of(client, mail, "Aarav")
    # nothing visible before publishing, even with marks entered
    await fill_all(client, w, {"Aarav": (90, 45), "Bhumi": (60, 30)})
    assert (await client.get(f"{API}/parent/children/{aarav}/results", headers=pa)).json() == []
    assert (await client.get(f"{API}/parent/children/{aarav}/results/{ex}", headers=pa)).status_code == 404
    assert (await client.get(f"{API}/parent/children/{aarav}/results/{ex}/report-card", headers=pa)).status_code == 404
    # incomplete marks block publishing; only the class teacher may publish
    r = await client.post(f"{base(w)}/publish", headers=hs["ct"])
    assert (
        r.status_code == 409
        and r.json()["error"]["code"] == "marks_incomplete"
        and r.json()["error"]["details"][0]["student"].startswith("Chirag")
    )
    await fill_all(client, w, {"Chirag": (50, 25)})
    assert (await client.post(f"{base(w)}/publish", headers=hs["maths"])).status_code == 403
    assert (await client.post(f"{base(w)}/publish", headers=hs["other"])).status_code == 403
    assert (await client.post(f"{base(w)}/publish", headers=hs["ct"])).status_code == 200
    assert (await client.post(f"{base(w)}/publish", headers=hs["ct"])).json()["error"]["code"] == "already_published"
    # the parent now sees exactly their own child's published result
    lst = (await client.get(f"{API}/parent/children/{aarav}/results", headers=pa)).json()
    assert len(lst) == 1 and lst[0]["percentage"] == 90.0 and lst[0]["rank"] == 1 and lst[0]["grade"] == "A+"
    res = (await client.get(f"{API}/parent/children/{aarav}/results/{ex}", headers=pa)).json()
    assert res["name"] == "Aarav Sharma" and res["total"] == 135 and len(res["marks"]) == 2 and res["class_size"] == 3
    card = (await client.get(f"{API}/parent/children/{aarav}/results/{ex}/report-card", headers=pa)).json()
    assert (
        card["school_name"] == "Rewa Public School"
        and card["grading"][0]["grade"] == "A+"
        and card["attendance"]["working_days"] == 0
        and card["attendance"]["percentage"] is None
    )
    assert "students" not in card and "guardian" not in str(card).lower()
    # once published a subject teacher is locked out, the class teacher can still edit and it is a sensitive audit
    e = {s["name"].split()[0]: s["enrollment_id"] for s in (await sheet(client, hs["ct"], w))["students"]}
    entry = [{"enrollment_id": e["Aarav"], "subject_id": w["subj"]["Mathematics"]["id"], "marks_obtained": 95}]
    r = await put_marks(client, hs["maths"], w, entry)
    assert r.status_code == 403 and r.json()["error"]["code"] == "published_locked"
    assert (await put_marks(client, hs["ct"], w, entry)).status_code == 200
    log = (await audit(client, w["h"], "results.edited"))[0]
    assert log["sensitive"] and log["changes"][0] == {"field": "Aarav Sharma / Mathematics", "from": "90", "to": "95"}
    assert (await client.get(f"{API}/parent/children/{aarav}/results/{ex}", headers=pa)).json()["total"] == 140
    # unpublish hides it again, and publish/unpublish are audited
    assert (await client.post(f"{base(w)}/unpublish", headers=hs["ct"])).status_code == 204
    assert (await client.get(f"{API}/parent/children/{aarav}/results", headers=pa)).json() == []
    assert (await client.post(f"{base(w)}/unpublish", headers=hs["ct"])).json()["error"]["code"] == "not_published"
    assert (await audit(client, w["h"], "results.published"))[0]["sensitive"]
    assert await audit(client, w["h"], "results.unpublished")
    # papers are locked while published, not when hidden
    assert (await client.post(f"{base(w)}/publish", headers=hs["ct"])).status_code == 200
    r = await client.put(
        f"{API}/exams/{ex}/papers", headers=w["h"], json={"class_ids": [w["class"]["id"]], "papers": []}
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "published_locked"


async def test_a_parent_cannot_see_another_familys_child_or_use_staff_routes(client, school_a, mail):
    w = await world(client, school_a, mail)
    await fill_all(client, w, MARKS)
    await client.post(f"{base(w)}/publish", headers=w["heads"]["ct"])
    pa, pb = await parent_of(client, mail, "Aarav"), await parent_of(client, mail, "Bhumi")
    ex, bhumi = w["exam"]["id"], w["students"]["Bhumi"]["id"]
    for url in ("/results", f"/results/{ex}", f"/results/{ex}/report-card", "/date-sheet"):
        assert (await client.get(f"{API}/parent/children/{bhumi}{url}", headers=pa)).status_code == 404, url
    assert (await client.get(f"{API}/parent/children/{bhumi}/results/{ex}", headers=pb)).status_code == 200
    # staff routes are closed to parents
    assert (await client.get(f"{API}/exams/{ex}/students/{bhumi}/result", headers=pb)).status_code == 403
    assert (await client.get(f"{base(w)}/sheet", headers=pb)).status_code == 403
    assert (await client.get(f"{base(w)}/export", headers=pb)).status_code == 403
    assert (await client.put(f"{base(w)}/marks", headers=pb, json={"entries": []})).status_code in (403, 422)
    assert (
        await client.get(f"{API}/parent/children/{bhumi}/results", headers=w["h"])
    ).status_code == 403  # staff on parent route


async def test_a_child_who_left_can_still_read_published_results(client, school_a, mail):
    w = await world(client, school_a, mail)
    await fill_all(client, w, MARKS)
    await client.post(f"{base(w)}/publish", headers=w["heads"]["ct"])
    aarav = w["students"]["Aarav"]["id"]
    r = await client.post(f"{API}/students/{aarav}/leave", headers=w["h"], json={"reason": "moved"})
    assert r.status_code == 200, r.text
    pa = await parent_of(client, mail, "Aarav")
    assert len((await client.get(f"{API}/parent/children/{aarav}/results", headers=pa)).json()) == 1
    # the sheet still shows him (he has marks) but marks entry for him is refused
    r = await put_marks(
        client,
        w["heads"]["ct"],
        w,
        [
            {
                "enrollment_id": (await sheet(client, w["heads"]["ct"], w))["students"][0]["enrollment_id"],
                "subject_id": w["subj"]["Mathematics"]["id"],
                "marks_obtained": 1,
            }
        ],
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "student_not_in_class"


async def test_remarks_by_class_teacher_and_report_card_for_staff(client, school_a, mail):
    w = await world(client, school_a, mail)
    ct, ex = w["heads"]["ct"], w["exam"]["id"]
    e = await fill_all(client, w, MARKS)
    body = {"remarks": [{"enrollment_id": e["Aarav"], "remark": "Excellent work"}]}
    assert (await client.put(f"{base(w)}/remarks", headers=w["heads"]["maths"], json=body)).status_code == 403
    assert (await client.put(f"{base(w)}/remarks", headers=ct, json=body)).json() == {"changed": 1}
    card = (
        await client.get(
            f"{API}/exams/{ex}/students/{w['students']['Aarav']['id']}/report-card", headers=w["heads"]["maths"]
        )
    ).json()
    assert card["remark"] == "Excellent work" and card["rank"] == 1 and card["academic_year"]
    assert (
        await client.get(
            f"{API}/exams/{ex}/students/{w['students']['Aarav']['id']}/report-card", headers=w["heads"]["other"]
        )
    ).status_code == 403
    await client.put(f"{base(w)}/remarks", headers=ct, json={"remarks": [{"enrollment_id": e["Aarav"], "remark": ""}]})
    card = (await client.get(f"{API}/exams/{ex}/students/{w['students']['Aarav']['id']}/result", headers=ct)).json()
    assert card["remark"] is None


async def test_excel_export_is_audited_and_scoped(client, school_a, mail):
    w = await world(client, school_a, mail)
    await fill_all(client, w, MARKS)
    r = await client.get(f"{base(w)}/export", headers=w["heads"]["ct"])
    assert r.status_code == 200 and "spreadsheetml" in r.headers["content-type"]
    rows = read_xlsx(r.content)
    assert rows[0][:4] == ["Rank", "Roll No", "Scholar No", "Name"] and rows[0][-6:-1] == [
        "Total",
        "Maximum",
        "Percentage",
        "Grade",
        "Result",
    ]
    assert [x[3] for x in rows[1:]] == ["Aarav Sharma", "Bhumi Sharma", "Chirag Sharma"] and rows[1][-6] == 135
    assert (await client.get(f"{base(w)}/export", headers=w["heads"]["other"])).status_code == 403
    assert (await audit(client, w["h"], "results.exported"))[0]["sensitive"]


async def test_exam_class_overview_and_deleting_an_empty_exam(client, school_a, mail):
    w = await world(client, school_a, mail)
    ex = w["exam"]["id"]
    ov = (await client.get(f"{API}/exams/{ex}/classes", headers=w["h"])).json()[0]
    assert (ov["papers"], ov["students"], ov["entered"], ov["expected"], ov["published_at"]) == (2, 3, 0, 6, None)
    assert (await client.get(f"{API}/exams/{ex}/classes", headers=w["heads"]["other"])).json() == []
    await fill_all(client, w, {"Aarav": (1, 1)})
    assert (await client.get(f"{API}/exams/{ex}/classes", headers=w["h"])).json()[0]["entered"] == 2
    extra = await client.post(
        f"{API}/exams", headers=w["h"], json={"name": "Quiz", "starts_on": "2026-12-02", "ends_on": "2026-12-01"}
    )
    assert extra.status_code == 422
    extra = (await client.post(f"{API}/exams", headers=w["h"], json={"name": "Quiz"})).json()
    assert (await client.delete(f"{API}/exams/{extra['id']}", headers=w["h"])).status_code == 204


@pytest.mark.parametrize("kid", ["Aarav"])
async def test_results_of_a_new_year_exam_are_per_enrollment(client, school_a, mail, kid):
    """An exam belongs to an academic year: only classes of that year can have papers."""
    w = await world(client, school_a, mail)
    y2 = (
        await client.post(
            f"{API}/academic/years",
            headers=w["h"],
            json={"name": "2027-28", "starts_on": "2027-04-01", "ends_on": "2028-03-31"},
        )
    ).json()
    c2 = (
        await client.post(
            f"{API}/academic/classes", headers=w["h"], json={"grade": "9", "section": "A", "academic_year_id": y2["id"]}
        )
    ).json()
    r = await client.put(
        f"{API}/exams/{w['exam']['id']}/papers", headers=w["h"], json={"class_ids": [c2["id"]], "papers": []}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "wrong_year"


async def test_report_card_attendance_covers_the_year_up_to_the_exam_end(client, school_a, mail):
    w = await world(client, school_a, mail)
    await fill_all(client, w, MARKS)
    ct, ex, cid = w["heads"]["ct"], w["exam"]["id"], w["class"]["id"]
    kid = w["students"]["Aarav"]["id"]
    today = today_ist()
    yesterday = today - timedelta(days=1)
    ids = {k: s["id"] for k, s in w["students"].items()}

    def rec(first, second):
        return [
            {"student_id": ids["Aarav"], "first_half": first, "second_half": second},
            {"student_id": ids["Bhumi"], "first_half": "present", "second_half": "present"},
            {"student_id": ids["Chirag"], "first_half": "present", "second_half": "present"},
        ]

    for d, recs in ((yesterday, rec("present", "present")), (today, rec("present", "absent"))):
        r = await client.put(f"{API}/attendance/classes/{cid}/days/{d}", headers=ct, json={"records": recs})
        assert r.status_code == 200, r.text
    url = f"{API}/exams/{ex}/students/{kid}/report-card"
    a = (await client.get(url, headers=ct)).json()["attendance"]
    # no exam end date: the year so far, up to today (one full day and one half day present)
    assert (a["working_days"], a["present_days"], a["absent_days"], a["half_days"]) == (2, 1.5, 0.5, 1)
    assert a["percentage"] == 75.0 and a["to_on"] == today.isoformat() and a["from_on"] <= yesterday.isoformat()
    # an exam that ended yesterday leaves today's absence out
    async with make_session(bypass=True) as db:
        await db.execute(update(Exam).where(Exam.id == uuid.UUID(ex)).values(ends_on=yesterday))
    a = (await client.get(url, headers=ct)).json()["attendance"]
    assert (a["working_days"], a["present_days"], a["percentage"]) == (1, 1.0, 100.0) and a[
        "to_on"
    ] == yesterday.isoformat()
    # publishing and the parent's own card show the same figures
    assert (await client.post(f"{base(w)}/publish", headers=ct)).status_code == 200
    pa = await parent_of(client, mail, "Aarav")
    card = (await client.get(f"{API}/parent/children/{kid}/results/{ex}/report-card", headers=pa)).json()
    assert card["attendance"]["working_days"] == 1
