from conftest import API, STRONG, add_staff, bearer, sign_in, staff_headers, temp_password_from

FULL = ("academic.manage", "fees.manage", "library.manage", "people.manage")


async def test_adding_staff_and_sending_the_login(client, school_a, mail):
    s = await add_staff(
        client, school_a["headers"], mail, email="r1@rps.example", name="Rajiv Mishra", department="Maths"
    )
    assert s["employee_code"] == "EMP002" and s["invite_status"] == "sent" and s["is_admin"] is False
    body = mail.last_to("r1@rps.example").body
    assert "Rajiv Mishra" in body and "Temporary password:" in body and "Rewa Public School" in body
    h = await staff_headers(client, mail, "r1@rps.example")
    assert (await client.get(f"{API}/auth/me", headers=h)).json()["must_change_password"] is False


async def test_the_temporary_password_is_never_stored_readable(client, school_a, mail):
    from sqlalchemy import select

    from app.db.session import system_session
    from app.models.user import User

    await add_staff(client, school_a["headers"], mail, email="r2@rps.example")
    tmp = temp_password_from(mail, "r2@rps.example")
    async with system_session() as db:
        u = await db.scalar(select(User).where(User.email == "r2@rps.example"))
        assert tmp not in (u.password_hash or "") and u.password_hash.startswith("$argon2")


async def test_each_send_creates_a_fresh_password(client, school_a, mail):
    s = await add_staff(client, school_a["headers"], mail, email="r3@rps.example")
    first = temp_password_from(mail, "r3@rps.example")
    r = await client.post(f"{API}/staff/{s['id']}/send-login", headers=school_a["headers"])
    assert r.json() == {"sent": 1, "failed": 0}
    second = temp_password_from(mail, "r3@rps.example")
    assert first != second
    assert (
        await client.post(f"{API}/auth/login", json={"email": "r3@rps.example", "password": first})
    ).status_code == 401
    await sign_in(client, "r3@rps.example", second)


async def test_a_failed_email_is_recorded_and_can_be_retried(client, school_a, mail):
    mail.fail = True
    s = await add_staff(client, school_a["headers"], mail, email="r4@rps.example", send=True)
    assert s["invite_status"] == "failed"
    mail.fail = False
    r = await client.post(f"{API}/staff/{s['id']}/send-login", headers=school_a["headers"])
    assert r.json()["sent"] == 1
    listed = {x["email"]: x for x in (await client.get(f"{API}/staff", headers=school_a["headers"])).json()["items"]}
    assert listed["r4@rps.example"]["invite_status"] == "sent"


async def test_send_login_to_everyone_still_pending(client, school_a, mail):
    for i in range(3):
        await add_staff(client, school_a["headers"], mail, email=f"p{i}@rps.example", send=False)
    r = await client.post(f"{API}/staff/send-login", headers=school_a["headers"], json={})
    assert r.json() == {"sent": 3, "failed": 0}
    assert all(mail.last_to(f"p{i}@rps.example") for i in range(3))
    again = await client.post(f"{API}/staff/send-login", headers=school_a["headers"], json={})
    assert again.json() == {"sent": 0, "failed": 0}  # nobody left waiting


async def test_bulk_add_from_a_list(client, school_a, mail):
    rows = [
        {"name": "Asha Verma", "designation": "Maths teacher", "email": "asha@rps.example"},
        {"name": "Rahul Soni", "designation": "Peon", "email": "rahul@rps.example"},
    ]
    r = await client.post(f"{API}/staff/bulk", headers=school_a["headers"], json={"rows": rows, "send_login": True})
    assert r.status_code == 201 and r.json()["total"] == 2
    assert mail.last_to("asha@rps.example") and mail.last_to("rahul@rps.example")
    dup = await client.post(f"{API}/staff/bulk", headers=school_a["headers"], json={"rows": [rows[0], rows[0]]})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "duplicate_in_list"


