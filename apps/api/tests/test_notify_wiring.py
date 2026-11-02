"""The no-op notification hooks of the other modules, wired to the notifications service: who gets which inbox row,
rollback leaves nothing behind, push goes out after the commit, and nobody outside the family/school is told."""

import uuid
from datetime import timedelta

from attkit import day, rec
from conftest import API
from feekit import head, invoices, pay, post, run, structure
from msgkit import new_push
from resultskit import fill_all, parent_of, world
from sqlalchemy import delete, func, select
from studentkit import GUARD, enrol
from timekit import MON, period, staff

from app.core.clock import today_ist
from app.core.money import rupees
from app.db.session import make_session
from app.models.academic import SchoolClass
from app.models.attendance import LeaveRequest
from app.models.certificate import Certificate
from app.models.fees import FeePayment
from app.models.notification import Notification
from app.models.results import Exam, ExamSchedule
from app.models.student import Student
from app.models.user import User
from app.services.notifications import KIND_CATEGORY, flush_pushes

PAR = f"{API}/parent"
MARKS = {"Aarav": (90, 45), "Bhumi": (60, 30), "Chirag": (40, 20)}


def days(n):
    return (today_ist() + timedelta(days=n)).isoformat()


async def inbox(email: str) -> list[Notification]:
    """Every inbox row of one user (by email), oldest first."""
    async with make_session(bypass=True) as db:
        rows = await db.scalars(
            select(Notification)
            .join(User, User.id == Notification.user_id)
            .where(User.email == email)
            .order_by(Notification.created_at, Notification.id)
        )
        return list(rows.all())


def fam(kid: str) -> str:
    return f"{kid.lower()}@fam.example"


async def all_rows() -> list[Notification]:
    async with make_session(bypass=True) as db:
        return list((await db.scalars(select(Notification))).all())


async def only(email: str, kind: str) -> Notification:
    rows = [n for n in await inbox(email) if n.kind == kind]
    assert len(rows) == 1, [(n.kind, n.title) for n in await inbox(email)]
    return rows[0]


async def fee_setup(client, w, tuition=12_345_600):
    h = w["h"]
    t = await head(client, h, "Tuition")
    await structure(client, h, w["class"]["id"], t["id"], tuition)


async def other_class_family(client, w, first="Zoya"):
    """A pupil of class 9-A with a parent login: they must never be told about class 8-A."""
    h = w["h"]
    c9 = (await client.post(f"{API}/academic/classes", headers=h, json={"grade": "9", "section": "A"})).json()
    await enrol(client, h, c9["id"], first=first, guardians=[{**GUARD, "name": "Z Parent", "email": fam(first)}])
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    return c9


# ------------------------------------------------------------------ the money helper
def test_rupees_uses_indian_grouping():
    assert rupees(0) == "₹0"
    assert rupees(99) == "₹0.99"
    assert rupees(500_000) == "₹5,000"
    assert rupees(12_345_600) == "₹1,23,456"
    assert rupees(12_345_650) == "₹1,23,456.50"
    assert rupees(1_000_000_000) == "₹1,00,00,000"
    assert rupees(-150_000) == "-₹1,500"


def test_every_new_kind_has_a_category():
    for kind in ("fee_invoice", "substitute_assigned", "certificate_issued"):
        assert kind in KIND_CATEGORY


