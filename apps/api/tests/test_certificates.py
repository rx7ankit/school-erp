import asyncio
import uuid

import pytest
from conftest import API
from sqlalchemy import select
from studentkit import GUARD, enrol, make_class, parent_headers
from timekit import staff

from app.db.session import system_session
from app.models.file import Attachment
from app.services.storage import MemoryStorage, StoredObject, get_storage


@pytest.fixture
def store() -> MemoryStorage:
    s = get_storage()
    assert isinstance(s, MemoryStorage)
    s.objects.clear()
    return s


async def issue(client, h, student_id, kind="bonafide", expect=201, **extra):
    r = await client.post(
        f"{API}/certificates",
        headers=h,
        json={"student_id": student_id, "kind": kind, "issued_on": "2026-06-10", **extra},
    )
    assert r.status_code == expect, r.text
    return r.json()


async def kid(client, h, first="Aarav", email="p@x.example", cls=None):
    if cls is None:
        classes = (await client.get(f"{API}/academic/classes", headers=h)).json()["items"]
        cls = classes[0] if classes else await make_class(client, h)
    s = await enrol(client, h, cls["id"], first=first, guardians=[{**GUARD, "email": email}])
    return s


async def test_numbers_are_sequential_per_kind_and_year_and_never_reused(client, school_a):
    h = school_a["headers"]
    a, b = await kid(client, h), await kid(client, h, "Diya", "q@x.example")
    c1 = await issue(client, h, a["id"], purpose="Bank account")
    c2 = await issue(client, h, b["id"])
    c3 = await issue(client, h, a["id"], "character", conduct="Good")
    assert (c1["number"], c2["number"], c3["number"]) == ("BON-2026-001", "BON-2026-002", "CHR-2026-001")
    assert c1["snapshot"]["purpose"] == "Bank account" and c1["snapshot"]["student"]["name"] == "Aarav Sharma"
    assert c1["snapshot"]["class"] == "8-A" and c1["issued_by_name"] == "Meera Rao"
    # a new calendar year restarts the sequence
    r = await client.post(
        f"{API}/certificates", headers=h, json={"student_id": a["id"], "kind": "bonafide", "issued_on": "2027-01-05"}
    )
    assert r.json()["number"] == "BON-2027-001"
    # cancelled numbers stay used
    await client.post(f"{API}/certificates/{c2['id']}/cancel", headers=h, json={"reason": "Wrong name"})
    c4 = await issue(client, h, b["id"])
    assert c4["number"] == "BON-2026-003"


async def test_concurrent_issue_never_repeats_a_number(client, school_a):
    h = school_a["headers"]
    kids = [await kid(client, h, f"Kid{i}", f"k{i}@x.example") for i in range(6)]
    rs = await asyncio.gather(*[issue_raw(client, h, k["id"]) for k in kids])
    nums = [r.json()["number"] for r in rs]
    assert all(r.status_code == 201 for r in rs)
    assert sorted(nums) == [f"BON-2026-{i:03d}" for i in range(1, 7)]


def issue_raw(client, h, student_id):
    return client.post(
        f"{API}/certificates", headers=h, json={"student_id": student_id, "kind": "bonafide", "issued_on": "2026-06-10"}
    )


async def test_transfer_certificate_marks_the_student_and_is_audited(client, school_a):
    h = school_a["headers"]
    s = await kid(client, h)
    # an active student who is not leaving cannot get a TC
    r = await issue(client, h, s["id"], "transfer", expect=409)
    assert r["error"]["code"] == "student_not_leaving"
    tc = await issue(client, h, s["id"], "transfer", left_on="2026-06-10", reason="Parent transferred", conduct="Good")
    assert tc["number"] == "TC-2026-001" and tc["snapshot"]["left_on"] == "2026-06-10"
    st = (await client.get(f"{API}/students/{s['id']}", headers=h)).json()
    assert st["status"] == "tc_issued" and st["tc_number"] == "TC-2026-001"
    # a second TC is refused while one is valid
    again = await issue(client, h, s["id"], "transfer", expect=409)
    assert again["error"]["code"] == "already_issued"
    # a bonafide is only for current students
    b = await issue(client, h, s["id"], "bonafide", expect=409)
    assert b["error"]["code"] == "student_not_active"
    audit = (await client.get(f"{API}/audit", headers=h, params={"q": "TC-2026-001"})).json()["items"]
    actions = {a["action"]: a for a in audit}
    assert actions["certificate.issued"]["sensitive"] is True and "student.tc_issued" in actions


