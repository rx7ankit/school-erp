from conftest import API, add_staff, bearer, sign_in
from sqlalchemy import func, select
from studentkit import GUARD, enrol, make_class, parent_headers, read_xlsx, xlsx

from app.db.session import system_session
from app.models.student import Guardian, Student
from app.models.user import User


async def family(client, h, mail, email="rakesh@example.com"):
    """Two children of one parent email in 8-A, and one child of another family."""
    c = await make_class(client, h)
    g = {**GUARD, "email": email}
    a = await enrol(client, h, c["id"], first="Aarav", guardians=[g])
    b = await enrol(client, h, c["id"], first="Diya", guardians=[g])
    other = await enrol(
        client, h, c["id"], first="Other", guardians=[{**GUARD, "name": "Mohan", "email": "mohan@example.com"}]
    )
    return c, a, b, other


async def test_one_click_login_and_the_child_switcher(client, school_a, mail):
    h = school_a["headers"]
    _, a, b, other = await family(client, h, mail)
    gid = a["guardians"][0]["id"]
    r = await client.post(f"{API}/parents/{gid}/send-login", headers=h)
    assert r.json() == {"created": 1, "sent": 1, "failed": 0, "skipped_no_email": 0}
    ph = await parent_headers(client, mail, "rakesh@example.com")
    me = (await client.get(f"{API}/auth/me", headers=ph)).json()
    assert me["kind"] == "parent" and [c["name"] for c in me["children"]] == ["Aarav Sharma", "Diya Sharma"]
    kids = (await client.get(f"{API}/parent/children", headers=ph)).json()
    assert [k["name"] for k in kids] == ["Aarav Sharma", "Diya Sharma"]
    assert kids[0]["class_label"] == "8-A" and kids[0]["relation"] == "father" and kids[0]["read_only"] is False
    d = (await client.get(f"{API}/parent/children/{b['id']}", headers=ph)).json()
    assert d["name"] == "Diya Sharma" and d["guardians"][0]["name"] == "Rakesh Sharma"
    # the parent's login row
    row = (await client.get(f"{API}/parents", headers=h, params={"q": "rakesh"})).json()["items"][0]
    assert row["login_status"] == "active" and len(row["children"]) == 2


async def test_a_parent_cannot_read_another_familys_child(client, school_a, mail):
    h = school_a["headers"]
    _, a, b, other = await family(client, h, mail)
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    ph = await parent_headers(client, mail, "rakesh@example.com")
    r = await client.get(f"{API}/parent/children/{other['id']}", headers=ph)
    assert r.status_code == 404
    # the staff routes are closed to parents
    assert (await client.get(f"{API}/students/{a['id']}", headers=ph)).status_code == 403
    assert (await client.get(f"{API}/students", headers=ph)).status_code == 403
    assert (await client.get(f"{API}/parents", headers=ph)).status_code == 403
    # and the parent routes are closed to staff
    assert (await client.get(f"{API}/parent/children", headers=h)).status_code == 403


async def test_a_child_who_left_stays_visible_but_read_only(client, school_a, mail):
    h = school_a["headers"]
    _, a, b, _ = await family(client, h, mail)
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    ph = await parent_headers(client, mail, "rakesh@example.com")
    await client.post(f"{API}/students/{a['id']}/leave", headers=h, json={"reason": "moved"})
    kids = {k["name"]: k for k in (await client.get(f"{API}/parent/children", headers=ph)).json()}
    assert kids["Aarav Sharma"]["read_only"] is True and kids["Aarav Sharma"]["class_label"] == "8-A"
    assert kids["Diya Sharma"]["read_only"] is False
    from app.services.guardians import assert_parent_child

    async with system_session() as db:
        user = await db.scalar(select(User).where(User.email == "rakesh@example.com"))
        import uuid

        assert (await assert_parent_child(db, user.id, uuid.UUID(b["id"]), writable=True)).first_name == "Diya"
        try:
            await assert_parent_child(db, user.id, uuid.UUID(a["id"]), writable=True)
            raise AssertionError("should be read only")
        except Exception as e:  # noqa: BLE001
            assert getattr(e, "code", "") == "child_read_only"


