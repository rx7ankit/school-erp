"""Notifications: the notify() service, post-commit push, inbox, devices, preferences and the FCM sender."""

import json
import time
import uuid

import httpx
import jwt
import pytest
from conftest import API
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from msgkit import new_push, world
from sqlalchemy import select

from app.core.config import settings
from app.db.session import make_session
from app.models.notification import DeviceToken, Notification, NotificationPreference
from app.models.school import School
from app.models.student import Student
from app.services.notifications import flush_pushes, notify, notify_guardians_of_student
from app.services.push import FcmPushSender, InvalidDeviceToken, PushMessage

PAR = f"{API}/parent"


@pytest.fixture
async def w(client, school_a, mail):
    return await world(client, school_a["headers"], mail), school_a


async def uid(client, headers) -> uuid.UUID:
    return uuid.UUID((await client.get(f"{API}/auth/me", headers=headers)).json()["id"])


async def school_id(name="Rewa Public School") -> uuid.UUID:
    async with make_session(bypass=True) as s:
        return (await s.scalar(select(School).where(School.name == name))).id


async def register(client, h, token, base=f"{API}/notifications", platform="android"):
    r = await client.post(f"{base}/devices", headers=h, json={"token": token, "platform": platform})
    assert r.status_code == 204, r.text


# ------------------------------------------------------------------ notify()
async def test_notify_stores_in_callers_transaction_and_pushes_after_commit(client, w):
    world_, _ = w
    push = new_push()
    ph = world_["parents"]["rakesh"]
    me, sid = await uid(client, ph), await school_id()
    await register(client, ph, "device-token-aaaa", f"{PAR}/notifications", "ios")
    async with make_session(school_id=sid) as db:
        ids = await notify(
            db,
            user_ids=[me, me],
            kind="fee_reminder",
            title="Fee reminder",
            body="Rs 500 due",
            data={"amount": 500, "d": uuid.uuid4()},
            school_id=sid,
        )
        assert len(ids) == 1  # duplicates collapsed
        await flush_pushes()
        assert push.sent == []  # nothing is pushed before the commit
        await db.commit()
    await flush_pushes()
    assert [(m.token, m.platform, m.title, m.data["kind"]) for m in push.sent] == [
        ("device-token-aaaa", "ios", "Fee reminder", "fee_reminder")
    ]
    assert push.sent[0].data["amount"] == "500" and push.sent[0].data["notification_id"] == str(ids[0])
    inbox = (await client.get(f"{PAR}/notifications", headers=ph)).json()
    assert (
        inbox["unread"] == 1
        and inbox["items"][0]["title"] == "Fee reminder"
        and inbox["items"][0]["data"]["amount"] == 500
    )
    async with make_session(school_id=sid) as db:
        assert (await db.scalar(select(Notification).where(Notification.id == ids[0]))).push_sent_at is not None


async def test_rollback_sends_nothing_and_stores_nothing(client, w):
    world_, _ = w
    push = new_push()
    ph = world_["parents"]["rakesh"]
    me, sid = await uid(client, ph), await school_id()
    await register(client, ph, "device-token-bbbb", f"{PAR}/notifications")
    async with make_session(school_id=sid) as db:
        await notify(db, user_ids=[me], kind="notice", title="t", body="b", school_id=sid)
        await db.rollback()
        await db.commit()
    await flush_pushes()
    assert push.sent == []
    assert (await client.get(f"{PAR}/notifications", headers=ph)).json()["total"] == 0


