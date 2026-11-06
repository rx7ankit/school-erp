"""Unified messaging: broadcasts, teacher threads, who may message whom, inactive threads, read state."""

import pytest
from conftest import API
from msgkit import new_push, world

from app.services.notifications import flush_pushes
from app.services.storage import StoredObject, get_storage

MSG = f"{API}/messaging"
PAR = f"{API}/parent"


@pytest.fixture
async def w(client, school_a, mail):
    new_push()
    return await world(client, school_a["headers"], mail)


def T(w, k):
    return w["staff"][k]["h"]


async def bcast(client, h, **kw):
    body = {"scope": "school", "title": "Holiday", "body": "School is closed on Monday.", **kw}
    return await client.post(f"{MSG}/broadcasts", headers=h, json=body)


# ------------------------------------------------------------------ broadcasts
async def test_school_broadcast_reaches_every_family_and_tracks_reads(client, w):
    r = await bcast(client, w["admin"])
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["tag"] == "School" and b["recipient_count"] == 3 and b["read_count"] == 0 and b["sender_role"] == "Admin"
    for name in ("rakesh", "mohan", "sunil"):
        ph = w["parents"][name]
        feed = (await client.get(f"{PAR}/updates", headers=ph)).json()
        assert [i["title"] for i in feed["items"]] == ["Holiday"] and feed["items"][0]["is_read"] is False
        assert (await client.get(f"{PAR}/messaging/unread", headers=ph)).json() == {"updates": 1, "messages": 0}
        # in-app notification too
        inbox = (await client.get(f"{PAR}/notifications", headers=ph)).json()
        assert inbox["unread"] == 1 and inbox["items"][0]["kind"] == "broadcast"
        assert inbox["items"][0]["data"]["broadcast_id"] == b["id"]
    ph = w["parents"]["rakesh"]
    assert (await client.post(f"{PAR}/updates/{b['id']}/read", headers=ph)).status_code == 204
    assert (await client.post(f"{PAR}/updates/{b['id']}/read", headers=ph)).status_code == 204  # idempotent
    assert (await client.get(f"{PAR}/messaging/unread", headers=ph)).json()["updates"] == 0
    assert (await client.get(f"{PAR}/updates?unread_only=true", headers=ph)).json()["total"] == 0
    assert (await client.get(f"{PAR}/updates/{b['id']}", headers=ph)).json()["is_read"] is True
    assert (await client.get(f"{MSG}/broadcasts/{b['id']}", headers=w["admin"])).json()["read_count"] == 1
    # audited
    logs = (await client.get(f"{API}/audit?category=messages", headers=w["admin"])).json()["items"]
    assert any(x["action"] == "broadcast.sent" for x in logs)


async def test_grade_and_class_audiences(client, w):
    ha = w["admin"]
    await bcast(client, ha, audience="classes", class_ids=[w["b"]["id"]], title="Only B")
    await bcast(client, ha, audience="grade", grade="8", title="Grade 8")
    titles = lambda k: [i["title"] for i in client_feed[k]]  # noqa: E731
    client_feed = {}
    for k in ("rakesh", "sunil"):
        client_feed[k] = (await client.get(f"{PAR}/updates", headers=w["parents"][k])).json()["items"]
    assert sorted(titles("rakesh")) == ["Grade 8"] and sorted(titles("sunil")) == ["Grade 8", "Only B"]
    bad = await bcast(client, ha, audience="grade", grade="11")
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "invalid_audience"
    assert (await bcast(client, ha, audience="classes", class_ids=[])).status_code == 422
    # all read-all clears
    ph = w["parents"]["sunil"]
    assert (await client.post(f"{PAR}/updates/read-all", headers=ph)).json()["updates"] == 0


