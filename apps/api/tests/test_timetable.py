import pytest
from conftest import API
from studentkit import GUARD, enrol, make_class, parent_headers
from timekit import MON, SUN, TUE, period, school_setup, slot, staff


async def test_periods_crud_and_validation(client, school_a):
    h = school_a["headers"]
    p1 = await period(client, h, 1)
    dup = await client.post(
        f"{API}/timetable/periods",
        headers=h,
        json={"number": 1, "name": "x", "starts_at": "11:00:00", "ends_at": "11:30:00"},
    )
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "period_number_taken"
    overlap = await client.post(
        f"{API}/timetable/periods",
        headers=h,
        json={"number": 2, "name": "x", "starts_at": "09:30:00", "ends_at": "10:00:00"},
    )
    assert overlap.status_code == 409 and overlap.json()["error"]["code"] == "period_overlap"
    backwards = await client.post(
        f"{API}/timetable/periods",
        headers=h,
        json={"number": 3, "name": "x", "starts_at": "10:00:00", "ends_at": "09:00:00"},
    )
    assert backwards.status_code == 422
    p2 = await period(client, h, 2, "09:40:00", "10:20:00")
    r = await client.patch(f"{API}/timetable/periods/{p2['id']}", headers=h, json={"starts_at": "09:20:00"})
    assert r.status_code == 409  # now overlaps period 1
    r = await client.patch(f"{API}/timetable/periods/{p2['id']}", headers=h, json={"name": "Second"})
    assert r.json()["name"] == "Second"
    assert [p["number"] for p in (await client.get(f"{API}/timetable/periods", headers=h)).json()] == [1, 2]
    assert (await client.delete(f"{API}/timetable/periods/{p1['id']}", headers=h)).status_code == 204