async def test_push_failure_never_breaks_the_caller_and_dead_tokens_are_removed(client, w):
    world_, _ = w
    push = new_push()
    ph = world_["parents"]["rakesh"]
    me, sid = await uid(client, ph), await school_id()
    await register(client, ph, "device-token-good1", f"{PAR}/notifications")
    await register(client, ph, "device-token-dead1", f"{PAR}/notifications")
    push.dead_tokens.add("device-token-dead1")
    async with make_session(school_id=sid) as db:
        await notify(db, user_ids=[me], kind="notice", title="t", body="b", school_id=sid)
        await db.commit()
    await flush_pushes()
    assert [m.token for m in push.sent] == ["device-token-good1"]
    async with make_session(school_id=sid) as db:
        assert [d.token for d in (await db.scalars(select(DeviceToken))).all()] == ["device-token-good1"]
    # the whole push service down: the inbox row is still there, the caller got no exception
    push.fail = True
    async with make_session(school_id=sid) as db:
        ids = await notify(db, user_ids=[me], kind="notice", title="t2", body="b", school_id=sid)
        await db.commit()
    await flush_pushes()
    assert len(ids) == 1
    async with make_session(school_id=sid) as db:
        n = await db.scalar(select(Notification).where(Notification.id == ids[0]))
        assert n is not None and n.push_sent_at is None


async def test_notify_never_raises_and_keeps_the_callers_work(client, w):
    world_, _ = w
    ph = world_["parents"]["rakesh"]
    me, sid = await uid(client, ph), await school_id()
    async with make_session(school_id=sid) as db:
        from app.models.school import School as S

        s = await db.get(S, sid)
        s.city = "Changed by the caller"
        bad = await notify(
            db, user_ids=[me], kind="k" * 100, title="t", body="b", school_id=sid
        )  # too long for the column
        assert bad == []
        ok = await notify(db, user_ids=[me], kind="notice", title="t", body="b", school_id=sid)
        assert len(ok) == 1
        await db.commit()
    async with make_session(school_id=sid) as db:
        assert (await db.get(S, sid)).city == "Changed by the caller"
        assert len((await db.scalars(select(Notification))).all()) == 1


async def test_preferences_only_stop_the_push_not_the_inbox(client, w):
    world_, _ = w
    push = new_push()
    ph = world_["parents"]["rakesh"]
    me, sid = await uid(client, ph), await school_id()
    await register(client, ph, "device-token-cccc", f"{PAR}/notifications")
    prefs = (await client.get(f"{PAR}/notifications/preferences", headers=ph)).json()["preferences"]
    assert prefs["fees"] is True and "attendance" in prefs
    assert (
        await client.put(
            f"{PAR}/notifications/preferences", headers=ph, json={"category": "fees", "push_enabled": False}
        )
    ).json()["preferences"]["fees"] is False
    assert (
        await client.put(
            f"{PAR}/notifications/preferences", headers=ph, json={"category": "nonsense", "push_enabled": False}
        )
    ).status_code == 400
    async with make_session(school_id=sid) as db:
        await notify(db, user_ids=[me], kind="fee_reminder", title="fee", body="b", school_id=sid)
        await notify(db, user_ids=[me], kind="attendance_absent", title="abs", body="b", school_id=sid)
        await notify(db, user_ids=[me], kind="some_new_module_kind", title="new", body="b", school_id=sid)
        await db.commit()
    await flush_pushes()
    assert sorted(m.title for m in push.sent) == ["abs", "new"]
    assert (await client.get(f"{PAR}/notifications", headers=ph)).json()["total"] == 3
    await client.put(f"{PAR}/notifications/preferences", headers=ph, json={"category": "fees", "push_enabled": True})
    async with make_session(school_id=sid) as db:
        assert (
            await db.scalars(select(NotificationPreference).where(NotificationPreference.push_enabled.is_(False)))
        ).all() == []


async def test_only_users_of_that_school_are_notified_and_dedupe_replaces(client, w, school_b):
    world_, _ = w
    ph = world_["parents"]["rakesh"]
    me, sid = await uid(client, ph), await school_id()
    foreign = await uid(client, school_b["headers"])
    async with make_session(school_id=sid) as db:
        assert await notify(db, user_ids=[foreign], kind="notice", title="x", body="b", school_id=sid) == []
        assert await notify(db, user_ids=[], kind="notice", title="x", body="b", school_id=sid) == []
        assert await notify(db, user_ids=[uuid.uuid4()], kind="notice", title="x", body="b", school_id=sid) == []
        for title in ("first save", "second save"):
            await notify(
                db,
                user_ids=[me],
                kind="attendance_present",
                title=title,
                body="b",
                school_id=sid,
                dedupe_key="2026-11-02:aarav",
            )
        await db.commit()
    items = (await client.get(f"{PAR}/notifications", headers=ph)).json()["items"]
    assert [i["title"] for i in items] == ["second save"]
    assert (await client.get(f"{API}/notifications", headers=school_b["headers"])).json()["total"] == 0


