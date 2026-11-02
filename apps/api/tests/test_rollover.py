"""Year-end rollover: readiness, plan, preview, apply (one transaction), idempotency, fees, notifications."""

import pytest
from conftest import API
from feekit import invoices, pay, run
from rolloverkit import apply, first_term_due, status, student_class, world, years
from sqlalchemy import func, select

from app.db.session import make_session
from app.models.academic import AcademicYear, ClassStaff, ClassSubject, SchoolClass
from app.models.fees import FeeCarryForward, FeeStructure, StudentConcession
from app.models.rollover import PromotionBatch
from app.models.student import Enrollment, Student


@pytest.fixture
async def w(client, school_a, mail):
    return await world(client, school_a, mail)


async def counts() -> dict:
    async with make_session(bypass=True) as s:
        return {
            "years": await s.scalar(select(func.count()).select_from(AcademicYear)),
            "classes": await s.scalar(select(func.count()).select_from(SchoolClass)),
            "enrollments": await s.scalar(select(func.count()).select_from(Enrollment)),
            "batches": await s.scalar(select(func.count()).select_from(PromotionBatch)),
            "active": await s.scalar(select(func.count()).select_from(Student).where(Student.status == "active")),
        }


# ------------------------------------------------------------------ happy path
async def test_default_rollover_promotes_everyone_and_the_last_grade_passes_out(client, w, mail):
    h = w["h"]
    out = await apply(client, h)
    assert (out["promoted"], out["staying"], out["leaving"], out["passed_out"]) == (3, 0, 0, 1)
    assert out["from_year"] != out["to_year"] and out["classes_created"] == 2  # 9-A and 10-A
    ys = await years(client, h)
    assert ys[out["from_year"]]["status"] == "completed" and ys[out["to_year"]]["status"] == "current"

    aarav = await student_class(client, h, w["kids"]["Aarav"]["id"])
    assert aarav["status"] == "active"
    assert aarav["current_enrollment"]["class_label"] == "9-A" and aarav["current_enrollment"]["roll_no"] == 1
    old = [e for e in aarav["enrollments"] if e["status"] == "promoted"][0]
    assert old["class_label"] == "8-A" and old["ended_on"] == ys[out["from_year"]]["ends_on"]
    assert any(e["kind"] == "promoted" and e["reason"].startswith("Promoted from 8-A to 9-A") for e in aarav["history"])

    diya = await student_class(client, h, w["kids"]["Diya"]["id"])
    assert diya["status"] == "passed_out" and diya["current_enrollment"] is None
    assert any(e["kind"] == "passed_out" for e in diya["history"])

    # last year's classes stay as the archive, the new year has its own
    classes = (await client.get(f"{API}/academic/classes", headers=h)).json()["items"]
    assert sorted(c["grade"] for c in classes) == ["10", "9"]
    old_classes = (await client.get(f"{API}/academic/classes?year_id={ys[out['from_year']]['id']}", headers=h)).json()
    assert sorted(c["grade"] for c in old_classes["items"]) == ["12", "8", "9"]
    assert (await client.get(f"{API}/rollover/status", headers=h)).json()["last_batch_id"] == out["batch_id"]


async def test_parents_get_a_congratulations_and_the_childs_class_label_updates(client, w):
    h = w["h"]
    out = await apply(client, h)
    assert out["parents_notified"] == 4
    inbox = (await client.get(f"{API}/parent/notifications", headers=w["parents"]["Aarav"])).json()["items"]
    n = [x for x in inbox if x["kind"] == "promotion_promoted"][0]
    assert n["title"] == "Congratulations!"
    assert n["body"] == f"Congratulations! Aarav Sharma is now in Class 9-A for {out['to_year']}."
    diya = (await client.get(f"{API}/parent/notifications", headers=w["parents"]["Diya"])).json()["items"]
    assert [x["body"] for x in diya if x["kind"] == "promotion_completed"] == [
        "Congratulations! Diya Sharma has completed Class 12-A."
    ]
    child = (
        await client.get(f"{API}/parent/children/{w['kids']['Aarav']['id']}", headers=w["parents"]["Aarav"])
    ).json()
    assert "9-A" in str(child)


