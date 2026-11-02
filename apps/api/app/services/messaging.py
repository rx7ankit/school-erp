"""Unified messaging: broadcasts (one way, to parents) and teacher threads (parent and one teacher, per child and
subject). Who may message whom is decided here, on the server:

- School broadcasts (whole school, a grade, chosen classes): admin or `academic.manage`.
- Class broadcasts: admin or `academic.manage` for any class; otherwise a teacher assigned to that class. The class
  teacher may use any subject tag or General, a subject teacher only their own subject.
- Threads: only a teacher currently assigned to the child's class (class teacher, or subject teacher for that
  subject) and the child's parents. A thread is active only while that assignment lasts and the child is active;
  it is derived from `class_staff`, so nothing is deleted or moved when teachers change.
- Parents never reply to broadcasts, and a child who has left is read-only.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import and_, exists, false, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, Forbidden, NotFound
from app.core.ids import uuid7
from app.core.principal import Principal
from app.models.academic import AcademicYear, ClassStaff, SchoolClass, Subject
from app.models.enums import (
    AuditCategory,
    BroadcastAudience,
    BroadcastScope,
    ClassRole,
    EnrollmentStatus,
    Permission,
    StudentStatus,
    YearStatus,
)
from app.models.file import Attachment
from app.models.messaging import (
    Broadcast,
    BroadcastClass,
    BroadcastRead,
    Message,
    MessageFile,
    MessageThread,
    ThreadRead,
)
from app.models.student import Enrollment, Guardian, Student, StudentGuardian
from app.models.user import User
from app.schemas.file import UploadOut
from app.schemas.messaging import (
    AttachmentRef,
    BroadcastIn,
    BroadcastOut,
    FeedItemOut,
    MessageOut,
    TeacherOut,
    ThreadOut,
    UnreadSummary,
)
from app.services.audit import Actor, log_audit
from app.services.guardians import assert_parent_child
from app.services.messages_i18n import render
from app.services.notifications import notify, notify_guardians_of_student
from app.services.storage import PURPOSES, get_storage, make_key
from app.services.students import class_label, full_name, get_student_or_404

log = logging.getLogger("scool.messaging")

ATTACHMENT_PURPOSE = "message_attachment"
CLASS_TEACHER_TAG = "Class teacher"


def _now() -> datetime:
    return datetime.now(UTC)


def _preview(text: str, n: int = 140) -> str:
    t = " ".join(text.split())
    return t if len(t) <= n else t[: n - 1] + "…"


def is_manager(p: Principal) -> bool:
    """Admin and academic managers may broadcast school wide and to any class."""
    return p.has(Permission.academic.value)


# ------------------------------------------------------------------ attachments
async def _link_files(
    db: AsyncSession,
    sender_id: uuid.UUID,
    school_id: uuid.UUID,
    ids: list[uuid.UUID],
    *,
    broadcast_id: uuid.UUID | None = None,
    message_id: uuid.UUID | None = None,
) -> None:
    ids = list(dict.fromkeys(ids))
    if not ids:
        return
    rows = (await db.scalars(select(Attachment).where(Attachment.id.in_(ids)))).all()
    used = (await db.scalars(select(MessageFile.attachment_id).where(MessageFile.attachment_id.in_(ids)))).all()
    ok = (
        len(rows) == len(ids)
        and not used
        and all(a.status == "ready" and a.purpose == ATTACHMENT_PURPOSE and a.uploaded_by == sender_id for a in rows)
    )
    if not ok:
        raise AppError(
            "An attachment is missing, not uploaded yet, not yours, or already used.",
            code="invalid_attachment",
            status=422,
        )
    for a in ids:
        db.add(MessageFile(school_id=school_id, broadcast_id=broadcast_id, message_id=message_id, attachment_id=a))
    await db.flush()


async def _attachment_map(
    db: AsyncSession, *, broadcast_ids: list[uuid.UUID] = (), message_ids: list[uuid.UUID] = ()
) -> dict[uuid.UUID, list[AttachmentRef]]:
    """parent id (broadcast or message) -> attachments."""
    out: dict[uuid.UUID, list[AttachmentRef]] = {}
    for col, ids in ((MessageFile.broadcast_id, broadcast_ids), (MessageFile.message_id, message_ids)):
        if not ids:
            continue
        rows = (
            await db.execute(
                select(col, Attachment).join(Attachment, Attachment.id == MessageFile.attachment_id).where(col.in_(ids))
            )
        ).all()
        for pid, a in rows:
            out.setdefault(pid, []).append(AttachmentRef.model_validate(a))
    return out


async def start_parent_upload(
    db: AsyncSession, p: Principal, *, filename: str, content_type: str, size_bytes: int
) -> UploadOut:
    """Parents attach files to thread messages. Same rules as /files/upload-url, fixed to message attachments."""
    types, max_bytes = PURPOSES[ATTACHMENT_PURPOSE]
    if content_type not in types:
        raise AppError("This kind of file is not allowed here.", code="invalid_file_type")
    if size_bytes > max_bytes:
        raise AppError(f"The file is too large. The limit is {max_bytes // (1024 * 1024)} MB.", code="file_too_large")
    file_id = uuid7()
    key = make_key(p.school_id, ATTACHMENT_PURPOSE, file_id, filename)
    db.add(
        Attachment(
            id=file_id,
            school_id=p.school_id,
            purpose=ATTACHMENT_PURPOSE,
            filename=filename[:200],
            content_type=content_type,
            size_bytes=size_bytes,
            storage_key=key,
            uploaded_by=p.user_id,
        )
    )
    await db.flush()
    ttl = settings.upload_url_ttl_seconds
    return UploadOut(
        id=file_id,
        upload_url=await get_storage().upload_url(key, content_type, ttl),
        headers={"Content-Type": content_type},
        expires_in=ttl,
    )


async def finish_parent_upload(db: AsyncSession, p: Principal, file_id: uuid.UUID) -> Attachment:
    a = await db.get(Attachment, file_id)
    if a is None or a.uploaded_by != p.user_id or a.purpose != ATTACHMENT_PURPOSE:
        raise NotFound("File not found.")
    if a.status == "ready":
        return a
    obj = await get_storage().head(a.storage_key)
    if obj is None:
        raise AppError("The file was not uploaded. Please try again.", code="upload_missing")
    if obj.size != a.size_bytes:
        await get_storage().delete(a.storage_key)
        raise AppError("The uploaded file does not match. Please try again.", code="upload_mismatch")
    a.status, a.confirmed_at = "ready", _now()
    await db.flush()
    return a


# ------------------------------------------------------------------ who is where
async def _current_year_ids(db: AsyncSession) -> list[uuid.UUID]:
    return list(
        (await db.scalars(select(AcademicYear.id).where(AcademicYear.status == YearStatus.current.value))).all()
    )


async def parent_active_children(
    db: AsyncSession, user_id: uuid.UUID, student_id: uuid.UUID | None = None
) -> list[tuple[uuid.UUID, uuid.UUID | None]]:
    """(student id, class id) of this parent's ACTIVE children; class is None if not placed this year."""
    q = (
        select(Student.id, Enrollment.class_id)
        .select_from(Student)
        .join(StudentGuardian, StudentGuardian.student_id == Student.id)
        .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
        .outerjoin(
            Enrollment,
            and_(
                Enrollment.student_id == Student.id,
                Enrollment.status == EnrollmentStatus.active.value,
                Enrollment.academic_year_id.in_(select(AcademicYear.id).where(AcademicYear.status == "current")),
            ),
        )
        .where(Guardian.user_id == user_id, Student.status == StudentStatus.active.value)
    )
    if student_id:
        q = q.where(Student.id == student_id)
    return [(r[0], r[1]) for r in (await db.execute(q)).all()]