async def test_who_may_broadcast(client, w, school_a, mail):
    a, b = w["a"]["id"], w["b"]["id"]
    # school wide: only announcements.manage (a teacher writes to their own classes)
    for k in ("ct", "mt", "free"):
        r = await bcast(client, T(w, k))
        assert r.status_code == 403 and r.json()["error"]["code"] == "missing_permission"
    # class teacher: any class of theirs, any subject or General
    ok = await bcast(client, T(w, "ct"), scope="class", class_id=a, subject_id=w["eng"]["id"], title="English test")
    assert ok.status_code == 201 and ok.json()["tag"] == "English" and ok.json()["sender_role"] == "Class teacher"
    gen = await bcast(client, T(w, "ct"), scope="class", class_id=a, title="Trip")
    assert gen.json()["tag"] == "General" and gen.json()["class_label"] == "8-A"
    # not their class
    r = await bcast(client, T(w, "ct"), scope="class", class_id=b)
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_assigned"
    assert (await bcast(client, T(w, "free"), scope="class", class_id=a)).status_code == 403
    # subject teacher: own subject only
    mine = await bcast(client, T(w, "mt"), scope="class", class_id=a, subject_id=w["maths"]["id"], title="Maths HW")
    assert mine.status_code == 201 and mine.json()["tag"] == "Mathematics" and mine.json()["sender_role"] == "Teacher"
    for sid in (w["eng"]["id"], None):
        r = await bcast(client, T(w, "mt"), scope="class", class_id=a, subject_id=sid)
        assert r.status_code == 403 and r.json()["error"]["code"] == "subject_not_yours"
    # parents cannot use staff routes
    ph = w["parents"]["rakesh"]
    assert (await bcast(client, ph)).status_code == 403
    assert (await client.get(f"{MSG}/broadcasts", headers=ph)).status_code == 403
    # academic.manage alone is not enough to write school wide
    r = await client.put(
        f"{API}/staff/{w['staff']['free']['id']}/permissions",
        headers=w["admin"],
        json={"permissions": ["academic.manage"]},
    )
    assert r.status_code == 200
    denied = await bcast(client, T(w, "free"))
    assert denied.status_code == 403 and denied.json()["error"]["details"]["needs"] == "announcements.manage"
    # announcements.manage may write school wide and to any class
    r = await client.put(
        f"{API}/staff/{w['staff']['free']['id']}/permissions",
        headers=w["admin"],
        json={"permissions": ["announcements.manage"]},
    )
    assert r.status_code == 200
    assert (await bcast(client, T(w, "free"))).status_code == 201
    assert (await bcast(client, T(w, "free"), scope="class", class_id=b)).status_code == 201


async def test_class_broadcast_is_seen_only_by_that_class_and_never_replied_to(client, w):
    await bcast(client, T(w, "ct"), scope="class", class_id=w["a"]["id"], title="A only")
    seen = lambda k: client.get(f"{PAR}/updates", headers=w["parents"][k])  # noqa: E731
    assert [i["title"] for i in (await seen("mohan")).json()["items"]] == ["A only"]
    assert (await seen("sunil")).json()["total"] == 0
    b_id = (await client.get(f"{MSG}/broadcasts", headers=T(w, "ct"))).json()["items"][0]["id"]
    # another class's parent: 404, never revealed
    assert (await client.get(f"{PAR}/updates/{b_id}", headers=w["parents"]["sunil"])).status_code == 404
    assert (await client.post(f"{PAR}/updates/{b_id}/read", headers=w["parents"]["sunil"])).status_code == 404
    # no reply route for broadcasts
    assert (
        await client.post(f"{PAR}/updates/{b_id}/messages", headers=w["parents"]["mohan"], json={"body": "x"})
    ).status_code in (404, 405)
    # staff list: own + school ones; the unrelated teacher does not see the class broadcast
    assert (await client.get(f"{MSG}/broadcasts", headers=T(w, "free"))).json()["total"] == 0
    assert (await client.get(f"{MSG}/broadcasts/{b_id}", headers=T(w, "free"))).status_code == 404
    assert (await client.get(f"{MSG}/broadcasts?mine=true", headers=T(w, "ct"))).json()["total"] == 1