async def test_new_classes_carry_subjects_teachers_and_fees_by_grade(client, w):
    h = w["h"]
    out = await apply(client, h)
    async with make_session(bypass=True) as s:
        nine = await s.scalar(
            select(SchoolClass).where(
                SchoolClass.grade == "9", SchoolClass.academic_year_id != w["cls"]["9"]["academic_year_id"]
            )
        )
        ten = await s.scalar(select(SchoolClass).where(SchoolClass.grade == "10"))
        # a student moving to class 9 pays class 9 fees (from last year's 9-A), 10 pays what 9 paid
        assert (await s.scalar(select(FeeStructure.amount_paise).where(FeeStructure.class_id == nine.id))) == 120_000
        assert (await s.scalar(select(FeeStructure.amount_paise).where(FeeStructure.class_id == ten.id))) == 120_000
        # "same teachers for the same class": new 9-A has last year's 9-A class teacher
        old9 = await s.scalar(select(ClassStaff.staff_id).where(ClassStaff.class_id == w["cls"]["9"]["id"]))
        assert (await s.scalar(select(ClassStaff.staff_id).where(ClassStaff.class_id == nine.id))) == old9
        assert (
            await s.scalar(select(func.count()).select_from(ClassSubject).where(ClassSubject.class_id == nine.id))
        ) == 1
    assert out["classes_created"] == 2


async def test_move_teachers_up_with_their_class(client, w):
    h = w["h"]
    await apply(client, h, {"teachers": "move_up"})
    async with make_session(bypass=True) as s:
        nine = await s.scalar(
            select(SchoolClass).where(
                SchoolClass.grade == "9", SchoolClass.academic_year_id != w["cls"]["9"]["academic_year_id"]
            )
        )
        ct = await s.scalar(
            select(ClassStaff.staff_id).where(ClassStaff.class_id == nine.id, ClassStaff.role == "class_teacher")
        )
        subj = await s.scalar(
            select(ClassStaff.staff_id).where(ClassStaff.class_id == nine.id, ClassStaff.role == "subject_teacher")
        )
    assert str(ct) == w["staff"]["ct8"]["id"] and str(subj) == w["staff"]["maths8"]["id"]


async def test_start_with_empty_teachers_and_the_checklist_lists_the_gaps(client, w):
    h = w["h"]
    out = await apply(client, h, {"teachers": "empty", "timetable": "empty"})
    keys = {i["key"]: i["count"] for i in out["checklist"]}
    assert keys["teacher_slots"] == 4  # 9-A and 10-A: a class teacher and a maths teacher each
    assert keys["invoices"] == 3
    assert [i["key"] for i in (await client.get(f"{API}/rollover/checklist", headers=h)).json()][0] == "teacher_slots"


# ------------------------------------------------------------------ decisions
async def test_stay_leave_and_other_destinations(client, w):
    h = w["h"]
    plan = {
        "decisions": [
            {"student_id": w["kids"]["Aarav"]["id"], "decision": "repeat"},
            {"student_id": w["kids"]["Bhumi"]["id"], "decision": "leave"},
            {
                "student_id": w["kids"]["Chirag"]["id"],
                "decision": "promote",
                "to_class": {"grade": "10", "section": "B"},
            },
        ]
    }
    out = await apply(client, h, plan)
    assert (out["promoted"], out["staying"], out["leaving"], out["passed_out"]) == (1, 1, 1, 1)
    ys = await years(client, h)
    aarav = await student_class(client, h, w["kids"]["Aarav"]["id"])
    assert aarav["current_enrollment"]["class_label"] == "8-A"  # stays, in a new class 8-A of the new year
    assert aarav["current_enrollment"]["academic_year"] == out["to_year"]
    assert [e for e in aarav["enrollments"] if e["status"] == "detained"]
    assert any(e["kind"] == "detained" for e in aarav["history"])
    bhumi = await student_class(client, h, w["kids"]["Bhumi"]["id"])
    assert bhumi["status"] == "left" and bhumi["left_on"] == ys[out["from_year"]]["ends_on"]
    assert bhumi["current_enrollment"] is None
    chirag = await student_class(client, h, w["kids"]["Chirag"]["id"])
    assert chirag["current_enrollment"]["class_label"] == "10-B"
    # leaving students get no automatic message, staying ones get the "will continue" text
    assert (await client.get(f"{API}/parent/notifications", headers=w["parents"]["Bhumi"])).json()["items"] == []
    body = (await client.get(f"{API}/parent/notifications", headers=w["parents"]["Aarav"])).json()["items"][0]
    assert body["kind"] == "promotion_stayed" and body["body"].startswith("Aarav Sharma will continue in Class 8-A")
    assert out["checklist"][-1]["key"] == "transfer_certificates"


