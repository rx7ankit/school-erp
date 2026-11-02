"""Attendance: the daily sheet, half days, edits with audit, statistics, holidays, analytics, staff attendance."""

from attkit import classroom, day, mark, rec
from conftest import API, add_staff, staff_headers
from studentkit import teacher


async def test_class_teacher_marks_a_day_and_the_numbers_follow_the_half_day_rule(client, school_a, mail):
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    sheet = (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th)).json()
    assert sheet["marked"] is False and sheet["can_mark"] is True
    assert [s["name"] for s in sheet["students"]] == ["Aarav Sharma", "Bhavna Sharma", "Chirag Sharma"]
    assert all(s["first_half"] == "present" and s["saved"] is False for s in sheet["students"])

    out = await mark(
        client,
        th,
        c["id"],
        day(0),
        [
            rec(a["id"]),
            rec(b["id"], "present", "absent", late=True, note="left early"),
            rec(d["id"], "absent", "absent"),
        ],
    )
    assert out["marked"] is True and out["marked_by"] == "t1"
    got = {s["name"]: s for s in out["students"]}
    assert got["Bhavna Sharma"]["second_half"] == "absent" and got["Bhavna Sharma"]["late"] is True
    assert all(s["saved"] for s in out["students"])

    # a second day: everyone present
    await mark(client, th, c["id"], day(1), [rec(a["id"]), rec(b["id"]), rec(d["id"])])
    stats = (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th)).json()
    by = {s["name"]: s for s in stats["students"]}
    assert by["Aarav Sharma"]["percentage"] == 100.0 and by["Aarav Sharma"]["full_days"] == 2
    # Bhavna: day 1 = 1, day 2 = 0.5 -> 75%
    assert by["Bhavna Sharma"]["present_days"] == 1.5 and by["Bhavna Sharma"]["percentage"] == 75.0
    assert by["Bhavna Sharma"]["half_days"] == 1 and by["Bhavna Sharma"]["late_days"] == 1
    # Chirag: absent one day, present the other -> 50%
    assert by["Chirag Sharma"]["percentage"] == 50.0 and by["Chirag Sharma"]["absent_days"] == 1
    assert by["Chirag Sharma"]["below_threshold"] is True and by["Aarav Sharma"]["below_threshold"] is False
    s = stats["summary"]
    assert s["working_days"] == 6 and s["present_days"] == 4.5 and s["percentage"] == 75.0
    # the day list
    days = (await client.get(f"{API}/attendance/classes/{c['id']}/days", headers=th)).json()
    assert [x["day_on"] for x in days] == [day(0), day(1)] and days[0]["percentage"] == 50.0
    # one student, staff side
    st = (await client.get(f"{API}/attendance/students/{b['id']}/stats", headers=th)).json()
    assert st["stats"]["percentage"] == 75.0


async def test_an_edit_is_audited_student_by_student(client, school_a, mail):
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    await mark(client, th, c["id"], day(0), [rec(a["id"]), rec(b["id"]), rec(d["id"], "absent", "absent")])
    # correction: only the changed student needs to be sent
    out = await mark(client, th, c["id"], day(0), [rec(d["id"], "present", "absent")])
    assert {s["name"]: s["first_half"] for s in out["students"]}["Chirag Sharma"] == "present"
    # nothing changed -> no new audit line
    await mark(client, th, c["id"], day(0), [rec(d["id"], "present", "absent")])
    log = (await client.get(f"{API}/audit", headers=school_a["headers"], params={"category": "attendance"})).json()
    actions = [x["action"] for x in log["items"]]
    assert actions.count("attendance.marked") == 1 and actions.count("attendance.edited") == 1
    edit = next(x for x in log["items"] if x["action"] == "attendance.edited")
    assert edit["changes"] == [{"field": "Chirag Sharma (3) first_half", "from": "absent", "to": "present"}] or (
        len(edit["changes"]) == 1 and edit["changes"][0]["from"] == "absent" and edit["changes"][0]["to"] == "present"
    )