async def test_left_child_gets_no_broadcast(client, w):
    r = await client.post(f"{API}/students/{w['aarav']['id']}/leave", headers=w["admin"], json={"reason": "moved"})
    assert r.status_code == 200, r.text
    b = (await bcast(client, w["admin"])).json()
    assert b["recipient_count"] == 2
    assert (await client.get(f"{PAR}/updates", headers=w["parents"]["rakesh"])).json()["total"] == 0


# ------------------------------------------------------------------ threads
async def open_parent_thread(client, w, who="rakesh", teacher="ct", student="aarav", subject=None):
    return await client.post(
        f"{PAR}/threads",
        headers=w["parents"][who],
        json={"student_id": w[student]["id"], "staff_id": w["staff"][teacher]["id"], "subject_id": subject},
    )


async def test_parent_sees_teachers_and_chats_with_read_receipts(client, w):
    ph, ct = w["parents"]["rakesh"], T(w, "ct")
    teachers = (await client.get(f"{PAR}/children/{w['aarav']['id']}/teachers", headers=ph)).json()
    assert [(t["name"], t["tag"], t["thread_id"]) for t in teachers] == [
        ("Rajiv Mishra", "Class teacher", None),
        ("Sunita Dwivedi", "Mathematics", None),
    ]
    r = await open_parent_thread(client, w)
    assert r.status_code == 201, r.text
    t = r.json()
    assert (
        t["tag"] == "Class teacher"
        and t["active"] is True
        and t["teacher_name"] == "Rajiv Mishra"
        and t["class_label"] == "8-A"
    )
    assert (await open_parent_thread(client, w)).json()["id"] == t["id"]  # reused
    m = await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "  Aarav has fever.  "})
    assert m.status_code == 201 and m.json()["body"] == "Aarav has fever." and m.json()["sender_kind"] == "parent"
    await flush_pushes()
    # the teacher sees it, unread
    tl = (await client.get(f"{MSG}/threads", headers=ct)).json()
    assert (
        tl["total"] == 1
        and tl["items"][0]["unread"] == 1
        and tl["items"][0]["last_message_preview"] == "Aarav has fever."
    )
    assert (await client.get(f"{MSG}/unread-count", headers=ct)).json() == {"messages": 1}
    # the teacher got an in-app notification
    assert (await client.get(f"{API}/notifications", headers=ct)).json()["items"][0]["kind"] == "message"
    msgs = (await client.get(f"{MSG}/threads/{t['id']}/messages", headers=ct)).json()
    assert msgs["items"][0]["mine"] is False and msgs["items"][0]["sender_kind"] == "parent"
    # parent's message is not "seen" until the teacher opens the thread
    pm = (await client.get(f"{PAR}/threads/{t['id']}/messages", headers=ph)).json()["items"][0]
    assert pm["mine"] is True and pm["seen"] is False
    assert (await client.post(f"{MSG}/threads/{t['id']}/read", headers=ct)).status_code == 204
    assert (await client.get(f"{MSG}/unread-count", headers=ct)).json() == {"messages": 0}
    assert (await client.get(f"{PAR}/threads/{t['id']}/messages", headers=ph)).json()["items"][0]["seen"] is True
    # teacher replies, parent sees unread, then reads
    assert (
        await client.post(f"{MSG}/threads/{t['id']}/messages", headers=ct, json={"body": "Get well soon"})
    ).status_code == 201
    assert (await client.get(f"{PAR}/messaging/unread", headers=ph)).json()["messages"] == 1
    assert (await client.get(f"{PAR}/threads", headers=ph)).json()["items"][0]["unread"] == 1
    assert (await client.get(f"{MSG}/threads/{t['id']}/messages", headers=ct)).json()["items"][0]["seen"] is False
    await client.post(f"{PAR}/threads/{t['id']}/read", headers=ph)
    assert (await client.get(f"{PAR}/messaging/unread", headers=ph)).json()["messages"] == 0
    assert (await client.get(f"{MSG}/threads/{t['id']}/messages", headers=ct)).json()["items"][0]["seen"] is True
    # the teacher's thread list now carries the thread id for the parent's teacher list
    teachers = (await client.get(f"{PAR}/children/{w['aarav']['id']}/teachers", headers=ph)).json()
    assert teachers[0]["thread_id"] == t["id"]