async def test_bulk_send_reaches_only_those_still_waiting_and_never_stores_the_password(client, school_a, mail):
    h = school_a["headers"]
    _, a, b, other = await family(client, h, mail)
    r = await client.post(f"{API}/parents/send-login", headers=h, json={})
    assert r.json()["sent"] == 2 and r.json()["created"] == 2  # two parents, not three children
    assert mail.last_to("rakesh@example.com") and mail.last_to("mohan@example.com")
    first = mail.last_to("rakesh@example.com").body
    await parent_headers(client, mail, "rakesh@example.com")  # Rakesh signs in
    mail.sent.clear()
    r = await client.post(f"{API}/parents/send-login", headers=h, json={})
    assert r.json()["sent"] == 0 and not mail.sent  # everyone was already sent a login
    mohan = (await client.get(f"{API}/parents", headers=h, params={"q": "mohan"})).json()["items"][0]
    r = await client.post(f"{API}/parents/send-login", headers=h, json={"guardian_ids": [mohan["guardian_id"]]})
    assert r.json()["sent"] == 1 and mail.last_to("mohan@example.com") and not mail.last_to("rakesh@example.com")
    assert first != mail.last_to("mohan@example.com").body
    async with system_session() as db:
        u = await db.scalar(select(User).where(User.email == "mohan@example.com"))
        assert u.kind == "parent" and u.password_hash.startswith("$argon2") and u.must_change_password is True


async def test_enrol_with_login_sends_the_email_and_siblings_share_it(client, school_a, mail):
    h = school_a["headers"]
    c = await make_class(client, h)
    g = {**GUARD, "email": "shared@example.com"}
    await enrol(client, h, c["id"], first="One", guardians=[g], send_login=True)
    assert len([m for m in mail.sent if m.to == "shared@example.com"]) == 1
    await enrol(client, h, c["id"], first="Two", guardians=[g], create_parent_login=True)
    async with system_session() as db:
        assert await db.scalar(select(func.count()).select_from(User).where(User.email == "shared@example.com")) == 1
        assert await db.scalar(select(func.count()).select_from(Guardian)) == 1
    ph = await parent_headers(client, mail, "shared@example.com")
    assert len((await client.get(f"{API}/parent/children", headers=ph)).json()) == 2
    # a third sibling after the parent already signed in does not reset the password
    mail.sent.clear()
    await enrol(client, h, c["id"], first="Three", guardians=[g], send_login=True)
    assert not mail.sent
    assert len((await client.get(f"{API}/parent/children", headers=ph)).json()) == 3


