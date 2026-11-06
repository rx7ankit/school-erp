"""Library: books and copies, issue/return/renew, fines (IST days, waive), lost/damaged, reminders, parents, export."""

import asyncio
import io
import uuid
from datetime import timedelta

from conftest import API, add_staff, staff_headers
from openpyxl import load_workbook
from sqlalchemy import select, update
from studentkit import enrol, make_class, parent_headers, teacher

from app.core.clock import today_ist, utcnow
from app.db.session import make_session
from app.jobs import tasks
from app.models.audit import AuditLog
from app.models.library import LibraryLoan
from app.models.notification import Notification

L = f"{API}/library"


async def world(client, h, mail, *, fine=500, loan_days=14):
    cls = await make_class(client, h)
    aarav = await enrol(
        client,
        h,
        cls["id"],
        guardians=[{"name": "R", "phone": "9876543210", "email": "aarav@fam.example"}],
        create_parent_login=True,
        send_login=True,
    )
    bina = await enrol(
        client,
        h,
        cls["id"],
        first="Bina",
        guardians=[{"name": "S", "phone": "9876543211", "email": "bina@fam.example"}],
    )
    r = await client.put(f"{L}/settings", headers=h, json={"loan_days": loan_days, "fine_per_day_paise": fine})
    assert r.status_code == 200, r.text
    r = await client.post(
        f"{L}/books",
        headers=h,
        json={
            "title": "Wings of Fire",
            "author": "A P J Abdul Kalam",
            "isbn": "9788173711466",
            "category": "Biography",
            "copies": 2,
        },
    )
    assert r.status_code == 201, r.text
    return {"cls": cls, "aarav": aarav, "bina": bina, "book": r.json()}


async def issue(client, h, copy, **who):
    r = await client.post(f"{L}/loans", headers=h, json={"copy_id": copy, **who})
    return r


async def backdate(loan_id, days):
    """Moves the due date into the past (issue refuses past dates)."""
    s = make_session(bypass=True)
    try:
        await s.execute(
            update(LibraryLoan)
            .where(LibraryLoan.id == uuid.UUID(loan_id))
            .values(due_on=today_ist() - timedelta(days=days))
        )
        await s.commit()
    finally:
        await s.close()


async def audits(action):
    s = make_session(bypass=True)
    try:
        return (await s.scalars(select(AuditLog).where(AuditLog.action == action))).all()
    finally:
        await s.close()


