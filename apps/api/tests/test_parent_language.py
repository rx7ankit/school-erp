"""Parent language (English / Hindi): the preference, /auth/me, and localized inbox rows, push, emails."""

import uuid

import msgkit
import pytest
import rolloverkit
from attkit import day, rec
from conftest import API, add_staff, staff_headers, temp_password_from
from feekit import invoices, pay, post, run
from msgkit import new_push
from resultskit import fill_all, parent_of, world
from sqlalchemy import select, text
from studentkit import GUARD, enrol, make_class
from test_notify_wiring import MARKS, days, fam, fee_setup, inbox, only

from app.db.session import make_session
from app.models.user import User
from app.services.email import login_mail, reset_mail
from app.services.messages_i18n import render, short_date_hi, span
from app.services.notifications import flush_pushes, notify

PAR = f"{API}/parent"


async def set_lang(client, h, lang="hi"):
    r = await client.patch(f"{PAR}/preferences", headers=h, json={"language": lang})
    assert r.status_code == 200, r.text
    return r


# ------------------------------------------------------------------ pure helpers
def test_hindi_dates_and_templates():
    from datetime import date

    assert short_date_hi(date(2026, 12, 10)) == "10 दिसंबर"
    assert short_date_hi(date(2026, 1, 3)) == "3 जनवरी"
    assert span(date(2026, 12, 3), date(2026, 12, 5)) == ("3 Dec to 5 Dec", "3 दिसंबर से 5 दिसंबर")
    m = render("fee_invoice", name="Aarav", period="Q2", amount="₹1,23,456", due=date(2026, 12, 10))
    assert m.body == "Aarav: fee invoice Q2 of ₹1,23,456 is due by 10 Dec."
    assert m.body_hi == "Aarav: Q2 की फ़ीस ₹1,23,456 है, 10 दिसंबर तक जमा करें।"


# ------------------------------------------------------------------ preference endpoints
async def test_preferences_and_me(client, school_a, mail):
    w = await world(client, school_a, mail)
    pa = await parent_of(client, mail, "Aarav")
    assert (await client.get(f"{PAR}/preferences", headers=pa)).json() == {"language": "en"}
    assert (await client.get(f"{API}/auth/me", headers=pa)).json()["language"] == "en"
    assert (await set_lang(client, pa)).json() == {"language": "hi"}
    assert (await client.get(f"{PAR}/preferences", headers=pa)).json() == {"language": "hi"}
    assert (await client.get(f"{API}/auth/me", headers=pa)).json()["language"] == "hi"
    # the other family is untouched
    pb = await parent_of(client, mail, "Bhumi")
    assert (await client.get(f"{PAR}/preferences", headers=pb)).json() == {"language": "en"}
    # bad value, no token
    assert (await client.patch(f"{PAR}/preferences", headers=pa, json={"language": "fr"})).status_code == 422
    assert (await client.patch(f"{PAR}/preferences", json={"language": "hi"})).status_code == 401
    assert (await set_lang(client, pa, "en")).json() == {"language": "en"}
    # staff and the owner cannot use it and stay on English
    for h in (school_a["headers"], w["heads"]["ct"]):
        assert (await client.patch(f"{PAR}/preferences", headers=h, json={"language": "hi"})).status_code == 403
        assert (await client.get(f"{PAR}/preferences", headers=h)).status_code == 403
        assert (await client.get(f"{API}/auth/me", headers=h)).json()["language"] == "en"


async def test_database_rejects_other_languages(client, school_a, mail):
    await world(client, school_a, mail)
    async with make_session(bypass=True) as db:
        with pytest.raises(Exception, match="ck_users_language"):
            await db.execute(text("update users set language = 'fr'"))


# ------------------------------------------------------------------ every hook family
async def _attendance(client, w, mail, **_):
    ids = {k: s["id"] for k, s in w["students"].items()}
    recs = [rec(ids["Aarav"], "present", "absent"), rec(ids["Bhumi"], "present", "absent"), rec(ids["Chirag"])]
    r = await client.put(
        f"{API}/attendance/classes/{w['class']['id']}/days/{day(0)}", headers=w["heads"]["ct"], json={"records": recs}
    )
    assert r.status_code == 200, r.text
    return "attendance_first_half", "Aarav attended the first half only", "Aarav आज केवल पहले हाफ़ में आया"


