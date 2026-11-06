import pytest
from conftest import (
    API,
    OWNER_EMAIL,
    OWNER_PASSWORD,
    STRONG,
    add_staff,
    bearer,
    make_owner,
    sign_in,
    staff_headers,
    temp_password_from,
)

from app.core.config import settings


async def test_health(client):
    assert (await client.get(f"{API}/health")).json() == {"status": "ok"}


async def test_login_success_and_me(client):
    await make_owner()
    t = await sign_in(client, OWNER_EMAIL, OWNER_PASSWORD)
    assert t["kind"] == "owner" and t["must_change_password"] is False
    me = (await client.get(f"{API}/auth/me", headers=bearer(t))).json()
    assert me["email"] == OWNER_EMAIL and me["school"] is None


async def test_wrong_password_and_unknown_email_look_identical(client):
    await make_owner()
    a = await client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "nope-nope-1"})
    b = await client.post(f"{API}/auth/login", json={"email": "ghost@x.example", "password": "nope-nope-1"})
    assert a.status_code == b.status_code == 401
    assert a.json()["error"]["message"] == b.json()["error"]["message"]
    assert a.json()["error"]["code"] == "invalid_credentials"


async def test_login_locks_after_five_wrong_attempts(client):
    await make_owner()
    for _ in range(5):
        assert (
            await client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong-pass-1"})
        ).status_code == 401
    r = await client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 429 and r.json()["error"]["code"] == "login_locked"
    assert int(r.headers["retry-after"]) > 0


async def test_a_good_login_clears_the_failure_count(client):
    await make_owner()
    for _ in range(3):
        await client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong-pass-1"})
    await sign_in(client, OWNER_EMAIL, OWNER_PASSWORD)
    for _ in range(3):  # would have been 6 in total without the reset
        assert (
            await client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong-pass-1"})
        ).status_code == 401


async def test_email_is_case_insensitive(client):
    await make_owner()
    await sign_in(client, OWNER_EMAIL.upper(), OWNER_PASSWORD)


async def test_temporary_password_must_be_changed_before_anything_else(client, school_a, mail):
    await add_staff(client, school_a["headers"], mail, email="t1@rps.example")
    tmp = temp_password_from(mail, "t1@rps.example")
    h = bearer(await sign_in(client, "t1@rps.example", tmp))
    assert (await client.get(f"{API}/auth/me", headers=h)).json()["must_change_password"] is True
    r = await client.get(f"{API}/academic/subjects", headers=h)
    assert r.status_code == 403 and r.json()["error"]["code"] == "password_change_required"


@pytest.mark.parametrize("bad", ["short1", "allletters!!", "12345678", "t1"])
async def test_weak_new_password_is_rejected(client, school_a, mail, bad):
    await add_staff(client, school_a["headers"], mail, email="t2@rps.example")
    tmp = temp_password_from(mail, "t2@rps.example")
    h = bearer(await sign_in(client, "t2@rps.example", tmp))
    r = await client.post(f"{API}/auth/change-password", headers=h, json={"current_password": tmp, "new_password": bad})
    assert r.status_code == 422 and r.json()["error"]["code"] == "weak_password"


async def test_wrong_current_password_is_rejected(client, school_a, mail):
    await add_staff(client, school_a["headers"], mail, email="t3@rps.example")
    h = bearer(await sign_in(client, "t3@rps.example", temp_password_from(mail, "t3@rps.example")))
    r = await client.post(
        f"{API}/auth/change-password", headers=h, json={"current_password": "Wrong#1234", "new_password": STRONG}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "wrong_password"


async def test_refresh_rotates_and_reuse_ends_the_chain(client, monkeypatch):
    monkeypatch.setattr(settings, "refresh_reuse_grace_seconds", 0)  # no grace: any replay is theft
    await make_owner()
    first = await sign_in(client, OWNER_EMAIL, OWNER_PASSWORD)
    second = (await client.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})).json()
    assert second["refresh_token"] != first["refresh_token"]
    assert (await client.get(f"{API}/auth/me", headers=bearer(second))).status_code == 200
    # the first refresh token is replayed, as a thief would
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_reused"
    # and now the legitimate chain is dead too
    assert (
        await client.post(f"{API}/auth/refresh", json={"refresh_token": second["refresh_token"]})
    ).status_code == 401
    assert (await client.get(f"{API}/auth/me", headers=bearer(second))).status_code == 401