async def test_nobody_else_can_open_or_read_a_thread(client, w):
    t = (await open_parent_thread(client, w)).json()
    # another family's parent, another teacher, even the admin: 404
    assert (await client.get(f"{PAR}/threads/{t['id']}", headers=w["parents"]["mohan"])).status_code == 404
    assert (await client.get(f"{PAR}/threads/{t['id']}/messages", headers=w["parents"]["mohan"])).status_code == 404
    assert (
        await client.post(f"{PAR}/threads/{t['id']}/messages", headers=w["parents"]["mohan"], json={"body": "hi"})
    ).status_code == 404
    for h in (T(w, "mt"), T(w, "free"), w["admin"]):
        assert (await client.get(f"{MSG}/threads/{t['id']}", headers=h)).status_code in (404, 403)
        assert (await client.post(f"{MSG}/threads/{t['id']}/messages", headers=h, json={"body": "hi"})).status_code in (
            404,
            403,
        )
    assert (await client.get(f"{PAR}/threads", headers=w["parents"]["mohan"])).json()["total"] == 0
    # another family's child
    r = await open_parent_thread(client, w, who="mohan", student="aarav")
    assert r.status_code == 404
    assert (
        await client.get(f"{PAR}/children/{w['aarav']['id']}/teachers", headers=w["parents"]["mohan"])
    ).status_code == 404
    assert (
        await client.get(f"{PAR}/threads?student_id={w['aarav']['id']}", headers=w["parents"]["mohan"])
    ).status_code == 404
    # staff routes are closed to parents, parent routes to staff
    assert (await client.get(f"{MSG}/threads", headers=w["parents"]["rakesh"])).status_code == 403
    assert (await client.get(f"{PAR}/threads", headers=T(w, "ct"))).status_code == 403


async def test_only_assigned_teachers_can_be_messaged_or_message(client, w):
    # parent -> a teacher of another class / unassigned subject
    r = await open_parent_thread(client, w, teacher="bt")
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_assigned"
    r = await open_parent_thread(client, w, teacher="free")
    assert r.status_code == 403
    r = await open_parent_thread(
        client, w, teacher="mt", subject=w["eng"]["id"]
    )  # maths teacher does not teach English
    assert r.status_code == 403
    r = await open_parent_thread(client, w, teacher="mt")  # maths teacher is not the class teacher
    assert r.status_code == 403
    assert (await open_parent_thread(client, w, teacher="mt", subject=w["maths"]["id"])).status_code == 201
    # teacher -> a child of another class, or unassigned
    r = await client.post(f"{MSG}/threads", headers=T(w, "ct"), json={"student_id": w["bkid"]["id"]})
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_assigned"
    r = await client.post(f"{MSG}/threads", headers=T(w, "free"), json={"student_id": w["aarav"]["id"]})
    assert r.status_code == 403
    r = await client.post(
        f"{MSG}/threads", headers=T(w, "mt"), json={"student_id": w["aarav"]["id"]}
    )  # not class teacher
    assert r.status_code == 403
    # admin has no thread either
    assert (
        await client.post(f"{MSG}/threads", headers=w["admin"], json={"student_id": w["aarav"]["id"]})
    ).status_code == 403
    # a teacher starts a thread, the parent can reply
    r = await client.post(f"{MSG}/threads", headers=T(w, "ct"), json={"student_id": w["aarav"]["id"]})
    assert r.status_code == 201
    await client.post(f"{MSG}/threads/{r.json()['id']}/messages", headers=T(w, "ct"), json={"body": "Meeting tomorrow"})
    await flush_pushes()
    assert (await client.get(f"{PAR}/notifications", headers=w["parents"]["rakesh"])).json()["items"][0][
        "title"
    ] == "Message from Rajiv Mishra"
    assert (
        await client.post(
            f"{PAR}/threads/{r.json()['id']}/messages", headers=w["parents"]["rakesh"], json={"body": "ok"}
        )
    ).status_code == 201
    # the other family's parent is not told
    assert (await client.get(f"{PAR}/notifications", headers=w["parents"]["mohan"])).json()["total"] == 0