# ------------------------------------------------------------------ attendance
async def test_attendance_saved_notifies_guardians_and_a_resave_replaces(client, school_a, mail):
    w = await world(client, school_a, mail)
    push = new_push()
    pa = await parent_of(client, mail, "Aarav")
    r = await client.post(
        f"{PAR}/notifications/devices", headers=pa, json={"token": "tok-aarav-1234", "platform": "ios"}
    )
    assert r.status_code == 204
    other = await other_class_family(client, w)
    ids = {k: s["id"] for k, s in w["students"].items()}
    ct, cid = w["heads"]["ct"], w["class"]["id"]

    async def save(a1="present", a2="present", on=day(0)):
        recs = [rec(ids["Aarav"], a1, a2), rec(ids["Bhumi"], "present", "absent"), rec(ids["Chirag"])]
        r = await client.put(f"{API}/attendance/classes/{cid}/days/{on}", headers=ct, json={"records": recs})
        assert r.status_code == 200, r.text

    await save("absent", "absent")
    a = await only(fam("Aarav"), "attendance_absent")
    b = await only(fam("Bhumi"), "attendance_first_half")
    c = await only(fam("Chirag"), "attendance_present")
    assert a.title == "Aarav is absent today" and a.student_id == uuid.UUID(ids["Aarav"]) and a.dedupe_key
    assert b.title == "Bhumi attended the first half only" and c.title == "Chirag is present today"
    await flush_pushes()
    assert [m.title for m in push.sent] == ["Aarav is absent today"]  # only Aarav's parent has a phone registered
    # Aarav's mark is corrected: his absent message is replaced; the others are not sent again
    await save("present", "present")
    assert [n.kind for n in await inbox(fam("Aarav"))] == ["attendance_present"]
    assert (await only(fam("Bhumi"), "attendance_first_half")).id == b.id
    assert (await only(fam("Chirag"), "attendance_present")).id == c.id
    # another day (not today) saves quietly; other families and the other class are untouched
    await save(on=day(1))
    assert len(await inbox(fam("Aarav"))) == 1
    assert await inbox(fam("Zoya")) == [] and other["id"]
    n = await client.get(f"{PAR}/notifications", headers=pa)
    assert n.json()["unread"] == 1 and n.json()["items"][0]["title"] == "Aarav is present today"


# ------------------------------------------------------------------ leave
async def test_leave_decision_notifies_the_childs_parents_only(client, school_a, mail):
    w = await world(client, school_a, mail)
    ids = {k: s["id"] for k, s in w["students"].items()}
    ct = w["heads"]["ct"]
    pa, pb = await parent_of(client, mail, "Aarav"), await parent_of(client, mail, "Bhumi")
    f, t = days(1), days(2)
    lv = (
        await client.post(
            f"{PAR}/children/{ids['Aarav']}/leave", headers=pa, json={"from_on": f, "to_on": t, "reason": "Trip"}
        )
    ).json()
    assert await inbox(fam("Aarav")) == []  # applying tells the parent nothing
    r = await client.post(f"{API}/leave/{lv['id']}/decision", headers=ct, json={"decision": "approve", "note": "Enjoy"})
    assert r.status_code == 200, r.text
    n = await only(fam("Aarav"), "leave_decided")
    assert n.title == "Leave approved" and "Aarav" in n.body and "Enjoy" in n.body and n.data["status"] == "approved"
    lv2 = (
        await client.post(f"{PAR}/children/{ids['Bhumi']}/leave", headers=pb, json={"from_on": f, "reason": "Fever"})
    ).json()
    await client.post(f"{API}/leave/{lv2['id']}/decision", headers=ct, json={"decision": "reject"})
    n2 = await only(fam("Bhumi"), "leave_decided")
    assert (
        n2.title == "Leave not approved"
        and n2.body.startswith("Leave for Bhumi")
        and n2.student_id == uuid.UUID(ids["Bhumi"])
    )
    assert await inbox(fam("Chirag")) == []
    assert (await client.get(f"{PAR}/notifications", headers=pb)).json()["unread"] == 1


# ------------------------------------------------------------------ fees
async def test_fee_invoice_payment_reminder_and_left_child(client, school_a, mail):
    w = await world(client, school_a, mail)
    h = w["h"]
    await fee_setup(client, w)
    await other_class_family(client, w)
    await run(client, h, period="Q2", due="2026-12-10")
    n = await only(fam("Aarav"), "fee_invoice")
    assert (
        n.title == "New fee invoice"
        and n.body == "Aarav: fee invoice Q2 of ₹1,23,456 is due by 10 Dec."
        and n.data["amount_paise"] == 12_345_600
    )
    assert await inbox(fam("Zoya")) == []  # no fee structure for 9-A: no invoice, and never Aarav's
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, h)}
    p = await pay(client, h, inv["Aarav"]["id"], 5_000_050)
    n = await only(fam("Aarav"), "fee_payment")
    assert n.body == f"₹50,000.50 received for Aarav, receipt {p['receipt_no']}."
    assert [x.kind for x in await inbox(fam("Bhumi"))] == ["fee_invoice"]
    # a reminder (once per 3 days) goes to the family of each child with a balance
    await post(client, h, "/fees/reminders/send", {"student_ids": [inv["Bhumi"]["student_id"]]}, 200)
    n = await only(fam("Bhumi"), "fee_reminder")
    assert n.title == "Fee reminder" and n.body.startswith(
        "Fee reminder: ₹1,23,456 is due for Bhumi Sharma by 10-12-2026"
    )
    await post(client, h, "/fees/reminders/send", {"student_ids": [inv["Bhumi"]["student_id"]]}, 200)
    assert len([x for x in await inbox(fam("Bhumi")) if x.kind == "fee_reminder"]) == 1  # skipped: reminded recently
    # a child who has left gets no fee messages
    cid = w["students"]["Chirag"]["id"]
    r = await client.post(f"{API}/students/{cid}/leave", headers=h, json={"reason": "Moved", "left_on": days(-1)})
    assert r.status_code == 200, r.text
    await pay(client, h, inv["Chirag"]["id"], 100_000)
    assert [x.kind for x in await inbox(fam("Chirag"))] == ["fee_invoice"]