async def _attendance_present(client, w, mail, **_):
    ids = {k: s["id"] for k, s in w["students"].items()}
    recs = [rec(ids["Aarav"]), rec(ids["Bhumi"]), rec(ids["Chirag"])]
    r = await client.put(
        f"{API}/attendance/classes/{w['class']['id']}/days/{day(0)}", headers=w["heads"]["ct"], json={"records": recs}
    )
    assert r.status_code == 200, r.text
    return "attendance_present", "Aarav is present today", "Aarav आज उपस्थित है"


async def _attendance_absent(client, w, mail, **_):
    ids = {k: s["id"] for k, s in w["students"].items()}
    recs = [rec(ids["Aarav"], "absent", "absent"), rec(ids["Bhumi"], "absent", "absent"), rec(ids["Chirag"])]
    r = await client.put(
        f"{API}/attendance/classes/{w['class']['id']}/days/{day(0)}", headers=w["heads"]["ct"], json={"records": recs}
    )
    assert r.status_code == 200, r.text
    return "attendance_absent", "Aarav is absent today", "Aarav आज अनुपस्थित है"


async def _leave(client, w, mail, parents, **_):
    ids = {k: s["id"] for k, s in w["students"].items()}
    for kid in ("Aarav", "Bhumi"):
        lv = (
            await client.post(
                f"{PAR}/children/{ids[kid]}/leave",
                headers=parents[kid],
                json={"from_on": days(1), "to_on": days(2), "reason": "Trip"},
            )
        ).json()
        r = await client.post(
            f"{API}/leave/{lv['id']}/decision", headers=w["heads"]["ct"], json={"decision": "approve", "note": "Enjoy"}
        )
        assert r.status_code == 200, r.text
    return "leave_decided", "Leave approved", "छुट्टी स्वीकृत"


async def _invoice(client, w, mail, **_):
    await fee_setup(client, w)
    await run(client, w["h"], period="Q2", due="2026-12-10")
    return "fee_invoice", "Aarav: fee invoice Q2 of ₹1,23,456 is due by 10 Dec.", "Q2 की फ़ीस ₹1,23,456 है, 10 दिसंबर तक"