async def test_a_class_can_go_to_another_section_and_roll_numbers_restart_alphabetically(client, w):
    h = w["h"]
    plan = {"class_moves": [{"from_class_id": w["cls"]["8"]["id"], "to_class": {"grade": "9", "section": "B"}}]}
    await apply(client, h, plan)
    s = await student_class(client, h, w["kids"]["Bhumi"]["id"])
    assert s["current_enrollment"]["class_label"] == "9-B" and s["current_enrollment"]["roll_no"] == 2
    a = await student_class(client, h, w["kids"]["Aarav"]["id"])
    assert a["current_enrollment"]["roll_no"] == 1


async def test_custom_classes_follow_their_next_class_chain(client, school_a):
    h = school_a["headers"]
    nursery = (
        await client.post(
            f"{API}/academic/classes", headers=h, json={"grade": "Nursery", "section": "A", "is_custom": True}
        )
    ).json()
    lkg = (
        await client.post(
            f"{API}/academic/classes", headers=h, json={"grade": "LKG", "section": "A", "is_custom": True}
        )
    ).json()
    await client.patch(f"{API}/academic/classes/{nursery['id']}", headers=h, json={"next_class_id": lkg["id"]})
    from studentkit import GUARD, enrol

    s = await enrol(client, h, nursery["id"], first="Tiny", guardians=[GUARD])
    pre = (await client.post(f"{API}/rollover/preview", headers=h, json={})).json()
    assert pre["problems"] == []  # Nursery has a next class (LKG) and LKG has no students to place
    out = await apply(client, h)
    assert out["promoted"] == 1
    assert (await student_class(client, h, s["id"]))["current_enrollment"]["class_label"] == "LKG-A"


async def test_missing_destination_blocks_apply_and_changes_nothing(client, school_a):
    h = school_a["headers"]
    lkg = (
        await client.post(
            f"{API}/academic/classes", headers=h, json={"grade": "LKG", "section": "A", "is_custom": True}
        )
    ).json()
    from studentkit import GUARD, enrol

    s = await enrol(client, h, lkg["id"], first="Tiny", guardians=[GUARD])
    pre = (await client.post(f"{API}/rollover/preview", headers=h, json={})).json()
    assert pre["can_apply"] is False and pre["problems"][0]["code"] == "no_destination"
    before = await counts()
    out = await apply(client, h, expect=422)
    assert out["error"]["code"] == "plan_has_problems"
    assert await counts() == before
    # choosing passed out for that student fixes it
    fixed = {"decisions": [{"student_id": s["id"], "decision": "passed_out"}]}
    assert (await client.post(f"{API}/rollover/preview", headers=h, json=fixed)).json()["can_apply"] is True


# ------------------------------------------------------------------ preview, draft, readiness
async def test_preview_writes_nothing_and_matches_apply(client, w):
    h = w["h"]
    before = await counts()
    pre = (await client.post(f"{API}/rollover/preview", headers=h, json={})).json()
    assert await counts() == before
    assert (pre["promoted"], pre["staying"], pre["leaving"], pre["passed_out"]) == (3, 0, 0, 1)
    assert [c["label"] for c in pre["new_classes"]] == ["9-A", "10-A"]
    assert pre["new_classes"][0]["from_classes"] == ["8-A"] and pre["new_classes"][0]["students"] == 2
    assert pre["teacher_slots"] == 4 and pre["teacher_slots_filled"] == 1  # 10-A had no class last year
    assert pre["fee_total_paise"] == 240_000 and pre["parents_notified"] == 4 and pre["can_apply"] is True
    out = await apply(client, h)
    assert out["classes_created"] == len(pre["new_classes"])