async def recipient_user_ids(db: AsyncSession, class_ids: list[uuid.UUID] | None) -> list[uuid.UUID]:
    """Parent logins of active students: the whole school (None) or the given classes."""
    q = (
        select(Guardian.user_id)
        .select_from(Guardian)
        .join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id)
        .join(Student, Student.id == StudentGuardian.student_id)
        .where(Guardian.user_id.is_not(None), Student.status == StudentStatus.active.value)
        .distinct()
    )
    if class_ids is not None:
        q = q.join(
            Enrollment,
            and_(
                Enrollment.student_id == Student.id,
                Enrollment.status == EnrollmentStatus.active.value,
                Enrollment.academic_year_id.in_(select(AcademicYear.id).where(AcademicYear.status == "current")),
            ),
        ).where(Enrollment.class_id.in_(class_ids))
    return list((await db.scalars(q)).all())


async def teacher_matches(
    db: AsyncSession, class_id: uuid.UUID, staff_id: uuid.UUID, subject_id: uuid.UUID | None
) -> bool:
    """Is this person right now the class teacher (subject None) or the subject teacher of that subject?"""
    q = select(ClassStaff.id).where(ClassStaff.class_id == class_id, ClassStaff.staff_id == staff_id)
    if subject_id is None:
        q = q.where(ClassStaff.role == ClassRole.class_teacher.value)
    else:
        q = q.where(ClassStaff.role == ClassRole.subject_teacher.value, ClassStaff.subject_id == subject_id)
    return (await db.scalar(q)) is not None


async def _class_of(db: AsyncSession, student: Student) -> SchoolClass | None:
    """The class the student is in this year (active enrollment), or None."""
    if student.status != StudentStatus.active.value:
        return None
    return await db.scalar(
        select(SchoolClass)
        .join(Enrollment, Enrollment.class_id == SchoolClass.id)
        .where(
            Enrollment.student_id == student.id,
            Enrollment.status == EnrollmentStatus.active.value,
            Enrollment.academic_year_id.in_(select(AcademicYear.id).where(AcademicYear.status == "current")),
        )
    )


