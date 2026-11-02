"""Helpers for the results, date sheet and feedback tests."""

from conftest import API, add_staff, staff_headers
from studentkit import GUARD, enrol, parent_headers

BANDS = [
    {"min_percent": 90, "grade": "A+"},
    {"min_percent": 75, "grade": "A"},
    {"min_percent": 60, "grade": "B"},
    {"min_percent": 33, "grade": "C"},
    {"min_percent": 0, "grade": "D"},
]


async def world(client, school, mail, kids=("Aarav", "Bhumi", "Chirag")):
    """Class 8-A with Maths and English, a class teacher, a Maths teacher, an English teacher, an unrelated
    teacher, an active grading scheme, one exam with both papers, and one student per name (each with a parent login)."""
    h = school["headers"]
    c = (await client.post(f"{API}/academic/classes", headers=h, json={"grade": "8", "section": "A"})).json()
    subj = {}
    for n in ("Mathematics", "English"):
        subj[n] = (await client.post(f"{API}/academic/subjects", headers=h, json={"name": n})).json()
    r = await client.put(
        f"{API}/academic/classes/{c['id']}/subjects", headers=h, json={"subject_ids": [s["id"] for s in subj.values()]}
    )
    assert r.status_code == 200, r.text
    staff = {}
    for key, name in (
        ("ct", "Class Teacher"),
        ("maths", "Maths Teacher"),
        ("eng", "English Teacher"),
        ("other", "Other Teacher"),
    ):
        staff[key] = await add_staff(client, h, mail, email=f"{key}@rps.example", name=name)
    await client.put(f"{API}/academic/classes/{c['id']}/class-teacher", headers=h, json={"staff_id": staff["ct"]["id"]})
    for key, s in (("maths", "Mathematics"), ("eng", "English")):
        r = await client.put(
            f"{API}/academic/classes/{c['id']}/subject-teachers/{subj[s]['id']}",
            headers=h,
            json={"staff_id": staff[key]["id"]},
        )
        assert r.status_code == 200, r.text
    heads = {k: await staff_headers(client, mail, f"{k}@rps.example") for k in staff}
    r = await client.post(
        f"{API}/grading-schemes", headers=h, json={"name": "Standard", "bands": BANDS, "make_active": True}
    )
    assert r.status_code == 201, r.text
    exam = (await client.post(f"{API}/exams", headers=h, json={"name": "Half-yearly"})).json()
    papers = [
        {"subject_id": subj["Mathematics"]["id"], "max_marks": 100, "pass_marks": 33},
        {"subject_id": subj["English"]["id"], "max_marks": 50},
    ]
    r = await client.put(f"{API}/exams/{exam['id']}/papers", headers=h, json={"class_ids": [c["id"]], "papers": papers})
    assert r.status_code == 200, r.text
    students = {}
    for k in kids:
        s = await enrol(
            client,
            h,
            c["id"],
            first=k,
            last="Sharma",
            guardians=[{**GUARD, "name": f"Parent of {k}", "email": f"{k.lower()}@fam.example"}],
        )
        students[k] = s
    await client.post(f"{API}/parents/send-login", headers=h, json={})
    return {"h": h, "class": c, "subj": subj, "staff": staff, "heads": heads, "exam": exam, "students": students}


async def parent_of(client, mail, kid):
    return await parent_headers(client, mail, f"{kid.lower()}@fam.example")


async def sheet(client, headers, w):
    r = await client.get(f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}/sheet", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def enr_ids(sh):
    return {s["name"].split()[0]: s["enrollment_id"] for s in sh["students"]}


async def put_marks(client, headers, w, entries):
    return await client.put(
        f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}/marks", headers=headers, json={"entries": entries}
    )


async def fill_all(client, w, marks):
    """marks: {kid: (maths, english)} entered by the class teacher."""
    sh = await sheet(client, w["heads"]["ct"], w)
    e = enr_ids(sh)
    entries = []
    for kid, (m, en) in marks.items():
        entries.append({"enrollment_id": e[kid], "subject_id": w["subj"]["Mathematics"]["id"], "marks_obtained": m})
        entries.append({"enrollment_id": e[kid], "subject_id": w["subj"]["English"]["id"], "marks_obtained": en})
    r = await put_marks(client, w["heads"]["ct"], w, entries)
    assert r.status_code == 200, r.text
    return e