async def test_draft_is_saved_shared_and_closed_by_apply(client, w, mail):
    h = w["h"]
    plan = {"new_year_name": "2099-00", "starts_on": "2099-04-01", "ends_on": "2100-03-31", "teachers": "move_up"}
    r = await client.put(f"{API}/rollover/draft", headers=h, json=plan)
    assert r.status_code == 200 and r.json()["plan"]["teachers"] == "move_up" and r.json()["updated_by"]
    # anyone with the Academic permission resumes the same draft
    from studentkit import teacher

    other = await teacher(client, h, mail, "acad@rps.example", perms=["academic.manage"])
    assert (await client.get(f"{API}/rollover/draft", headers=other)).json()["plan"]["new_year_name"] == "2099-00"
    st = await status(client, h)
    r = await client.post(
        f"{API}/rollover/apply", headers=h, json={"from_year_id": st["current_year_id"], "confirm": True}
    )
    assert r.status_code == 200 and r.json()["to_year"] == "2099-00"  # the draft was used
    assert (await client.get(f"{API}/rollover/draft", headers=h)).json()["updated_at"] is None  # and closed


async def test_students_step_shows_hints(client, w):
    h = w["h"]
    r = await client.post(
        f"{API}/fees/invoice-runs", headers=h, json={"period_label": "Term 1", "due_on": "2099-01-01"}
    )
    assert r.status_code == 201
    panels = (await client.get(f"{API}/rollover/students", headers=h)).json()
    by = {p["class_label"]: p for p in panels}
    assert by["8-A"]["destination"] == "9-A" and by["12-A"]["destination"] is None
    assert [s["name"] for s in by["8-A"]["students"]] == ["Aarav Sharma", "Bhumi Sharma"]
    assert by["8-A"]["students"][0]["fee_balance_paise"] == 100_000
    assert by["12-A"]["students"][0]["decision"] == "passed_out"
    one = (await client.get(f"{API}/rollover/students?class_id={w['cls']['9']['id']}", headers=h)).json()
    assert len(one) == 1 and one[0]["students"][0]["to_class"] == "10-A"


async def test_readiness_check_lists_open_items_but_does_not_block(client, w, mail):
    h = w["h"]
    r = (await client.get(f"{API}/rollover/readiness", headers=h)).json()
    items = {i["key"]: i for i in r["items"]}
    assert set(items) == {
        "results_unpublished",
        "leave_pending",
        "fees_unpaid",
        "classes_without_class_teacher",
        "emergency_contact_missing",
    }
    assert items["emergency_contact_missing"]["count"] == 4 and items["classes_without_class_teacher"]["ok"] is True
    # an exam with papers but not published, and an unpaid invoice
    ex = (await client.post(f"{API}/exams", headers=h, json={"name": "Final"})).json()
    await client.put(
        f"{API}/exams/{ex['id']}/papers",
        headers=h,
        json={"class_ids": [w["cls"]["8"]["id"]], "papers": [{"subject_id": w["maths"]["id"], "max_marks": 100}]},
    )
    await run(client, h, "Term 1")
    items = {i["key"]: i for i in (await client.get(f"{API}/rollover/readiness", headers=h)).json()["items"]}
    assert items["results_unpublished"]["details"] == ["Final: 8-A"]
    assert (
        items["fees_unpaid"]["count"] == 4 and items["fees_unpaid"]["amount_paise"] == 100_000 * 2 + 120_000 + 150_000
    )
    assert (await client.get(f"{API}/rollover/readiness", headers=h)).json()["all_ok"] is False
    await apply(client, h)  # still allowed


async def test_banner_shows_from_45_days_before_the_year_end(client, w):
    st = await status(client, w["h"])
    assert st["current_year"] and st["suggested_name"] and st["suggested_starts_on"]
    assert st["show_banner"] == (st["days_left"] <= 45)