async def test_thread_goes_inactive_when_the_teacher_is_reassigned_and_comes_back(client, w):
    ph, ha = w["parents"]["rakesh"], w["admin"]
    t = (await open_parent_thread(client, w)).json()
    await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "Hello sir"})
    # a new class teacher replaces Rajiv
    await client.put(
        f"{API}/academic/classes/{w['a']['id']}/class-teacher", headers=ha, json={"staff_id": w["staff"]["ct2"]["id"]}
    )
    th = (await client.get(f"{PAR}/threads/{t['id']}", headers=ph)).json()
    assert (
        th["active"] is False
        and th["inactive_notice"] == "Rajiv Mishra is no longer the class teacher of Aarav Sharma."
    )
    # history stays readable, but nobody can post
    assert (await client.get(f"{PAR}/threads/{t['id']}/messages", headers=ph)).json()["total"] == 1
    r = await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "still there?"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "thread_inactive"
    r = await client.post(f"{MSG}/threads/{t['id']}/messages", headers=T(w, "ct"), json={"body": "hi"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "thread_inactive"
    assert (await client.get(f"{MSG}/threads/{t['id']}/messages", headers=T(w, "ct"))).json()["total"] == 1
    assert (await client.get(f"{MSG}/threads?active=false", headers=T(w, "ct"))).json()["total"] == 1
    # the parent now sees the new teacher, with a fresh thread of its own
    teachers = (await client.get(f"{PAR}/children/{w['aarav']['id']}/teachers", headers=ph)).json()
    assert teachers[0]["name"] == "Neha Gupta" and teachers[0]["thread_id"] is None
    new = (await open_parent_thread(client, w, teacher="ct2")).json()
    assert new["id"] != t["id"] and new["active"] is True
    assert (await client.get(f"{PAR}/threads?active=true", headers=ph)).json()["total"] == 1
    assert (await client.get(f"{PAR}/threads", headers=ph)).json()["total"] == 2
    # and cannot open the old one again
    assert (await open_parent_thread(client, w)).status_code == 403
    # the old teacher is assigned again later: the same thread, with its history, is active again
    await client.put(
        f"{API}/academic/classes/{w['a']['id']}/class-teacher", headers=ha, json={"staff_id": w["staff"]["ct"]["id"]}
    )
    th = (await client.get(f"{PAR}/threads/{t['id']}", headers=ph)).json()
    assert th["active"] is True and th["inactive_notice"] is None
    assert (
        await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "welcome back"})
    ).status_code == 201
    assert (await client.get(f"{PAR}/threads/{t['id']}/messages", headers=ph)).json()["total"] == 2


async def test_subject_teacher_removed_makes_subject_thread_inactive(client, w):
    ph, ha = w["parents"]["rakesh"], w["admin"]
    t = (await open_parent_thread(client, w, teacher="mt", subject=w["maths"]["id"])).json()
    assert t["tag"] == "Mathematics"
    await client.put(
        f"{API}/academic/classes/{w['a']['id']}/subject-teachers/{w['maths']['id']}",
        headers=ha,
        json={"staff_id": None},
    )
    th = (await client.get(f"{PAR}/threads/{t['id']}", headers=ph)).json()
    assert (
        th["active"] is False
        and th["inactive_notice"] == "Sunita Dwivedi no longer teaches Mathematics to Aarav Sharma."
    )


