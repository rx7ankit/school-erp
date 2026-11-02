"""Results, date sheets and feedback of one school are invisible to another, in the API and in Postgres itself."""

import uuid

import pytest
from conftest import API, bearer, sign_in
from resultskit import fill_all, parent_of, world
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError

from app.db.session import make_session
from app.models.results import (
    Exam,
    ExamPaper,
    ExamPublication,
    ExamSchedule,
    ExamSubject,
    FeedbackRequest,
    FeedbackResponse,
    FeedbackTarget,
    GradeBand,
    GradingScheme,
    ReportCard,
    ReportRemark,
    Result,
)

MODELS = (
    GradingScheme, GradeBand, Exam, ExamSubject, Result, ExamPublication, ReportRemark, ReportCard,
    ExamSchedule, ExamPaper, FeedbackRequest, FeedbackTarget, FeedbackResponse,
)  # fmt: skip


async def fill(client, school, mail, domain_suffix):
    w = await world(client, school, mail)
    await fill_all(client, w, {"Aarav": (80, 40), "Bhumi": (70, 30), "Chirag": (60, 20)})
    await client.post(f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}/publish", headers=w["heads"]["ct"])
    sched = (await client.post(f"{API}/exam-schedules", headers=w["h"], json={"name": "Dates"})).json()
    await client.put(
        f"{API}/exam-schedules/{sched['id']}/papers",
        headers=w["h"],
        json={
            "papers": [
                {
                    "class_id": w["class"]["id"],
                    "subject_id": w["subj"]["English"]["id"],
                    "paper_on": "2027-03-01",
                    "starts_at": "10:00",
                }
            ]
        },
    )
    req = (
        await client.post(
            f"{API}/feedback",
            headers=w["h"],
            json={"title": "FB", "class_ids": [w["class"]["id"]], "closes_on": "2099-01-01"},
        )
    ).json()
    e = (
        await client.get(f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}/sheet", headers=w["heads"]["ct"])
    ).json()
    await client.put(
        f"{API}/exams/{w['exam']['id']}/classes/{w['class']['id']}/remarks",
        headers=w["heads"]["ct"],
        json={"remarks": [{"enrollment_id": e["students"][0]["enrollment_id"], "remark": "Good"}]},
    )
    pa = await parent_of(client, mail, "Aarav")
    row = (await client.get(f"{API}/parent/feedback", headers=pa)).json()[0]
    await client.put(
        f"{API}/parent/feedback/targets/{row['targets'][0]['target_id']}/children/{row['student_id']}",
        headers=pa,
        json={"rating": 4},
    )
    return w, sched, req


async def test_other_schools_results_are_invisible(client, school_a, school_b, mail):
    # the world() helper uses fixed emails, so build school B's data with its own staff emails
    wa, sa, ra = await fill(client, school_a, mail, "a")
    ha = wa["h"]
    # school B only needs its own admin: ids of A must 404 for B
    hb = school_b["headers"]
    ex, cl, st = wa["exam"]["id"], wa["class"]["id"], wa["students"]["Aarav"]["id"]
    assert (await client.get(f"{API}/exams", headers=hb)).json()["total"] == 0
    for url in (
        f"/exams/{ex}/classes", f"/exams/{ex}/classes/{cl}/sheet", f"/exams/{ex}/classes/{cl}/export",
        f"/exams/{ex}/students/{st}/result", f"/exams/{ex}/students/{st}/report-card",
        f"/exam-schedules/{sa['id']}", f"/feedback/{ra['id']}", f"/feedback/{ra['id']}/export",
    ):  # fmt: skip
        assert (await client.get(f"{API}{url}", headers=hb)).status_code == 404, url
    assert (await client.post(f"{API}/exams/{ex}/classes/{cl}/publish", headers=hb)).status_code == 404
    assert (
        await client.put(f"{API}/exams/{ex}/papers", headers=hb, json={"class_ids": [cl], "papers": []})
    ).status_code == 404
    assert (await client.post(f"{API}/exam-schedules/{sa['id']}/publish", headers=hb)).status_code == 404
    assert (await client.post(f"{API}/feedback/{ra['id']}/close", headers=hb)).status_code == 404
    assert (await client.post(f"{API}/grading-schemes/{uuid.uuid4()}/activate", headers=hb)).status_code == 404
    assert (await client.get(f"{API}/grading-schemes", headers=hb)).json() == []
    assert (await client.get(f"{API}/feedback", headers=hb)).json() == []
    assert (await client.get(f"{API}/exam-schedules", headers=hb)).json() == []
    # B cannot put A's class on an exam of its own
    own = (await client.post(f"{API}/exams", headers=hb, json={"name": "Own"})).json()
    assert (
        await client.put(f"{API}/exams/{own['id']}/papers", headers=hb, json={"class_ids": [cl], "papers": []})
    ).status_code == 404
    assert (await client.get(f"{API}/exams", headers=ha)).json()["total"] == 1


async def test_a_parent_of_another_school_sees_nothing(client, school_a, school_b, mail):
    wa, _, _ = await fill(client, school_a, mail, "a")
    pa = bearer(await sign_in(client, "aarav@fam.example", "Parent#Pass9"))  # fill() already set this password
    ex, st = wa["exam"]["id"], wa["students"]["Aarav"]["id"]
    assert len((await client.get(f"{API}/parent/children/{st}/results", headers=pa)).json()) == 1
    # a second school's admin is not a parent; and A's parent cannot read an id guessed from elsewhere
    assert (await client.get(f"{API}/parent/children/{uuid.uuid4()}/results/{ex}", headers=pa)).status_code == 404


async def test_postgres_itself_hides_other_schools_for_every_new_table(client, school_a, school_b, mail):
    wa, _, _ = await fill(client, school_a, mail, "a")
    # school B gets its own rows through the API with different staff emails
    hb = school_b["headers"]
    await client.post(
        f"{API}/grading-schemes", headers=hb, json={"name": "B", "bands": [{"min_percent": 0, "grade": "P"}]}
    )
    await client.post(f"{API}/exams", headers=hb, json={"name": "B exam"})
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=a_id)
    try:
        for model in MODELS:
            rows = (await s.scalars(select(model))).all()
            assert rows, model.__tablename__
            assert {r.school_id for r in rows} == {a_id}, model.__tablename__
    finally:
        await s.close()
    s = make_session(school_id=b_id)
    try:
        assert {r.school_id for r in (await s.scalars(select(Exam))).all()} == {b_id}
        assert (await s.scalars(select(Result))).all() == []
        assert (await s.scalars(select(FeedbackResponse))).all() == []
    finally:
        await s.close()
    nobody = make_session()
    try:
        for model in MODELS:
            assert (await nobody.scalars(select(model))).all() == [], model.__tablename__
    finally:
        await nobody.close()


@pytest.mark.parametrize(
    "build",
    [
        lambda b: Exam(school_id=b, academic_year_id=uuid.uuid4(), name="Sneaky"),
        lambda b: GradingScheme(school_id=b, name="Sneaky"),
    ],
)
async def test_postgres_blocks_writing_into_another_school(client, school_a, school_b, build):
    a_id, b_id = uuid.UUID(school_a["school"]["id"]), uuid.UUID(school_b["school"]["id"])
    s = make_session(school_id=a_id)
    try:
        s.add(build(b_id))
        with pytest.raises((DBAPIError, ProgrammingError)):
            await s.flush()
    finally:
        await s.rollback()
        await s.close()