# ------------------------------------------------------------------ fees
async def test_dues_follow_the_student_into_the_first_invoice_of_the_new_year(client, w):
    h = w["h"]
    await run(client, h, "Term 1")
    inv = {i["student_name"]: i for i in await invoices(client, h)}
    await pay(client, h, inv["Aarav Sharma"]["id"], 40_000)  # 60,000 left
    plan = {"fees": {"dues": "carry", "first_invoice": {"period_label": "Term 1", "due_on": first_term_due()}}}
    pre = (await client.post(f"{API}/rollover/preview", headers=h, json=plan)).json()
    assert pre["dues"] == {"mode": "carry", "students": 4, "total_paise": 60_000 + 100_000 + 120_000 + 150_000}
    out = await apply(client, h, plan)
    assert (
        out["invoices_created"] == 3 and out["dues_carried_paise"] == 60_000 + 100_000 + 120_000
    )  # Diya has no new invoice
    new = {i["student_name"]: i for i in await invoices(client, h, student_id=w["kids"]["Aarav"]["id"])}
    mine = [
        i
        for i in await invoices(client, h, student_id=w["kids"]["Aarav"]["id"])
        if i["period_label"] == "Term 1" and i["status"] != "closed"
    ]
    assert len(mine) == 1 and mine[0]["total_paise"] == 120_000 + 60_000  # class 9 fee + previous dues
    detail = (await client.get(f"{API}/fees/invoices/{mine[0]['id']}", headers=h)).json()
    assert [i["kind"] for i in detail["items"]] == ["fee", "previous_dues"]
    assert new
    # Diya passed out with dues: they stay open for the fees staff
    diya = [i for i in await invoices(client, h, student_id=w["kids"]["Diya"]["id"])]
    assert diya[0]["status"] == "unpaid"


async def test_write_off_needs_a_reason_closes_the_invoices_and_is_audited_as_sensitive(client, w):
    h = w["h"]
    await run(client, h, "Term 1")
    bad = {"fees": {"dues": "write_off"}}
    assert (await client.post(f"{API}/rollover/preview", headers=h, json=bad)).status_code == 422
    plan = {
        "fees": {
            "dues": "write_off",
            "write_off_reason": "Board decision",
            "first_invoice": {"due_on": first_term_due()},
        }
    }
    out = await apply(client, h, plan)
    assert out["dues_written_off_paise"] == 100_000 * 2 + 120_000 + 150_000
    async with make_session(bypass=True) as s:
        rows = (await s.scalars(select(FeeCarryForward))).all()
        assert len(rows) == 4 and all(
            r.written_off and r.to_invoice_id is None and r.reason == "Board decision" for r in rows
        )
    new = [i for i in await invoices(client, h, student_id=w["kids"]["Aarav"]["id"]) if i["status"] != "closed"]
    assert len(new) == 1 and new[0]["total_paise"] == 120_000  # no previous dues line
    audit = (await client.get(f"{API}/audit?action=fees.written_off", headers=h)).json()
    assert audit["items"][0]["sensitive"] is True


async def test_fee_increase_rounding_and_cell_overrides(client, w):
    h = w["h"]
    plan = {
        "fees": {
            "increase_percent": 10,
            "round_to_paise": 10_000,
            "cells": [{"grade": "10", "fee_head_id": w["head"]["id"], "amount_paise": 99_900}],
        }
    }
    pre = (await client.post(f"{API}/rollover/preview", headers=h, json=plan)).json()
    # 9-A: 120000 + 10% = 132000 -> nearest Rs 100 = 130000 ... 132000 rounds to 130000; class 10 overridden
    assert [c["fee_total_paise"] for c in pre["new_classes"]] == [130_000, 99_900]
    await apply(client, h, plan)
    async with make_session(bypass=True) as s:
        got = sorted((await s.scalars(select(FeeStructure.amount_paise))).all())
    assert {130_000, 99_900} <= set(got)


async def test_concessions_and_optional_fees_follow_continuing_students(client, w):
    h = w["h"]
    c = (
        await client.post(f"{API}/fees/concessions", headers=h, json={"name": "RTE", "kind": "percent", "value": 100})
    ).json()
    r = await client.post(
        f"{API}/fees/students/{w['kids']['Aarav']['id']}/concessions", headers=h, json={"concession_id": c["id"]}
    )
    assert r.status_code == 201, r.text
    out = await apply(client, h)
    async with make_session(bypass=True) as s:
        years_of = (
            await s.scalars(
                select(StudentConcession.academic_year_id).where(StudentConcession.concession_id == c["id"])
            )
        ).all()
    assert len(set(years_of)) == 2 and len(years_of) == 2  # last year's and the carried one
    assert out["promoted"] == 3