# ------------------------------------------------------------------ broadcasts
def _tag(b: Broadcast, subjects: dict[uuid.UUID, str]) -> str:
    if b.scope == BroadcastScope.school.value:
        return "School"
    return subjects.get(b.subject_id, "General") if b.subject_id else "General"


async def _check_class_broadcast_rights(
    db: AsyncSession, p: Principal, class_id: uuid.UUID, subject_id: uuid.UUID | None
) -> str:
    """Returns the sender's role label, or raises."""
    if is_manager(p):
        return "Admin" if p.is_admin else "Staff"
    mine = [a for a in p.assignments if a.class_id == class_id]
    if not mine:
        raise Forbidden("You are not assigned to this class.", code="not_assigned")
    if any(a.role == ClassRole.class_teacher.value for a in mine):
        return CLASS_TEACHER_TAG
    if subject_id is None or not any(a.subject_id == subject_id for a in mine):
        raise Forbidden("A subject teacher can broadcast only for their own subject.", code="subject_not_yours")
    return "Teacher"


async def create_broadcast(db: AsyncSession, p: Principal, actor: Actor, body: BroadcastIn) -> Broadcast:
    year_ids = await _current_year_ids(db)
    targets: list[uuid.UUID] = []
    grade = None
    class_id = None
    subject_id = body.subject_id
    if body.scope == BroadcastScope.school.value:
        if not is_manager(p):
            raise Forbidden(
                "Only the admin or academic managers can write to the whole school.",
                code="missing_permission",
                details={"needs": Permission.academic.value},
            )
        subject_id = None
        audience = body.audience
        role = "Admin" if p.is_admin else "Staff"
        if audience == BroadcastAudience.grade.value:
            grade = (body.grade or "").strip()
            targets = list(
                (
                    await db.scalars(
                        select(SchoolClass.id).where(
                            SchoolClass.grade == grade, SchoolClass.academic_year_id.in_(year_ids)
                        )
                    )
                ).all()
            )
            if not grade or not targets:
                raise AppError("No class of that grade this year.", code="invalid_audience", status=422)
        elif audience == BroadcastAudience.classes.value:
            targets = list(dict.fromkeys(body.class_ids))
            found = (
                await db.scalars(
                    select(SchoolClass.id).where(
                        SchoolClass.id.in_(targets), SchoolClass.academic_year_id.in_(year_ids)
                    )
                )
            ).all()
            if not targets or len(found) != len(targets):
                raise AppError("Choose classes of the current year.", code="invalid_audience", status=422)
    else:
        if body.class_id is None:
            raise AppError("Choose the class.", code="invalid_audience", status=422)
        cls = await db.scalar(select(SchoolClass).where(SchoolClass.id == body.class_id))
        if cls is None:
            raise NotFound("Class not found.")
        if cls.academic_year_id not in year_ids:
            raise AppError("This class is not in the current year.", code="invalid_audience", status=422)
        class_id = cls.id
        audience = BroadcastAudience.classes.value
        targets = [cls.id]
        role = await _check_class_broadcast_rights(db, p, cls.id, subject_id)
        if subject_id and await db.get(Subject, subject_id) is None:
            raise NotFound("Subject not found.")

    recipients = await recipient_user_ids(db, targets if audience != BroadcastAudience.all.value else None)
    b = Broadcast(
        school_id=p.school_id,
        scope=body.scope,
        audience=audience,
        grade=grade,
        class_id=class_id,
        subject_id=subject_id,
        title=body.title.strip(),
        body=body.body.strip(),
        sender_id=p.user_id,
        sender_name=p.name,
        sender_role=role,
        recipient_count=len(recipients),
    )
    db.add(b)
    await db.flush()
    for cid in targets if audience != BroadcastAudience.all.value else []:
        db.add(BroadcastClass(school_id=p.school_id, broadcast_id=b.id, class_id=cid))
    await db.flush()
    await _link_files(db, p.user_id, p.school_id, body.attachment_ids, broadcast_id=b.id)
    log_audit(
        db,
        actor,
        AuditCategory.messages,
        "broadcast.sent",
        f"Broadcast '{b.title}' to {b.recipient_count} parent login(s)",
        entity_type="broadcast",
        entity_id=b.id,
        entity_label=b.title,
    )
    subjects = {}
    if b.subject_id:
        subjects[b.subject_id] = (await db.get(Subject, b.subject_id)).name
    await _notify_broadcast(db, b, recipients, _tag(b, subjects))
    return b


async def _notify_broadcast(db: AsyncSession, b: Broadcast, recipients: list[uuid.UUID], tag: str) -> None:
    await notify(
        db,
        user_ids=recipients,
        kind="broadcast",
        title=f"{tag}: {b.title}",
        body=_preview(b.body, 200),
        data={"broadcast_id": b.id, "scope": b.scope, "tag": tag},
        school_id=b.school_id,
    )


