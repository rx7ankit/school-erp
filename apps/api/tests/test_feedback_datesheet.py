from datetime import timedelta

from conftest import API
from resultskit import fill_all, parent_of, world
from studentkit import read_xlsx

from app.core.clock import today_ist


def days(n):
    return (today_ist() + timedelta(days=n)).isoformat()


# ------------------------------------------------------------------ date sheet
async def test_date_sheet_draft_publish_and_parent_view(client, school_a, mail):
    w = await world(client, school_a, mail)
    h = w["h"]
    other = (await client.post(f"{API}/academic/classes", headers=h, json={"grade": "9", "section": "A"})).json()
    await client.put(
        f"{API}/academic/classes/{other['id']}/subjects",
        headers=h,
        json={"subject_ids": [w["subj"]["Mathematics"]["id"]]},
    )
    s = (await client.post(f"{API}/exam-schedules", headers=h, json={"name": "Half-yearly exams"})).json()
    assert (await client.post(f"{API}/exam-schedules/{s['id']}/publish", headers=h)).json()["error"][
        "code"
    ] == "no_papers"
    papers = [
        {
            "class_id": w["class"]["id"],
            "subject_id": w["subj"]["English"]["id"],
            "paper_on": days(11),
            "starts_at": "10:00:00",
        },
        {
            "class_id": w["class"]["id"],
            "subject_id": w["subj"]["Mathematics"]["id"],
            "paper_on": days(10),
            "starts_at": "09:30:00",
        },
        {
            "class_id": other["id"],
            "subject_id": w["subj"]["Mathematics"]["id"],
            "paper_on": days(10),
            "starts_at": "09:30:00",
        },
    ]
    r = await client.put(f"{API}/exam-schedules/{s['id']}/papers", headers=h, json={"papers": papers})
    assert r.status_code == 200 and [i["subject"] for i in r.json()["items"]][:2] == ["Mathematics", "Mathematics"]
    bad = [{**papers[0], "class_id": other["id"]}]
    assert (await client.put(f"{API}/exam-schedules/{s['id']}/papers", headers=h, json={"papers": bad})).json()[
        "error"
    ]["code"] == "subject_not_in_class"
    assert (
        await client.put(f"{API}/exam-schedules/{s['id']}/papers", headers=h, json={"papers": papers[:1] * 2})
    ).status_code == 422
    aarav = w["students"]["Aarav"]["id"]
    pa = await parent_of(client, mail, "Aarav")
    assert (await client.get(f"{API}/parent/children/{aarav}/date-sheet", headers=pa)).json() == []
    # drafts are invisible to ordinary teachers
    assert (await client.get(f"{API}/exam-schedules", headers=w["heads"]["ct"])).json() == []
    assert (await client.get(f"{API}/exam-schedules/{s['id']}", headers=w["heads"]["ct"])).status_code == 404
    # only academic.manage publishes
    assert (await client.post(f"{API}/exam-schedules/{s['id']}/publish", headers=w["heads"]["ct"])).status_code == 403
    r = await client.post(f"{API}/exam-schedules/{s['id']}/publish", headers=h)
    assert r.status_code == 200 and r.json()["published_at"]
    assert (await client.delete(f"{API}/exam-schedules/{s['id']}", headers=h)).status_code == 409
    sheets = (await client.get(f"{API}/parent/children/{aarav}/date-sheet", headers=pa)).json()
    assert len(sheets) == 1
    assert [(i["class_name"], i["subject"], i["paper_on"], i["starts_at"]) for i in sheets[0]["items"]] == [
        ("8-A", "Mathematics", days(10), "09:30:00"),
        ("8-A", "English", days(11), "10:00:00"),
    ]  # only the child's own class
    assert (await client.get(f"{API}/exam-schedules/{s['id']}", headers=w["heads"]["ct"])).status_code == 200
    assert (
        await client.get(f"{API}/parent/children/{w['students']['Bhumi']['id']}/date-sheet", headers=pa)
    ).status_code == 404
    await client.post(f"{API}/exam-schedules/{s['id']}/unpublish", headers=h)
    assert (await client.get(f"{API}/parent/children/{aarav}/date-sheet", headers=pa)).json() == []
    assert (await client.delete(f"{API}/exam-schedules/{s['id']}", headers=h)).status_code == 204
    logs = (await client.get(f"{API}/audit", headers=h, params={"action": "datesheet.published"})).json()["items"]
    assert logs


# ------------------------------------------------------------------ feedback
async def new_request(client, w, **over):
    body = {"title": "Term 1 feedback", "class_ids": [w["class"]["id"]], "closes_on": days(7), **over}
    r = await client.post(f"{API}/feedback", headers=w["h"], json=body)
    assert r.status_code == 201, r.text
    return r.json()


async def targets_for(client, pa, kid_id):
    rows = (await client.get(f"{API}/parent/feedback", headers=pa)).json()
    row = next(x for x in rows if x["student_id"] == kid_id)
    return row, {t["teacher"]: t["target_id"] for t in row["targets"]}