async def test_only_the_class_teacher_marks_and_teachers_see_only_their_classes(client, school_a, mail):
    h = school_a["headers"]
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    c2, th2, _, _ = await classroom(client, school_a, mail, email="t2@rps.example", grade="9", parents=False)
    body = {"records": [rec(a["id"]), rec(b["id"]), rec(d["id"])]}
    # another class's teacher
    r = await client.put(f"{API}/attendance/classes/{c['id']}/days/{day(0)}", headers=th2, json=body)
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_class_teacher"
    assert (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th2)).status_code == 403
    assert (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th2)).status_code == 403
    assert (await client.get(f"{API}/attendance/students/{a['id']}/stats", headers=th2)).status_code == 404
    # a subject teacher of the class can look but not mark
    sub = await add_staff(client, h, mail, email="sub@rps.example", name="Sub")
    subj = (await client.post(f"{API}/academic/subjects", headers=h, json={"name": "Maths"})).json()
    await client.put(f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": [subj["id"]]})
    r = await client.put(
        f"{API}/academic/classes/{c['id']}/subject-teachers/{subj['id']}", headers=h, json={"staff_id": sub["id"]}
    )
    assert r.status_code == 200, r.text
    sub_h = await staff_headers(client, mail, "sub@rps.example")
    assert (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=sub_h)).status_code == 200
    assert (
        await client.put(f"{API}/attendance/classes/{c['id']}/days/{day(0)}", headers=sub_h, json=body)
    ).status_code == 403
    # academic.manage alone does not mark either (class teacher only), but sees everything
    am = await teacher(client, h, mail, "am@rps.example", perms=["academic.manage"])
    assert (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=am)).status_code == 200
    assert (
        await client.put(f"{API}/attendance/classes/{c['id']}/days/{day(0)}", headers=am, json=body)
    ).status_code == 403
    # the admin passes
    assert (
        await client.put(f"{API}/attendance/classes/{c['id']}/days/{day(0)}", headers=h, json=body)
    ).status_code == 200
    # parents cannot use the staff routes
    # not signed in
    assert (await client.get(f"{API}/attendance/classes/{c['id']}/sheet")).status_code == 401


async def test_saving_rules(client, school_a, mail):
    h = school_a["headers"]
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    url = f"{API}/attendance/classes/{c['id']}/days"
    # the first save must list everyone
    r = await client.put(f"{url}/{day(0)}", headers=th, json={"records": [rec(a["id"])]})
    assert r.status_code == 422 and r.json()["error"]["code"] == "incomplete"
    assert set(r.json()["error"]["details"]["missing"]) == {"Bhavna Sharma", "Chirag Sharma"}
    # nothing was saved
    assert (await client.get(f"{API}/attendance/classes/{c['id']}/days", headers=th)).json() == []
    full = [rec(a["id"]), rec(b["id"]), rec(d["id"])]
    # future date
    future = (__import__("datetime").date.fromisoformat(day(0)) + __import__("datetime").timedelta(days=1)).isoformat()
    assert (await client.put(f"{url}/{future}", headers=th, json={"records": full})).json()["error"][
        "code"
    ] == "future_date"
    # a student from outside the class, and a duplicate
    other = (await classroom(client, school_a, mail, email="t9@rps.example", grade="9", n=1, parents=False))[2][0]
    r = await client.put(f"{url}/{day(0)}", headers=th, json={"records": [*full, rec(other["id"])]})
    assert r.json()["error"]["code"] == "not_in_class"
    r = await client.put(f"{url}/{day(0)}", headers=th, json={"records": [*full, rec(a["id"])]})
    assert r.json()["error"]["code"] == "duplicate_student"
    # bad value
    assert (
        await client.put(f"{url}/{day(0)}", headers=th, json={"records": [rec(a["id"], "sick")]})
    ).status_code == 422
    # outside the academic year
    assert (await client.put(f"{url}/2020-01-06", headers=h, json={"records": full})).json()["error"][
        "code"
    ] == "outside_year"
    # a class teacher can correct only the last 7 days; the admin can do any day in the year
    assert (await client.put(f"{url}/{day(10)}", headers=th, json={"records": full})).json()["error"][
        "code"
    ] == "edit_window_closed"
    assert (await client.put(f"{url}/{day(10)}", headers=h, json={"records": full})).status_code == 200


