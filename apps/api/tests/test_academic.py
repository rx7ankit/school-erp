from conftest import API, add_staff, staff_headers


async def setup_class_and_subject(client, headers, grade="8", section="B", subject="Mathematics"):
    c = (
        await client.post(f"{API}/academic/classes", headers=headers, json={"grade": grade, "section": section})
    ).json()
    s = (await client.post(f"{API}/academic/subjects", headers=headers, json={"name": subject})).json()
    return c, s


async def test_a_new_school_starts_with_a_current_year(client, school_a):
    years = (await client.get(f"{API}/academic/years", headers=school_a["headers"])).json()["items"]
    assert len(years) == 1 and years[0]["status"] == "current"
    assert years[0]["starts_on"].endswith("-04-01") and years[0]["ends_on"].endswith("-03-31")


async def test_create_standard_and_custom_classes(client, school_a):
    h = school_a["headers"]
    a = await client.post(f"{API}/academic/classes", headers=h, json={"grade": "9", "section": "A"})
    assert a.status_code == 201 and a.json()["is_custom"] is False and a.json()["display_order"] == 9
    n = await client.post(
        f"{API}/academic/classes", headers=h, json={"grade": "Nursery", "section": "A", "is_custom": True}
    )
    assert n.json()["is_custom"] is True and n.json()["display_order"] == 0
    dup = await client.post(f"{API}/academic/classes", headers=h, json={"grade": "9", "section": "A"})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "class_exists"
    listed = (await client.get(f"{API}/academic/classes", headers=h)).json()["items"]
    assert [c["grade"] for c in listed] == ["Nursery", "9"]  # ordered: custom pre-primary first


async def test_only_one_current_year_and_a_completed_year_stays_closed(client, school_a):
    h = school_a["headers"]
    y2 = (
        await client.post(
            f"{API}/academic/years",
            headers=h,
            json={"name": "2027-28", "starts_on": "2027-04-01", "ends_on": "2028-03-31"},
        )
    ).json()
    assert y2["status"] == "draft"
    assert (await client.post(f"{API}/academic/years/{y2['id']}/set-current", headers=h)).json()["status"] == "current"
    years = {y["name"]: y["status"] for y in (await client.get(f"{API}/academic/years", headers=h)).json()["items"]}
    assert sorted(years.values()) == ["completed", "current"]
    old = next(
        y["id"]
        for y in (await client.get(f"{API}/academic/years", headers=h)).json()["items"]
        if y["status"] == "completed"
    )
    assert (await client.post(f"{API}/academic/years/{old}/set-current", headers=h)).status_code == 409
    c = await client.post(f"{API}/academic/classes", headers=h, json={"grade": "5", "academic_year_id": old})
    assert c.status_code == 409 and c.json()["error"]["code"] == "year_completed"


async def test_a_year_must_end_after_it_starts(client, school_a):
    r = await client.post(
        f"{API}/academic/years",
        headers=school_a["headers"],
        json={"name": "bad", "starts_on": "2027-04-01", "ends_on": "2027-03-01"},
    )
    assert r.status_code == 422


async def test_subjects_and_class_subjects(client, school_a):
    h = school_a["headers"]
    c, s = await setup_class_and_subject(client, h)
    eng = (await client.post(f"{API}/academic/subjects", headers=h, json={"name": "English"})).json()
    assert (await client.post(f"{API}/academic/subjects", headers=h, json={"name": "English"})).status_code == 409
    r = await client.put(
        f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": [s["id"], eng["id"]]}
    )
    assert sorted(r.json()["subject_ids"]) == sorted([s["id"], eng["id"]])
    # a subject that is still taught cannot be deleted
    assert (await client.delete(f"{API}/academic/subjects/{s['id']}", headers=h)).status_code == 409