async def _feed_outs(
    db: AsyncSession, rows: list[Broadcast], read: dict[uuid.UUID, bool], *, staff: bool
) -> list[FeedItemOut] | list[BroadcastOut]:
    if not rows:
        return []
    ids = [b.id for b in rows]
    subj_ids = {b.subject_id for b in rows if b.subject_id}
    subjects = (
        {s.id: s.name for s in (await db.scalars(select(Subject).where(Subject.id.in_(subj_ids)))).all()}
        if subj_ids
        else {}
    )
    targets = (
        await db.execute(
            select(BroadcastClass.broadcast_id, BroadcastClass.class_id).where(BroadcastClass.broadcast_id.in_(ids))
        )
    ).all()
    class_ids = {c for _, c in targets} | {b.class_id for b in rows if b.class_id}
    classes = (
        {
            c.id: class_label(c)
            for c in (await db.scalars(select(SchoolClass).where(SchoolClass.id.in_(class_ids)))).all()
        }
        if class_ids
        else {}
    )
    files = await _attachment_map(db, broadcast_ids=ids)
    read_counts: dict[uuid.UUID, int] = {}
    if staff:
        read_counts = dict(
            (
                await db.execute(
                    select(BroadcastRead.broadcast_id, func.count())
                    .where(BroadcastRead.broadcast_id.in_(ids))
                    .group_by(BroadcastRead.broadcast_id)
                )
            ).all()
        )
    by_b: dict[uuid.UUID, list[str]] = {}
    for bid, cid in targets:
        by_b.setdefault(bid, []).append(classes[cid])
    out = []
    for b in rows:
        base = dict(
            id=b.id,
            scope=b.scope,
            tag=_tag(b, subjects),
            class_label=classes.get(b.class_id) if b.class_id else None,
            title=b.title,
            body=b.body,
            sender_name=b.sender_name,
            sender_role=b.sender_role,
            created_at=b.created_at,
            is_read=read.get(b.id, False),
            attachments=files.get(b.id, []),
        )
        if staff:
            out.append(
                BroadcastOut(
                    **base,
                    audience=b.audience,
                    grade=b.grade,
                    class_id=b.class_id,
                    subject_id=b.subject_id,
                    class_labels=sorted(by_b.get(b.id, [])),
                    recipient_count=b.recipient_count,
                    read_count=read_counts.get(b.id, 0),
                )
            )
        else:
            out.append(FeedItemOut(**base))
    return out


# --- staff side
def _staff_visible(p: Principal):
    """Managers see every broadcast; others their own plus school-wide ones."""
    if is_manager(p):
        return True
    return or_(Broadcast.sender_id == p.user_id, Broadcast.scope == BroadcastScope.school.value)