async def test_child_who_left_makes_threads_read_only(client, w):
    ph = w["parents"]["rakesh"]
    t = (await open_parent_thread(client, w)).json()
    await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "bye"})
    await client.post(f"{API}/students/{w['aarav']['id']}/leave", headers=w["admin"], json={"reason": "moved"})
    th = (await client.get(f"{PAR}/threads/{t['id']}", headers=ph)).json()
    assert th["active"] is False and "has left the school" in th["inactive_notice"]
    assert (await client.get(f"{PAR}/threads/{t['id']}/messages", headers=ph)).json()["total"] == 1
    r = await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "x"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "child_read_only"
    r = await client.post(f"{MSG}/threads/{t['id']}/messages", headers=T(w, "ct"), json={"body": "x"})
    assert r.status_code == 403
    assert (await open_parent_thread(client, w, teacher="ct")).status_code == 403
    assert (await client.get(f"{PAR}/children/{w['aarav']['id']}/teachers", headers=ph)).json() == []
    r = await client.post(f"{MSG}/threads", headers=T(w, "ct"), json={"student_id": w["aarav"]["id"]})
    assert r.status_code == 403


async def test_message_validation(client, w):
    ph = w["parents"]["rakesh"]
    t = (await open_parent_thread(client, w)).json()
    url = f"{PAR}/threads/{t['id']}/messages"
    assert (await client.post(url, headers=ph, json={"body": ""})).status_code == 422
    r = await client.post(url, headers=ph, json={"body": "   "})
    assert r.status_code == 422
    assert (await client.post(url, headers=ph, json={"body": "x" * 4001})).status_code == 422
    assert (
        await client.post(
            url, headers=ph, json={"body": "ok", "attachment_ids": ["00000000-0000-0000-0000-000000000001"]}
        )
    ).status_code == 422