async def test_holidays_are_not_working_days_and_cannot_be_marked(client, school_a, mail):
    h = school_a["headers"]
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    full = [rec(a["id"]), rec(b["id"]), rec(d["id"], "absent", "absent")]
    await mark(client, th, c["id"], day(2), full)
    await mark(client, th, c["id"], day(1), full)
    # only academic.manage may add holidays
    r = await client.post(f"{API}/holidays", headers=th, json={"title": "Diwali", "from_on": day(1)})
    assert r.status_code == 403
    r = await client.post(f"{API}/holidays", headers=h, json={"title": "Diwali", "from_on": day(1), "to_on": day(1)})
    assert r.status_code == 201 and r.json()["kind"] == "holiday"
    hid = r.json()["id"]
    # the already-marked holiday no longer counts as a working day
    st = (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th)).json()
    assert (
        st["summary"]["working_days"] == 3
        and {x["name"]: x["working_days"] for x in st["students"]}["Aarav Sharma"] == 1
    )
    # and it cannot be marked
    r = await client.put(f"{API}/attendance/classes/{c['id']}/days/{day(1)}", headers=th, json={"records": full})
    assert r.status_code == 409 and r.json()["error"]["code"] == "holiday"
    sheet = (
        await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th, params={"day_on": day(1)})
    ).json()
    assert sheet["holiday"] == "Diwali" and sheet["can_mark"] is False
    # an exam marker is not a holiday
    r = await client.post(f"{API}/holidays", headers=h, json={"title": "Unit test", "from_on": day(2), "kind": "exam"})
    assert r.json()["to_on"] == day(2)
    st = (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th)).json()
    assert st["summary"]["working_days"] == 3
    # list, change, remove
    assert len((await client.get(f"{API}/holidays", headers=th)).json()) == 2
    assert (await client.patch(f"{API}/holidays/{hid}", headers=h, json={"title": "Diwali break"})).json()[
        "title"
    ] == "Diwali break"
    bad = await client.patch(f"{API}/holidays/{hid}", headers=h, json={"to_on": day(5)})
    assert bad.status_code == 422
    assert (await client.delete(f"{API}/holidays/{hid}", headers=h)).status_code == 204
    assert (
        await client.post(f"{API}/holidays", headers=h, json={"title": "x", "from_on": day(1), "to_on": day(3)})
    ).status_code == 422
    log = (await client.get(f"{API}/audit", headers=h, params={"category": "academic"})).json()["items"]
    assert {"holiday.created", "holiday.updated", "holiday.deleted"} <= {x["action"] for x in log}


async def test_a_student_who_leaves_gets_no_new_records_but_keeps_the_old_ones(client, school_a, mail):
    h = school_a["headers"]
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    await mark(client, th, c["id"], day(1), [rec(a["id"]), rec(b["id"]), rec(d["id"])])
    assert (
        await client.post(f"{API}/students/{d['id']}/leave", headers=h, json={"reason": "moved"})
    ).status_code == 200
    sheet = (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th)).json()
    assert [s["name"] for s in sheet["students"]] == ["Aarav Sharma", "Bhavna Sharma"]
    await mark(client, th, c["id"], day(0), [rec(a["id"]), rec(b["id"])])  # the leaver is not required
    r = await client.put(
        f"{API}/attendance/classes/{c['id']}/days/{day(0)}", headers=th, json={"records": [rec(d["id"])]}
    )
    assert r.json()["error"]["code"] == "not_in_class"
    st = (await client.get(f"{API}/attendance/students/{d['id']}/stats", headers=h)).json()
    assert st["stats"]["working_days"] == 1 and st["stats"]["percentage"] == 100.0  # history stays
    cs = (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th)).json()
    assert {x["name"]: x["status"] for x in cs["students"]}["Chirag Sharma"] == "left"


