"""Leave applications: apply, decide, effect on attendance, parent access rules."""

from datetime import timedelta

import pytest
from attkit import TODAY, classroom, day, mark, rec
from conftest import API
from studentkit import parent_headers, teacher

from app.services.storage import get_storage


def ahead(n: int) -> str:
    return (TODAY + timedelta(days=n)).isoformat()


async def apply(client, ph, student_id, **over):
    body = {"from_on": day(0), "reason": "Fever"} | over
    return await client.post(f"{API}/parent/children/{student_id}/leave", headers=ph, json=body)


async def test_parent_applies_teacher_approves_and_the_sheet_preselects_leave(client, school_a, mail):
    c, th, (a, b, d), ph = await classroom(client, school_a, mail)
    r = await apply(client, ph, a["id"], from_on=ahead(1), to_on=ahead(2), reason="Family function")
    assert r.status_code == 201, r.text
    lv = r.json()
    assert lv["status"] == "pending" and lv["class_label"] == "8-A" and lv["guardian_name"] == "Parent Aarav"
    # the parent sees it
    mine = (await client.get(f"{API}/parent/children/{a['id']}/leave", headers=ph)).json()
    assert mine["total"] == 1 and mine["items"][0]["id"] == lv["id"]
    # the class teacher sees it pending, and approves with a note
    lst = (await client.get(f"{API}/leave", headers=th, params={"status": "pending"})).json()
    assert [x["id"] for x in lst["items"]] == [lv["id"]]
    r = await client.post(
        f"{API}/leave/{lv['id']}/decision", headers=th, json={"decision": "approve", "note": "Take care"}
    )
    out = r.json()
    assert out["status"] == "approved" and out["decision_note"] == "Take care" and out["decided_by_name"] == "t1"
    assert out["decided_at"] is not None
    # decided once only
    r = await client.post(f"{API}/leave/{lv['id']}/decision", headers=th, json={"decision": "reject"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_decided"
    # the sheet for a leave day pre-selects "leave" for Aarav only (not yet saved)
    sh = (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th, params={"day_on": ahead(1)})).json()
    got = {s["name"]: s for s in sh["students"]}
    assert got["Aarav Sharma"]["first_half"] == "leave" and got["Aarav Sharma"]["second_half"] == "leave"
    assert got["Aarav Sharma"]["saved"] is False and got["Aarav Sharma"]["leave_id"] == lv["id"]
    assert got["Bhavna Sharma"]["first_half"] == "present" and got["Bhavna Sharma"]["leave_id"] is None
    # a day outside the leave is untouched
    sh = (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th, params={"day_on": ahead(3)})).json()
    assert all(s["first_half"] == "present" for s in sh["students"])
    # the audit log has the three steps
    log = (await client.get(f"{API}/audit", headers=school_a["headers"], params={"category": "leave"})).json()["items"]
    assert {"leave.requested", "leave.approved"} <= {x["action"] for x in log}


async def test_leave_counts_as_not_present_but_is_shown_separately(client, school_a, mail):
    c, th, (a, b, d), ph = await classroom(client, school_a, mail)
    lv = (await apply(client, ph, a["id"], from_on=day(1), to_on=day(1))).json()
    await client.post(f"{API}/leave/{lv['id']}/decision", headers=th, json={"decision": "approve"})
    sh = (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th, params={"day_on": day(1)})).json()
    recs = [rec(s["student_id"], s["first_half"], s["second_half"]) for s in sh["students"]]
    await mark(client, th, c["id"], day(1), recs)
    await mark(client, th, c["id"], day(0), [rec(a["id"]), rec(b["id"]), rec(d["id"])])
    st = (await client.get(f"{API}/parent/children/{a['id']}/attendance/stats", headers=ph)).json()["stats"]
    assert st["working_days"] == 2 and st["leave_days"] == 1.0 and st["absent_days"] == 0.0
    assert st["present_days"] == 1.0 and st["percentage"] == 50.0
    cal = (
        await client.get(
            f"{API}/parent/children/{a['id']}/attendance/calendar", headers=ph, params={"month": day(1)[:7]}
        )
    ).json()
    assert next(x for x in cal["days"] if x["day_on"] == day(1))["status"] == "leave"


async def test_approving_after_the_day_was_marked_turns_absent_into_leave(client, school_a, mail):
    c, th, (a, b, d), ph = await classroom(client, school_a, mail)
    await mark(client, th, c["id"], day(1), [rec(a["id"], "absent", "absent"), rec(b["id"]), rec(d["id"])])
    await mark(client, th, c["id"], day(0), [rec(a["id"], "present", "absent"), rec(b["id"]), rec(d["id"])])
    # a leave for yesterday (whole day) and for today's second half only
    l1 = (await apply(client, ph, a["id"], from_on=day(1), to_on=day(1))).json()
    l2 = (await apply(client, ph, a["id"], from_on=day(0), to_on=day(0), half="second")).json()
    for lv in (l1, l2):
        assert (
            await client.post(f"{API}/leave/{lv['id']}/decision", headers=th, json={"decision": "approve"})
        ).status_code == 200
    st = (await client.get(f"{API}/attendance/classes/{c['id']}/stats", headers=th)).json()
    aarav = next(s for s in st["students"] if s["name"] == "Aarav Sharma")
    assert aarav["absent_days"] == 0.0 and aarav["leave_days"] == 1.5 and aarav["present_days"] == 0.5
    log = (await client.get(f"{API}/audit", headers=school_a["headers"], params={"category": "attendance"})).json()[
        "items"
    ]
    assert "attendance.leave_applied" in [x["action"] for x in log]