async def test_slot_conflicts_class_and_teacher(client, school_a, mail):
    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    other = await make_class(client, h, section="B")
    first = await slot(client, h, s["cls"]["id"], 1, s["p1"]["id"], s["maths"]["id"], s["asha"]["id"])
    assert first["class_label"] == "8-A" and first["staff_name"] == "Asha" and first["period_number"] == 1
    # the class is already busy then
    r = await client.post(
        f"{API}/timetable/slots",
        headers=h,
        json={
            "class_id": s["cls"]["id"],
            "weekday": 1,
            "period_id": s["p1"]["id"],
            "subject_id": s["maths"]["id"],
            "staff_id": s["bhanu"]["id"],
        },
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "class_busy"
    # the teacher is already in 8-A
    r = await client.post(
        f"{API}/timetable/slots",
        headers=h,
        json={
            "class_id": other["id"],
            "weekday": 1,
            "period_id": s["p1"]["id"],
            "subject_id": s["maths"]["id"],
            "staff_id": s["asha"]["id"],
        },
    )
    err = r.json()["error"]
    assert r.status_code == 409 and err["code"] == "teacher_busy" and err["details"]["class"] == "8-A"
    # a different period or day is fine
    await slot(client, h, other["id"], 1, s["p2"]["id"], s["maths"]["id"], s["asha"]["id"])
    await slot(client, h, other["id"], 2, s["p1"]["id"], s["maths"]["id"], s["asha"]["id"])
    # moving a lesson to a busy teacher is refused too, own slot is not a conflict
    mine = await client.patch(f"{API}/timetable/slots/{first['id']}", headers=h, json={"staff_id": s["asha"]["id"]})
    assert mine.status_code == 200
    bhanu_slot = await slot(client, h, other["id"], 3, s["p1"]["id"], s["maths"]["id"], s["bhanu"]["id"])
    r = await client.patch(f"{API}/timetable/slots/{bhanu_slot['id']}", headers=h, json={"staff_id": s["asha"]["id"]})
    assert r.status_code == 200  # Asha has nothing on Wednesday period 1
    r = await client.patch(f"{API}/timetable/slots/{first['id']}", headers=h, json={"staff_id": s["bhanu"]["id"]})
    assert r.status_code == 200 and r.json()["staff_name"] == "Bhanu"


async def test_sunday_and_bad_references_are_rejected(client, school_a, mail):
    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    body = {
        "class_id": s["cls"]["id"],
        "weekday": 7,
        "period_id": s["p1"]["id"],
        "subject_id": s["maths"]["id"],
        "staff_id": s["asha"]["id"],
    }
    assert (await client.post(f"{API}/timetable/slots", headers=h, json=body)).status_code == 422
    import uuid

    for key in ("class_id", "period_id", "subject_id", "staff_id"):
        r = await client.post(f"{API}/timetable/slots", headers=h, json=body | {"weekday": 1, key: str(uuid.uuid4())})
        assert r.status_code == 404, key


async def test_slot_race_is_stopped_by_the_database(client, school_a, mail):
    import asyncio

    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    other = await make_class(client, h, section="B")

    def body(cid):
        return {
            "class_id": cid,
            "weekday": 4,
            "period_id": s["p1"]["id"],
            "subject_id": s["maths"]["id"],
            "staff_id": s["asha"]["id"],
        }

    rs = await asyncio.gather(
        client.post(f"{API}/timetable/slots", headers=h, json=body(s["cls"]["id"])),
        client.post(f"{API}/timetable/slots", headers=h, json=body(other["id"])),
    )
    assert sorted(r.status_code for r in rs) == [201, 409]


async def test_permissions_for_timetable(client, school_a, mail):
    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    th = s["asha"]["headers"]  # no permissions
    body = {
        "class_id": s["cls"]["id"],
        "weekday": 1,
        "period_id": s["p1"]["id"],
        "subject_id": s["maths"]["id"],
        "staff_id": s["asha"]["id"],
    }
    assert (await client.post(f"{API}/timetable/slots", headers=th, json=body)).status_code == 403
    assert (
        await client.post(
            f"{API}/timetable/periods",
            headers=th,
            json={"number": 9, "name": "x", "starts_at": "15:00:00", "ends_at": "15:30:00"},
        )
    ).status_code == 403
    sl = await slot(client, h, s["cls"]["id"], 1, s["p1"]["id"], s["maths"]["id"], s["asha"]["id"])
    # any teacher may read class and own timetables
    t = (await client.get(f"{API}/timetable/classes/{s['cls']['id']}", headers=th)).json()
    assert t["class_label"] == "8-A" and len(t["slots"]) == 1 and len(t["periods"]) == 2
    assert (await client.get(f"{API}/timetable/me", headers=th)).json()["slots"][0]["id"] == sl["id"]
    assert (await client.delete(f"{API}/timetable/slots/{sl['id']}", headers=th)).status_code == 403
    # another teacher's timetable needs a permission, own does not
    assert (await client.get(f"{API}/timetable/staff/{s['bhanu']['id']}", headers=th)).status_code == 403
    assert (await client.get(f"{API}/timetable/staff/{s['asha']['id']}", headers=th)).status_code == 200
    assert (await client.get(f"{API}/timetable/staff/{s['asha']['id']}", headers=h)).json()["staff_name"] == "Asha"
    # the academic.manage permission is enough to edit
    mgr = await staff(client, h, mail, "mgr@rps.example", perms=["academic.manage"])
    assert (await client.delete(f"{API}/timetable/slots/{sl['id']}", headers=mgr["headers"])).status_code == 204
    # a period in use cannot be deleted
    sl = await slot(client, h, s["cls"]["id"], 1, s["p1"]["id"], s["maths"]["id"], s["asha"]["id"])
    r = await client.delete(f"{API}/timetable/periods/{s['p1']['id']}", headers=h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "period_in_use"
    assert sl


async def test_absence_cover_and_my_day(client, school_a, mail):
    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    cid, mid = s["cls"]["id"], s["maths"]["id"]
    a1 = await slot(client, h, cid, 1, s["p1"]["id"], mid, s["asha"]["id"])
    await slot(client, h, cid, 1, s["p2"]["id"], mid, s["asha"]["id"])
    b = await make_class(client, h, section="B")
    await slot(client, h, b["id"], 1, s["p1"]["id"], mid, s["bhanu"]["id"])  # Bhanu busy in period 1
    sm = await staff(client, h, mail, "sm@rps.example", perms=["staff.manage"])
    # only staff.manage marks absence
    r = await client.post(
        f"{API}/timetable/absences", headers=s["bhanu"]["headers"], json={"staff_id": s["asha"]["id"], "absent_on": MON}
    )
    assert r.status_code == 403
    r = await client.post(
        f"{API}/timetable/absences",
        headers=sm["headers"],
        json={"staff_id": s["asha"]["id"], "absent_on": MON, "reason": "Fever"},
    )
    assert r.status_code == 201 and r.json()["slots_to_cover"] == 2 and r.json()["slots_covered"] == 0
    again = await client.post(
        f"{API}/timetable/absences", headers=sm["headers"], json={"staff_id": s["asha"]["id"], "absent_on": MON}
    )
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_absent"
    cover = (await client.get(f"{API}/timetable/cover", headers=sm["headers"], params={"on": MON})).json()
    assert [(c["slot"]["period_number"], c["substitute_name"]) for c in cover] == [(1, None), (2, None)]
    # free teachers in period 1: Chetan (and the managers) but not Asha (absent) or Bhanu (teaching)
    free = (
        await client.get(
            f"{API}/timetable/free-teachers", headers=sm["headers"], params={"on": MON, "period_id": s["p1"]["id"]}
        )
    ).json()
    names = {f["name"] for f in free}
    assert "Chetan" in names and "Asha" not in names and "Bhanu" not in names

    def sub(slot_id, staff_id, on=MON, who=sm):
        return client.post(
            f"{API}/timetable/substitutions",
            headers=who["headers"],
            json={"slot_id": slot_id, "covers_on": on, "substitute_staff_id": staff_id},
        )

    # busy / absent / wrong day / not absent / permission
    r = await sub(a1["id"], s["bhanu"]["id"])
    assert r.status_code == 409 and r.json()["error"]["code"] == "substitute_busy"
    assert (await sub(a1["id"], s["asha"]["id"])).json()["error"]["code"] == "invalid_substitute"
    assert (await sub(a1["id"], s["chetan"]["id"], on=TUE)).json()["error"]["code"] == "wrong_weekday"
    assert (await sub(a1["id"], s["chetan"]["id"], on=SUN)).json()["error"]["code"] == "wrong_weekday"
    assert (await sub(a1["id"], s["chetan"]["id"], who=s["bhanu"])).status_code == 403
    ok = await sub(a1["id"], s["chetan"]["id"])
    assert (
        ok.status_code == 201 and ok.json()["substitute_name"] == "Chetan" and ok.json()["absent_staff_name"] == "Asha"
    )
    # the same person cannot be given a second class in the same period
    cls_c = await make_class(client, h, section="C")
    await slot(client, h, cls_c["id"], 1, s["p1"]["id"], mid, sm["id"])  # a slot of sm, not absent
    # reassign replaces
    r = await sub(a1["id"], s["chetan"]["id"])
    assert r.status_code in (200, 201)
    listed = (
        await client.get(f"{API}/timetable/substitutions", headers=s["bhanu"]["headers"], params={"on": MON})
    ).json()
    assert len(listed) == 1 and listed[0]["slot"]["id"] == a1["id"]
    # Chetan's day: covering Asha's 8-A period 1
    day = (await client.get(f"{API}/timetable/me/day", headers=s["chetan"]["headers"], params={"on": MON})).json()
    assert [(e["role"], e["absent_staff_name"]) for e in day["entries"]] == [("covering", "Asha")]
    # Asha's day: period 1 covered by Chetan, period 2 still uncovered (teaching)
    day = (await client.get(f"{API}/timetable/me/day", headers=s["asha"]["headers"], params={"on": MON})).json()
    assert [(e["slot"]["period_number"], e["role"], e["substitute_name"]) for e in day["entries"]] == [
        (1, "covered", "Chetan"),
        (2, "teaching", None),
    ]
    # Sunday is empty; a day with no absence has Asha teaching
    assert (await client.get(f"{API}/timetable/me/day", headers=s["asha"]["headers"], params={"on": SUN})).json()[
        "entries"
    ] == []
    # cover now shows the substitute
    cover = (await client.get(f"{API}/timetable/cover", headers=sm["headers"], params={"on": MON})).json()
    assert cover[0]["substitute_name"] == "Chetan" and cover[1]["substitute_name"] is None
    ab = (await client.get(f"{API}/timetable/absences", headers=sm["headers"], params={"on": MON})).json()
    assert ab["total"] == 1 and ab["items"][0]["slots_covered"] == 1
    # an absent substitute is refused; un-marking an absence cancels its cover
    await client.post(
        f"{API}/timetable/absences", headers=sm["headers"], json={"staff_id": s["chetan"]["id"], "absent_on": MON}
    )
    p2_slot = cover[1]["slot"]["id"]
    assert (await sub(p2_slot, s["chetan"]["id"])).json()["error"]["code"] == "substitute_absent"
    r = await client.delete(f"{API}/timetable/absences/{ab['items'][0]['id']}", headers=sm["headers"])
    assert r.status_code == 204
    assert (await client.get(f"{API}/timetable/substitutions", headers=sm["headers"], params={"on": MON})).json() == []
    # a slot whose teacher is not absent cannot be covered
    assert (await sub(a1["id"], s["bhanu"]["id"])).json()["error"]["code"] == "not_absent"


async def test_substitute_cannot_cover_two_classes_in_one_period(client, school_a, mail):
    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    mid = s["maths"]["id"]
    b = await make_class(client, h, section="B")
    asha_slot = await slot(client, h, s["cls"]["id"], 1, s["p1"]["id"], mid, s["asha"]["id"])
    bhanu_slot = await slot(client, h, b["id"], 1, s["p1"]["id"], mid, s["bhanu"]["id"])
    for who in ("asha", "bhanu"):
        r = await client.post(f"{API}/timetable/absences", headers=h, json={"staff_id": s[who]["id"], "absent_on": MON})
        assert r.status_code == 201
    body = {"covers_on": MON, "substitute_staff_id": s["chetan"]["id"]}
    assert (
        await client.post(f"{API}/timetable/substitutions", headers=h, json=body | {"slot_id": asha_slot["id"]})
    ).status_code == 201
    r = await client.post(f"{API}/timetable/substitutions", headers=h, json=body | {"slot_id": bhanu_slot["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "substitute_busy"


async def test_parent_sees_timetable_with_todays_substitute(client, school_a, mail):
    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    mid = s["maths"]["id"]
    a1 = await slot(client, h, s["cls"]["id"], 1, s["p1"]["id"], mid, s["asha"]["id"])
    await slot(client, h, s["cls"]["id"], 1, s["p2"]["id"], mid, s["bhanu"]["id"])
    kid = await enrol(client, h, s["cls"]["id"], guardians=[{**GUARD, "email": "p@x.example"}])
    other_class = await make_class(client, h, section="Z")
    stranger = await enrol(
        client, h, other_class["id"], first="Zed", guardians=[{**GUARD, "name": "Other", "email": "o@x.example"}]
    )
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    ph = await parent_headers(client, mail, "p@x.example")
    await client.post(f"{API}/timetable/absences", headers=h, json={"staff_id": s["asha"]["id"], "absent_on": MON})
    await client.post(
        f"{API}/timetable/substitutions",
        headers=h,
        json={"slot_id": a1["id"], "covers_on": MON, "substitute_staff_id": s["chetan"]["id"]},
    )
    t = (await client.get(f"{API}/parent/children/{kid['id']}/timetable", headers=ph, params={"on": MON})).json()
    assert t["class_label"] == "8-A" and len(t["slots"]) == 2 and len(t["periods"]) == 2
    assert [(e["slot"]["period_number"], e["teacher_name"], e["substitute_name"]) for e in t["today"]] == [
        (1, "Asha", "Chetan"),
        (2, "Bhanu", None),
    ]
    # another day has no substitute, Sunday nothing
    t = (await client.get(f"{API}/parent/children/{kid['id']}/timetable", headers=ph, params={"on": TUE})).json()
    assert t["today"] == []
    # another family's child is a 404; staff cannot use the parent route; parents cannot use staff routes
    assert (await client.get(f"{API}/parent/children/{stranger['id']}/timetable", headers=ph)).status_code == 404
    assert (await client.get(f"{API}/parent/children/{kid['id']}/timetable", headers=h)).status_code == 403
    assert (await client.get(f"{API}/timetable/classes/{s['cls']['id']}", headers=ph)).status_code == 403
    assert (await client.get(f"{API}/timetable/me/day", headers=ph)).status_code == 403
    # a child who left keeps a read-only view
    await client.post(f"{API}/students/{kid['id']}/leave", headers=h, json={"reason": "moved"})
    assert (await client.get(f"{API}/parent/children/{kid['id']}/timetable", headers=ph)).status_code == 200


async def test_changing_the_teacher_cancels_stale_cover(client, school_a, mail):
    h = school_a["headers"]
    s = await school_setup(client, h, mail)
    a1 = await slot(client, h, s["cls"]["id"], 1, s["p1"]["id"], s["maths"]["id"], s["asha"]["id"])
    await client.post(f"{API}/timetable/absences", headers=h, json={"staff_id": s["asha"]["id"], "absent_on": MON})
    await client.post(
        f"{API}/timetable/substitutions",
        headers=h,
        json={"slot_id": a1["id"], "covers_on": MON, "substitute_staff_id": s["chetan"]["id"]},
    )
    await client.patch(f"{API}/timetable/slots/{a1['id']}", headers=h, json={"staff_id": s["bhanu"]["id"]})
    assert (await client.get(f"{API}/timetable/substitutions", headers=h, params={"on": MON})).json() == []
    # deleting a slot works with cover recorded and the changes are audited
    audit = (await client.get(f"{API}/audit", headers=h, params={"q": "Chetan"})).json()["items"]
    assert any(a["action"] == "substitution.assigned" for a in audit)


@pytest.mark.parametrize("path", ["/timetable/periods", "/timetable/me", "/timetable/cover"])
async def test_signed_out_is_401(client, path):
    assert (await client.get(f"{API}{path}")).status_code == 401