async def test_feedback_targets_rating_and_anonymous_summary(client, school_a, mail):
    w = await world(client, school_a, mail)
    h = w["h"]
    req = await new_request(client, w, share_with_teachers=True)
    assert req["targets"] == 3 and req["status"] == "open"  # class teacher + two subject teachers
    aarav, bhumi = w["students"]["Aarav"]["id"], w["students"]["Bhumi"]["id"]
    pa, pb = await parent_of(client, mail, "Aarav"), await parent_of(client, mail, "Bhumi")
    row, t = await targets_for(client, pa, aarav)
    assert set(t) == {"Class Teacher", "Maths Teacher", "English Teacher"} and row["student_name"] == "Aarav Sharma"

    def put(hd, tid, sid, **b):
        return client.put(f"{API}/parent/feedback/targets/{tid}/children/{sid}", headers=hd, json=b)

    assert (await put(pa, t["Maths Teacher"], aarav, rating=5, comment="Explains very well")).status_code == 204
    assert (
        await put(pa, t["Maths Teacher"], aarav, rating=4, comment="  Explains well  ")
    ).status_code == 204  # change own answer
    assert (await put(pb, t["Maths Teacher"], bhumi, rating=2)).status_code == 204
    assert (await put(pa, t["English Teacher"], aarav, rating=3, comment="")).status_code == 204
    # validation
    for bad in (0, 6):
        assert (await put(pa, t["Maths Teacher"], aarav, rating=bad)).status_code == 422
    assert (await put(pa, t["Maths Teacher"], aarav, rating=3, comment="x" * 501)).status_code == 422
    assert (await put(pa, t["Maths Teacher"], aarav, rating=3, comment="x" * 500)).status_code == 204
    assert (await put(pa, t["Maths Teacher"], aarav, rating=4, comment="Explains well")).status_code == 204
    # a parent cannot rate for another family's child
    assert (await put(pa, t["Maths Teacher"], bhumi, rating=1)).status_code == 404
    mine = (await client.get(f"{API}/parent/feedback", headers=pa)).json()
    first = next(x for x in mine if x["student_id"] == aarav)
    assert {x["teacher"]: x["my_rating"] for x in first["targets"]}["Maths Teacher"] == 4
    # managers: average, spread, response rate, comments with no names
    d = (await client.get(f"{API}/feedback/{req['id']}", headers=h)).json()
    maths = next(x for x in d["teachers"] if x["teacher"] == "Maths Teacher")
    assert (
        maths["responses"] == 2
        and maths["average"] == 3.0
        and maths["spread"] == {"1": 0, "2": 1, "3": 0, "4": 1, "5": 0}
    )
    assert (
        maths["expected"] == 3 and round(maths["response_rate"], 3) == 0.667 and maths["comments"] == ["Explains well"]
    )
    assert d["responses"] == 3 and d["teachers"][0]["responses"] >= 0
    text = str(d).lower()
    assert "guardian" not in text and "aarav" not in text and "parent of" not in text
    # no guardian or student ids leak through the parent payload or the audit log either
    assert "guardian" not in str(mine).lower()
    audit = (await client.get(f"{API}/audit", headers=h, params={"limit": 100})).json()["items"]
    assert not [
        a for a in audit if "feedback.rate" in a["action"] or "Aarav" in a["summary"] and "rating" in a["summary"]
    ]
    # a teacher sees nothing while it is open
    assert (await client.get(f"{API}/feedback/mine", headers=w["heads"]["maths"])).json() == []
    assert (await client.get(f"{API}/feedback/{req['id']}", headers=w["heads"]["maths"])).status_code == 403
    assert (await client.get(f"{API}/feedback", headers=w["heads"]["maths"])).status_code == 403
    # close early: answers can no longer change
    assert (await client.post(f"{API}/feedback/{req['id']}/close", headers=h)).json()["status"] == "closed"
    assert (await put(pa, t["Maths Teacher"], aarav, rating=1)).json()["error"]["code"] == "feedback_closed"
    assert (await client.get(f"{API}/parent/feedback", headers=pa)).json() == []
    assert (await client.post(f"{API}/feedback/{req['id']}/close", headers=h)).status_code == 409
    # each teacher sees only their own summary
    mm = (await client.get(f"{API}/feedback/mine", headers=w["heads"]["maths"])).json()
    assert len(mm) == 1 and [s["teacher"] for s in mm[0]["summaries"]] == ["Maths Teacher"]
    assert mm[0]["summaries"][0]["average"] == 3.0 and mm[0]["summaries"][0]["comments"] == ["Explains well"]
    ee = (await client.get(f"{API}/feedback/mine", headers=w["heads"]["eng"])).json()
    assert [s["teacher"] for s in ee[0]["summaries"]] == ["English Teacher"] and ee[0]["summaries"][0]["average"] == 3.0
    assert (await client.get(f"{API}/feedback/mine", headers=w["heads"]["other"])).json() == []
    # export
    x = await client.get(f"{API}/feedback/{req['id']}/export", headers=h)
    assert x.status_code == 200 and read_xlsx(x.content)[0][0] == "Teacher"
    assert (await client.get(f"{API}/feedback/{req['id']}/export", headers=w["heads"]["maths"])).status_code == 403