# ------------------------------------------------------------------ safety: idempotency, atomicity, permission
async def test_applying_twice_is_refused_and_changes_nothing(client, w):
    h = w["h"]
    st = await status(client, h)
    first = await apply(client, h)
    after = await counts()
    r = await client.post(
        f"{API}/rollover/apply", headers=h, json={"from_year_id": st["current_year_id"], "confirm": True}
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_applied"
    assert r.json()["error"]["details"]["batch_id"] == first["batch_id"]
    assert await counts() == after
    # the batch is kept as a record
    batches = (await client.get(f"{API}/rollover/batches", headers=h)).json()
    assert len(batches) == 1 and batches[0]["summary"]["promoted"] == 3
    detail = (await client.get(f"{API}/rollover/batches/{first['batch_id']}", headers=h)).json()
    assert {(i["name"], i["decision"], i["to_class"]) for i in detail["items"]} >= {
        ("Aarav Sharma", "promote", "9-A"),
        ("Diya Sharma", "passed_out", None),
    }


async def test_apply_needs_the_confirmation_tick(client, w):
    out = await apply(client, w["h"], confirm=False, expect=422)
    assert out["error"]["code"] == "confirm_required"


async def test_a_failure_halfway_rolls_everything_back(client, w, monkeypatch):
    h = w["h"]
    before = await counts()

    async def boom(*a, **k):
        raise RuntimeError("disk on fire")  # after students moved, classes created and the years switched

    monkeypatch.setattr("app.services.rollover.generate_invoices", boom)
    plan = {
        "fees": {"first_invoice": {"due_on": first_term_due()}},
        "decisions": [{"student_id": w["kids"]["Bhumi"]["id"], "decision": "leave"}],
    }
    st = await status(client, h)
    with pytest.raises(RuntimeError):
        await client.post(
            f"{API}/rollover/apply",
            headers=h,
            json={"from_year_id": st["current_year_id"], "confirm": True, "plan": plan},
        )
    assert await counts() == before
    async with make_session(bypass=True) as s:
        assert (
            await s.scalar(select(func.count()).select_from(AcademicYear).where(AcademicYear.status == "current"))
        ) == 1
        assert (await s.scalar(select(Student.status).where(Student.first_name == "Bhumi"))) == "active"
        assert (await s.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.status != "active"))) == 0
    assert (await status(client, h))["already_applied"] is False
    monkeypatch.undo()
    assert (await apply(client, h, plan))["leaving"] == 1  # and it can simply be run again


async def test_only_academic_managers_can_roll_over(client, w, mail):
    from studentkit import teacher

    h = w["h"]
    ct = await teacher(client, h, mail, "plain@rps.example", class_id=w["cls"]["8"]["id"])
    fees = await teacher(client, h, mail, "feesonly@rps.example", perms=["fees.manage"])
    for headers in (ct, fees, w["parents"]["Aarav"]):
        for method, url in (
            ("get", "/rollover/status"),
            ("get", "/rollover/readiness"),
            ("post", "/rollover/preview"),
            ("put", "/rollover/draft"),
        ):
            r = await getattr(client, method)(
                f"{API}{url}", headers=headers, **({"json": {}} if method != "get" else {})
            )
            assert r.status_code == 403, (url, r.text)
        r = await client.post(
            f"{API}/rollover/apply",
            headers=headers,
            json={"from_year_id": (await status(client, h))["current_year_id"], "confirm": True},
        )
        assert r.status_code == 403
    acad = await teacher(client, h, mail, "acad@rps.example", perms=["academic.manage"])
    assert (await client.get(f"{API}/rollover/status", headers=acad)).status_code == 200