async def test_class_teacher_and_subject_teacher_assignment(client, school_a, mail):
    h = school_a["headers"]
    c, s = await setup_class_and_subject(client, h)
    t1 = await add_staff(client, h, mail, email="t1@rps.example", name="Rajiv Mishra")
    t2 = await add_staff(client, h, mail, email="t2@rps.example", name="Sunita Dwivedi")
    await client.put(f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": [s["id"]]})
    assert (
        await client.put(f"{API}/academic/classes/{c['id']}/class-teacher", headers=h, json={"staff_id": t1["id"]})
    ).status_code == 200
    assert (
        await client.put(
            f"{API}/academic/classes/{c['id']}/subject-teachers/{s['id']}", headers=h, json={"staff_id": t2["id"]}
        )
    ).status_code == 200
    staff = {x["email"]: x for x in (await client.get(f"{API}/staff", headers=h)).json()["items"]}
    assert [a["role"] for a in staff["t1@rps.example"]["assignments"]] == ["class_teacher"]
    assert [a["role"] for a in staff["t2@rps.example"]["assignments"]] == ["subject_teacher"]
    # replacing the class teacher: the old one loses the role, and it is audited as sensitive with before and after
    await client.put(f"{API}/academic/classes/{c['id']}/class-teacher", headers=h, json={"staff_id": t2["id"]})
    staff = {x["email"]: x for x in (await client.get(f"{API}/staff", headers=h)).json()["items"]}
    assert staff["t1@rps.example"]["assignments"] == []
    assert {a["role"] for a in staff["t2@rps.example"]["assignments"]} == {"class_teacher", "subject_teacher"}
    log = (await client.get(f"{API}/audit", headers=h, params={"action": "classteacher.changed", "limit": 1})).json()[
        "items"
    ][0]
    assert log["sensitive"] and log["changes"][0] == {
        "field": "Class teacher, 8-B",
        "from": "Rajiv Mishra",
        "to": "Sunita Dwivedi",
    }
    # clearing it
    await client.put(f"{API}/academic/classes/{c['id']}/class-teacher", headers=h, json={"staff_id": None})
    cls = (await client.get(f"{API}/academic/classes", headers=h)).json()["items"][0]
    assert cls["class_teacher_id"] is None


async def test_one_subject_teacher_per_class_subject_and_only_for_taught_subjects(client, school_a, mail):
    h = school_a["headers"]
    c, s = await setup_class_and_subject(client, h)
    t = await add_staff(client, h, mail, email="t@rps.example")
    r = await client.put(
        f"{API}/academic/classes/{c['id']}/subject-teachers/{s['id']}", headers=h, json={"staff_id": t["id"]}
    )
    assert r.status_code == 404  # class does not study it yet
    await client.put(f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": [s["id"]]})
    assert (
        await client.put(
            f"{API}/academic/classes/{c['id']}/subject-teachers/{s['id']}", headers=h, json={"staff_id": t["id"]}
        )
    ).status_code == 200
    # removing the subject from the class also ends the teacher's assignment
    await client.put(f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": []})
    assert (await client.get(f"{API}/academic/assignments", headers=h)).json()["total"] == 0


async def test_a_class_with_teachers_cannot_be_deleted_until_cleared(client, school_a, mail):
    h = school_a["headers"]
    c, _ = await setup_class_and_subject(client, h)
    t = await add_staff(client, h, mail, email="t@rps.example")
    await client.put(f"{API}/academic/classes/{c['id']}/class-teacher", headers=h, json={"staff_id": t["id"]})
    r = await client.delete(f"{API}/academic/classes/{c['id']}", headers=h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "class_has_teachers"
    await client.put(f"{API}/academic/classes/{c['id']}/class-teacher", headers=h, json={"staff_id": None})
    assert (await client.delete(f"{API}/academic/classes/{c['id']}", headers=h)).status_code == 204


async def test_a_class_with_students_cannot_be_deleted(client, school_a):
    import uuid
    from datetime import date

    from app.db.session import make_session
    from app.models.student import Enrollment, Student

    h = school_a["headers"]
    c, _ = await setup_class_and_subject(client, h)
    sid = uuid.UUID(school_a["school"]["id"])
    year = (await client.get(f"{API}/academic/years", headers=h)).json()["items"][0]["id"]
    db = make_session(school_id=sid)
    st = Student(school_id=sid, scholar_no="RPS1", first_name="Aarav")
    db.add(st)
    await db.flush()
    db.add(
        Enrollment(
            school_id=sid,
            student_id=st.id,
            class_id=uuid.UUID(c["id"]),
            academic_year_id=uuid.UUID(year),
            started_on=date(2026, 4, 1),
        )
    )
    await db.commit()
    await db.close()
    r = await client.delete(f"{API}/academic/classes/{c['id']}", headers=h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "class_has_students"
    assert (await client.get(f"{API}/academic/classes", headers=h)).json()["items"][0]["students"] == 1


async def test_teachers_can_read_setup_but_only_academic_managers_can_change_it(client, school_a, mail):
    h = school_a["headers"]
    t = await add_staff(client, h, mail, email="plain@rps.example")
    th = await staff_headers(client, mail, "plain@rps.example")
    assert (await client.get(f"{API}/academic/classes", headers=th)).status_code == 200
    assert (await client.get(f"{API}/academic/subjects", headers=th)).status_code == 200
    r = await client.post(f"{API}/academic/classes", headers=th, json={"grade": "7"})
    assert r.status_code == 403 and r.json()["error"]["details"] == {"needs": "academic.manage"}
    await client.put(f"{API}/staff/{t['id']}/permissions", headers=h, json={"permissions": ["academic.manage"]})
    assert (await client.post(f"{API}/academic/classes", headers=th, json={"grade": "7"})).status_code == 201