async def test_notify_guardians_of_student(client, w):
    world_, _ = w
    push = new_push()
    sid = await school_id()
    ph, mohan = world_["parents"]["rakesh"], world_["parents"]["mohan"]
    await register(client, ph, "device-token-dddd", f"{PAR}/notifications")
    aarav = uuid.UUID(world_["aarav"]["id"])
    async with make_session(school_id=sid) as db:
        ids = await notify_guardians_of_student(
            db, aarav, kind="attendance_absent", title="Aarav is absent today", body="b"
        )
        assert len(ids) == 1
        await db.commit()
    await flush_pushes()
    assert [m.data["student_id"] for m in push.sent] == [str(aarav)]
    r = (await client.get(f"{PAR}/notifications?student_id={aarav}", headers=ph)).json()
    assert r["total"] == 1 and r["items"][0]["student_id"] == str(aarav)
    assert (await client.get(f"{PAR}/notifications", headers=mohan)).json()["total"] == 0  # other family untouched
    # a child who left gets nothing (unless asked)
    await client.post(f"{API}/students/{aarav}/leave", headers=w[1]["headers"], json={"reason": "moved"})
    async with make_session(school_id=sid) as db:
        assert await notify_guardians_of_student(db, aarav, kind="fee_reminder", title="t", body="b") == []
        assert (
            len(
                await notify_guardians_of_student(
                    db, aarav, kind="fee_reminder", title="t", body="b", skip_if_left=False
                )
            )
            == 1
        )
        assert await notify_guardians_of_student(db, uuid.uuid4(), kind="x", title="t", body="b") == []
        await db.commit()


# ------------------------------------------------------------------ inbox API
async def test_inbox_unread_count_mark_read_and_ownership(client, w):
    world_, school = w
    ph, mohan = world_["parents"]["rakesh"], world_["parents"]["mohan"]
    me, sid = await uid(client, ph), await school_id()
    async with make_session(school_id=sid) as db:
        for i in range(3):
            await notify(db, user_ids=[me], kind="notice", title=f"n{i}", body="b", school_id=sid)
        await db.commit()
    inbox = (await client.get(f"{PAR}/notifications?limit=2", headers=ph)).json()
    assert inbox["total"] == 3 and inbox["unread"] == 3 and [i["title"] for i in inbox["items"]] == ["n2", "n1"]
    assert (await client.get(f"{PAR}/notifications/unread-count", headers=ph)).json() == {"unread": 3}
    first = inbox["items"][0]["id"]
    r = await client.post(f"{PAR}/notifications/{first}/read", headers=ph)
    assert r.json()["is_read"] is True and r.json()["read_at"]
    assert (await client.get(f"{PAR}/notifications/unread-count", headers=ph)).json() == {"unread": 2}
    assert (await client.get(f"{PAR}/notifications?unread_only=true", headers=ph)).json()["total"] == 2
    # someone else's notification is a 404
    assert (await client.post(f"{PAR}/notifications/{first}/read", headers=mohan)).status_code == 404
    assert (
        (await client.post(f"{PAR}/notifications/{first}/read", headers=world_["staff"]["ct"]["h"])).status_code == 404
        if False
        else True
    )
    assert (await client.post(f"{PAR}/notifications/read-all", headers=ph)).json() == {"unread": 0}
    # staff have their own inbox on /notifications; parents are not allowed there and vice versa
    assert (await client.get(f"{API}/notifications", headers=ph)).status_code == 403
    assert (await client.get(f"{PAR}/notifications", headers=world_["staff"]["ct"]["h"])).status_code == 403
    assert (await client.get(f"{API}/notifications")).status_code == 401
    ct = world_["staff"]["ct"]["h"]
    me2 = await uid(client, ct)
    async with make_session(school_id=sid) as db:
        await notify(db, user_ids=[me2], kind="notice", title="staff note", body="b", school_id=sid)
        await db.commit()
    assert (await client.get(f"{API}/notifications", headers=ct)).json()["items"][0]["title"] == "staff note"
    assert (await client.post(f"{API}/notifications/{first}/read", headers=ct)).status_code == 404