async def test_the_archived_year_is_read_only(client, w):
    h = w["h"]
    ex = (await client.post(f"{API}/exams", headers=h, json={"name": "Final"})).json()
    r = await client.put(
        f"{API}/exams/{ex['id']}/papers",
        headers=h,
        json={"class_ids": [w["cls"]["8"]["id"]], "papers": [{"subject_id": w["maths"]["id"], "max_marks": 100}]},
    )
    assert r.status_code == 200
    sheet = (await client.get(f"{API}/exams/{ex['id']}/classes/{w['cls']['8']['id']}/sheet", headers=h)).json()
    entry = {
        "enrollment_id": sheet["students"][0]["enrollment_id"],
        "subject_id": w["maths"]["id"],
        "marks_obtained": 50,
    }
    marks_url = f"{API}/exams/{ex['id']}/classes/{w['cls']['8']['id']}/marks"
    assert (await client.put(marks_url, headers=h, json={"entries": [entry]})).status_code == 200
    await apply(client, h)
    # last year: marks, remarks, papers, attendance and invoice runs are all refused, reading still works
    r = await client.put(marks_url, headers=h, json={"entries": [entry]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "year_completed"
    r = await client.put(
        f"{API}/exams/{ex['id']}/classes/{w['cls']['8']['id']}/remarks",
        headers=h,
        json={"remarks": [{"enrollment_id": sheet["students"][0]["enrollment_id"], "remark": "Good"}]},
    )
    assert r.status_code == 409
    r = await client.put(
        f"{API}/exams/{ex['id']}/papers",
        headers=h,
        json={"class_ids": [w["cls"]["8"]["id"]], "papers": [{"subject_id": w["maths"]["id"], "max_marks": 80}]},
    )
    assert r.status_code == 409
    assert (
        await client.get(f"{API}/exams/{ex['id']}/classes/{w['cls']['8']['id']}/sheet", headers=h)
    ).status_code == 200
    from attkit import day

    att = await client.put(
        f"{API}/attendance/classes/{w['cls']['8']['id']}/days/{day(0)}",
        headers=h,
        json={"records": [{"student_id": w["kids"]["Aarav"]["id"], "first_half": "present", "second_half": "present"}]},
    )
    assert att.status_code == 409
    ys = await years(client, h)
    old = [y for n, y in ys.items() if y["status"] == "completed"][0]
    r = await client.post(
        f"{API}/fees/invoice-runs",
        headers=h,
        json={"period_label": "X", "due_on": "2099-01-01", "academic_year_id": old["id"]},
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "year_completed"


async def test_timetable_is_copied_with_the_class_it_follows_or_left_empty(client, w):
    from app.models.timetable import TimetableSlot

    h = w["h"]
    p = (
        await client.post(
            f"{API}/timetable/periods",
            headers=h,
            json={"number": 1, "name": "P1", "starts_at": "09:00", "ends_at": "09:40"},
        )
    ).json()
    for weekday in (1, 2):
        r = await client.post(
            f"{API}/timetable/slots",
            headers=h,
            json={
                "class_id": w["cls"]["8"]["id"],
                "weekday": weekday,
                "period_id": p["id"],
                "subject_id": w["maths"]["id"],
                "staff_id": w["staff"]["maths8"]["id"],
            },
        )
        assert r.status_code == 201, r.text
    pre = (await client.post(f"{API}/rollover/preview", headers=h, json={"teachers": "move_up"})).json()
    assert [c["timetable_slots"] for c in pre["new_classes"]] == [2, 0]
    out = await apply(client, h, {"teachers": "move_up"})
    assert out["classes_created"] == 2
    async with make_session(bypass=True) as s:
        new = (
            await s.scalars(
                select(TimetableSlot).where(TimetableSlot.academic_year_id != w["cls"]["8"]["academic_year_id"])
            )
        ).all()
        assert len(new) == 2 and {x.staff_id for x in new} == {uuid_of(w["staff"]["maths8"]["id"])}
        assert (await s.scalar(select(func.count()).select_from(TimetableSlot))) == 4  # last year's two stay


def uuid_of(x):
    import uuid

    return uuid.UUID(x)


async def test_empty_timetable_option_copies_nothing(client, w):
    from app.models.timetable import TimetableSlot

    h = w["h"]
    p = (
        await client.post(
            f"{API}/timetable/periods",
            headers=h,
            json={"number": 1, "name": "P1", "starts_at": "09:00", "ends_at": "09:40"},
        )
    ).json()
    await client.post(
        f"{API}/timetable/slots",
        headers=h,
        json={
            "class_id": w["cls"]["9"]["id"],
            "weekday": 1,
            "period_id": p["id"],
            "subject_id": w["maths"]["id"],
            "staff_id": w["staff"]["maths8"]["id"],
        },
    )
    await apply(client, h, {"timetable": "empty"})
    async with make_session(bypass=True) as s:
        assert (await s.scalar(select(func.count()).select_from(TimetableSlot))) == 1