# ------------------------------------------------------------------ attachments
async def test_attachments_on_broadcasts_and_messages(client, w):
    store = get_storage()

    async def upload_staff(h, name="notice.pdf"):
        r = await client.post(
            f"{API}/files/upload-url",
            headers=h,
            json={
                "purpose": "message_attachment",
                "filename": name,
                "content_type": "application/pdf",
                "size_bytes": 10,
            },
        )
        assert r.status_code == 201, r.text
        fid = r.json()["id"]
        key = (await client.get(f"{API}/files/{fid}", headers=h)).json()
        from sqlalchemy import select

        from app.db.session import system_session
        from app.models.file import Attachment

        async with system_session() as db:
            a = await db.scalar(select(Attachment).where(Attachment.id == fid))
            store.objects[a.storage_key] = StoredObject(size=10, content_type="application/pdf")
        assert key
        assert (await client.post(f"{API}/files/{fid}/complete", headers=h)).status_code == 200
        return fid

    fid = await upload_staff(w["admin"])
    b = (await bcast(client, w["admin"], attachment_ids=[fid])).json()
    assert [a["filename"] for a in b["attachments"]] == ["notice.pdf"]
    # the same file cannot be attached twice, nor someone else's
    assert (await bcast(client, w["admin"], attachment_ids=[fid])).status_code == 422
    other = await upload_staff(T(w, "ct"), "mine.pdf")
    assert (await bcast(client, w["admin"], attachment_ids=[other])).status_code == 422
    item = (await client.get(f"{PAR}/updates", headers=w["parents"]["rakesh"])).json()["items"][0]
    assert item["attachments"][0]["id"] == fid
    r = await client.get(f"{PAR}/messaging/files/{fid}/url", headers=w["parents"]["rakesh"])
    assert r.status_code == 200 and r.json()["url"].startswith("https://storage.test/download/")
    assert (await client.get(f"{MSG}/files/{fid}/url", headers=T(w, "free"))).status_code == 200  # school wide
    # a class-only attachment is private to that class
    fid2 = await upload_staff(T(w, "ct"), "class.pdf")
    await bcast(client, T(w, "ct"), scope="class", class_id=w["a"]["id"], attachment_ids=[fid2])
    assert (await client.get(f"{PAR}/messaging/files/{fid2}/url", headers=w["parents"]["mohan"])).status_code == 200
    assert (await client.get(f"{PAR}/messaging/files/{fid2}/url", headers=w["parents"]["sunil"])).status_code == 404
    assert (await client.get(f"{MSG}/files/{fid2}/url", headers=T(w, "free"))).status_code == 404

    # a parent attaches a file to a reply
    ph = w["parents"]["rakesh"]
    t = (await open_parent_thread(client, w)).json()
    up = await client.post(
        f"{PAR}/messaging/upload-url",
        headers=ph,
        json={"purpose": "x", "filename": "rx.pdf", "content_type": "application/pdf", "size_bytes": 20},
    )
    assert up.status_code == 201, up.text
    pid = up.json()["id"]
    assert (await client.post(f"{PAR}/messaging/files/{pid}/complete", headers=ph)).status_code == 400  # not uploaded
    from sqlalchemy import select

    from app.db.session import system_session
    from app.models.file import Attachment

    async with system_session() as db:
        key = (await db.scalar(select(Attachment).where(Attachment.id == pid))).storage_key
    store.objects[key] = StoredObject(size=20, content_type="application/pdf")
    assert (await client.post(f"{PAR}/messaging/files/{pid}/complete", headers=ph)).status_code == 200
    big = await client.post(
        f"{PAR}/messaging/upload-url",
        headers=ph,
        json={"purpose": "x", "filename": "a.exe", "content_type": "application/x-msdownload", "size_bytes": 5},
    )
    assert big.status_code == 400
    m = await client.post(
        f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "prescription", "attachment_ids": [pid]}
    )
    assert m.status_code == 201 and m.json()["attachments"][0]["filename"] == "rx.pdf"
    assert (await client.get(f"{MSG}/files/{pid}/url", headers=T(w, "ct"))).status_code == 200
    assert (await client.get(f"{MSG}/files/{pid}/url", headers=T(w, "mt"))).status_code == 404
    assert (await client.get(f"{PAR}/messaging/files/{pid}/url", headers=w["parents"]["mohan"])).status_code == 404


# ------------------------------------------------------------------ push
async def test_message_and_broadcast_push_to_registered_phones(client, w):
    push = new_push()
    ph = w["parents"]["rakesh"]
    r = await client.post(
        f"{PAR}/notifications/devices", headers=ph, json={"token": "tok-rakesh-phone-1", "platform": "android"}
    )
    assert r.status_code == 204
    await bcast(client, w["admin"])
    await flush_pushes()
    assert [m.title for m in push.to_token("tok-rakesh-phone-1")] == ["School: Holiday"]
    # turn Messages off: the inbox still shows it, the phone does not buzz
    r = await client.put(
        f"{PAR}/notifications/preferences", headers=ph, json={"category": "messages", "push_enabled": False}
    )
    assert r.json()["preferences"]["messages"] is False
    await bcast(client, w["admin"], title="Second")
    await flush_pushes()
    assert len(push.to_token("tok-rakesh-phone-1")) == 1
    assert (await client.get(f"{PAR}/notifications", headers=ph)).json()["total"] == 2