# ------------------------------------------------------------------ results
async def test_publishing_results_notifies_each_childs_parents(client, school_a, mail):
    w = await world(client, school_a, mail)
    await other_class_family(client, w)
    await fill_all(client, w, MARKS)
    for k in MARKS:
        assert await inbox(fam(k)) == []
    base = f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}"
    assert (await client.post(f"{base}/publish", headers=w["heads"]["ct"])).status_code == 200
    for k in MARKS:
        n = await only(fam(k), "result")
        assert n.title == "Results are out" and n.body == f"Results of Half-yearly are out for {k}."
        assert n.student_id == uuid.UUID(w["students"][k]["id"])
    assert await inbox(fam("Zoya")) == []
    # unpublish and publish again replaces the message instead of doubling it
    await client.post(f"{base}/unpublish", headers=w["heads"]["ct"])
    await client.post(f"{base}/publish", headers=w["heads"]["ct"])
    assert len(await inbox(fam("Aarav"))) == 1


# ------------------------------------------------------------------ date sheet and feedback
async def test_date_sheet_and_feedback_reach_only_the_classes_families(client, school_a, mail):
    w = await world(client, school_a, mail)
    h = w["h"]
    await other_class_family(client, w)
    s = (await client.post(f"{API}/exam-schedules", headers=h, json={"name": "Half-yearly exams"})).json()
    paper = {
        "class_id": w["class"]["id"],
        "subject_id": w["subj"]["English"]["id"],
        "paper_on": days(10),
        "starts_at": "10:00:00",
    }
    await client.put(f"{API}/exam-schedules/{s['id']}/papers", headers=h, json={"papers": [paper]})
    assert await inbox(fam("Aarav")) == []  # a draft tells nobody
    assert (await client.post(f"{API}/exam-schedules/{s['id']}/publish", headers=h)).status_code == 200
    for k in MARKS:
        n = await only(fam(k), "exam")
        assert n.title == "Date sheet published" and n.body == f"Date sheet for Half-yearly exams is out for {k}."
    # feedback: a draft is silent, opening it notifies
    r = await client.post(
        f"{API}/feedback",
        headers=h,
        json={"title": "Term 1", "class_ids": [w["class"]["id"]], "closes_on": days(7), "open_now": False},
    )
    assert r.status_code == 201, r.text
    assert [x.kind for x in await inbox(fam("Aarav"))] == ["exam"]
    assert (await client.post(f"{API}/feedback/{r.json()['id']}/open", headers=h)).status_code in (200, 204)
    n = await only(fam("Aarav"), "feedback")
    assert n.title == "Rate your child's teachers" and n.body.startswith("Please rate Aarav's teachers: Term 1, until ")
    r2 = await client.post(
        f"{API}/feedback", headers=h, json={"title": "Term 2", "class_ids": [w["class"]["id"]], "closes_on": days(9)}
    )
    assert r2.status_code == 201
    assert len([x for x in await inbox(fam("Bhumi")) if x.kind == "feedback"]) == 2
    assert await inbox(fam("Zoya")) == []


