from conftest import API
from sqlalchemy import func, select
from studentkit import GUARD, enrol, make_class, teacher

from app.db.session import system_session
from app.models.student import Enrollment, Guardian, Student, StudentEvent


async def audit(client, h, action):
    return (await client.get(f"{API}/audit", headers=h, params={"action": action})).json()["items"]


async def test_direct_enrolment_creates_everything(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h)
    s = await enrol(client, h, c["id"], dob="2014-06-15", gender="male", category="OBC")
    assert s["scholar_no"] == "1" and s["name"] == "Aarav Sharma" and s["status"] == "active"
    assert s["current_enrollment"]["class_label"] == "8-A" and s["current_enrollment"]["roll_no"] == 1
    assert s["guardians"][0]["name"] == "Rakesh Sharma" and s["guardians"][0]["is_primary"] is True
    assert s["guardians"][0]["login_status"] == "none"
    assert [e["kind"] for e in s["history"]] == ["admitted"] and s["history"][0]["to_class"] == "8-A"
    assert s["history"][0]["recorded_by_name"] == "Meera Rao"
    s2 = await enrol(client, h, c["id"], first="Diya", guardians=[{**GUARD, "name": "Sunita"}])
    assert s2["scholar_no"] == "2" and s2["current_enrollment"]["roll_no"] == 2
    log = await audit(client, h, "student.admitted")
    assert len(log) == 2 and "Class 8-A" in log[0]["summary"]