async def _payment(client, w, mail, **_):
    await fee_setup(client, w)
    await run(client, w["h"], period="Q2", due="2026-12-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, w["h"])}
    for kid in ("Aarav", "Bhumi"):
        await pay(client, w["h"], inv[kid]["id"], 5_000_050)
    return "fee_payment", "₹50,000.50 received for Aarav", "Aarav के लिए ₹50,000.50 प्राप्त हुए"


async def _reminder(client, w, mail, **_):
    await fee_setup(client, w)
    await run(client, w["h"], period="Q2", due="2026-12-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, w["h"])}
    ids = [inv["Aarav"]["student_id"], inv["Bhumi"]["student_id"]]
    await post(client, w["h"], "/fees/reminders/send", {"student_ids": ids}, 200)
    return (
        "fee_reminder",
        "Fee reminder: ₹1,23,456 is due for Aarav Sharma by 10-12-2026",
        "Aarav Sharma की ₹1,23,456 फ़ीस बकाया है (10 दिसंबर तक)।",
    )


async def _results(client, w, mail, **_):
    await fill_all(client, w, MARKS)
    base = f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}"
    assert (await client.post(f"{base}/publish", headers=w["heads"]["ct"])).status_code == 200
    return "result", "Results of Half-yearly are out for Aarav.", "Aarav का Half-yearly का परिणाम आ गया है।"


async def _datesheet(client, w, mail, **_):
    h = w["h"]
    s = (await client.post(f"{API}/exam-schedules", headers=h, json={"name": "Half-yearly exams"})).json()
    paper = {
        "class_id": w["class"]["id"],
        "subject_id": w["subj"]["English"]["id"],
        "paper_on": days(10),
        "starts_at": "10:00:00",
    }
    await client.put(f"{API}/exam-schedules/{s['id']}/papers", headers=h, json={"papers": [paper]})
    assert (await client.post(f"{API}/exam-schedules/{s['id']}/publish", headers=h)).status_code == 200
    return (
        "exam",
        "Date sheet for Half-yearly exams is out for Aarav.",
        "Aarav के लिए Half-yearly exams की डेटशीट आ गई है।",
    )


async def _feedback(client, w, mail, **_):
    r = await client.post(
        f"{API}/feedback",
        headers=w["h"],
        json={"title": "Term 1", "class_ids": [w["class"]["id"]], "closes_on": days(7)},
    )
    assert r.status_code == 201, r.text
    return "feedback", "Please rate Aarav's teachers: Term 1, until", "कृपया Aarav के शिक्षकों को रेटिंग दें: Term 1,"


async def _certificate(client, w, mail, **_):
    for kid in ("Aarav", "Bhumi"):
        r = await client.post(
            f"{API}/certificates",
            headers=w["h"],
            json={"student_id": w["students"][kid]["id"], "kind": "bonafide", "issued_on": days(0)},
        )
        assert r.status_code == 201, r.text
    return "certificate_issued", "Bonafide certificate", "Aarav का बोनाफ़ाइड प्रमाणपत्र"


FAMILIES = [
    _attendance,
    _attendance_present,
    _attendance_absent,
    _leave,
    _invoice,
    _payment,
    _reminder,
    _results,
    _datesheet,
    _feedback,
    _certificate,
]


@pytest.mark.parametrize("trigger", FAMILIES, ids=lambda f: f.__name__.strip("_"))
async def test_hook_family_follows_the_parents_language(trigger, client, school_a, mail):
    w = await world(client, school_a, mail)
    parents = {k: await parent_of(client, mail, k) for k in ("Aarav", "Bhumi")}
    await set_lang(client, parents["Aarav"])
    # a phone for each, to see the push text too
    push = new_push()
    for kid in parents:
        r = await client.post(
            f"{PAR}/notifications/devices", headers=parents[kid], json={"token": f"tok-{kid}-12345", "platform": "ios"}
        )
        assert r.status_code == 204
    kind, en, hi = await trigger(client, w, mail, parents=parents)
    await flush_pushes()
    hi_rows = [n for n in await inbox(fam("Aarav")) if n.kind == kind]
    en_rows = [n for n in await inbox(fam("Bhumi")) if n.kind == kind]
    assert len(hi_rows) == 1 and len(en_rows) == 1
    assert hi in hi_rows[0].body or hi in hi_rows[0].title, hi_rows[0].body
    assert en not in hi_rows[0].body
    assert "Bhumi" in en_rows[0].body and not any("ऀ" <= c <= "ॿ" for c in en_rows[0].title + en_rows[0].body)
    assert en.replace("Aarav", "Bhumi") in en_rows[0].body or en.replace("Aarav", "Bhumi") in en_rows[0].title
    # the push carries the same text as each parent's inbox row
    texts = {(m.token, m.title, m.body) for m in push.sent}
    assert ("tok-Aarav-12345", hi_rows[0].title, hi_rows[0].body) in {(t[0], t[1], t[2]) for t in texts}
    assert ("tok-Bhumi-12345", en_rows[0].title, en_rows[0].body) in texts
    # the API shows the same Hindi
    items = (await client.get(f"{PAR}/notifications", headers=parents["Aarav"])).json()["items"]
    assert any(i["kind"] == kind and (hi in i["body"] or hi in i["title"]) for i in items)


async def test_switching_back_to_english_and_the_time_of_the_event_decide(client, school_a, mail):
    w = await world(client, school_a, mail)
    pa = await parent_of(client, mail, "Aarav")
    sid = w["students"]["Aarav"]["id"]
    base = f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}"
    await fill_all(client, w, MARKS)
    await set_lang(client, pa)
    await client.post(f"{base}/publish", headers=w["heads"]["ct"])
    await set_lang(client, pa, "en")
    await client.post(f"{base}/unpublish", headers=w["heads"]["ct"])
    await client.post(f"{base}/publish", headers=w["heads"]["ct"])
    n = await only(fam("Aarav"), "result")  # replaced by the second publish, in English
    assert n.title == "Results are out" and str(n.student_id) == sid


async def test_two_guardians_each_get_their_own_language(client, school_a, mail):
    h = school_a["headers"]
    c = await make_class(client, h)
    guards = [
        {**GUARD, "name": "Mother", "relation": "mother", "email": "mum@fam.example"},
        {**GUARD, "name": "Father", "email": "dad@fam.example"},
    ]
    s = await enrol(client, h, c["id"], first="Isha", guardians=guards)
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    from studentkit import parent_headers

    mum = await parent_headers(client, mail, "mum@fam.example")
    dad = await parent_headers(client, mail, "dad@fam.example")
    await set_lang(client, mum)
    r = await client.post(
        f"{API}/certificates", headers=h, json={"student_id": s["id"], "kind": "bonafide", "issued_on": days(0)}
    )
    assert r.status_code == 201, r.text
    assert (await only("mum@fam.example", "certificate_issued")).title == "प्रमाणपत्र तैयार है"
    assert (await only("dad@fam.example", "certificate_issued")).title == "Certificate ready"
    assert dad