# ------------------------------------------------------------------ timetable and certificates
async def test_substitute_gets_a_notification_and_so_does_the_family_for_a_certificate(client, school_a, mail):
    w = await world(client, school_a, mail)
    h = w["h"]
    p1 = await period(client, h, 1)
    sl = await client.post(
        f"{API}/timetable/slots",
        headers=h,
        json={
            "class_id": w["class"]["id"],
            "weekday": 1,
            "period_id": p1["id"],
            "subject_id": w["subj"]["Mathematics"]["id"],
            "staff_id": w["staff"]["maths"]["id"],
        },
    )
    assert sl.status_code == 201, sl.text
    r = await client.post(
        f"{API}/timetable/absences", headers=h, json={"staff_id": w["staff"]["maths"]["id"], "absent_on": MON}
    )
    assert r.status_code == 201, r.text
    chetan = await staff(client, h, mail, "chetan@rps.example")
    body = {"slot_id": sl.json()["id"], "covers_on": MON, "substitute_staff_id": chetan["id"]}
    assert (await client.post(f"{API}/timetable/substitutions", headers=h, json=body)).status_code == 201
    n = await only("chetan@rps.example", "substitute_assigned")
    assert (
        n.title == "You are covering a class"
        and n.body
        == "You cover 8-A period 1 (Mathematics) for Maths Teacher on 2 Nov.".replace(
            "period 1 (Mathematics) for", "period 1 (Mathematics) on 2 Nov for"
        ).replace(" on 2 Nov.", ".")
    )
    assert n.data["covers_on"] == MON
    assert (
        await inbox("maths@rps.example") == [] and await inbox(fam("Aarav")) == []
    )  # not the absent teacher, not parents
    # a certificate: bonafide for Aarav, and a transfer certificate for a child who is leaving (the family is told too)
    r = await client.post(
        f"{API}/certificates",
        headers=h,
        json={"student_id": w["students"]["Aarav"]["id"], "kind": "bonafide", "issued_on": days(0)},
    )
    assert r.status_code == 201, r.text
    n = await only(fam("Aarav"), "certificate_issued")
    assert n.title == "Certificate ready" and n.body == f"Bonafide certificate {r.json()['number']} for Aarav is ready."
    r = await client.post(
        f"{API}/certificates",
        headers=h,
        json={
            "student_id": w["students"]["Chirag"]["id"],
            "kind": "transfer",
            "issued_on": days(0),
            "left_on": days(0),
            "reason": "Moved",
            "conduct": "Good",
        },
    )
    assert r.status_code == 201, r.text
    assert (await only(fam("Chirag"), "certificate_issued")).body.startswith("Transfer certificate")
    assert await inbox(fam("Bhumi")) == []