async def test_guardian_name_and_mobile_are_required(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h)
    r = await client.post(
        f"{API}/students", headers=h, json={"first_name": "A", "class_id": c["id"], "guardians": [{"name": "Dad"}]}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "guardian_phone_required"
    r = await client.post(f"{API}/students", headers=h, json={"first_name": "A", "class_id": c["id"], "guardians": []})
    assert r.status_code == 422


async def test_class_capacity_is_checked(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h, capacity=1)
    await enrol(client, h, c["id"])
    r = await client.post(
        f"{API}/students", headers=h, json={"first_name": "B", "class_id": c["id"], "guardians": [GUARD]}
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "class_full"


async def test_only_academic_managers_write_and_teachers_see_their_class(client, school_a, mail):
    h = school_a["headers"]
    c8, c9 = await make_class(client, h, "8"), await make_class(client, h, "9")
    s8, s9 = await enrol(client, h, c8["id"], first="Eight"), await enrol(client, h, c9["id"], first="Nine")
    t = await teacher(client, h, mail, "t8@rps.example", class_id=c8["id"])
    body = {"first_name": "X", "class_id": c8["id"], "guardians": [GUARD]}
    assert (await client.post(f"{API}/students", headers=t, json=body)).status_code == 403
    assert (await client.patch(f"{API}/students/{s8['id']}", headers=t, json={"address": "x"})).status_code == 403
    assert (await client.post(f"{API}/students/{s8['id']}/leave", headers=t, json={"reason": "x"})).status_code == 403
    mine = (await client.get(f"{API}/students", headers=t)).json()
    assert [x["name"] for x in mine["items"]] == ["Eight Sharma"] and mine["total"] == 1
    assert (await client.get(f"{API}/students/{s8['id']}", headers=t)).status_code == 200
    assert (await client.get(f"{API}/students/{s9['id']}", headers=t)).status_code == 404  # not their class
    # a staff member with no class and no permission sees nobody
    n = await teacher(client, h, mail, "nobody@rps.example")
    assert (await client.get(f"{API}/students", headers=n)).json()["total"] == 0
    # academic.manage sees everyone and may write
    m = await teacher(client, h, mail, "mgr@rps.example", perms=["academic.manage"])
    assert (await client.get(f"{API}/students", headers=m)).json()["total"] == 2
    assert (await client.post(f"{API}/students", headers=m, json=body)).status_code == 201


async def test_list_search_filter_and_pagination(client, school_a):
    h = school_a["headers"]
    a, b = await make_class(client, h, "8", "A"), await make_class(client, h, "8", "B")
    for i, name in enumerate(["Anil", "Bhavna", "Chetan"]):
        await enrol(
            client,
            h,
            (a if i < 2 else b)["id"],
            first=name,
            guardians=[{**GUARD, "name": f"P{name}", "phone": f"98000000{i}0"}],
        )
    got = (await client.get(f"{API}/students", headers=h)).json()
    assert got["total"] == 3 and [x["class_label"] for x in got["items"]] == ["8-A", "8-A", "8-B"]
    assert (await client.get(f"{API}/students", headers=h, params={"class_id": b["id"]})).json()["total"] == 1
    assert (await client.get(f"{API}/students", headers=h, params={"grade": "8"})).json()["total"] == 3
    assert (
        (await client.get(f"{API}/students", headers=h, params={"q": "bhav"}))
        .json()["items"][0]["name"]
        .startswith("Bhavna")
    )
    assert (await client.get(f"{API}/students", headers=h, params={"q": "PChetan"})).json()["total"] == 1  # by guardian
    assert (await client.get(f"{API}/students", headers=h, params={"q": "3"})).json()["total"] == 1  # scholar no
    page = (await client.get(f"{API}/students", headers=h, params={"limit": 2, "offset": 2})).json()
    assert page["total"] == 3 and len(page["items"]) == 1
    assert (await client.get(f"{API}/students", headers=h, params={"status": "bogus"})).status_code == 422


async def test_edit_is_audited_and_scholar_no_is_unique(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h)
    s1, s2 = await enrol(client, h, c["id"]), await enrol(client, h, c["id"], first="Diya")
    r = await client.patch(
        f"{API}/students/{s1['id']}", headers=h, json={"address": "Civil Lines", "blood_group": "O+"}
    )
    assert r.status_code == 200 and r.json()["address"] == "Civil Lines"
    log = await audit(client, h, "student.edited")
    assert {x["field"] for x in log[0]["changes"]} == {"Address", "Blood Group"}
    dup = await client.patch(f"{API}/students/{s1['id']}", headers=h, json={"scholar_no": s2["scholar_no"]})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "scholar_no_taken"
    assert (await client.patch(f"{API}/students/{s1['id']}", headers=h, json={"first_name": None})).status_code == 422
    assert (await client.patch(f"{API}/students/{s1['id']}", headers=h, json={"samagra_id": "12"})).status_code == 422


async def test_leaving_and_rejoining_keep_the_history(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h)
    s = await enrol(client, h, c["id"])
    r = await client.post(
        f"{API}/students/{s['id']}/leave", headers=h, json={"reason": "Family moved", "left_on": "2026-10-01"}
    )
    d = r.json()
    assert d["status"] == "left" and d["left_on"] == "2026-10-01" and d["current_enrollment"]["status"] == "left"
    assert (
        await client.post(f"{API}/students/{s['id']}/leave", headers=h, json={"reason": "again"})
    ).status_code == 409
    assert (await client.get(f"{API}/students", headers=h)).json()["total"] == 0  # active only by default
    assert (await client.get(f"{API}/students", headers=h, params={"status": "left"})).json()["total"] == 1
    assert (await client.get(f"{API}/students", headers=h, params={"status": "all"})).json()["total"] == 1
    log = await audit(client, h, "student.left")
    assert log[0]["sensitive"] is True and "Family moved" in log[0]["summary"]
    r = await client.post(
        f"{API}/students/{s['id']}/rejoin", headers=h, json={"class_id": c["id"], "reason": "Came back"}
    )
    d = r.json()
    assert d["status"] == "active" and d["left_on"] is None and d["current_enrollment"]["status"] == "active"
    assert [e["kind"] for e in d["history"]] == ["rejoined", "left", "admitted"]
    assert (await client.get(f"{API}/students/{s['id']}/history", headers=h)).json()[0]["kind"] == "rejoined"
    assert (
        await client.post(f"{API}/students/{s['id']}/rejoin", headers=h, json={"class_id": c["id"]})
    ).status_code == 409
    async with system_session() as db:
        assert await db.scalar(select(func.count()).select_from(Enrollment)) == 1  # the year's row is reused


async def test_transfer_between_sections(client, school_a):
    h = school_a["headers"]
    a, b = await make_class(client, h, "8", "A"), await make_class(client, h, "8", "B", capacity=1)
    s = await enrol(client, h, a["id"])
    other = await enrol(client, h, b["id"], first="Full")
    r = await client.post(f"{API}/students/{s['id']}/transfer", headers=h, json={"class_id": b["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "class_full"
    await client.post(f"{API}/students/{other['id']}/leave", headers=h, json={"reason": "x"})
    r = await client.post(
        f"{API}/students/{s['id']}/transfer", headers=h, json={"class_id": b["id"], "reason": "Parent request"}
    )
    d = r.json()
    assert (
        r.status_code == 200
        and d["current_enrollment"]["class_label"] == "8-B"
        and d["current_enrollment"]["roll_no"] == 1
    )
    ev = d["history"][0]
    assert ev["kind"] == "class_changed" and ev["from_class"] == "8-A" and ev["to_class"] == "8-B"
    assert (
        await client.post(f"{API}/students/{s['id']}/transfer", headers=h, json={"class_id": b["id"]})
    ).status_code == 409
    assert (await audit(client, h, "student.transferred"))[0]["changes"][0]["to"] == "8-B"
    # a class of another year cannot be used
    y = (
        await client.post(
            f"{API}/academic/years",
            headers=h,
            json={"name": "2027-28", "starts_on": "2027-04-01", "ends_on": "2028-03-31"},
        )
    ).json()
    nxt = (
        await client.post(f"{API}/academic/classes", headers=h, json={"grade": "9", "academic_year_id": y["id"]})
    ).json()
    r = await client.post(f"{API}/students/{s['id']}/transfer", headers=h, json={"class_id": nxt["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "other_year"


async def test_photo_uses_a_confirmed_student_photo_upload(client, school_a):
    from app.models.file import Attachment
    from app.services.storage import StoredObject, get_storage

    h = school_a["headers"]
    c = await make_class(client, h)
    s = await enrol(client, h, c["id"])
    up = (
        await client.post(
            f"{API}/files/upload-url",
            headers=h,
            json={"purpose": "student_photo", "filename": "a.jpg", "content_type": "image/jpeg", "size_bytes": 1000},
        )
    ).json()
    r = await client.put(f"{API}/students/{s['id']}/photo", headers=h, json={"file_id": up["id"]})
    assert r.status_code == 422  # not confirmed yet
    async with system_session() as db:
        key = (await db.get(Attachment, __import__("uuid").UUID(up["id"]))).storage_key
    get_storage().objects[key] = StoredObject(size=1000, content_type="image/jpeg")
    assert (await client.post(f"{API}/files/{up['id']}/complete", headers=h)).status_code == 200
    r = await client.put(f"{API}/students/{s['id']}/photo", headers=h, json={"file_id": up["id"]})
    assert r.status_code == 200 and r.json()["photo_url"].startswith("https://storage.test/download/")
    assert (await client.delete(f"{API}/students/{s['id']}/photo", headers=h)).json()["photo_url"] is None
    doc = (
        await client.post(
            f"{API}/files/upload-url",
            headers=h,
            json={
                "purpose": "student_document",
                "filename": "a.pdf",
                "content_type": "application/pdf",
                "size_bytes": 10,
            },
        )
    ).json()
    assert (
        await client.put(f"{API}/students/{s['id']}/photo", headers=h, json={"file_id": doc["id"]})
    ).status_code == 422


async def test_guardians_siblings_and_primary(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h)
    s1 = await enrol(client, h, c["id"], guardians=[{**GUARD, "email": "Rakesh@Example.com"}])
    s2 = await enrol(client, h, c["id"], first="Diya", guardians=[{**GUARD, "email": "rakesh@example.com"}])
    assert s1["guardians"][0]["id"] == s2["guardians"][0]["id"]  # the same email is the same parent
    async with system_session() as db:
        assert await db.scalar(select(func.count()).select_from(Guardian)) == 1
    r = await client.post(
        f"{API}/students/{s1['id']}/guardians",
        headers=h,
        json={"name": "Sunita Sharma", "phone": "9000000001", "relation": "mother", "is_primary": True},
    )
    assert r.status_code == 201
    gs = {g["name"]: g for g in r.json()}
    assert gs["Sunita Sharma"]["is_primary"] is True and gs["Rakesh Sharma"]["is_primary"] is False
    r = await client.patch(
        f"{API}/students/{s1['id']}/guardians/{gs['Rakesh Sharma']['id']}", headers=h, json={"is_emergency": True}
    )
    assert {g["name"]: g["is_emergency"] for g in r.json()}["Rakesh Sharma"] is True
    r = await client.delete(f"{API}/students/{s1['id']}/guardians/{gs['Sunita Sharma']['id']}", headers=h)
    assert [g["name"] for g in r.json()] == ["Rakesh Sharma"] and r.json()[0]["is_primary"] is True
    r = await client.patch(f"{API}/parents/{gs['Rakesh Sharma']['id']}", headers=h, json={"occupation": "Farmer"})
    assert r.status_code == 200


async def test_enrol_hooks_run_inside_the_transaction(client, school_a):
    from app.core.errors import Conflict
    from app.services import enrolment

    seen = []

    async def ok(db, ctx):
        seen.append((ctx.student.first_name, ctx.fee_options))

    async def boom(db, ctx):
        raise Conflict("fees said no", code="fees_no")

    saved = list(enrolment.ENROL_HOOKS)  # the fees module registers a real hook; keep it out of this test
    enrolment.ENROL_HOOKS.clear()
    h = school_a["headers"]
    c = await make_class(client, h)
    enrolment.register_enrol_hook(ok)
    try:
        await enrol(client, h, c["id"], fee_options=[{"head": "transport", "amount_paise": 50000}])
        assert seen == [("Aarav", [{"head": "transport", "amount_paise": 50000}])]
        enrolment.register_enrol_hook(boom)
        r = await client.post(
            f"{API}/students", headers=h, json={"first_name": "Z", "class_id": c["id"], "guardians": [GUARD]}
        )
        assert r.status_code == 409 and r.json()["error"]["code"] == "fees_no"
        async with system_session() as db:
            assert await db.scalar(select(func.count()).select_from(Student)) == 1  # the failed one left nothing
    finally:
        enrolment.ENROL_HOOKS[:] = saved


async def test_status_helpers_for_other_modules(client, school_a):
    from app.models.academic import SchoolClass
    from app.services import students as svc
    from app.services.audit import Actor

    h = school_a["headers"]
    c = await make_class(client, h)
    s = await enrol(client, h, c["id"])
    import uuid

    async with system_session() as db:
        st = await svc.get_student_or_404(db, uuid.UUID(s["id"]))
        assert (await svc.class_of_student(db, st.id)).id == uuid.UUID(c["id"])
        actor = Actor(None, "Certificates", "System", st.school_id)
        await svc.mark_tc_issued(db, actor, st, tc_number="TC-2026-001")
        assert st.status == "tc_issued" and await svc.class_of_student(db, st.id) is None
        assert (await svc.class_of_student(db, st.id, active_only=False)).id == uuid.UUID(c["id"])
        kinds = (await db.scalars(select(StudentEvent.kind).where(StudentEvent.student_id == st.id))).all()
        assert set(kinds) == {"admitted", "tc_issued"}
        assert await db.get(SchoolClass, uuid.UUID(c["id"]))