async def test_email_must_be_unique_across_the_whole_platform(client, school_a, school_b, mail):
    await add_staff(client, school_a["headers"], mail, email="same@x.example")
    r = await client.post(
        f"{API}/staff", headers=school_b["headers"], json={"name": "Dup", "email": "SAME@x.example", "designation": "T"}
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_taken"


async def test_permissions_can_be_given_and_are_audited_as_sensitive(client, school_a, mail):
    s = await add_staff(client, school_a["headers"], mail, email="acc@rps.example", name="Suresh Tiwari")
    r = await client.put(
        f"{API}/staff/{s['id']}/permissions",
        headers=school_a["headers"],
        json={"permissions": ["fees.manage", "library.manage"]},
    )
    assert r.status_code == 200 and r.json()["permissions"] == ["fees.manage", "library.manage"]
    log = (
        await client.get(f"{API}/audit", headers=school_a["headers"], params={"action": "staff.access_changed"})
    ).json()["items"]
    assert log and log[0]["sensitive"] is True and log[0]["changes"][0]["to"] == "Fees, Library"
    # take one away again
    r = await client.put(
        f"{API}/staff/{s['id']}/permissions", headers=school_a["headers"], json={"permissions": ["fees.manage"]}
    )
    assert r.json()["permissions"] == ["fees.manage"]


async def test_permission_changes_take_effect_immediately(client, school_a, mail):
    s = await add_staff(client, school_a["headers"], mail, email="soon@rps.example")
    h = await staff_headers(client, mail, "soon@rps.example")
    assert (await client.get(f"{API}/staff", headers=h)).status_code == 403  # no Staff permission yet
    await client.put(
        f"{API}/staff/{s['id']}/permissions", headers=school_a["headers"], json={"permissions": ["staff.manage"]}
    )
    assert (await client.get(f"{API}/staff", headers=h)).status_code == 200  # same token, now allowed
    await client.put(f"{API}/staff/{s['id']}/permissions", headers=school_a["headers"], json={"permissions": []})
    assert (await client.get(f"{API}/staff", headers=h)).status_code == 403


async def test_a_school_always_keeps_one_person_who_manages_people(client, school_a, mail):
    admin = school_a["headers"]
    me = (await client.get(f"{API}/auth/me", headers=admin)).json()
    assert (
        set(FULL) <= set(me["permissions"]) and me["is_admin"] is True
    )  # all four; `staff.manage` rides along for old apps
    # the only people manager can neither lose that permission nor be removed
    r = await client.put(f"{API}/staff/{me['id']}/permissions", headers=admin, json={"permissions": ["fees.manage"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "last_people_manager"
    assert (await client.delete(f"{API}/staff/{me['id']}", headers=admin)).status_code in (403, 409)
    # a second person given People & access makes that possible
    s = await add_staff(client, admin, mail, email="deputy@rps.example", permissions=["people.manage"])
    assert s["is_admin"] is False
    ok = await client.put(f"{API}/staff/{me['id']}/permissions", headers=admin, json={"permissions": ["fees.manage"]})
    assert ok.status_code == 200 and ok.json()["is_admin"] is False
    # and now the deputy is the last one
    h = await staff_headers(client, mail, "deputy@rps.example")
    r = await client.put(f"{API}/staff/{s['id']}/permissions", headers=h, json={"permissions": []})
    assert r.status_code == 409 and r.json()["error"]["code"] == "last_people_manager"


async def test_four_permissions_and_what_each_opens(client, school_a, mail):
    admin = school_a["headers"]
    full = await add_staff(client, admin, mail, email="full@rps.example", permissions=list(FULL))
    assert full["is_admin"] is True
    acad = await add_staff(client, admin, mail, email="ac@rps.example", permissions=["academic.manage"])
    ppl = await add_staff(client, admin, mail, email="pp@rps.example", permissions=["people.manage"])
    h_ac = await staff_headers(client, mail, "ac@rps.example")
    h_pp = await staff_headers(client, mail, "pp@rps.example")
    # staff accounts, permissions and the audit log are People & access
    assert (await client.get(f"{API}/staff", headers=h_ac)).status_code == 403
    assert (await client.get(f"{API}/staff", headers=h_pp)).status_code == 200
    assert (await client.get(f"{API}/audit", headers=h_pp)).status_code == 200
    assert (await client.get(f"{API}/audit", headers=h_ac)).status_code == 403
    # the school's bill and logo need all four
    assert (await client.get(f"{API}/school/billing", headers=h_pp)).status_code == 403
    assert (await client.get(f"{API}/school/billing", headers=admin)).status_code == 200
    assert acad["is_admin"] is False and ppl["is_admin"] is False
    # the retired staff.manage is read as people.manage; anything unknown is refused
    ok = await client.put(
        f"{API}/staff/{acad['id']}/permissions", headers=admin, json={"permissions": ["staff.manage"]}
    )
    assert ok.status_code == 200 and "people.manage" in ok.json()["permissions"]
    bad = await client.put(f"{API}/staff/{acad['id']}/permissions", headers=admin, json={"permissions": ["nope"]})
    assert bad.status_code == 422


async def test_access_options_and_presets(client, school_a, mail):
    admin = school_a["headers"]
    o = (await client.get(f"{API}/staff/access-options", headers=admin)).json()
    assert [p["key"] for p in o["permissions"]] == [
        "academic.manage",
        "fees.manage",
        "library.manage",
        "people.manage",
    ]
    presets = {p["key"]: p["permissions"] for p in o["presets"]}
    assert (
        sorted(presets["full"]) == sorted(FULL)
        and presets["teacher"] == []
        and presets["accountant"] == ["fees.manage"]
    )
    await add_staff(client, admin, mail, email="t@rps.example")
    t = await staff_headers(client, mail, "t@rps.example")
    assert (await client.get(f"{API}/staff/access-options", headers=t)).status_code == 403


async def test_home_layout_follows_the_permissions(client, school_a, mail):
    admin = school_a["headers"]
    full = (await client.get(f"{API}/home/layout", headers=admin)).json()
    assert full["tabs"] == ["home", "messages", "academic", "fees", "library"]
    assert full["menu"] == ["people"] and full["blocks"][:3] == ["my_day", "my_classes", "notices"]
    assert full["blocks"][3:] == ["academic", "fees", "library", "people"]
    await add_staff(client, admin, mail, email="t@rps.example")
    await add_staff(client, admin, mail, email="acc@rps.example", permissions=["fees.manage"])
    t = await staff_headers(client, mail, "t@rps.example")
    acc = await staff_headers(client, mail, "acc@rps.example")
    teacher = (await client.get(f"{API}/home/layout", headers=t)).json()
    assert teacher["tabs"] == ["home", "messages"] and teacher["menu"] == []
    assert teacher["blocks"] == ["my_day", "my_classes", "notices"] and teacher["has_assignments"] is False
    fees_only = (await client.get(f"{API}/home/layout", headers=acc)).json()
    assert fees_only["tabs"] == ["home", "messages", "fees"] and fees_only["blocks"][-1] == "fees"
    assert (await client.get(f"{API}/home/layout")).status_code == 401


async def test_removing_staff_blocks_their_login(client, school_a, mail):
    s = await add_staff(client, school_a["headers"], mail, email="gone@rps.example")
    h = await staff_headers(client, mail, "gone@rps.example")
    assert (await client.delete(f"{API}/staff/{s['id']}", headers=school_a["headers"])).status_code == 204
    assert (await client.get(f"{API}/auth/me", headers=h)).status_code == 401
    assert (
        await client.post(f"{API}/auth/login", json={"email": "gone@rps.example", "password": STRONG})
    ).status_code == 401


async def test_edit_staff_details_is_audited(client, school_a, mail):
    s = await add_staff(client, school_a["headers"], mail, email="ed@rps.example")
    r = await client.patch(
        f"{API}/staff/{s['id']}",
        headers=school_a["headers"],
        json={"designation": "Head of Maths", "phone": "90000 11111"},
    )
    assert r.json()["designation"] == "Head of Maths"
    log = (await client.get(f"{API}/audit", headers=school_a["headers"], params={"action": "staff.edited"})).json()[
        "items"
    ]
    assert {c["field"] for c in log[0]["changes"]} == {"Phone", "Designation"}


async def test_validation_errors_use_the_standard_shape(client, school_a):
    r = await client.post(
        f"{API}/staff", headers=school_a["headers"], json={"name": "x", "email": "not-an-email", "designation": ""}
    )
    assert r.status_code == 422
    body = r.json()["error"]
    assert body["code"] == "validation_error" and {d["field"] for d in body["details"]} >= {
        "name",
        "email",
        "designation",
    }


async def test_a_parent_login_cannot_use_staff_routes(client, school_a):
    from app.core.security import hash_password
    from app.db.session import system_session
    from app.models.user import User

    async with system_session() as db:
        db.add(
            User(
                school_id=school_a["school"]["id"],
                kind="parent",
                name="Parent",
                email="p@x.example",
                must_change_password=False,
                password_hash=await hash_password(STRONG),
            )
        )
    h = bearer(await sign_in(client, "p@x.example", STRONG))
    assert (await client.get(f"{API}/staff", headers=h)).status_code == 403
    assert (await client.get(f"{API}/academic/classes", headers=h)).status_code == 403
