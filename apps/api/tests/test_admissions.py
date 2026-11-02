from conftest import API, add_staff
from sqlalchemy import func, select
from studentkit import make_class, parent_headers, read_xlsx, teacher

from app.db.session import system_session
from app.models.student import Admission, Enrollment, Guardian, Student, StudentEvent
from app.models.user import User

APP = {
    "applicant_name": "Kabir Verma",
    "dob": "2015-02-10",
    "gender": "male",
    "grade_applied": "8",
    "guardian_name": "Anita Verma",
    "guardian_phone": "9822222222",
    "guardian_email": "anita@example.com",
    "status": "applied",
}


async def approved(client, h, **over) -> dict:
    a = (await client.post(f"{API}/admissions", headers=h, json={**APP, **over})).json()
    r = await client.post(f"{API}/admissions/{a['id']}/status", headers=h, json={"status": "approved"})
    assert r.status_code == 200, r.text
    return r.json()


async def test_admission_flow_and_enrol_in_one_action(client, school_a, mail):
    h = school_a["headers"]
    c = await make_class(client, h)
    r = await client.post(f"{API}/admissions", headers=h, json={**APP, "status": "enquiry"})
    assert r.status_code == 201 and r.json()["status"] == "enquiry" and r.json()["student_id"] is None
    a = r.json()
    # cannot jump to enrolled by status, nor enrol before approval
    assert (
        await client.post(f"{API}/admissions/{a['id']}/status", headers=h, json={"status": "enrolled"})
    ).status_code == 422
    r = await client.post(f"{API}/admissions/{a['id']}/enrol", headers=h, json={"class_id": c["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "not_approved"
    for st in ("applied", "approved"):
        assert (await client.post(f"{API}/admissions/{a['id']}/status", headers=h, json={"status": st})).json()[
            "status"
        ] == st
    r = await client.post(
        f"{API}/admissions/{a['id']}/enrol",
        headers=h,
        json={"class_id": c["id"], "admitted_on": "2026-04-05", "send_login": True},
    )
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["name"] == "Kabir Verma" and s["dob"] == "2015-02-10" and s["admitted_on"] == "2026-04-05"
    assert s["current_enrollment"]["class_label"] == "8-A" and s["history"][0]["reason"] == "Admission"
    g = s["guardians"][0]
    assert g["name"] == "Anita Verma" and g["has_login"] is True and g["login_status"] == "sent"
    after = (await client.get(f"{API}/admissions/{a['id']}", headers=h)).json()
    assert after["status"] == "enrolled" and after["student_id"] == s["id"] and after["enrolled_at"]
    ph = await parent_headers(client, mail, "anita@example.com")
    assert (await client.get(f"{API}/parent/children", headers=ph)).json()[0]["name"] == "Kabir Verma"
    assert (
        await client.post(f"{API}/admissions/{a['id']}/enrol", headers=h, json={"class_id": c["id"]})
    ).status_code == 409
    assert (await client.patch(f"{API}/admissions/{a['id']}", headers=h, json={"notes": "x"})).status_code == 409
    log = (await client.get(f"{API}/audit", headers=h, params={"action": "admission.enrolled"})).json()["items"]
    assert len(log) == 1


async def test_enrol_is_all_or_nothing(client, school_a, mail):
    h = school_a["headers"]
    await add_staff(client, h, mail, email="anita@example.com", send=False)  # the parent's email is taken
    c = await make_class(client, h)
    a = await approved(client, h)
    r = await client.post(f"{API}/admissions/{a['id']}/enrol", headers=h, json={"class_id": c["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_taken"
    async with system_session() as db:
        for model in (Student, Guardian, Enrollment, StudentEvent):
            assert await db.scalar(select(func.count()).select_from(model)) == 0, model
        adm = await db.get(Admission, __import__("uuid").UUID(a["id"]))
        assert adm.status == "approved" and adm.student_id is None and adm.enrolled_at is None
        assert await db.scalar(select(func.count()).select_from(User).where(User.kind == "parent")) == 0
    # without the login the same admission can still be enrolled
    r = await client.post(
        f"{API}/admissions/{a['id']}/enrol", headers=h, json={"class_id": c["id"], "create_parent_login": False}
    )
    assert r.status_code == 201


async def test_enrol_checks_class_capacity_and_class_choice(client, school_a):
    h = school_a["headers"]
    c = await make_class(client, h, capacity=1)
    a1, a2 = await approved(client, h), await approved(client, h, applicant_name="Second Child", guardian_email=None)
    assert (await client.post(f"{API}/admissions/{a1['id']}/enrol", headers=h, json={})).status_code == 422  # no class
    assert (
        await client.post(f"{API}/admissions/{a1['id']}/enrol", headers=h, json={"class_id": c["id"]})
    ).status_code == 201
    r = await client.post(f"{API}/admissions/{a2['id']}/enrol", headers=h, json={"class_id": c["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "class_full"
    # an admission can carry its preferred class
    c2 = await make_class(client, h, "9")
    a3 = await approved(client, h, applicant_name="Third", class_id=c2["id"], guardian_email=None)
    s = (await client.post(f"{API}/admissions/{a3['id']}/enrol", headers=h, json={})).json()
    assert s["current_enrollment"]["class_label"] == "9-A"


async def test_status_rules_list_and_export(client, school_a):
    h = school_a["headers"]
    a = (await client.post(f"{API}/admissions", headers=h, json={**APP, "status": "enquiry"})).json()
    r = await client.post(
        f"{API}/admissions/{a['id']}/status", headers=h, json={"status": "rejected", "note": "No seat"}
    )
    assert r.json()["status"] == "rejected" and "No seat" in r.json()["notes"]
    assert (
        await client.post(f"{API}/admissions/{a['id']}/status", headers=h, json={"status": "approved"})
    ).status_code == 409
    await client.post(f"{API}/admissions", headers=h, json={**APP, "applicant_name": "Other Kid"})
    assert (await client.get(f"{API}/admissions", headers=h)).json()["total"] == 2
    assert (await client.get(f"{API}/admissions", headers=h, params={"status": "rejected"})).json()["total"] == 1
    assert (await client.get(f"{API}/admissions", headers=h, params={"q": "other"})).json()["items"][0][
        "applicant_name"
    ] == "Other Kid"
    r = await client.patch(f"{API}/admissions/{a['id']}", headers=h, json={"guardian_phone": "9000000009"})
    assert r.json()["guardian_phone"] == "9000000009"
    x = read_xlsx((await client.get(f"{API}/admissions/export", headers=h)).content)
    assert len(x) == 3 and x[0][0] == "Applicant"
    log = (await client.get(f"{API}/audit", headers=h, params={"category": "exports"})).json()["items"]
    assert log[0]["action"] == "admissions.exported"


async def test_admissions_need_academic_manage(client, school_a, mail):
    h = school_a["headers"]
    t = await teacher(client, h, mail, "plain@rps.example")
    assert (await client.get(f"{API}/admissions", headers=t)).status_code == 403
    assert (await client.post(f"{API}/admissions", headers=t, json=APP)).status_code == 403
    m = await teacher(client, h, mail, "mgr@rps.example", perms=["academic.manage"])
    assert (await client.post(f"{API}/admissions", headers=m, json=APP)).status_code == 201