async def test_enrolment_is_atomic_when_the_login_fails(client, school_a, mail):
    h = school_a["headers"]
    await add_staff(client, h, mail, email="teacher@rps.example", send=False)
    c = await make_class(client, h)
    r = await client.post(
        f"{API}/students",
        headers=h,
        json={
            "first_name": "Ghost",
            "class_id": c["id"],
            "guardians": [{**GUARD, "email": "teacher@rps.example"}],
            "create_parent_login": True,
        },
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_taken"
    async with system_session() as db:
        for model in (Student, Guardian):
            assert await db.scalar(select(func.count()).select_from(model)) == 0
        from app.models.student import Enrollment, StudentEvent

        assert await db.scalar(select(func.count()).select_from(Enrollment)) == 0
        assert await db.scalar(select(func.count()).select_from(StudentEvent)) == 0
    assert (await client.get(f"{API}/audit", headers=h, params={"action": "student.admitted"})).json()["total"] == 0
    # the scholar number was not burnt either
    assert (await enrol(client, h, c["id"]))["scholar_no"] == "1"


async def test_login_needs_an_email(client, school_a, mail):
    h = school_a["headers"]
    c = await make_class(client, h)
    s = await enrol(client, h, c["id"])  # guardian has no email
    gid = s["guardians"][0]["id"]
    assert (await client.post(f"{API}/parents/{gid}/send-login", headers=h)).status_code == 422
    r = await client.post(f"{API}/parents/send-login", headers=h, json={"guardian_ids": [gid]})
    assert r.json() == {"created": 0, "sent": 0, "failed": 0, "skipped_no_email": 1}
    r = await client.post(
        f"{API}/students",
        headers=h,
        json={"first_name": "N", "class_id": c["id"], "guardians": [GUARD], "send_login": True},
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "guardian_email_required"


async def test_failed_email_is_retried_from_the_list(client, school_a, mail):
    h = school_a["headers"]
    _, a, *_ = await family(client, h, mail)
    mail.fail = True
    r = await client.post(f"{API}/parents/send-login", headers=h, json={})
    assert r.json()["failed"] == 2 and r.json()["sent"] == 0
    assert (await client.get(f"{API}/parents", headers=h, params={"login": "failed"})).json()["total"] == 2
    mail.fail = False
    r = await client.post(f"{API}/parents/send-login", headers=h, json={})  # failed ones count as waiting
    assert r.json()["sent"] == 2
    assert (await client.get(f"{API}/parents", headers=h, params={"login": "sent"})).json()["total"] == 2


async def test_parent_list_groups_rows_by_email(client, school_a, mail):
    h = school_a["headers"]
    c = await make_class(client, h)
    s1, s2, s3 = [await enrol(client, h, c["id"], first=n) for n in ("A", "B", "C")]
    rows = [
        {"scholar_no": s1["scholar_no"], "name": "Rakesh", "email": "r@example.com", "mobile": "9000000000"},
        {"scholar_no": s2["scholar_no"], "name": "Rakesh", "email": "R@example.com", "mobile": "9000000000"},
        {"scholar_no": s3["scholar_no"], "name": "Mohan", "email": "m@example.com"},
        {"scholar_no": "999", "name": "Ghost", "email": "g@example.com"},
    ]
    r = (await client.post(f"{API}/parents/list-import", headers=h, json={"rows": rows})).json()
    assert r["dry_run"] is True and r["error_rows"] == 1 and r["errors"][0]["row_no"] == 4
    assert r["parents"] == 2 and r["links"] == 3
    async with system_session() as db:
        assert await db.scalar(select(func.count()).select_from(User).where(User.kind == "parent")) == 0
    bad = await client.post(f"{API}/parents/list-import", headers=h, json={"rows": rows, "dry_run": False})
    assert bad.status_code == 409 and bad.json()["error"]["code"] == "list_has_errors"
    r = (
        await client.post(
            f"{API}/parents/list-import", headers=h, json={"rows": rows[:3], "dry_run": False, "send_login": True}
        )
    ).json()
    assert r["logins_created"] == 2 and r["sent"] == 2 and mail.last_to("r@example.com")
    ph = await parent_headers(client, mail, "r@example.com")
    assert len((await client.get(f"{API}/parent/children", headers=ph)).json()) == 2
    # the same through a file
    f = xlsx(
        [[s3["scholar_no"], "Sita", "s@example.com", "9111111111"]], ["Scholar No", "Guardian Name", "Email", "Mobile"]
    )
    from studentkit import upload

    r = await client.post(f"{API}/parents/list-import/file", headers=h, files=upload(f), params={"dry_run": "false"})
    assert r.status_code == 200 and r.json()["links"] == 1


async def test_parents_export_is_audited(client, school_a, mail):
    h = school_a["headers"]
    await family(client, h, mail)
    r = await client.get(f"{API}/parents/export", headers=h)
    rows = read_xlsx(r.content)
    assert rows[0][0] == "Parent" and len(rows) == 3
    log = (await client.get(f"{API}/audit", headers=h, params={"category": "exports"})).json()["items"]
    assert log[0]["action"] == "parents.exported"


async def test_login_for_a_parent_returns_kind_parent(client, school_a, mail):
    h = school_a["headers"]
    await family(client, h, mail)
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    ph = await parent_headers(client, mail, "mohan@example.com")
    assert (await sign_in(client, "mohan@example.com", "Parent#Pass9"))["kind"] == "parent"
    assert bearer({"access_token": "x"})  # keep import used
    assert len((await client.get(f"{API}/parent/children", headers=ph)).json()) == 1