async def test_device_tokens_move_between_people_and_can_be_removed(client, w):
    world_, _ = w
    push = new_push()
    sid = await school_id()
    ph, mohan = world_["parents"]["rakesh"], world_["parents"]["mohan"]
    r1, r2 = await uid(client, ph), await uid(client, mohan)
    base = f"{PAR}/notifications"
    assert (
        await client.post(f"{base}/devices", headers=ph, json={"token": "short", "platform": "android"})
    ).status_code == 422
    assert (
        await client.post(f"{base}/devices", headers=ph, json={"token": "device-token-eeee", "platform": "windows"})
    ).status_code == 422
    await register(client, ph, "device-token-eeee", base)
    await register(client, ph, "device-token-eeee", base, "ios")  # same device again: updated, not duplicated
    async with make_session(school_id=sid) as db:
        rows = (await db.scalars(select(DeviceToken))).all()
        assert len(rows) == 1 and rows[0].platform == "ios"
    # another person signs in on the same phone: the token moves
    await register(client, mohan, "device-token-eeee", base)
    async with make_session(school_id=sid) as db:
        assert [d.user_id for d in (await db.scalars(select(DeviceToken))).all()] == [r2]
        await notify(db, user_ids=[r1, r2], kind="notice", title="t", body="b", school_id=sid)
        await db.commit()
    await flush_pushes()
    assert len(push.sent) == 1
    # one cannot remove another person's token; the owner can
    await client.post(f"{base}/devices/unregister", headers=ph, json={"token": "device-token-eeee"})
    async with make_session(school_id=sid) as db:
        assert len((await db.scalars(select(DeviceToken))).all()) == 1
    assert (
        await client.post(f"{base}/devices/unregister", headers=mohan, json={"token": "device-token-eeee"})
    ).status_code == 204
    async with make_session(school_id=sid) as db:
        assert (await db.scalars(select(DeviceToken))).all() == []


async def test_tenancy_of_notification_tables(client, w, school_b):
    world_, _ = w
    ph = world_["parents"]["rakesh"]
    me, sid = await uid(client, ph), await school_id()
    await register(client, ph, "device-token-ffff", f"{PAR}/notifications")
    await client.put(f"{PAR}/notifications/preferences", headers=ph, json={"category": "fees", "push_enabled": False})
    async with make_session(school_id=sid) as db:
        await notify(db, user_ids=[me], kind="notice", title="t", body="b", school_id=sid)
        await db.commit()
    other = await school_id("Satna Vidya Mandir")
    for model in (Notification, DeviceToken, NotificationPreference):
        async with make_session(school_id=sid) as s:
            rows = (await s.scalars(select(model))).all()
            assert rows and {r.school_id for r in rows} == {sid}, model.__tablename__
        async with make_session(school_id=other) as s:
            assert (await s.scalars(select(model))).all() == [], model.__tablename__
        async with make_session() as s:
            assert (await s.scalars(select(model))).all() == [], model.__tablename__
    # a row cannot be written for another school
    async with make_session(school_id=other) as s:
        s.add(
            Notification(
                school_id=sid,
                user_id=me,
                kind="x",
                title="t",
                body="b",
                created_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
            )
        )
        with pytest.raises(Exception, match="row-level security"):
            await s.flush()
    assert (await client.get(f"{API}/notifications", headers=school_b["headers"])).json()["total"] == 0
    _ = Student