# ------------------------------------------------------------------ fallback and staff
async def test_no_hindi_text_falls_back_to_english_and_staff_stay_english(client, school_a, mail):
    w = await world(client, school_a, mail)
    pa = await parent_of(client, mail, "Aarav")
    await set_lang(client, pa)
    uid = (await client.get(f"{API}/auth/me", headers=pa)).json()["id"]
    sid = (await client.get(f"{API}/auth/me", headers=pa)).json()["school"]["id"]
    async with make_session(school_id=uuid.UUID(sid)) as db:
        await notify(
            db, user_ids=[uuid.UUID(uid)], kind="notice", title="Plain", body="English only", school_id=uuid.UUID(sid)
        )
        await notify(
            db,
            user_ids=[uuid.UUID(uid)],
            kind="notice",
            title="With",
            body="With",
            title_hi="हिंदी",
            body_hi="हिंदी शरीर",
            school_id=uuid.UUID(sid),
        )
        await db.commit()
    got = {n.title: n.body for n in await inbox(fam("Aarav"))}
    assert got["Plain"] == "English only" and got["हिंदी"] == "हिंदी शरीर" and "With" not in got
    # staff recipients get English even when a Hindi variant is supplied
    ct_id = w["staff"]["ct"]["id"]
    async with make_session(school_id=uuid.UUID(sid)) as db:
        await notify(
            db,
            user_ids=[uuid.UUID(ct_id)],
            kind="notice",
            title="T",
            body="B",
            title_hi="टी",
            body_hi="बी",
            school_id=uuid.UUID(sid),
        )
        await db.commit()
    assert [n.title for n in await inbox("ct@rps.example")][-1] == "T"


# ------------------------------------------------------------------ rollover
async def test_rollover_messages_follow_language(client, school_a, mail):
    w = await rolloverkit.world(client, school_a, mail)
    await set_lang(client, w["parents"]["Aarav"])
    await set_lang(client, w["parents"]["Diya"])
    await rolloverkit.apply(client, w["h"])
    a = await only(fam("Aarav"), "promotion_promoted")
    assert a.title == "बधाई हो!" and "अब" in a.body and "कक्षा 9-A" in a.body and "Aarav" in a.body
    b = await only(fam("Bhumi"), "promotion_promoted")
    assert b.title == "Congratulations!" and "is now in Class 9-A" in b.body
    d = await only(fam("Diya"), "promotion_completed")
    assert "ने कक्षा 12-A पूरी कर ली है" in d.body