async def test_not_shared_requests_stay_hidden_from_teachers(client, school_a, mail):
    w = await world(client, school_a, mail)
    req = await new_request(client, w)  # share_with_teachers defaults to false
    await client.post(f"{API}/feedback/{req['id']}/close", headers=w["h"])
    assert (await client.get(f"{API}/feedback/mine", headers=w["heads"]["maths"])).json() == []


async def test_dates_draft_and_automatic_close(client, school_a, mail):
    w = await world(client, school_a, mail)
    h = w["h"]
    r = await client.post(
        f"{API}/feedback",
        headers=h,
        json={"title": "x", "class_ids": [w["class"]["id"]], "opens_on": days(5), "closes_on": days(1)},
    )
    assert r.status_code == 422
    # not open yet -> parents do not see it; a draft likewise until opened
    future = await new_request(client, w, opens_on=days(2), title="Later")
    draft = await new_request(client, w, open_now=False, title="Draft")
    pa = await parent_of(client, mail, "Aarav")
    assert (await client.get(f"{API}/parent/feedback", headers=pa)).json() == []
    assert draft["status"] == "draft" and future["status"] == "open"
    assert (await client.post(f"{API}/feedback/{draft['id']}/open", headers=h)).json()["status"] == "open"
    rows = (await client.get(f"{API}/parent/feedback", headers=pa)).json()
    assert [x["title"] for x in rows] == ["Draft"]
    # a request whose closing date passed is closed by itself (move the date back in the database)
    from sqlalchemy import update

    from app.db.session import system_session
    from app.models.results import FeedbackRequest

    async with system_session() as db:
        await db.execute(
            update(FeedbackRequest)
            .where(FeedbackRequest.id == draft["id"])
            .values(opens_on=today_ist() - timedelta(days=9), closes_on=today_ist() - timedelta(days=1))
        )
    assert (await client.get(f"{API}/feedback/{draft['id']}", headers=h)).json()["status"] == "closed"
    assert (await client.get(f"{API}/parent/feedback", headers=pa)).json() == []
    tid = rows[0]["targets"][0]["target_id"]
    r = await client.put(
        f"{API}/parent/feedback/targets/{tid}/children/{w['students']['Aarav']['id']}", headers=pa, json={"rating": 5}
    )
    assert r.json()["error"]["code"] == "feedback_closed"


async def test_feedback_needs_teachers_and_permission(client, school_a, mail):
    w = await world(client, school_a, mail)
    empty = (await client.post(f"{API}/academic/classes", headers=w["h"], json={"grade": "5", "section": "A"})).json()
    r = await client.post(
        f"{API}/feedback", headers=w["h"], json={"title": "x", "class_ids": [empty["id"]], "closes_on": days(3)}
    )
    assert r.json()["error"]["code"] == "no_teachers"
    r = await client.post(
        f"{API}/feedback",
        headers=w["heads"]["ct"],
        json={"title": "x", "class_ids": [w["class"]["id"]], "closes_on": days(3)},
    )
    assert r.status_code == 403
    pa = await parent_of(client, mail, "Aarav")
    assert (
        await client.post(
            f"{API}/feedback", headers=pa, json={"title": "x", "class_ids": [w["class"]["id"]], "closes_on": days(3)}
        )
    ).status_code == 403
    # a child who left cannot be rated for, and is not asked
    req = await new_request(client, w)
    aarav = w["students"]["Aarav"]["id"]
    _, t = await targets_for(client, pa, aarav)
    await client.post(f"{API}/students/{aarav}/leave", headers=w["h"], json={"reason": "moved"})
    assert (await client.get(f"{API}/parent/feedback", headers=pa)).json() == []
    r = await client.put(
        f"{API}/parent/feedback/targets/{t['Maths Teacher']}/children/{aarav}", headers=pa, json={"rating": 5}
    )
    assert r.status_code in (403, 404) and req


async def test_siblings_rate_separately_and_marks_dont_mix(client, school_a, mail):
    """Two children of one parent each give their own answer for the same teacher."""
    w = await world(client, school_a, mail, kids=("Aarav",))
    from conftest import add_staff  # noqa: F401
    from studentkit import GUARD, enrol

    sib = await enrol(
        client,
        w["h"],
        w["class"]["id"],
        first="Anya",
        last="Sharma",
        guardians=[{**GUARD, "email": "aarav@fam.example", "name": "Parent of Aarav"}],
    )
    await new_request(client, w)
    pa = await parent_of(client, mail, "Aarav")
    rows = (await client.get(f"{API}/parent/feedback", headers=pa)).json()
    assert {r["student_name"] for r in rows} == {"Aarav Sharma", "Anya Sharma"}
    tid = rows[0]["targets"][0]["target_id"]
    for kid, rating in ((w["students"]["Aarav"]["id"], 5), (sib["id"], 1)):
        assert (
            await client.put(f"{API}/parent/feedback/targets/{tid}/children/{kid}", headers=pa, json={"rating": rating})
        ).status_code == 204
    d = (await client.get(f"{API}/feedback", headers=w["h"])).json()[0]
    assert d["responses"] == 2
    await fill_all(client, w, {"Aarav": (1, 1)})
