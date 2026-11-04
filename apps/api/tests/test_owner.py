import uuid

from conftest import API, OWNER_EMAIL, OWNER_PASSWORD, STRONG, bearer, new_school, sign_in

from app.db.session import make_session
from app.models.student import Student


async def add_students(school_id: str, n: int, status="active"):
    sid = uuid.UUID(school_id)
    db = make_session(school_id=sid)
    for i in range(n):
        db.add(Student(school_id=sid, scholar_no=f"S{uuid.uuid4().hex[:6]}", first_name=f"Child{i}", status=status))
    await db.commit()
    await db.close()


async def test_creating_a_school_sets_everything_up(client, owner, mail):
    r = await client.post(
        f"{API}/owner/schools",
        headers=owner,
        json={
            "name": "Rewa Public School",
            "city": "Rewa",
            "admin_name": "Meera Rao",
            "admin_email": "meera@rps.example",
        },
    )
    s = r.json()
    assert r.status_code == 201 and s["status"] == "active" and s["price_per_student_paise"] == 1000
    assert (
        s["slug"] == "rewa-public-school"
        and s["admin_email"] == "meera@rps.example"
        and s["admin_login_status"] == "sent"
    )
    assert mail.last_to("meera@rps.example") is not None
    # the admin signs in, is told to choose a password, and has an academic year ready
    from conftest import temp_password_from

    t = await sign_in(client, "meera@rps.example", temp_password_from(mail, "meera@rps.example"))
    me = (await client.get(f"{API}/auth/me", headers=bearer(t))).json()
    assert me["is_admin"] and me["school"]["name"] == "Rewa Public School" and me["must_change_password"]


async def test_two_schools_with_the_same_name_get_different_slugs(client, owner, mail):
    for email in ("a@x.example", "b@x.example"):
        await client.post(
            f"{API}/owner/schools",
            headers=owner,
            json={"name": "Same Name", "admin_name": "Admin", "admin_email": email},
        )
    slugs = {s["slug"] for s in (await client.get(f"{API}/owner/schools", headers=owner)).json()["items"]}
    assert slugs == {"same-name", "same-name-2"}


async def test_admin_email_must_be_new(client, owner, school_a):
    r = await client.post(
        f"{API}/owner/schools",
        headers=owner,
        json={"name": "Another", "admin_name": "X Y", "admin_email": school_a["email"].upper()},
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_taken"


async def test_admin_login_status_moves_from_sent_to_logged_in(client, owner, mail):
    r = await client.post(
        f"{API}/owner/schools",
        headers=owner,
        json={"name": "School S", "admin_name": "Ad Min", "admin_email": "ad@x.example"},
    )
    sid = r.json()["id"]
    assert (await client.get(f"{API}/owner/schools/{sid}", headers=owner)).json()["admin_login_status"] == "sent"
    from conftest import temp_password_from

    await sign_in(client, "ad@x.example", temp_password_from(mail, "ad@x.example"))
    got = (await client.get(f"{API}/owner/schools/{sid}", headers=owner)).json()
    assert got["admin_login_status"] == "logged_in" and got["admin_last_login_at"]


async def test_resend_admin_login_creates_a_new_password(client, owner, mail):
    from conftest import temp_password_from

    r = await client.post(
        f"{API}/owner/schools",
        headers=owner,
        json={"name": "School R", "admin_name": "Ad Min", "admin_email": "re@x.example"},
    )
    first = temp_password_from(mail, "re@x.example")
    assert (await client.post(f"{API}/owner/schools/{r.json()['id']}/resend-admin-login", headers=owner)).json() == {
        "sent": True
    }
    assert temp_password_from(mail, "re@x.example") != first


async def test_billing_numbers_count_only_active_students_of_paying_schools(client, owner, mail):
    a = await new_school(client, owner, mail, name="School A", admin_email="a@x.example")
    b = await new_school(client, owner, mail, name="School B", admin_email="b@x.example")
    await add_students(a["school"]["id"], 5)
    await add_students(a["school"]["id"], 2, status="left")  # left students are not billed
    await add_students(b["school"]["id"], 3)
    # both still on trial: nothing billed
    st = (await client.get(f"{API}/owner/stats", headers=owner)).json()
    assert st["schools"] == 2 and st["schools_trial"] == 2 and st["mrr_paise"] == 0
    await client.patch(f"{API}/owner/schools/{a['school']['id']}", headers=owner, json={"status": "active"})
    st = (await client.get(f"{API}/owner/stats", headers=owner)).json()
    assert st["active_students"] == 5 and st["mrr_paise"] == 5 * 1000 and st["arr_paise"] == 5 * 1000 * 12
    assert st["schools_active"] == 1 and st["schools_trial"] == 1
    # a different price for one school
    await client.patch(
        f"{API}/owner/schools/{a['school']['id']}", headers=owner, json={"price_per_student_paise": 1500}
    )
    assert (await client.get(f"{API}/owner/stats", headers=owner)).json()["mrr_paise"] == 7500
    one = (await client.get(f"{API}/owner/schools/{a['school']['id']}", headers=owner)).json()
    assert one["active_students"] == 5 and one["monthly_paise"] == 7500


async def test_suspending_and_price_changes_are_in_the_school_audit_log(client, owner, school_a):
    sid = school_a["school"]["id"]
    await client.patch(f"{API}/owner/schools/{sid}", headers=owner, json={"price_per_student_paise": 1200})
    await client.patch(f"{API}/owner/schools/{sid}", headers=owner, json={"status": "active"})
    items = (
        await client.get(f"{API}/audit", headers=school_a["headers"], params={"sensitive": True, "limit": 50})
    ).json()["items"]
    actions = {i["action"] for i in items}
    assert {"school.price_changed", "school.active"} <= actions


async def test_owner_does_not_get_a_way_to_read_student_records(client, owner):
    from app.main import app

    paths = app.openapi()["paths"]
    assert not [p for p in paths if p.startswith("/api/v1/owner") and "student" in p]


async def test_owner_sign_in_and_unknown_status_is_rejected(client, owner, school_a):
    r = await client.patch(f"{API}/owner/schools/{school_a['school']['id']}", headers=owner, json={"status": "banana"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "bad_status"
    t = await sign_in(client, OWNER_EMAIL, OWNER_PASSWORD)
    assert t["kind"] == "owner"
    assert STRONG  # imported for symmetry with other tests