# ------------------------------------------------------------------ tenancy
async def test_other_school_sees_nothing(client, w, school_b, mail):
    from sqlalchemy import select

    from app.db.session import make_session
    from app.models.messaging import (
        Broadcast,
        BroadcastClass,
        BroadcastRead,
        Message,
        MessageThread,
        ThreadRead,
    )

    await bcast(client, w["admin"], audience="classes", class_ids=[w["a"]["id"]])
    t = (await open_parent_thread(client, w)).json()
    await client.post(f"{PAR}/threads/{t['id']}/messages", headers=w["parents"]["rakesh"], json={"body": "hi"})
    await client.post(f"{PAR}/updates/read-all", headers=w["parents"]["rakesh"])
    await client.post(f"{MSG}/threads/{t['id']}/read", headers=T(w, "ct"))
    hb = school_b["headers"]
    assert (await client.get(f"{MSG}/broadcasts", headers=hb)).json()["total"] == 0
    bid = (await client.get(f"{MSG}/broadcasts", headers=w["admin"])).json()["items"][0]["id"]
    assert (await client.get(f"{MSG}/broadcasts/{bid}", headers=hb)).status_code == 404
    # school B cannot broadcast to school A's class, nor open a thread about its child
    r = await client.post(
        f"{MSG}/broadcasts",
        headers=hb,
        json={"scope": "school", "audience": "classes", "class_ids": [w["a"]["id"]], "title": "x", "body": "y"},
    )
    assert r.status_code == 422
    r = await client.post(
        f"{MSG}/broadcasts", headers=hb, json={"scope": "class", "class_id": w["a"]["id"], "title": "x", "body": "y"}
    )
    assert r.status_code == 404
    assert (await client.post(f"{MSG}/threads", headers=hb, json={"student_id": w["aarav"]["id"]})).status_code == 404
    # Postgres row level security, straight on the tables
    from app.models.school import School

    async with make_session(bypass=True) as s:
        schools = {x.name: x.id for x in (await s.scalars(select(School))).all()}
    me, other = schools["Rewa Public School"], schools["Satna Vidya Mandir"]
    for model in (Broadcast, BroadcastClass, BroadcastRead, MessageThread, Message, ThreadRead):
        async with make_session(school_id=me) as s:
            rows = (await s.scalars(select(model))).all()
            assert rows and {r.school_id for r in rows} == {me}, model.__tablename__
        async with make_session(school_id=other) as s:
            assert (await s.scalars(select(model))).all() == [], model.__tablename__
        async with make_session() as s:
            assert (await s.scalars(select(model))).all() == [], model.__tablename__


async def test_a_parent_can_send_a_video_with_no_text(client, w):
    store = get_storage()
    ph = w["parents"]["rakesh"]
    t = (await open_parent_thread(client, w)).json()
    # nothing at all is still refused
    empty = await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "  "})
    assert empty.status_code == 422
    up = await client.post(
        f"{PAR}/messaging/upload-url",
        headers=ph,
        json={
            "purpose": "x",
            "filename": "fever.mov",
            "content_type": "video/quicktime",
            "size_bytes": 20 * 1024 * 1024,
        },
    )
    assert up.status_code == 201, up.text
    vid = up.json()["id"]
    from sqlalchemy import select

    from app.db.session import system_session
    from app.models.file import Attachment

    async with system_session() as db:
        key = (await db.scalar(select(Attachment).where(Attachment.id == vid))).storage_key
    store.objects[key] = StoredObject(size=20 * 1024 * 1024, content_type="video/quicktime")
    assert (await client.post(f"{PAR}/messaging/files/{vid}/complete", headers=ph)).status_code == 200
    m = await client.post(f"{PAR}/threads/{t['id']}/messages", headers=ph, json={"body": "", "attachment_ids": [vid]})
    assert m.status_code == 201, m.text
    assert m.json()["body"] == "" and m.json()["attachments"][0]["content_type"] == "video/quicktime"
    # over the 50 MB limit is refused
    huge = await client.post(
        f"{PAR}/messaging/upload-url",
        headers=ph,
        json={"purpose": "x", "filename": "big.mp4", "content_type": "video/mp4", "size_bytes": 60 * 1024 * 1024},
    )
    assert huge.status_code == 400
