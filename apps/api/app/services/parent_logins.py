"""Parent logins for staff: who has one, create and send in one click or in bulk, and the email-list import."""

import uuid
from collections import defaultdict

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, Conflict
from app.models.academic import SchoolClass
from app.models.enums import AuditCategory, InviteStatus
from app.models.student import Enrollment, Guardian, Student, StudentGuardian
from app.models.user import User
from app.schemas.students import ParentChild, ParentListIn, ParentListOut, ParentListRow, ParentRow, RowError
from app.services.audit import Actor, log_audit
from app.services.guardians import (
    ensure_parent_login,
    ensure_primary,
    link_guardian,
    login_state,
    norm_email,
    school_name,
    send_parent_login,
)
from app.services.sheets import read_table
from app.services.students import class_label, current_year_or_none, full_name


def parents_query(q: str | None):
    stmt = select(Guardian).order_by(Guardian.name)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Guardian.name.ilike(like), Guardian.email.ilike(like), Guardian.phone.ilike(like)))
    return stmt


async def parent_rows(db: AsyncSession, guardians: list[Guardian]) -> list[ParentRow]:
    ids = [g.id for g in guardians]
    state = await login_state(db, guardians)
    kids: dict[uuid.UUID, list[ParentChild]] = defaultdict(list)
    if ids:
        year = await current_year_or_none(db)
        rows = (
            await db.execute(
                select(StudentGuardian.guardian_id, Student, SchoolClass)
                .join(Student, Student.id == StudentGuardian.student_id)
                .outerjoin(
                    Enrollment,
                    (Enrollment.student_id == Student.id)
                    & (Enrollment.academic_year_id == (year.id if year else None)),
                )
                .outerjoin(SchoolClass, SchoolClass.id == Enrollment.class_id)
                .where(StudentGuardian.guardian_id.in_(ids))
                .order_by(Student.first_name)
            )
        ).all()
        for gid, s, c in rows:
            kids[gid].append(ParentChild(student_id=s.id, name=full_name(s), class_label=class_label(c) if c else None))
    out = []
    for g in guardians:
        status, user, inv = state[g.id]
        out.append(
            ParentRow(
                guardian_id=g.id,
                name=g.name,
                email=g.email,
                phone=g.phone,
                children=kids.get(g.id, []),
                login_status=status,
                login_sent_at=inv.last_sent_at if inv else None,
                last_login_at=user.last_login_at if user else None,
            )
        )
    return out


async def send_logins(
    db: AsyncSession, actor: Actor, guardians: list[Guardian], *, create_only: bool = False
) -> dict[str, int]:
    """Creates missing parent logins and (unless `create_only`) emails a fresh temporary password to each.
    Guardians without an email are counted and skipped. A login conflict stops the whole call."""
    assert actor.school_id
    school = await school_name(db, actor.school_id)
    created = sent = failed = skipped = 0
    for g in guardians:
        if not norm_email(g.email) and not g.user_id:
            skipped += 1
            continue
        user, was_created = await ensure_parent_login(db, g)
        created += was_created
        if create_only:
            continue
        if await send_parent_login(db, actor, user, school=school, audit=False):
            sent += 1
        else:
            failed += 1
    if created:
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "parent.logins_created",
            f"Created {created} parent logins",
            entity_label="Parents",
        )
    if sent or failed:
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "login.sent",
            f"Sent login emails to {sent} parents" + (f" ({failed} failed)" if failed else ""),
            entity_label="Parents",
        )
    return {"created": created, "sent": sent, "failed": failed, "skipped_no_email": skipped}


async def pending_guardians(db: AsyncSession) -> list[Guardian]:
    """Guardians with an email who have no login yet, or whose login has never been used and not been sent."""
    gs = (await db.scalars(select(Guardian).where(Guardian.email.is_not(None)))).all()
    state = await login_state(db, list(gs))
    return [g for g in gs if state[g.id][0] in ("none", InviteStatus.pending.value, InviteStatus.failed.value)]