async def test_calendar_month_and_validation(client, school_a, mail):
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    await mark(client, th, c["id"], day(0), [rec(a["id"]), rec(b["id"], "present", "absent"), rec(d["id"])])
    month = day(0)[:7]
    cal = (
        await client.get(f"{API}/attendance/students/{b['id']}/calendar", headers=th, params={"month": month})
    ).json()
    today = next(x for x in cal["days"] if x["day_on"] == day(0))
    assert today["status"] == "half" and today["second_half"] == "absent"
    assert any(x["status"] == "not_marked" for x in cal["days"]) and cal["stats"]["percentage"] == 50.0
    for bad in ("2026-13", "nov", "2026-1-1"):
        r = await client.get(f"{API}/attendance/students/{b['id']}/calendar", headers=th, params={"month": bad})
        assert r.status_code == 422
    r = await client.get(
        f"{API}/attendance/classes/{c['id']}/stats", headers=th, params={"from_on": day(0), "to_on": day(5)}
    )
    assert r.json()["error"]["code"] == "invalid_period"
    r = await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th, params={"month": month})
    assert r.json()["summary"]["working_days"] == 3
    # a month with nothing marked: no division by zero
    r = await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th, params={"month": "2020-01"})
    assert r.json()["summary"]["percentage"] is None


async def test_export_is_filtered_and_audited(client, school_a, mail):
    from studentkit import read_xlsx

    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    await mark(client, th, c["id"], day(0), [rec(a["id"]), rec(b["id"], "absent", "absent"), rec(d["id"])])
    r = await client.get(f"{API}/attendance/classes/{c['id']}/stats/export", headers=th)
    assert r.status_code == 200
    rows = read_xlsx(r.content)
    assert rows[0][2] == "Name" and [x[2] for x in rows[1:]] == ["Aarav Sharma", "Bhavna Sharma", "Chirag Sharma"]
    assert rows[2][-1] == 0.0
    log = (await client.get(f"{API}/audit", headers=school_a["headers"], params={"category": "exports"})).json()[
        "items"
    ]
    assert log[0]["action"] == "attendance.exported"


async def test_school_analytics_scope_and_teacher_wise(client, school_a, mail):
    h = school_a["headers"]
    c, th, (a, b, d), _ = await classroom(client, school_a, mail, parents=False)
    c2, th2, (e,), _ = await classroom(client, school_a, mail, email="t2@rps.example", grade="9", n=1, parents=False)
    await mark(
        client, th, c["id"], day(0), [rec(a["id"]), rec(b["id"], "present", "absent"), rec(d["id"], "absent", "absent")]
    )
    await mark(client, th2, c2["id"], day(0), [rec(e["id"])])
    an = (await client.get(f"{API}/attendance/analytics", headers=h)).json()
    assert an["marked_days"] == 1 and an["overall_percentage"] == 62.5  # (1 + .5 + 0 + 1) / 4
    assert {r["class_label"]: r["percentage"] for r in an["by_class"]} == {"8-A": 50.0, "9-A": 100.0}
    assert an["trend"][0]["day_on"] == day(0) and len(an["by_weekday"]) == 1
    assert an["students_below_threshold"] == 2
    below = (await client.get(f"{API}/attendance/analytics/below", headers=h)).json()
    assert [(x["name"], x["percentage"]) for x in below["items"]] == [("Chirag Sharma", 0.0), ("Bhavna Sharma", 50.0)]
    # a teacher sees only their own class
    mine = (await client.get(f"{API}/attendance/analytics", headers=th2)).json()
    assert [r["class_label"] for r in mine["by_class"]] == ["9-A"] and mine["overall_percentage"] == 100.0
    assert (await client.get(f"{API}/attendance/analytics/below", headers=th2)).json()["total"] == 0
    assert (
        await client.get(f"{API}/attendance/analytics", headers=th2, params={"class_id": c["id"]})
    ).status_code == 404
    # teacher-wise: the admin sees all, a teacher sees only their own row
    rows = {r["name"]: r for r in (await client.get(f"{API}/attendance/analytics/teachers", headers=h)).json()}
    assert rows["t1"]["class_teacher_of"] == ["8-A"] and rows["t1"]["class_attendance_percentage"] == 50.0
    assert rows["t2"]["class_attendance_percentage"] == 100.0
    own = (await client.get(f"{API}/attendance/analytics/teachers", headers=th)).json()
    assert [r["name"] for r in own] == ["t1"]