# ------------------------------------------------------------------ rollback and isolation
async def test_a_rolled_back_change_leaves_no_notification_and_no_push(client, school_a, mail):
    w = await world(client, school_a, mail)
    h = w["h"]
    push = new_push()
    pa = await parent_of(client, mail, "Aarav")
    assert (
        await client.post(
            f"{PAR}/notifications/devices", headers=pa, json={"token": "tok-rb-123456", "platform": "android"}
        )
    ).status_code == 204
    await fee_setup(client, w)
    await run(client, h, period="Q2", due="2026-12-10")
    inv = {i["student_name"].split()[0]: i for i in await invoices(client, h)}
    await pay(client, h, inv["Aarav"]["id"], 100_000)
    aarav = uuid.UUID(w["students"]["Aarav"]["id"])
    await fill_all(client, w, MARKS)
    await client.post(
        f"{API}/certificates", headers=h, json={"student_id": str(aarav), "kind": "bonafide", "issued_on": days(0)}
    )
    lv = (
        await client.post(f"{PAR}/children/{aarav}/leave", headers=pa, json={"from_on": days(1), "reason": "Fever"})
    ).json()
    await client.post(f"{API}/leave/{lv['id']}/decision", headers=w["heads"]["ct"], json={"decision": "approve"})
    sched = (await client.post(f"{API}/exam-schedules", headers=h, json={"name": "Unit test"})).json()
    paper = {
        "class_id": w["class"]["id"],
        "subject_id": w["subj"]["English"]["id"],
        "paper_on": days(10),
        "starts_at": "10:00:00",
    }
    await client.put(f"{API}/exam-schedules/{sched['id']}/papers", headers=h, json={"papers": [paper]})
    await flush_pushes()
    push.sent.clear()
    async with make_session(bypass=True) as db:
        await db.execute(delete(Notification))
        await db.commit()
    assert await all_rows() == []

    from app.services import datesheet, fee_notify, feedback, leave, results
    from app.services.attendance import _notify_attendance_saved
    from app.services.certificates import _notify_certificate_issued

    cid = uuid.UUID(w["class"]["id"])
    async with make_session(bypass=True) as db:
        school_id = (await db.get(SchoolClass, cid)).school_id
    async with make_session(school_id=school_id) as db:
        stu = await db.get(Student, aarav)
        cls = await db.get(SchoolClass, cid)
        exam = await db.get(Exam, uuid.UUID(w["exam"]["id"]))
        payment = await db.scalar(select(FeePayment))
        lr = await db.scalar(select(LeaveRequest))
        cert = await db.scalar(select(Certificate))
        sch = await db.get(ExamSchedule, uuid.UUID(sched["id"]))
        req_id = (
            await client.post(
                f"{API}/feedback",
                headers=h,
                json={"title": "Rb", "class_ids": [str(cid)], "closes_on": days(5), "open_now": False},
            )
        ).json()["id"]
        req = await db.get(feedback.FeedbackRequest, uuid.UUID(req_id))
        await db.execute(delete(Notification))
        hooks = [
            _notify_attendance_saved(db, cls, today_ist(), [(stu, "absent")]),
            fee_notify._notify_payment_received(db, payment),
            fee_notify._notify_reminder(db, aarav, "Fee reminder: test"),
            leave._notify_leave_decided(db, lr, stu),
            results._notify_results_published(db, exam, cls, [aarav]),
            datesheet._notify_datesheet_published(db, sch, [cid]),
            feedback._notify_feedback_requested(db, req, [cid]),
            _notify_certificate_issued(db, cert, stu),
        ]
        names = ["attendance", "payment", "reminder", "leave", "results", "datesheet", "feedback", "certificate"]
        for name, coro in zip(names, hooks, strict=True):
            before = await db.scalar(select(func.count()).select_from(Notification))
            await coro
            assert await db.scalar(select(func.count()).select_from(Notification)) > before, name
        await db.rollback()
    await flush_pushes()
    assert await all_rows() == [] and push.sent == []
    # the same hooks, committed, do reach the parent's phone afterwards
    async with make_session(school_id=school_id) as db:
        await fee_notify._notify_reminder(db, aarav, "Fee reminder: test")
        await flush_pushes()
        assert push.sent == []
        await db.commit()
    await flush_pushes()
    assert [m.title for m in push.sent] == ["Fee reminder"]


async def test_no_notification_crosses_a_school_or_a_family(client, school_a, school_b, mail):
    w = await world(client, school_a, mail)
    hb = school_b["headers"]
    pa = await parent_of(client, mail, "Aarav")
    # school B has its own pupil whose parent shares nothing with school A, and a teacher
    from studentkit import make_class

    cb = await make_class(client, hb)
    await enrol(
        client, hb, cb["id"], first="Bimal", guardians=[{**GUARD, "name": "B Parent", "email": "bimal@fam.example"}]
    )
    await client.post(f"{API}/parents/send-login", headers=hb, json={})
    await fee_setup(client, w)
    await run(client, w["h"], period="Q2", due="2026-12-10")
    await fill_all(client, w, MARKS)
    await client.post(f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}/publish", headers=w["heads"]["ct"])
    ids = {k: s["id"] for k, s in w["students"].items()}
    await client.put(
        f"{API}/attendance/classes/{w['class']['id']}/days/{day(0)}",
        headers=w["heads"]["ct"],
        json={"records": [rec(ids[k]) for k in MARKS]},
    )
    rows = await all_rows()
    assert rows
    async with make_session(bypass=True) as db:
        users = {u.id: u for u in (await db.scalars(select(User))).all()}
    school_of_a = users[rows[0].user_id].school_id
    assert all(n.school_id == school_of_a == users[n.user_id].school_id for n in rows)
    assert await inbox("bimal@fam.example") == []
    assert (await client.get(f"{API}/notifications", headers=hb)).json()["total"] == 0
    # every row of a parent belongs to that parent's own child, and Aarav's parent sees nothing about Bhumi or Chirag
    own = (await client.get(f"{PAR}/notifications", headers=pa)).json()["items"]
    assert own and {i["student_id"] for i in own} == {ids["Aarav"]}
    assert len(own) == len(await inbox(fam("Aarav")))