async def test_reject_cancel_and_overlap_rules(client, school_a, mail):
    c, th, (a, b, d), ph = await classroom(client, school_a, mail)
    first = (await apply(client, ph, a["id"], from_on=ahead(1), to_on=ahead(3))).json()
    # overlapping dates are refused, a different half of a different day is fine
    r = await apply(client, ph, a["id"], from_on=ahead(3), to_on=ahead(4))
    assert r.status_code == 409 and r.json()["error"]["code"] == "leave_overlaps"
    # reject, then the dates are free again
    r = await client.post(
        f"{API}/leave/{first['id']}/decision", headers=th, json={"decision": "reject", "note": "Exams"}
    )
    assert r.json()["status"] == "rejected" and r.json()["decision_note"] == "Exams"
    sh = (await client.get(f"{API}/attendance/classes/{c['id']}/sheet", headers=th, params={"day_on": ahead(1)})).json()
    assert all(s["first_half"] == "present" for s in sh["students"])  # a rejected leave pre-selects nothing
    again = await apply(client, ph, a["id"], from_on=ahead(1), to_on=ahead(1), half="first")
    assert again.status_code == 201
    other_half = await apply(client, ph, a["id"], from_on=ahead(1), to_on=ahead(1), half="second")
    assert other_half.status_code == 201
    same_half = await apply(client, ph, a["id"], from_on=ahead(1), to_on=ahead(1), half="first")
    assert same_half.status_code == 409
    # cancel while pending; not after a decision
    assert (await client.post(f"{API}/parent/leave/{again.json()['id']}/cancel", headers=ph)).json()[
        "status"
    ] == "cancelled"
    r = await client.post(f"{API}/parent/leave/{first['id']}/cancel", headers=ph)
    assert r.status_code == 409 and r.json()["error"]["code"] == "not_pending"
    r = await client.post(f"{API}/leave/{again.json()['id']}/decision", headers=th, json={"decision": "approve"})
    assert r.status_code == 409  # cancelled


async def test_date_validation(client, school_a, mail):
    c, th, (a, *_), ph = await classroom(client, school_a, mail, n=1)
    assert (await apply(client, ph, a["id"], from_on=ahead(2), to_on=ahead(1))).status_code == 422
    assert (await apply(client, ph, a["id"], from_on=ahead(1), to_on=ahead(2), half="first")).status_code == 422
    assert (await apply(client, ph, a["id"], reason="")).status_code == 422
    r = await apply(client, ph, a["id"], from_on=day(30), to_on=day(29))
    assert r.json()["error"]["code"] == "too_old"
    r = await apply(client, ph, a["id"], from_on=ahead(1), to_on=ahead(100))
    assert r.json()["error"]["code"] == "too_long"
    # to_on defaults to from_on; a single half day is fine
    r = await client.post(
        f"{API}/parent/children/{a['id']}/leave",
        headers=ph,
        json={"from_on": ahead(1), "half": "second", "reason": "Dentist"},
    )
    assert r.status_code == 201 and r.json()["to_on"] == ahead(1) and r.json()["half"] == "second"


async def test_only_the_class_teacher_or_admin_decides(client, school_a, mail):
    h = school_a["headers"]
    c, th, (a, *_), ph = await classroom(client, school_a, mail, n=1)
    c2, th2, _, _ = await classroom(client, school_a, mail, email="t2@rps.example", grade="9", n=1, parents=False)
    am = await teacher(client, h, mail, "am@rps.example", perms=["academic.manage"])
    lv = (await apply(client, ph, a["id"], from_on=ahead(1))).json()
    body = {"decision": "approve"}
    for other in (th2, am):  # not their class: they cannot even see it
        assert (await client.post(f"{API}/leave/{lv['id']}/decision", headers=other, json=body)).status_code == 404
        assert (await client.get(f"{API}/leave/{lv['id']}", headers=other)).status_code == 404
        assert (await client.get(f"{API}/leave", headers=other)).json()["total"] == 0
    assert (await client.post(f"{API}/leave/{lv['id']}/decision", headers=ph, json=body)).status_code == 403
    assert (await client.get(f"{API}/leave", headers=ph)).status_code == 403
    assert (await client.get(f"{API}/leave", headers=h)).json()["total"] == 1  # admin sees all
    assert (await client.get(f"{API}/leave", headers=th, params={"class_id": c2["id"]})).json()["total"] == 0
    assert (await client.post(f"{API}/leave/{lv['id']}/decision", headers=h, json=body)).json()["status"] == "approved"
    assert (
        await client.post(f"{API}/leave/{lv['id']}/decision", headers=th, json={"decision": "maybe"})
    ).status_code == 422