async def test_two_refreshes_at_once_do_not_sign_anyone_out(client):
    """Two tabs (or two requests) refresh with the same token within moments: both get a working sign-in."""
    await make_owner()
    first = await sign_in(client, OWNER_EMAIL, OWNER_PASSWORD)
    a = await client.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
    b = await client.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert a.status_code == 200 and b.status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=bearer(a.json()))).status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=bearer(b.json()))).status_code == 200


async def test_logout_ends_the_session(client):
    await make_owner()
    t = await sign_in(client, OWNER_EMAIL, OWNER_PASSWORD)
    assert (await client.post(f"{API}/auth/logout", headers=bearer(t))).status_code == 204
    assert (await client.get(f"{API}/auth/me", headers=bearer(t))).status_code == 401
    assert (await client.post(f"{API}/auth/refresh", json={"refresh_token": t["refresh_token"]})).status_code == 401


async def test_changing_password_signs_out_other_devices(client, school_a, mail):
    phone = await sign_in(client, school_a["email"], STRONG)
    laptop = await sign_in(client, school_a["email"], STRONG)
    r = await client.post(
        f"{API}/auth/change-password",
        headers=bearer(laptop),
        json={"current_password": STRONG, "new_password": "Another#Pass77"},
    )
    assert r.status_code == 204
    assert (await client.get(f"{API}/auth/me", headers=bearer(laptop))).status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=bearer(phone))).status_code == 401


async def test_forgot_password_never_reveals_who_exists(client, school_a, mail):
    ok = await client.post(f"{API}/auth/forgot-password", json={"email": school_a["email"]})
    ghost = await client.post(f"{API}/auth/forgot-password", json={"email": "ghost@x.example"})
    assert ok.status_code == ghost.status_code == 202 and ok.json() == ghost.json()
    assert mail.last_to("ghost@x.example") is None


async def test_reset_password_flow_is_single_use(client, school_a, mail):
    await client.post(f"{API}/auth/forgot-password", json={"email": school_a["email"]})
    token = mail.last_to(school_a["email"]).body.split("token=")[1].split()[0]
    assert (
        await client.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "Reset#Pass55"})
    ).status_code == 204
    await sign_in(client, school_a["email"], "Reset#Pass55")
    again = await client.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "Reset#Pass66"})
    assert again.status_code == 400 and again.json()["error"]["code"] == "reset_expired"
    # old password and old sessions no longer work
    assert (
        await client.post(f"{API}/auth/login", json={"email": school_a["email"], "password": STRONG})
    ).status_code == 401
    assert (await client.get(f"{API}/auth/me", headers=school_a["headers"])).status_code == 401


async def test_forgot_password_is_rate_limited(client, school_a, mail):
    codes = [
        (await client.post(f"{API}/auth/forgot-password", json={"email": school_a["email"]})).status_code
        for _ in range(5)
    ]
    assert codes[:3] == [202, 202, 202] and codes[3] == 429


async def test_suspended_school_cannot_sign_in_or_use_old_tokens(client, owner, school_a):
    sid = school_a["school"]["id"]
    assert (
        await client.patch(f"{API}/owner/schools/{sid}", headers=owner, json={"status": "suspended"})
    ).status_code == 200
    r = await client.post(f"{API}/auth/login", json={"email": school_a["email"], "password": STRONG})
    assert r.status_code == 403 and r.json()["error"]["code"] == "school_suspended"
    assert (await client.get(f"{API}/auth/me", headers=school_a["headers"])).status_code == 403
    await client.patch(f"{API}/owner/schools/{sid}", headers=owner, json={"status": "active"})
    await sign_in(client, school_a["email"], STRONG)


async def test_missing_or_garbage_token(client):
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    r = await client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.token"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_token"


async def test_a_staff_member_can_sign_in_after_being_added(client, school_a, mail):
    await add_staff(client, school_a["headers"], mail, email="ok@rps.example")
    h = await staff_headers(client, mail, "ok@rps.example")
    assert (await client.get(f"{API}/auth/me", headers=h)).json()["kind"] == "staff"


async def test_me_includes_the_job_title_and_the_browser_may_call_the_api(client, school_a):
    me = (await client.get(f"{API}/auth/me", headers=school_a["headers"])).json()
    assert me["designation"] == "Principal"
    pre = await client.options(
        f"{API}/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert pre.status_code == 200 and pre.headers["access-control-allow-origin"] == "http://localhost:3000"
    evil = await client.options(
        f"{API}/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in evil.headers