async def test_tc_for_a_student_who_already_left(client, school_a):
    h = school_a["headers"]
    s = await kid(client, h)
    await client.post(f"{API}/students/{s['id']}/leave", headers=h, json={"reason": "moved", "left_on": "2026-05-01"})
    tc = await issue(client, h, s["id"], "transfer")
    assert tc["snapshot"]["left_on"] == "2026-05-01"
    assert (await client.get(f"{API}/students/{s['id']}", headers=h)).json()["status"] == "tc_issued"


async def test_cancel_and_reissue(client, school_a):
    h = school_a["headers"]
    s = await kid(client, h)
    tc = await issue(client, h, s["id"], "transfer", left_on="2026-06-10")
    # reason is required
    assert (await client.post(f"{API}/certificates/{tc['id']}/reissue", headers=h, json={})).status_code == 422
    new = await client.post(
        f"{API}/certificates/{tc['id']}/reissue", headers=h, json={"reason": "Name spelling corrected"}
    )
    assert new.status_code == 201, new.text
    new = new.json()
    assert new["number"] == "TC-2026-002" and new["replaces_id"] == tc["id"] and new["status"] == "issued"
    old = (await client.get(f"{API}/certificates/{tc['id']}", headers=h)).json()
    assert old["status"] == "cancelled" and "Name spelling" in old["cancel_reason"]
    assert (await client.get(f"{API}/students/{s['id']}", headers=h)).json()["tc_number"] == "TC-2026-002"
    # cancelling twice is refused; cancelling the live TC lets a fresh one be issued
    assert (
        await client.post(f"{API}/certificates/{tc['id']}/cancel", headers=h, json={"reason": "again"})
    ).status_code == 409
    await client.post(f"{API}/certificates/{new['id']}/cancel", headers=h, json={"reason": "Issued by mistake"})
    assert (await client.get(f"{API}/students/{s['id']}", headers=h)).json()["tc_number"] is None
    third = await issue(client, h, s["id"], "transfer")
    assert third["number"] == "TC-2026-003"
    listed = (await client.get(f"{API}/certificates", headers=h, params={"student_id": s["id"]})).json()
    assert listed["total"] == 3
    live = (await client.get(f"{API}/certificates", headers=h, params={"status": "issued"})).json()
    assert [c["number"] for c in live["items"]] == ["TC-2026-003"]
    assert (await client.get(f"{API}/certificates", headers=h, params={"q": "TC-2026-002"})).json()["total"] == 1
    assert (await client.get(f"{API}/certificates", headers=h, params={"kind": "bonafide"})).json()["total"] == 0
    acts = {a["action"] for a in (await client.get(f"{API}/audit", headers=h, params={"limit": 100})).json()["items"]}
    assert {"certificate.issued", "certificate.reissued", "certificate.cancelled"} <= acts


async def test_the_snapshot_does_not_change_after_the_student_does(client, school_a):
    h = school_a["headers"]
    s = await kid(client, h)
    c = await issue(client, h, s["id"])
    await client.patch(f"{API}/students/{s['id']}", headers=h, json={"first_name": "Changed"})
    again = (await client.get(f"{API}/certificates/{c['id']}", headers=h)).json()
    assert again["snapshot"] == c["snapshot"] and again["snapshot"]["student"]["name"] == "Aarav Sharma"


async def test_permissions(client, school_a, mail):
    h = school_a["headers"]
    s = await kid(client, h)
    plain = await staff(client, h, mail, "plain@rps.example")
    mgr = await staff(client, h, mail, "mgr@rps.example", perms=["academic.manage"])
    fees = await staff(client, h, mail, "fees@rps.example", perms=["fees.manage"])
    body = {"student_id": s["id"], "kind": "bonafide"}
    for who in (plain, fees):
        assert (await client.post(f"{API}/certificates", headers=who["headers"], json=body)).status_code == 403
        assert (await client.get(f"{API}/certificates", headers=who["headers"])).status_code == 403
        assert (await client.get(f"{API}/students/{s['id']}/documents", headers=who["headers"])).status_code == 403
    assert (await client.post(f"{API}/certificates", headers=mgr["headers"], json=body)).status_code == 201
    assert (
        await client.post(f"{API}/certificates", headers=h, json={**body, "student_id": str(uuid.uuid4())})
    ).status_code == 404