# ------------------------------------------------------------------ emails
async def test_fee_reminder_email_language(client, school_a, mail):
    w = await world(client, school_a, mail)
    pa = await parent_of(client, mail, "Aarav")
    await set_lang(client, pa)
    await fee_setup(client, w)
    await run(client, w["h"], period="Q2", due="2026-12-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, w["h"])}
    ids = [inv["Aarav"]["student_id"], inv["Bhumi"]["student_id"]]
    mail.sent.clear()
    r = await post(client, w["h"], "/fees/reminders/send", {"student_ids": ids, "email": True}, 200)
    assert r.json()["emailed"] == 2
    hi = mail.last_to(fam("Aarav"))
    en = mail.last_to(fam("Bhumi"))
    assert hi.subject == "फ़ीस की याद दिलाना" and "फ़ीस बकाया है" in hi.body and "10 दिसंबर" in hi.body
    assert en.subject == "Fee reminder" and en.body.startswith("Fee reminder: ₹1,23,456 is due for Bhumi Sharma")


async def test_login_mail_is_bilingual_for_parents_only(client, school_a, mail):
    await world(client, school_a, mail)
    parent = mail.last_to(fam("Aarav"))
    assert "Temporary password:" in parent.body and "नमस्ते" in parent.body and "अस्थायी पासवर्ड" in parent.body
    assert temp_password_from(mail, fam("Aarav"))
    staff_mail = mail.last_to("ct@rps.example")
    assert "Temporary password:" in staff_mail.body and not any("ऀ" <= c <= "ॿ" for c in staff_mail.body)
    # unit level
    assert "नमस्ते" not in login_mail(name="T", email="t@x.io", password="pw", school="S").body
    assert "नमस्ते" in reset_mail(name="P", email="p@x.io", token="tk", parent=True).body
    assert "नमस्ते" not in reset_mail(name="T", email="t@x.io", token="tk").body
    # a real reset request for a parent and for staff
    mail.sent.clear()
    for e in (fam("Aarav"), "ct@rps.example"):
        assert (await client.post(f"{API}/auth/forgot-password", json={"email": e})).status_code in (200, 202, 204)
    assert "नमस्ते" in mail.last_to(fam("Aarav")).body
    assert "नमस्ते" not in mail.last_to("ct@rps.example").body


# ------------------------------------------------------------------ parent-facing prose
async def test_payment_and_thread_notices_come_with_hindi(client, school_a, mail):
    w = await world(client, school_a, mail)
    pa = await parent_of(client, mail, "Aarav")
    await fee_setup(client, w)
    await run(client, w["h"], period="Q2", due="2026-12-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, w["h"])}
    p = await pay(client, w["h"], inv["Aarav"]["id"], 100_000)
    sid = w["students"]["Aarav"]["id"]
    r = await client.get(f"{PAR}/children/{sid}/fees/receipts/{p['id']}", headers=pa)
    assert r.status_code == 200, r.text
    assert r.json()["status_label"] == "Paid" and r.json()["status_label_hi"] == "भुगतान हो गया"


async def test_message_notification_and_thread_notice_in_hindi(client, school_a, mail):
    new_push()
    w = await msgkit.world(client, school_a["headers"], mail)
    ph, ct = w["parents"]["rakesh"], w["staff"]["ct"]["h"]
    await set_lang(client, ph)
    t = (
        await client.post(
            f"{PAR}/threads",
            headers=ph,
            json={"student_id": w["aarav"]["id"], "staff_id": w["staff"]["ct"]["id"], "subject_id": None},
        )
    ).json()
    await client.post(f"{API}/messaging/threads/{t['id']}/messages", headers=ct, json={"body": "Get well soon"})
    n = await only("rakesh@example.com", "message")
    assert n.title == "Rajiv Mishra का संदेश" and n.body == "Get well soon"
    await client.put(
        f"{API}/academic/classes/{w['a']['id']}/class-teacher",
        headers=w["admin"],
        json={"staff_id": w["staff"]["ct2"]["id"]},
    )
    th = (await client.get(f"{PAR}/threads/{t['id']}", headers=ph)).json()
    assert th["inactive_notice"] == "Rajiv Mishra is no longer the class teacher of Aarav Sharma."
    assert th["inactive_notice_hi"] == "Rajiv Mishra अब Aarav Sharma के कक्षा अध्यापक नहीं हैं।"


# ------------------------------------------------------------------ cross school
async def test_language_does_not_cross_schools(client, school_a, school_b, mail):
    await world(client, school_a, mail)
    pa = await parent_of(client, mail, "Aarav")
    await set_lang(client, pa)
    hb = school_b["headers"]
    cb = await make_class(client, hb)
    await enrol(client, hb, cb["id"], first="Bimal", guardians=[{**GUARD, "name": "B", "email": "bimal@fam.example"}])
    await client.post(f"{API}/parents/send-login", headers=hb, json={})
    from studentkit import parent_headers

    pb = await parent_headers(client, mail, "bimal@fam.example")
    assert (await client.get(f"{PAR}/preferences", headers=pb)).json() == {"language": "en"}
    async with make_session(
        school_id=uuid.UUID((await client.get(f"{API}/auth/me", headers=pb)).json()["school"]["id"])
    ) as db:
        langs = {u.email: u.language for u in (await db.scalars(select(User))).all()}
    assert "bimal@fam.example" in langs and fam("Aarav") not in langs  # school A's parent is invisible to school B
    r = await client.post(
        f"{API}/certificates",
        headers=hb,
        json={"student_id": "00000000-0000-0000-0000-000000000000", "kind": "bonafide", "issued_on": days(0)},
    )
    assert r.status_code in (404, 422)
    assert [n.kind for n in await inbox(fam("Aarav"))] == []
    assert add_staff and staff_headers