async def test_books_copies_search_and_counts(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    book = w["book"]
    assert [c["accession_no"] for c in book["copies"]] == ["LIB-00001", "LIB-00002"]
    assert book["copies_total"] == 2 and book["available"] == 2
    r = await client.post(
        f"{L}/books", headers=h, json={"title": "Malgudi Days", "author": "R K Narayan", "category": "Fiction"}
    )
    other = r.json()
    more = await client.post(f"{L}/books/{other['id']}/copies", headers=h, json={"count": 3})
    assert [c["accession_no"] for c in more.json()] == ["LIB-00003", "LIB-00004", "LIB-00005"]
    for q, n in (("wings", 1), ("narayan", 1), ("9788173", 1), ("fiction", 1), ("zzz", 0)):
        got = (await client.get(f"{L}/books", headers=h, params={"q": q})).json()
        assert got["total"] == n, q
    # custom accession number: unique per school
    ok = await client.post(f"{L}/books/{other['id']}/copies", headers=h, json={"accession_no": "XY-1"})
    assert ok.status_code == 201
    dup = await client.post(f"{L}/books/{book['id']}/copies", headers=h, json={"accession_no": "XY-1"})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "accession_taken"
    # availability counts follow loans; the book with copies cannot be deleted
    await issue(client, h, book["copies"][0]["id"], student_id=w["aarav"]["id"])
    got = (await client.get(f"{L}/books/{book['id']}", headers=h)).json()
    assert (got["available"], got["issued"]) == (1, 1)
    only = (await client.get(f"{L}/books", headers=h, params={"available_only": True})).json()
    assert only["total"] == 2
    assert (await client.delete(f"{L}/books/{book['id']}", headers=h)).json()["error"]["code"] == "has_copies"
    empty = (await client.post(f"{L}/books", headers=h, json={"title": "Empty"})).json()
    assert (await client.delete(f"{L}/books/{empty['id']}", headers=h)).status_code == 204
    patched = await client.patch(f"{L}/books/{book['id']}", headers=h, json={"author": "Kalam"})
    assert patched.json()["author"] == "Kalam"


async def test_accession_numbers_are_race_safe(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    rs = await asyncio.gather(
        *[client.post(f"{L}/books/{w['book']['id']}/copies", headers=h, json={"count": 2}) for _ in range(6)]
    )
    nos = [c["accession_no"] for r in rs for c in r.json()]
    assert all(r.status_code == 201 for r in rs) and len(nos) == len(set(nos)) == 12


async def test_issue_return_on_time_has_no_fine_and_default_due_date(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    copy = w["book"]["copies"][0]
    r = await issue(client, h, copy["id"], student_id=w["aarav"]["id"])
    assert r.status_code == 201, r.text
    loan = r.json()
    assert loan["due_on"] == (today_ist() + timedelta(days=14)).isoformat()
    assert loan["status"] == "open" and loan["student_name"] == "Aarav Sharma" and loan["borrower_type"] == "student"
    # the same copy cannot be issued twice, by id or by accession number
    again = await client.post(
        f"{L}/loans", headers=h, json={"accession_no": copy["accession_no"], "student_id": w["bina"]["id"]}
    )
    assert again.status_code == 409 and again.json()["error"]["code"] == "copy_not_available"
    done = await client.post(f"{L}/loans/{loan['id']}/return", headers=h)
    assert done.status_code == 200 and done.json()["status"] == "returned" and done.json()["fine_paise"] == 0
    assert (await client.post(f"{L}/loans/{loan['id']}/return", headers=h)).json()["error"]["code"] == "loan_closed"
    assert (await client.get(f"{L}/books/{w['book']['id']}", headers=h)).json()["available"] == 2
    # issued by accession number to a staff member with an explicit due date
    t = await teacher(client, h, mail, email="t1@rps.example")
    staff_id = (await client.get(f"{API}/auth/me", headers=t)).json()["id"]
    due = (today_ist() + timedelta(days=3)).isoformat()
    s = await client.post(
        f"{L}/loans", headers=h, json={"accession_no": copy["accession_no"], "staff_id": staff_id, "due_on": due}
    )
    assert s.status_code == 201 and s.json()["borrower_type"] == "staff" and s.json()["due_on"] == due
    assert s.json()["staff_name"] == "t1"
    assert [
        x["id"]
        for x in (await client.get(f"{L}/loans", headers=h, params={"staff_id": staff_id, "status": "all"})).json()[
            "items"
        ]
    ] == [s.json()["id"]]
    assert {a.action for a in await audits("library.issued")} == {"library.issued"} and len(
        await audits("library.issued")
    ) == 2
    assert len(await audits("library.returned")) == 1


async def test_issue_validation(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    c = w["book"]["copies"][0]["id"]
    both = await issue(client, h, c, student_id=w["aarav"]["id"], staff_id=str(uuid.uuid4()))
    none = await issue(client, h, c)
    assert both.status_code == none.status_code == 422 and none.json()["error"]["code"] == "one_borrower"
    past = await issue(client, h, c, student_id=w["aarav"]["id"], due_on=(today_ist() - timedelta(days=1)).isoformat())
    assert past.json()["error"]["code"] == "due_in_past"
    assert (await issue(client, h, c, student_id=str(uuid.uuid4()))).status_code == 404
    assert (await issue(client, h, str(uuid.uuid4()), student_id=w["aarav"]["id"])).status_code == 404
    # a student who has left cannot borrow
    await client.post(f"{API}/students/{w['bina']['id']}/leave", headers=h, json={"reason": "moved"})
    assert (await issue(client, h, c, student_id=w["bina"]["id"])).json()["error"]["code"] == "student_not_active"
    # a parent is not "staff"
    me = await client.get(f"{API}/auth/me", headers=h)
    assert (await issue(client, h, c, staff_id=me.json()["id"])).status_code == 201


async def test_concurrent_issue_of_one_copy_has_one_winner(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    c = w["book"]["copies"][0]["id"]
    rs = await asyncio.gather(
        issue(client, h, c, student_id=w["aarav"]["id"]),
        issue(client, h, c, student_id=w["bina"]["id"]),
        issue(client, h, c, student_id=w["aarav"]["id"]),
    )
    assert sorted(r.status_code for r in rs) == [201, 409, 409]


async def test_overdue_fine_is_days_past_due_times_rate_and_is_audited(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail, fine=250)
    loan = (await issue(client, h, w["book"]["copies"][0]["id"], student_id=w["aarav"]["id"])).json()
    await backdate(loan["id"], 4)
    od = (await client.get(f"{L}/overdue", headers=h)).json()
    assert od["total"] == 1
    row = od["items"][0]
    assert row["overdue"] and row["days_overdue"] == 4 and row["fine_paise"] == 1000 and row["status"] == "overdue"
    assert (await client.get(f"{L}/loans", headers=h, params={"status": "overdue"})).json()["total"] == 1
    # due today is not overdue
    ok = (
        await issue(client, h, w["book"]["copies"][1]["id"], student_id=w["bina"]["id"], due_on=today_ist().isoformat())
    ).json()
    assert ok["overdue"] is False and ok["days_overdue"] == 0
    ret = (await client.post(f"{L}/loans/{loan['id']}/return", headers=h, json={})).json()
    assert ret["fine_paise"] == 1000 and ret["fine_waived_paise"] == 0 and ret["days_overdue"] == 4
    assert len(await audits("library.fine_charged")) == 1
    assert (await client.get(f"{L}/overdue", headers=h)).json()["total"] == 0


async def test_fine_waive_needs_a_reason_and_is_audited(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail, fine=300)
    loan = (await issue(client, h, w["book"]["copies"][0]["id"], student_id=w["aarav"]["id"])).json()
    await backdate(loan["id"], 2)
    no = await client.post(f"{L}/loans/{loan['id']}/return", headers=h, json={"waive_fine": True})
    assert no.status_code == 422 and no.json()["error"]["code"] == "waive_reason_required"
    # nothing changed by the refused attempt
    assert (await client.get(f"{L}/loans", headers=h, params={"status": "open"})).json()["total"] == 1
    r = await client.post(
        f"{L}/loans/{loan['id']}/return", headers=h, json={"waive_fine": True, "waive_reason": "Was ill"}
    )
    j = r.json()
    assert j["fine_paise"] == 0 and j["fine_waived_paise"] == 600 and j["waive_reason"] == "Was ill"
    a = await audits("library.fine_waived")
    assert len(a) == 1 and "₹6" in a[0].summary and a[0].category == "fees"
    assert await audits("library.fine_charged") == []


async def test_fine_override_and_zero_rate(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail, fine=0)
    loan = (await issue(client, h, w["book"]["copies"][0]["id"], student_id=w["aarav"]["id"])).json()
    await backdate(loan["id"], 10)
    assert (await client.get(f"{L}/overdue", headers=h)).json()["items"][0]["fine_paise"] == 0
    r = await client.post(
        f"{L}/loans/{loan['id']}/return", headers=h, json={"condition": "damaged", "fine_paise": 15000}
    )
    assert r.json()["fine_paise"] == 15000 and r.json()["status"] == "damaged"
    assert (await client.get(f"{L}/books/{w['book']['id']}", headers=h)).json()["damaged"] == 1


async def test_lost_and_damaged_copies_cannot_be_issued_until_available_again(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    c0, c1 = w["book"]["copies"]
    loan = (await issue(client, h, c0["id"], student_id=w["aarav"]["id"])).json()
    lost = await client.post(
        f"{L}/loans/{loan['id']}/return", headers=h, json={"condition": "lost", "fine_paise": 20000}
    )
    assert lost.json()["status"] == "lost" and lost.json()["fine_paise"] == 20000
    assert (await issue(client, h, c0["id"], student_id=w["bina"]["id"])).json()["error"][
        "code"
    ] == "copy_not_available"
    assert len(await audits("library.lost")) == 1
    # a copy on the shelf is marked damaged, then repaired
    r = await client.patch(f"{L}/copies/{c1['id']}", headers=h, json={"status": "damaged"})
    assert r.json()["status"] == "damaged"
    assert (await issue(client, h, c1["id"], student_id=w["bina"]["id"])).status_code == 409
    assert (await client.patch(f"{L}/copies/{c1['id']}", headers=h, json={"status": "available"})).json()[
        "status"
    ] == "available"
    on = (await issue(client, h, c1["id"], student_id=w["bina"]["id"])).json()
    # a copy on loan can't be flipped from the shelf
    assert (await client.patch(f"{L}/copies/{c1['id']}", headers=h, json={"status": "lost"})).json()["error"][
        "code"
    ] == "copy_issued"
    assert on["status"] == "open"
    assert (await client.get(f"{L}/loans", headers=h, params={"status": "lost"})).json()["total"] == 1
    assert len(await audits("library.copy_damaged")) == 1


async def test_renew_rules(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail, loan_days=7)
    loan = (await issue(client, h, w["book"]["copies"][0]["id"], student_id=w["aarav"]["id"])).json()
    due = today_ist() + timedelta(days=7)
    r1 = (await client.post(f"{L}/loans/{loan['id']}/renew", headers=h)).json()
    r2 = (await client.post(f"{L}/loans/{loan['id']}/renew", headers=h)).json()
    assert r1["due_on"] == (due + timedelta(days=7)).isoformat() and r2["renewals"] == 2
    third = await client.post(f"{L}/loans/{loan['id']}/renew", headers=h)
    assert third.status_code == 409 and third.json()["error"]["code"] == "renewal_limit"
    late = (await issue(client, h, w["book"]["copies"][1]["id"], student_id=w["bina"]["id"])).json()
    await backdate(late["id"], 1)
    assert (await client.post(f"{L}/loans/{late['id']}/renew", headers=h)).json()["error"]["code"] == "overdue"
    await client.post(f"{L}/loans/{loan['id']}/return", headers=h)
    assert (await client.post(f"{L}/loans/{loan['id']}/renew", headers=h)).json()["error"]["code"] == "loan_closed"


async def test_history_per_borrower_and_search(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    c0, c1 = w["book"]["copies"]
    first = (await issue(client, h, c0["id"], student_id=w["aarav"]["id"])).json()
    await client.post(f"{L}/loans/{first['id']}/return", headers=h)
    await issue(client, h, c0["id"], student_id=w["aarav"]["id"])
    await issue(client, h, c1["id"], student_id=w["bina"]["id"])
    hist = (await client.get(f"{L}/loans", headers=h, params={"student_id": w["aarav"]["id"], "status": "all"})).json()
    assert hist["total"] == 2 and {x["student_name"] for x in hist["items"]} == {"Aarav Sharma"}
    assert (await client.get(f"{L}/loans", headers=h, params={"student_id": w["aarav"]["id"]})).json()["total"] == 1
    assert (await client.get(f"{L}/loans", headers=h, params={"q": "Bina", "status": "all"})).json()["total"] == 1
    assert (await client.get(f"{L}/loans", headers=h, params={"q": "LIB-00002", "status": "all"})).json()["total"] == 1


async def test_permissions(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    plain = await teacher(client, h, mail, email="plain@rps.example")
    lib = await teacher(client, h, mail, email="lib@rps.example", perms=["library.manage"])
    for method, url in (
        ("get", "/library/books"),
        ("get", "/library/loans"),
        ("get", "/library/overdue"),
        ("get", "/library/export"),
        ("get", "/library/settings"),
    ):
        assert (await getattr(client, method)(f"{API}{url}", headers=plain)).status_code == 403, url
    for url, body in (
        ("/library/books", {"title": "x"}),
        ("/library/loans", {"copy_id": w["book"]["copies"][0]["id"], "student_id": w["aarav"]["id"]}),
    ):
        r = await client.post(f"{API}{url}", headers=plain, json=body)
        assert r.status_code == 403 and r.json()["error"]["code"] == "missing_permission"
    assert (
        await client.put(f"{L}/settings", headers=plain, json={"loan_days": 5, "fine_per_day_paise": 0})
    ).status_code == 403
    assert (await client.get(f"{L}/books", headers=lib)).status_code == 200
    assert (await issue(client, lib, w["book"]["copies"][0]["id"], student_id=w["aarav"]["id"])).status_code == 201
    assert (await client.get(f"{L}/books")).status_code == 401
    # parents cannot use the staff routes
    ph = await parent_headers(client, mail, "aarav@fam.example")
    assert (await client.get(f"{L}/books", headers=ph)).status_code == 403
    # settings validation
    assert (
        await client.put(f"{L}/settings", headers=h, json={"loan_days": 0, "fine_per_day_paise": 0})
    ).status_code == 422
    assert (
        await client.put(f"{L}/settings", headers=h, json={"loan_days": 5, "fine_per_day_paise": -1})
    ).status_code == 422


async def test_settings_default_and_audit(client, school_a, mail):
    h = school_a["headers"]
    assert (await client.get(f"{L}/settings", headers=h)).json() == {"loan_days": 14, "fine_per_day_paise": 0}
    await client.put(f"{L}/settings", headers=h, json={"loan_days": 10, "fine_per_day_paise": 200})
    await client.put(f"{L}/settings", headers=h, json={"loan_days": 21, "fine_per_day_paise": 200})
    assert (await client.get(f"{L}/settings", headers=h)).json()["loan_days"] == 21
    assert len(await audits("library.settings_updated")) == 2


async def test_export_is_audited_and_filtered(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail, fine=100)
    loan = (await issue(client, h, w["book"]["copies"][0]["id"], student_id=w["aarav"]["id"])).json()
    await backdate(loan["id"], 3)
    r = await client.get(f"{L}/export", headers=h, params={"status": "overdue"})
    assert r.status_code == 200 and "spreadsheetml" in r.headers["content-type"]
    wb = load_workbook(io.BytesIO(r.content))
    books, loans = list(wb["Books"].iter_rows(values_only=True)), list(wb["Loans"].iter_rows(values_only=True))
    assert books[1][0] == "Wings of Fire" and books[1][4:6] == (2, 1)
    assert len(loans) == 2 and loans[1][3] == "Aarav Sharma" and loans[1][10] == 3.0 and loans[1][8] == "overdue"
    assert len(await audits("library.exported")) == 1
    none = load_workbook(io.BytesIO((await client.get(f"{L}/export", headers=h, params={"status": "lost"})).content))
    assert len(list(none["Loans"].iter_rows())) == 1


async def test_parent_sees_only_own_childs_loans(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    ph = await parent_headers(client, mail, "aarav@fam.example")
    a, b = w["aarav"]["id"], w["bina"]["id"]
    l1 = (await issue(client, h, w["book"]["copies"][0]["id"], student_id=a)).json()
    await issue(client, h, w["book"]["copies"][1]["id"], student_id=b)
    got = (await client.get(f"{API}/parent/children/{a}/library", headers=ph)).json()
    assert [x["title"] for x in got["current"]] == ["Wings of Fire"] and got["overdue_count"] == 0
    assert got["current"][0]["due_on"] == l1["due_on"] and got["current"][0]["overdue"] is False
    assert (await client.get(f"{API}/parent/children/{b}/library", headers=ph)).status_code == 404
    assert (await client.get(f"{API}/parent/children/{uuid.uuid4()}/library", headers=ph)).status_code == 404
    assert (await client.get(f"{API}/parent/children/{a}/library", headers=h)).status_code == 403
    await backdate(l1["id"], 2)
    got = (await client.get(f"{API}/parent/children/{a}/library", headers=ph)).json()
    assert got["overdue_count"] == 1 and got["current"][0]["overdue"] and got["current"][0]["days_overdue"] == 2
    # returned books drop off; a child who has left stays readable
    await client.post(f"{L}/loans/{l1['id']}/return", headers=h)
    assert (await client.get(f"{API}/parent/children/{a}/library", headers=ph)).json()["current"] == []
    await client.post(f"{API}/students/{a}/leave", headers=h, json={"reason": "moved"})
    assert (await client.get(f"{API}/parent/children/{a}/library", headers=ph)).status_code == 200


async def test_overdue_reminders_once_per_three_days_per_loan(client, school_a, mail):
    h = school_a["headers"]
    w = await world(client, h, mail)
    ph = await parent_headers(client, mail, "aarav@fam.example")
    l1 = (await issue(client, h, w["book"]["copies"][0]["id"], student_id=w["aarav"]["id"])).json()
    await issue(client, h, w["book"]["copies"][1]["id"], student_id=w["bina"]["id"])  # not overdue
    assert (await tasks.library_reminders())["reminders"] == 0
    await backdate(l1["id"], 1)
    assert await tasks.library_reminders() == {"schools": 1, "failed": 0, "reminders": 1}
    assert (await tasks.library_reminders())["reminders"] == 0  # within 3 days
    inbox = (await client.get(f"{API}/parent/notifications", headers=ph)).json()["items"]
    assert [n["kind"] for n in inbox] == ["library_due"] and "Wings of Fire" in inbox[0]["body"]
    s = make_session(bypass=True)
    try:
        await s.execute(
            update(LibraryLoan)
            .where(LibraryLoan.id == uuid.UUID(l1["id"]))
            .values(last_reminded_at=utcnow() - timedelta(days=4))
        )
        await s.commit()
    finally:
        await s.close()
    assert (await tasks.library_reminders())["reminders"] == 1
    # a returned book is not reminded about; a child who left gets nothing
    await client.post(f"{L}/loans/{l1['id']}/return", headers=h)
    s = make_session(bypass=True)
    try:
        await s.execute(update(LibraryLoan).values(last_reminded_at=None))
        await s.commit()
    finally:
        await s.close()
    assert (await tasks.library_reminders())["reminders"] == 0
    s = make_session(bypass=True)
    try:
        assert len((await s.scalars(select(Notification).where(Notification.kind == "library_due"))).all()) == 2
    finally:
        await s.close()


async def test_borrower_lookup_needs_only_library_permission(client, school_a, mail):
    h = school_a["headers"]
    lib = await teacher(client, h, mail, email="lata@rps.example", perms=["library.manage"])
    other = await teacher(client, h, mail, email="rajiv@rps.example")
    r = await client.get(f"{API}/library/borrowers", headers=lib, params={"q": "rajiv"})
    assert r.status_code == 200 and [b["kind"] for b in r.json()] == ["staff"]
    assert (await client.get(f"{API}/library/borrowers", headers=lib, params={"q": "r"})).status_code == 422
    assert (await client.get(f"{API}/library/borrowers", headers=other, params={"q": "rajiv"})).status_code == 403


async def test_library_summary_counts_titles_copies_and_loans(client, school_a, mail):
    h = school_a["headers"]
    s = (await client.get(f"{API}/library/summary", headers=h)).json()
    assert s == {"books": 0, "copies": 0, "on_loan": 0, "overdue": 0}
    await add_staff(client, h, mail, email="t@rps.example")
    t = await staff_headers(client, mail, "t@rps.example")
    assert (await client.get(f"{API}/library/summary", headers=t)).status_code == 403