async def test_staff_attendance_needs_staff_manage_and_feeds_the_teacher_rows(client, school_a, mail):
    h = school_a["headers"]
    c, th, _, _ = await classroom(client, school_a, mail, parents=False)
    sheet = (await client.get(f"{API}/attendance/staff", headers=h)).json()
    t1 = next(x for x in sheet if x["name"] == "t1")
    assert t1["status"] is None and t1["saved"] is False
    assert (await client.get(f"{API}/attendance/staff", headers=th)).status_code == 403
    body = {"records": [{"staff_id": t1["staff_id"], "status": "absent", "reason": "fever"}]}
    assert (await client.put(f"{API}/attendance/staff/{day(0)}", headers=th, json=body)).status_code == 403
    out = (await client.put(f"{API}/attendance/staff/{day(0)}", headers=h, json=body)).json()
    assert next(x for x in out if x["name"] == "t1")["status"] == "absent"
    # change it to leave
    body["records"][0]["status"] = "leave"
    await client.put(f"{API}/attendance/staff/{day(0)}", headers=h, json=body)
    row = next(
        r for r in (await client.get(f"{API}/attendance/analytics/teachers", headers=h)).json() if r["name"] == "t1"
    )
    assert (row["days_marked"], row["days_leave"], row["days_absent"]) == (1, 1, 0)
    future = (__import__("datetime").date.fromisoformat(day(0)) + __import__("datetime").timedelta(days=2)).isoformat()
    assert (await client.put(f"{API}/attendance/staff/{future}", headers=h, json=body)).status_code == 422
    body["records"][0]["staff_id"] = "00000000-0000-0000-0000-000000000001"
    assert (await client.put(f"{API}/attendance/staff/{day(0)}", headers=h, json=body)).json()["error"][
        "code"
    ] == "not_staff"
    log = (await client.get(f"{API}/audit", headers=h, params={"category": "attendance"})).json()["items"]
    assert [x["action"] for x in log].count("staff_attendance.marked") == 2


async def test_parent_sees_only_their_own_childs_attendance(client, school_a, mail):
    c, th, (a, b, d), ph = await classroom(client, school_a, mail)
    await mark(client, th, c["id"], day(0), [rec(a["id"]), rec(b["id"], "absent", "absent"), rec(d["id"])])
    month = day(0)[:7]
    cal = (
        await client.get(f"{API}/parent/children/{a['id']}/attendance/calendar", headers=ph, params={"month": month})
    ).json()
    assert next(x for x in cal["days"] if x["day_on"] == day(0))["status"] == "full"
    st = (await client.get(f"{API}/parent/children/{a['id']}/attendance/stats", headers=ph)).json()
    assert st["stats"]["percentage"] == 100.0
    # another family's child: 404 on everything
    for path in ("attendance/stats", "leave"):
        assert (await client.get(f"{API}/parent/children/{b['id']}/{path}", headers=ph)).status_code == 404
    r = await client.get(f"{API}/parent/children/{b['id']}/attendance/calendar", headers=ph, params={"month": month})
    assert r.status_code == 404
    # staff routes are closed to parents, parent routes to staff
    assert (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=ph)).status_code == 403
    assert (await client.get(f"{API}/attendance/analytics", headers=ph)).status_code == 403
    assert (await client.get(f"{API}/holidays", headers=ph)).status_code == 403
    assert (await client.get(f"{API}/parent/children/{a['id']}/attendance/stats", headers=th)).status_code == 403
    assert (await client.get(f"{API}/parent/holidays", headers=ph)).status_code == 200