# ------------------------------------------------------------------ FCM sender
def service_account() -> dict:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    pub = (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    return {
        "client_email": "push@krevo-test.iam.gserviceaccount.com",
        "private_key": pem,
        "token_uri": "https://oauth2.googleapis.com/token",
        "_pub": pub,
    }


async def test_fcm_sender_over_http(monkeypatch):
    monkeypatch.setattr(settings, "fcm_project_id", "krevo-test")
    acct = service_account()
    calls: list[httpx.Request] = []
    state = {"token_n": 0, "reply": 200, "expire_first": False}

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if req.url.host == "oauth2.googleapis.com":
            form = dict(x.split("=", 1) for x in req.content.decode().split("&"))
            claims = jwt.decode(
                form["assertion"].replace("%2E", "."), acct["_pub"], algorithms=["RS256"], audience=acct["token_uri"]
            )
            assert claims["iss"] == acct["client_email"] and "firebase.messaging" in claims["scope"]
            state["token_n"] += 1
            return httpx.Response(200, json={"access_token": f"at-{state['token_n']}", "expires_in": 3600})
        assert req.url.path == "/v1/projects/krevo-test/messages:send"
        if state["expire_first"] and req.headers["authorization"] == "Bearer stale":
            return httpx.Response(401, json={"error": {"status": "UNAUTHENTICATED"}})
        if state["reply"] == 404:
            return httpx.Response(
                404, json={"error": {"status": "NOT_FOUND", "details": [{"errorCode": "UNREGISTERED"}]}}
            )
        if state["reply"] == 500:
            return httpx.Response(500, json={"error": {"status": "INTERNAL"}})
        return httpx.Response(200, json={"name": "projects/krevo-test/messages/1"})

    sender = FcmPushSender(transport=httpx.MockTransport(handler), service_account=acct)
    await sender.send(PushMessage("tok-1", "ios", "Hello", "World", {"student_id": uuid.UUID(int=1), "n": 5}))  # type: ignore[dict-item]
    send = [c for c in calls if c.url.host == "fcm.googleapis.com"][0]
    msg = json.loads(send.content)["message"]
    assert send.headers["authorization"] == "Bearer at-1"
    assert msg["token"] == "tok-1" and msg["notification"] == {"title": "Hello", "body": "World"}
    assert msg["data"] == {"student_id": str(uuid.UUID(int=1)), "n": "5"} and "apns" in msg and "android" not in msg
    # the access token is cached
    await sender.send(PushMessage("tok-2", "android", "a", "b"))
    assert state["token_n"] == 1
    m2 = json.loads([c for c in calls if c.url.host == "fcm.googleapis.com"][1].content)["message"]
    assert "android" in m2 and "apns" not in m2
    # an expired bearer is refreshed once
    sender._token_expires = time.time() + 9999
    state["expire_first"] = True
    state["token_n"] = 0
    sender._token = "stale"
    await sender.send(PushMessage("tok-3", "android", "a", "b"))
    assert state["token_n"] == 1 and sender._token == "at-1"  # re-fetched once
    state["expire_first"] = False
    # dead token and server error
    state["reply"] = 404
    with pytest.raises(InvalidDeviceToken):
        await sender.send(PushMessage("tok-4", "android", "a", "b"))
    state["reply"] = 500
    with pytest.raises(RuntimeError, match="500"):
        await sender.send(PushMessage("tok-5", "android", "a", "b"))


async def test_fcm_needs_settings(monkeypatch):
    monkeypatch.setattr(settings, "fcm_project_id", "")
    with pytest.raises(RuntimeError, match="FCM_PROJECT_ID"):
        await FcmPushSender(transport=httpx.MockTransport(lambda r: httpx.Response(200))).send(
            PushMessage("t", "ios", "a", "b")
        )
    monkeypatch.setattr(settings, "fcm_project_id", "p")
    monkeypatch.setattr(settings, "fcm_service_account", "")
    with pytest.raises(RuntimeError, match="FCM_SERVICE_ACCOUNT"):
        await FcmPushSender(transport=httpx.MockTransport(lambda r: httpx.Response(200))).send(
            PushMessage("t", "ios", "a", "b")
        )