async def test_parent_sees_only_issued_certificates_of_own_child(client, school_a, mail):
    h = school_a["headers"]
    cls = await make_class(client, h)
    mine = await kid(client, h, "Aarav", "p@x.example", cls)
    other = await kid(client, h, "Other", "o@x.example", cls)
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    ph = await parent_headers(client, mail, "p@x.example")
    c1 = await issue(client, h, mine["id"])
    c2 = await issue(client, h, mine["id"], "character")
    await issue(client, h, other["id"])
    await client.post(f"{API}/certificates/{c2['id']}/cancel", headers=h, json={"reason": "Wrong"})
    got = (await client.get(f"{API}/parent/children/{mine['id']}/certificates", headers=ph)).json()
    assert [c["number"] for c in got] == [c1["number"]] and got[0]["snapshot"]["student"]["name"] == "Aarav Sharma"
    assert "cancel_reason" not in got[0] and "issued_by" not in got[0]
    assert (await client.get(f"{API}/parent/children/{other['id']}/certificates", headers=ph)).status_code == 404
    # parents cannot use the staff routes; staff cannot use the parent route
    assert (await client.get(f"{API}/certificates", headers=ph)).status_code == 403
    assert (
        await client.post(f"{API}/certificates", headers=ph, json={"student_id": mine["id"], "kind": "bonafide"})
    ).status_code == 403
    assert (await client.get(f"{API}/parent/children/{mine['id']}/certificates", headers=h)).status_code == 403
    # a child with a TC (left) is still visible to the parent, read only
    await issue(client, h, mine["id"], "transfer", left_on="2026-06-10")
    got = (await client.get(f"{API}/parent/children/{mine['id']}/certificates", headers=ph)).json()
    assert {c["kind"] for c in got} == {"bonafide", "transfer"}


async def _confirmed_file(client, h, store, name="birth.pdf", purpose="student_document"):
    r = await client.post(
        f"{API}/files/upload-url",
        headers=h,
        json={"purpose": purpose, "filename": name, "content_type": "application/pdf", "size_bytes": 500},
    )
    fid = r.json()["id"]
    async with system_session() as db:
        key = await db.scalar(select(Attachment.storage_key).where(Attachment.id == uuid.UUID(fid)))
    store.objects[key] = StoredObject(size=500, content_type="application/pdf")
    assert (await client.post(f"{API}/files/{fid}/complete", headers=h)).status_code == 200
    return fid


async def test_student_documents_are_restricted_and_every_view_is_audited(client, school_a, mail, store):
    h = school_a["headers"]
    s = await kid(client, h)
    mgr = await staff(client, h, mail, "mgr@rps.example", perms=["academic.manage"])
    fid = await _confirmed_file(client, mgr["headers"], store)
    pending = (
        await client.post(
            f"{API}/files/upload-url",
            headers=h,
            json={
                "purpose": "student_document",
                "filename": "x.pdf",
                "content_type": "application/pdf",
                "size_bytes": 5,
            },
        )
    ).json()["id"]
    path = f"{API}/students/{s['id']}/documents"
    assert (await client.post(path, headers=h, json={"kind": "id_proof", "attachment_id": pending})).json()["error"][
        "code"
    ] == "file_not_ready"
    assert (await client.post(path, headers=h, json={"kind": "nope", "attachment_id": fid})).status_code == 422
    d = await client.post(
        path, headers=mgr["headers"], json={"kind": "birth_certificate", "attachment_id": fid, "note": "orig"}
    )
    assert d.status_code == 201 and d.json()["filename"] == "birth.pdf" and d.json()["kind"] == "birth_certificate"
    dup = await client.post(path, headers=h, json={"kind": "other", "attachment_id": fid})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "file_in_use"
    assert [x["kind"] for x in (await client.get(path, headers=h)).json()] == ["birth_certificate"]
    link = await client.get(f"{path}/{d.json()['id']}/url", headers=h)
    assert link.status_code == 200 and link.json()["url"].startswith("https://")
    # not the right kind of file
    plain_file = await _confirmed_file(client, h, store, "leave.pdf", "leave_attachment")
    assert (await client.post(path, headers=h, json={"kind": "other", "attachment_id": plain_file})).status_code == 404
    # a teacher without the permission, and a parent, are refused
    plain = await staff(client, h, mail, "plain@rps.example")
    assert (await client.get(path, headers=plain["headers"])).status_code == 403
    assert (await client.get(f"{path}/{d.json()['id']}/url", headers=plain["headers"])).status_code == 403
    audit = (await client.get(f"{API}/audit", headers=h, params={"sensitive": True, "limit": 50})).json()["items"]
    actions = [a["action"] for a in audit]
    assert {"student_document.added", "student_document.listed", "student_document.opened"} <= set(actions)
    assert (await client.delete(f"{path}/{d.json()['id']}", headers=mgr["headers"])).status_code == 204
    assert (await client.get(path, headers=h)).json() == []
    assert (await client.get(f"{path}/{d.json()['id']}/url", headers=h)).status_code == 404