async def list_broadcasts_staff(
    db: AsyncSession, p: Principal, *, scope: str | None, mine: bool, limit: int, offset: int
) -> tuple[list[BroadcastOut], int]:
    q = select(Broadcast).where(_staff_visible(p))
    if scope:
        q = q.where(Broadcast.scope == scope)
    if mine:
        q = q.where(Broadcast.sender_id == p.user_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = list(
        (
            await db.scalars(q.order_by(Broadcast.created_at.desc(), Broadcast.id.desc()).limit(limit).offset(offset))
        ).all()
    )
    return await _feed_outs(db, rows, {}, staff=True), total


async def get_broadcast_staff(db: AsyncSession, p: Principal, broadcast_id: uuid.UUID) -> BroadcastOut:
    b = await db.scalar(select(Broadcast).where(Broadcast.id == broadcast_id, _staff_visible(p)))
    if b is None:
        raise NotFound("Broadcast not found.")
    return (await _feed_outs(db, [b], {}, staff=True))[0]


# --- parent side
async def _parent_visible(db: AsyncSession, user_id: uuid.UUID, student_id: uuid.UUID | None):
    kids = await parent_active_children(db, user_id, student_id)
    if not kids:
        return false()
    class_ids = [c for _, c in kids if c]
    conds = [Broadcast.audience == BroadcastAudience.all.value]
    if class_ids:
        conds.append(
            exists().where(BroadcastClass.broadcast_id == Broadcast.id, BroadcastClass.class_id.in_(class_ids))
        )
    return or_(*conds)


def _is_read(user_id: uuid.UUID):
    return exists().where(BroadcastRead.broadcast_id == Broadcast.id, BroadcastRead.user_id == user_id)


async def parent_feed(
    db: AsyncSession, user_id: uuid.UUID, *, student_id: uuid.UUID | None, unread_only: bool, limit: int, offset: int
) -> tuple[list[FeedItemOut], int]:
    if student_id:
        await assert_parent_child(db, user_id, student_id)
    vis = await _parent_visible(db, user_id, student_id)
    q = select(Broadcast).where(vis)
    if unread_only:
        q = q.where(~_is_read(user_id))
    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = list(
        (
            await db.scalars(q.order_by(Broadcast.created_at.desc(), Broadcast.id.desc()).limit(limit).offset(offset))
        ).all()
    )
    ids = [b.id for b in rows]
    read = (
        set(
            (
                await db.scalars(
                    select(BroadcastRead.broadcast_id).where(
                        BroadcastRead.user_id == user_id, BroadcastRead.broadcast_id.in_(ids)
                    )
                )
            ).all()
        )
        if ids
        else set()
    )
    return await _feed_outs(db, rows, {i: True for i in read}, staff=False), total


async def _visible_broadcast_or_404(db: AsyncSession, user_id: uuid.UUID, broadcast_id: uuid.UUID) -> Broadcast:
    vis = await _parent_visible(db, user_id, None)
    b = await db.scalar(select(Broadcast).where(Broadcast.id == broadcast_id, vis))
    if b is None:
        raise NotFound("Update not found.")
    return b


async def parent_feed_item(db: AsyncSession, user_id: uuid.UUID, broadcast_id: uuid.UUID) -> FeedItemOut:
    b = await _visible_broadcast_or_404(db, user_id, broadcast_id)
    is_read = await db.scalar(select(_is_read(user_id)).where(Broadcast.id == b.id))
    return (await _feed_outs(db, [b], {b.id: bool(is_read)}, staff=False))[0]


async def mark_broadcast_read(
    db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID, broadcast_id: uuid.UUID
) -> None:
    b = await _visible_broadcast_or_404(db, user_id, broadcast_id)
    await db.execute(
        pg_insert(BroadcastRead)
        .values(school_id=school_id, broadcast_id=b.id, user_id=user_id, read_at=_now())
        .on_conflict_do_nothing()
    )


async def mark_all_broadcasts_read(db: AsyncSession, school_id: uuid.UUID, user_id: uuid.UUID) -> int:
    vis = await _parent_visible(db, user_id, None)
    ids = (await db.scalars(select(Broadcast.id).where(vis, ~_is_read(user_id)))).all()
    if ids:
        now = _now()
        await db.execute(
            pg_insert(BroadcastRead)
            .values([{"school_id": school_id, "broadcast_id": i, "user_id": user_id, "read_at": now} for i in ids])
            .on_conflict_do_nothing()
        )
    return len(ids)


async def unread_updates(db: AsyncSession, user_id: uuid.UUID) -> int:
    vis = await _parent_visible(db, user_id, None)
    return await db.scalar(select(func.count()).select_from(Broadcast).where(vis, ~_is_read(user_id))) or 0


# ------------------------------------------------------------------ threads
async def _unread_by_thread(db: AsyncSession, me: uuid.UUID, thread_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not thread_ids:
        return {}
    rows = (
        await db.execute(
            select(Message.thread_id, func.count())
            .select_from(Message)
            .outerjoin(ThreadRead, and_(ThreadRead.thread_id == Message.thread_id, ThreadRead.user_id == me))
            .where(
                Message.thread_id.in_(thread_ids),
                Message.sender_id != me,
                or_(ThreadRead.last_read_at.is_(None), Message.created_at > ThreadRead.last_read_at),
            )
            .group_by(Message.thread_id)
        )
    ).all()
    return dict(rows)


async def _thread_outs(db: AsyncSession, me: uuid.UUID, threads: list[MessageThread]) -> list[ThreadOut]:
    if not threads:
        return []
    students = {
        s.id: s
        for s in (await db.scalars(select(Student).where(Student.id.in_({t.student_id for t in threads})))).all()
    }
    users = {
        u.id: u.name for u in (await db.scalars(select(User).where(User.id.in_({t.staff_id for t in threads})))).all()
    }
    subj_ids = {t.subject_id for t in threads if t.subject_id}
    subjects = (
        {s.id: s.name for s in (await db.scalars(select(Subject).where(Subject.id.in_(subj_ids)))).all()}
        if subj_ids
        else {}
    )
    enr = (
        await db.execute(
            select(Enrollment.student_id, SchoolClass)
            .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
            .where(
                Enrollment.student_id.in_(list(students)),
                Enrollment.status == EnrollmentStatus.active.value,
                Enrollment.academic_year_id.in_(select(AcademicYear.id).where(AcademicYear.status == "current")),
            )
        )
    ).all()
    class_of = {sid: c for sid, c in enr}
    assigned: set[tuple[uuid.UUID, uuid.UUID, uuid.UUID | None]] = set()
    if class_of:
        for cs in (
            await db.scalars(select(ClassStaff).where(ClassStaff.class_id.in_({c.id for c in class_of.values()})))
        ).all():
            assigned.add(
                (cs.class_id, cs.staff_id, cs.subject_id if cs.role == ClassRole.subject_teacher.value else None)
            )
    unread = await _unread_by_thread(db, me, [t.id for t in threads])
    out = []
    for t in threads:
        s = students[t.student_id]
        cls = class_of.get(s.id) if s.status == StudentStatus.active.value else None
        teacher = users.get(t.staff_id, "Teacher")
        tag = subjects.get(t.subject_id, "Subject") if t.subject_id else CLASS_TEACHER_TAG
        active = cls is not None and (cls.id, t.staff_id, t.subject_id) in assigned
        notice = notice_hi = None
        if not active:
            if s.status != StudentStatus.active.value:
                notice = f"{full_name(s)} has left the school, so this conversation is read-only."
                notice_hi = f"{full_name(s)} ने स्कूल छोड़ दिया है, इसलिए यह बातचीत केवल पढ़ने के लिए है।"
            elif t.subject_id:
                notice = f"{teacher} no longer teaches {tag} to {full_name(s)}."
                notice_hi = f"{teacher} अब {full_name(s)} को {tag} नहीं पढ़ाते।"
            else:
                notice = f"{teacher} is no longer the class teacher of {full_name(s)}."
                notice_hi = f"{teacher} अब {full_name(s)} के कक्षा अध्यापक नहीं हैं।"
        out.append(
            ThreadOut(
                id=t.id,
                student_id=s.id,
                student_name=full_name(s),
                class_label=class_label(cls) if cls else None,
                teacher_id=t.staff_id,
                teacher_name=teacher,
                subject_id=t.subject_id,
                tag=tag,
                active=active,
                inactive_notice=notice,
                inactive_notice_hi=notice_hi,
                last_message_at=t.last_message_at,
                last_message_preview=t.last_message_preview,
                unread=unread.get(t.id, 0),
            )
        )
    return out


async def thread_out(db: AsyncSession, me: uuid.UUID, t: MessageThread) -> ThreadOut:
    return (await _thread_outs(db, me, [t]))[0]


def _recent_first():
    return [MessageThread.last_message_at.desc().nulls_last(), MessageThread.created_at.desc()]


async def list_threads_staff(
    db: AsyncSession, p: Principal, *, student_id: uuid.UUID | None, active: bool | None, limit: int, offset: int
) -> tuple[list[ThreadOut], int]:
    q = select(MessageThread).where(MessageThread.staff_id == p.user_id)
    if student_id:
        q = q.where(MessageThread.student_id == student_id)
    return await _page_threads(db, p.user_id, q, active, limit, offset)


async def list_threads_parent(
    db: AsyncSession, user_id: uuid.UUID, *, student_id: uuid.UUID | None, active: bool | None, limit: int, offset: int
) -> tuple[list[ThreadOut], int]:
    if student_id:
        await assert_parent_child(db, user_id, student_id)
    kids = (
        select(StudentGuardian.student_id)
        .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
        .where(Guardian.user_id == user_id)
    )
    q = select(MessageThread).where(MessageThread.student_id.in_(kids))
    if student_id:
        q = q.where(MessageThread.student_id == student_id)
    return await _page_threads(db, user_id, q, active, limit, offset)


async def _page_threads(db, me, q, active, limit, offset) -> tuple[list[ThreadOut], int]:
    q = q.order_by(*_recent_first(), MessageThread.id)
    if active is None:
        total = await db.scalar(select(func.count()).select_from(q.order_by(None).subquery())) or 0
        rows = list((await db.scalars(q.limit(limit).offset(offset))).all())
        return await _thread_outs(db, me, rows), total
    # Active state is derived from class_staff, so filter after deriving it.
    outs = [o for o in await _thread_outs(db, me, list((await db.scalars(q)).all())) if o.active == active]
    return outs[offset : offset + limit], len(outs)


async def _get_or_create_thread(
    db: AsyncSession, student: Student, staff_id: uuid.UUID, subject_id: uuid.UUID | None
) -> MessageThread:
    cond = [MessageThread.student_id == student.id, MessageThread.staff_id == staff_id]
    cond.append(MessageThread.subject_id.is_(None) if subject_id is None else MessageThread.subject_id == subject_id)
    t = await db.scalar(select(MessageThread).where(*cond))
    if t:
        return t
    try:
        async with db.begin_nested():
            t = MessageThread(
                school_id=student.school_id, student_id=student.id, staff_id=staff_id, subject_id=subject_id
            )
            db.add(t)
            await db.flush()
    except IntegrityError:  # opened at the same moment by the other side
        t = await db.scalar(select(MessageThread).where(*cond))
        if t is None:
            raise
    return t


async def _assert_teaches(
    db: AsyncSession, student: Student, staff_id: uuid.UUID, subject_id: uuid.UUID | None, *, who: str
) -> None:
    if student.status != StudentStatus.active.value:
        raise AppError(
            f"{full_name(student)} has left the school, so there is nobody to message.",
            code="child_read_only",
            status=403,
        )
    cls = await _class_of(db, student)
    if cls is None or not await teacher_matches(db, cls.id, staff_id, subject_id):
        raise Forbidden(
            "You are not assigned to this child's class."
            if who == "staff"
            else "This teacher does not teach your child.",
            code="not_assigned",
        )


async def open_thread_staff(
    db: AsyncSession, p: Principal, student_id: uuid.UUID, subject_id: uuid.UUID | None
) -> MessageThread:
    """A teacher starts (or reopens) a thread about a child they teach. Admin has no thread: only assigned teachers."""
    student = await get_student_or_404(db, student_id)
    await _assert_teaches(db, student, p.user_id, subject_id, who="staff")
    return await _get_or_create_thread(db, student, p.user_id, subject_id)


async def open_thread_parent(
    db: AsyncSession, p: Principal, student_id: uuid.UUID, staff_id: uuid.UUID, subject_id: uuid.UUID | None
) -> MessageThread:
    student = await assert_parent_child(db, p.user_id, student_id, writable=True)
    await _assert_teaches(db, student, staff_id, subject_id, who="parent")
    return await _get_or_create_thread(db, student, staff_id, subject_id)


async def teachers_of_child(db: AsyncSession, student: Student) -> list[TeacherOut]:
    """The teachers a parent can write to now, with the existing thread if any. Empty for a child who has left."""
    cls = await _class_of(db, student)
    if cls is None:
        return []
    rows = (
        await db.execute(
            select(ClassStaff, User.name, Subject.name)
            .join(User, User.id == ClassStaff.staff_id)
            .outerjoin(Subject, Subject.id == ClassStaff.subject_id)
            .where(ClassStaff.class_id == cls.id)
        )
    ).all()
    threads = {
        (t.staff_id, t.subject_id): t.id
        for t in (await db.scalars(select(MessageThread).where(MessageThread.student_id == student.id))).all()
    }
    out = []
    for cs, name, subject in rows:
        sid = cs.subject_id if cs.role == ClassRole.subject_teacher.value else None
        out.append(
            TeacherOut(
                staff_id=cs.staff_id,
                name=name,
                subject_id=sid,
                tag=subject if sid else CLASS_TEACHER_TAG,
                thread_id=threads.get((cs.staff_id, sid)),
            )
        )
    out.sort(key=lambda x: (x.subject_id is not None, x.tag, x.name))
    return out


async def thread_for_staff(db: AsyncSession, p: Principal, thread_id: uuid.UUID) -> MessageThread:
    t = await db.scalar(select(MessageThread).where(MessageThread.id == thread_id, MessageThread.staff_id == p.user_id))
    if t is None:
        raise NotFound("Conversation not found.")
    return t


async def thread_for_parent(db: AsyncSession, p: Principal, thread_id: uuid.UUID) -> MessageThread:
    t = await db.get(MessageThread, thread_id)
    if t is None:
        raise NotFound("Conversation not found.")
    await assert_parent_child(db, p.user_id, t.student_id)  # 404 for another family's child
    return t


# ------------------------------------------------------------------ messages
async def mark_thread_read(db: AsyncSession, t: MessageThread, user_id: uuid.UUID) -> None:
    await db.execute(
        pg_insert(ThreadRead)
        .values(school_id=t.school_id, thread_id=t.id, user_id=user_id, last_read_at=_now())
        .on_conflict_do_update(index_elements=["thread_id", "user_id"], set_={"last_read_at": _now()})
    )


async def list_messages(
    db: AsyncSession, t: MessageThread, me: uuid.UUID, *, limit: int, offset: int
) -> tuple[list[MessageOut], int]:
    """Newest first (page 1 is the latest); the app reverses for display."""
    total = await db.scalar(select(func.count()).select_from(Message).where(Message.thread_id == t.id)) or 0
    msgs = list(
        (
            await db.scalars(
                select(Message)
                .where(Message.thread_id == t.id)
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
    )
    names = (
        {u.id: u.name for u in (await db.scalars(select(User).where(User.id.in_({m.sender_id for m in msgs})))).all()}
        if msgs
        else {}
    )
    files = await _attachment_map(db, message_ids=[m.id for m in msgs])
    reads = (await db.scalars(select(ThreadRead).where(ThreadRead.thread_id == t.id))).all()
    teacher_read = next((r.last_read_at for r in reads if r.user_id == t.staff_id), None)
    parents_read = max((r.last_read_at for r in reads if r.user_id != t.staff_id), default=None)
    out = []
    for m in msgs:
        from_teacher = m.sender_id == t.staff_id
        other = parents_read if from_teacher else teacher_read
        out.append(
            MessageOut(
                id=m.id,
                sender_id=m.sender_id,
                sender_name=names.get(m.sender_id, ""),
                sender_kind="teacher" if from_teacher else "parent",
                mine=m.sender_id == me,
                body=m.body,
                created_at=m.created_at,
                seen=m.sender_id == me and other is not None and other >= m.created_at,
                attachments=files.get(m.id, []),
            )
        )
    return out, total


async def send_message(
    db: AsyncSession, p: Principal, t: MessageThread, body: str, attachment_ids: list[uuid.UUID]
) -> MessageOut:
    """The caller already proved they belong to the thread (thread_for_staff / thread_for_parent)."""
    from_teacher = p.user_id == t.staff_id
    if not from_teacher:
        student = await assert_parent_child(db, p.user_id, t.student_id, writable=True)  # left child: 403
    else:
        student = await get_student_or_404(db, t.student_id)
    info = await thread_out(db, p.user_id, t)
    if not info.active:
        raise AppError(info.inactive_notice or "This conversation is closed.", code="thread_inactive", status=403)
    text = body.strip()
    if not text:
        raise AppError("Write a message first.", code="empty_message", status=422)
    m = Message(school_id=t.school_id, thread_id=t.id, sender_id=p.user_id, body=text, created_at=_now())
    db.add(m)
    await db.flush()
    await _link_files(db, p.user_id, t.school_id, attachment_ids, message_id=m.id)
    t.last_message_at, t.last_message_preview, t.last_sender_id = m.created_at, _preview(text, 160), p.user_id
    await mark_thread_read(db, t, p.user_id)
    await _notify_message(db, t, p, student, text)
    return MessageOut(
        id=m.id,
        sender_id=p.user_id,
        sender_name=p.name,
        sender_kind="teacher" if from_teacher else "parent",
        mine=True,
        body=text,
        created_at=m.created_at,
        seen=False,
        attachments=(await _attachment_map(db, message_ids=[m.id])).get(m.id, []),
    )


async def _notify_message(db: AsyncSession, t: MessageThread, sender: Principal, student: Student, text: str) -> None:
    data = {"thread_id": t.id, "student_id": student.id}
    if sender.user_id == t.staff_id:
        await notify_guardians_of_student(
            db,
            student.id,
            kind="message",
            **render("message", sender=sender.name, text=_preview(text, 200)).kw(),
            data=data,
        )
    else:
        await notify(
            db,
            user_ids=[t.staff_id],
            kind="message",
            title=f"{sender.name} about {full_name(student)}",
            body=_preview(text, 200),
            data=data,
            school_id=t.school_id,
            student_id=student.id,
        )


async def unread_messages_staff(db: AsyncSession, p: Principal) -> int:
    ids = list((await db.scalars(select(MessageThread.id).where(MessageThread.staff_id == p.user_id))).all())
    return sum((await _unread_by_thread(db, p.user_id, ids)).values())


async def unread_messages_parent(db: AsyncSession, user_id: uuid.UUID) -> int:
    kids = (
        select(StudentGuardian.student_id)
        .join(Guardian, Guardian.id == StudentGuardian.guardian_id)
        .where(Guardian.user_id == user_id)
    )
    ids = list((await db.scalars(select(MessageThread.id).where(MessageThread.student_id.in_(kids)))).all())
    return sum((await _unread_by_thread(db, user_id, ids)).values())


async def parent_summary(db: AsyncSession, user_id: uuid.UUID) -> UnreadSummary:
    return UnreadSummary(updates=await unread_updates(db, user_id), messages=await unread_messages_parent(db, user_id))


# ------------------------------------------------------------------ file download
async def file_download(db: AsyncSession, p: Principal, attachment_id: uuid.UUID) -> tuple[str, int]:
    """A short-lived link to an attachment, only if the caller may see the broadcast or message it belongs to."""
    link = await db.scalar(select(MessageFile).where(MessageFile.attachment_id == attachment_id))
    a = await db.get(Attachment, attachment_id)
    if link is None or a is None:
        raise NotFound("File not found.")
    allowed = False
    if link.broadcast_id:
        b = await db.get(Broadcast, link.broadcast_id)
        if p.is_staff:
            allowed = b is not None and (
                is_manager(p)
                or b.sender_id == p.user_id
                or b.scope == BroadcastScope.school.value
                or (b.class_id is not None and p.is_assigned_to(b.class_id))
            )
        else:
            allowed = (
                b is not None
                and (
                    await db.scalar(
                        select(Broadcast.id).where(Broadcast.id == b.id, await _parent_visible(db, p.user_id, None))
                    )
                )
                is not None
            )
    else:
        msg = await db.get(Message, link.message_id)
        t = await db.get(MessageThread, msg.thread_id) if msg else None
        if t is not None:
            if p.is_staff:
                allowed = t.staff_id == p.user_id
            else:
                try:
                    await assert_parent_child(db, p.user_id, t.student_id)
                    allowed = True
                except NotFound:
                    allowed = False
    if not allowed:
        raise NotFound("File not found.")
    ttl = settings.download_url_ttl_seconds
    return await get_storage().download_url(a.storage_key, a.filename, ttl), ttl