async def test_another_familys_child_and_a_child_who_left(client, school_a, mail):
    h = school_a["headers"]
    c, th, (a, b, d), ph = await classroom(client, school_a, mail)
    # another family's child: 404, and nothing is created
    assert (await apply(client, ph, b["id"])).status_code == 404
    lv_b = None
    ph_b = await parent_headers(client, mail, "bhavna.parent8@example.com")
    lv_b = (await apply(client, ph_b, b["id"], from_on=ahead(1))).json()
    assert (await client.post(f"{API}/parent/leave/{lv_b['id']}/cancel", headers=ph)).status_code == 404
    assert (await client.get(f"{API}/parent/leave/{lv_b['id']}/attachment-url", headers=ph)).status_code == 404
    assert (await client.get(f"{API}/parent/children/{a['id']}/leave", headers=ph)).json()["total"] == 0
    # a child who left: history readable, nothing writable
    lv = (await apply(client, ph, a["id"], from_on=ahead(1))).json()
    await client.post(f"{API}/students/{a['id']}/leave", headers=h, json={"reason": "moved"})
    r = await apply(client, ph, a["id"], from_on=ahead(2))
    assert r.status_code == 403 and r.json()["error"]["code"] == "child_read_only"
    r = await client.post(f"{API}/parent/leave/{lv['id']}/cancel", headers=ph)
    assert r.status_code == 403 and r.json()["error"]["code"] == "child_read_only"
    assert (await client.get(f"{API}/parent/children/{a['id']}/leave", headers=ph)).json()["total"] == 1
    assert (await client.get(f"{API}/parent/children/{a['id']}/attendance/stats", headers=ph)).status_code == 200
    # a pending leave of a child who left cannot be approved any more
    r = await client.post(f"{API}/leave/{lv['id']}/decision", headers=h, json={"decision": "approve"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "no_class"


async def test_attachment_flow_for_parents(client, school_a, mail):
    c, th, (a, b, d), ph = await classroom(client, school_a, mail)
    ph_b = await parent_headers(client, mail, "bhavna.parent8@example.com")
    up = f"{API}/parent/leave/attachments"
    bad = await client.post(
        f"{up}/upload-url",
        headers=ph,
        json={"filename": "x.exe", "content_type": "application/x-msdownload", "size_bytes": 10},
    )
    assert bad.json()["error"]["code"] == "invalid_file_type"
    big = await client.post(
        f"{up}/upload-url",
        headers=ph,
        json={"filename": "x.pdf", "content_type": "application/pdf", "size_bytes": 11 * 1024 * 1024},
    )
    assert big.json()["error"]["code"] == "file_too_large"
    r = await client.post(
        f"{up}/upload-url",
        headers=ph,
        json={"filename": "note.pdf", "content_type": "application/pdf", "size_bytes": 500},
    )
    assert r.status_code == 201
    fid = r.json()["id"]
    # not uploaded yet: cannot attach, cannot complete
    assert (await apply(client, ph, a["id"], attachment_id=fid)).json()["error"]["code"] == "invalid_attachment"
    assert (await client.post(f"{up}/{fid}/complete", headers=ph)).json()["error"]["code"] == "upload_missing"
    # someone else cannot complete or use it
    assert (await client.post(f"{up}/{fid}/complete", headers=ph_b)).status_code == 404
    from sqlalchemy import select

    from app.db.session import system_session
    from app.models.file import Attachment
    from app.services.storage import StoredObject

    async with system_session() as db:
        key = (await db.scalar(select(Attachment).where(Attachment.id == fid))).storage_key
    get_storage().objects[key] = StoredObject(size=500, content_type="application/pdf")
    assert (await client.post(f"{up}/{fid}/complete", headers=ph)).json()["status"] == "ready"
    assert (await apply(client, ph_b, b["id"], attachment_id=fid)).json()["error"]["code"] == "invalid_attachment"
    lv = (await apply(client, ph, a["id"], attachment_id=fid)).json()
    assert lv["has_attachment"] is True
    # parent and class teacher can open it; another teacher and another family cannot
    assert (
        (await client.get(f"{API}/parent/leave/{lv['id']}/attachment-url", headers=ph))
        .json()["url"]
        .startswith("https://")
    )
    assert (await client.get(f"{API}/leave/{lv['id']}/attachment-url", headers=th)).status_code == 200
    th2 = await teacher(client, school_a["headers"], mail, "t5@rps.example")
    assert (await client.get(f"{API}/leave/{lv['id']}/attachment-url", headers=th2)).status_code == 404
    assert (await client.get(f"{API}/parent/leave/{lv['id']}/attachment-url", headers=ph_b)).status_code == 404
    # staff cannot use the parent upload
    assert (
        await client.post(
            f"{up}/upload-url",
            headers=th,
            json={"filename": "n.pdf", "content_type": "application/pdf", "size_bytes": 5},
        )
    ).status_code == 403


@pytest.mark.parametrize("path", ["leave", "attendance/analytics", "holidays"])
async def test_anonymous_is_refused(client, path):
    assert (await client.get(f"{API}/{path}")).status_code == 401