async def link_parent_list(db: AsyncSession, actor: Actor, body: ParentListIn) -> ParentListOut:
    """`scholar no, guardian name, email, mobile` rows. Rows are grouped by email: one email is one guardian and one
    login, linked to every child listed with it. With dry_run nothing is saved."""
    assert actor.school_id
    errors: list[RowError] = []
    scholars = {r.scholar_no.strip() for r in body.rows}
    students = {
        s.scholar_no: s for s in (await db.scalars(select(Student).where(Student.scholar_no.in_(scholars)))).all()
    }
    groups: dict[str, list[tuple[int, object]]] = defaultdict(list)
    for i, r in enumerate(body.rows, start=1):
        if r.scholar_no.strip() not in students:
            errors.append(RowError(row_no=i, error=f"No student with scholar number {r.scholar_no}"))
            continue
        groups[str(r.email).lower()].append((i, r))
    if errors and not body.dry_run:
        raise Conflict(
            f"{len(errors)} rows have problems. Nothing was saved.",
            code="list_has_errors",
            details=[e.model_dump() for e in errors[:100]],
        )
    links = 0
    new_guardians: dict[str, Guardian] = {}
    for email, items in groups.items():
        first = items[0][1]
        g = (await db.scalar(select(Guardian).where(Guardian.email == email))) or None
        if g is None:
            if not body.dry_run:
                g = Guardian(
                    school_id=actor.school_id,
                    name=first.name.strip(),
                    phone=first.mobile,
                    email=email,  # type: ignore[attr-defined]
                )
                db.add(g)
                await db.flush()
        if g is not None:
            new_guardians[email] = g
        for _, r in items:
            links += 1
            if not body.dry_run and g is not None:
                s = students[r.scholar_no.strip()]  # type: ignore[attr-defined]
                existing = await db.get(StudentGuardian, (s.id, g.id))
                await link_guardian(
                    db,
                    s,
                    g,
                    relation=existing.relation if existing else r.relation,  # type: ignore[attr-defined]
                    is_primary=existing.is_primary if existing else False,
                    is_emergency=existing.is_emergency if existing else False,
                )
                await ensure_primary(db, s)
    created = sent = failed = 0
    if not body.dry_run:
        guardians = list(new_guardians.values())
        res = await send_logins(db, actor, guardians, create_only=not body.send_login)
        created, sent, failed = res["created"], res["sent"], res["failed"]
        log_audit(
            db,
            actor,
            AuditCategory.students,
            "parents.list_imported",
            f"Linked {links} children to {len(groups)} parent emails from a list",
            entity_label="Parents",
        )
    else:
        created = sum(1 for e in groups if not new_guardians.get(e) or not new_guardians[e].user_id)
    return ParentListOut(
        dry_run=body.dry_run,
        total_rows=len(body.rows),
        error_rows=len(errors),
        errors=errors,
        parents=len(groups),
        links=links,
        logins_created=created,
        sent=sent,
        failed=failed,
    )


async def user_of(db: AsyncSession, guardian: Guardian) -> User | None:
    return await db.get(User, guardian.user_id) if guardian.user_id else None


def require_email(guardian: Guardian) -> None:
    if not norm_email(guardian.email):
        raise AppError(f"{guardian.name} has no email.", code="guardian_email_required", status=422)


LIST_ALIASES = {
    "scholar_number": "scholar_no",
    "scholar": "scholar_no",
    "guardian_name": "name",
    "parent_name": "name",
    "guardian_email": "email",
    "parent_email": "email",
    "mobile": "mobile",
    "guardian_mobile": "mobile",
    "phone": "mobile",
}


async def link_parent_file(
    db: AsyncSession, actor: Actor, *, data: bytes, filename: str, dry_run: bool, send_login: bool
) -> ParentListOut:
    """The same as the pasted list, from a file with columns: scholar no, guardian name, email, mobile."""
    table = read_table(data, filename, aliases=LIST_ALIASES, required=("scholar_no", "name", "email"))
    rows, bad = [], []
    for row_no, rec in table:
        try:
            rows.append(
                ParentListRow(
                    scholar_no=str(rec.get("scholar_no") or ""),
                    name=str(rec.get("name") or ""),
                    email=str(rec.get("email") or ""),
                    mobile=str(rec["mobile"]) if rec.get("mobile") else None,
                    relation=str(rec.get("relation") or "other").lower(),  # type: ignore[arg-type]
                )
            )
        except Exception:  # noqa: BLE001
            bad.append(RowError(row_no=row_no, error="Needs a scholar number, a name and a valid email"))
    if bad and not dry_run:
        raise Conflict(
            f"{len(bad)} rows have problems. Nothing was saved.",
            code="list_has_errors",
            details=[b.model_dump() for b in bad],
        )
    if rows:
        out = await link_parent_list(db, actor, ParentListIn(rows=rows, dry_run=dry_run, send_login=send_login))
    else:
        out = ParentListOut(
            dry_run=dry_run,
            total_rows=0,
            error_rows=0,
            errors=[],
            parents=0,
            links=0,
            logins_created=0,
            sent=0,
            failed=0,
        )
    out.errors = bad + out.errors
    out.error_rows += len(bad)
    out.total_rows += len(bad)
    return out
