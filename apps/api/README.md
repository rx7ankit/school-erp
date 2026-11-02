# Scool API

FastAPI (async), SQLAlchemy 2, Alembic, PostgreSQL, Redis. Built from `docs/erd.md`.

```bash
cp ../../.env.example .env                 # then edit
docker compose -f ../../infra/docker-compose.yml up -d    # Postgres 18 + Redis
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py             # http://localhost:8000/docs
uv run pytest                              # needs Postgres and Redis running
uv run ruff check app tests
```

Tests use a **real Postgres and a real Redis** (`TEST_DATABASE_URL`, `TEST_REDIS_URL`, default `scool_test` and Redis db 15). The test run recreates the schema and applies the migrations, so the migrations are tested too.

## How it is built

| Layer | Where | Rule |
|---|---|---|
| Routes | `app/api/v1/*.py` | Thin. Check permission, call a service or do a small query, return a schema. |
| Services | `app/services/*.py` | Business rules. Take a session and an `Actor`. Always write the audit entry in the same transaction. |
| Models | `app/models/*.py` | SQLAlchemy. School tables use `TenantMixin` (adds `school_id`). |
| Schemas | `app/schemas/*.py` | Pydantic request and response shapes. Never return a model directly. |
| Core | `app/core/*.py` | Config, security, errors, ids, the IST clock. |

### The rules that keep it safe
- **One school never sees another's data.** Every school table has `school_id`. The API filters by it, and Postgres **row level security** enforces it as a second lock: the school is set at the start of every transaction (`app/db/session.py`). `bypass` is only for login, the platform owner and background jobs. Tests in `tests/test_tenancy.py` prove it straight against the database.
- **Time**: moments are UTC (`timestamptz`), calendar dates are plain IST dates (`date`), money is integer paise. Dates in filters mean the IST school day.
- **Passwords**: Argon2. A temporary password is created at the moment a login email is sent and never stored readable. Refresh tokens rotate, and replaying an old one ends the whole chain.
- **Permissions**: loaded fresh on every request, so a change applies immediately. Admins pass every permission check. Class teacher rights come from `class_staff`, not from a permission.
- **Audit**: `log_audit()` inside the same transaction as the change. The `audit_logs` table is append-only (a trigger rejects update and delete). Only the admin can read it.
- **Errors** always look like `{"error": {"code", "message", "details"}}`.

### Adding a module (the pattern)
1. Add models (use `TenantMixin` for school data). Run `uv run alembic revision --autogenerate -m "..."`, then **add the new tenant tables to the RLS list** in the migration (copy the block in `0001_foundation.py`).
2. Add schemas, a service for the rules, and a router in `app/api/v1/`; register it in `router.py`.
3. Guard routes with `require_permission(...)`, `require_staff`, `require_admin` or `require_owner`. For class-scoped actions use `principal.is_class_teacher_of(class_id)` or `is_assigned_to(class_id)`.
4. Write `log_audit(...)` for anything that changes money, attendance, results, access or student status.
5. Tests: a happy path, the permission failure, and a cross-school check.

## What exists now
Auth (login, refresh, logout, change and reset password, lockout), platform owner (schools, billing stats), staff (add, bulk, permissions, login emails), academic setup (years, classes and custom classes, subjects, class and subject teachers), audit log (search and filters), students, guardians, parent logins, admissions, Excel import and export.

## Next, from the ERD
Attendance (half days), leave, results and report cards, fees (setup, invoices, instalments, receipts), messaging and broadcasts, notifications and push, timetable and substitutes, certificates, year-end rollover, platform invoices.

## Email (Resend) and files (Cloudflare R2)

**Email.** `EMAIL_BACKEND=resend` with `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified in Resend).
`console` just logs the mail in development. The temporary password in a login email is never stored or logged on failure.

**Files.** `STORAGE_BACKEND=r2` with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
Keep the bucket private. Apps never send files through the API:

1. `POST /files/upload-url` with purpose, filename, type and size. The API checks the allowed types and size, and returns a short-lived link.
2. The app `PUT`s the file straight to that link.
3. `POST /files/{id}/complete` confirms the file is there and matches. Only then can it be opened.
4. `GET /files/{id}/url` returns a short-lived download link (the uploader or an admin).

Keys look like `schools/{school_id}/{purpose}/{file_id}/{name}`. Add a new kind of file by adding a purpose in `services/storage.py`.
For the browser to upload, set a CORS rule on the bucket allowing `PUT` from the web app origin.

## Students module

Students, guardians, parent logins, admissions, import and export. Code: `app/services/{students,guardians,enrolment,admissions,parent_logins,student_import,student_views,sheets}.py`, routes `app/api/v1/{students,admissions,parents,parent_app}.py`, schemas `app/schemas/students.py`, migration `0003_students_admissions`.

### Who may do what
- **Write** (enrol, edit, leave, rejoin, transfer, photo, guardians, import, admissions, parent logins): `academic.manage` (admin passes), as the ERD says.
- **Read** students: admin, `academic.manage` and `fees.manage` see every student. Any other staff member sees only students of classes they are assigned to (class or subject teacher), found through `class_staff`. A student outside that gets **404**, not 403. Helper: `can_read_all_students(p)`, `visible_class_ids(p)`, `assert_can_view_student(db, p, student)`.
- **Parents** use `/parent/*` only. They get 403 on every staff route.

### Endpoints
| | |
|---|---|
| `GET /students` | `q` (name, scholar no, guardian name or mobile), `class_id`, `grade`, `status` (default `active`, or `left`, `tc_issued`, `passed_out`, `all`), `year_id` (default current), `limit`, `offset` |
| `POST /students` | direct enrolment (student + guardians + enrollment + `admitted` event, optional parent login) |
| `GET/PATCH /students/{id}` | detail with current enrollment, all enrollments, guardians (with login status) and history |
| `GET /students/{id}/history` | the timeline (`student_events`) |
| `POST /students/{id}/leave`, `/rejoin`, `/transfer` | lifecycle; `transfer` moves to another class of the same year |
| `PUT/DELETE /students/{id}/photo` | `{file_id}` of a confirmed `student_photo` upload |
| `POST/PATCH/DELETE /students/{id}/guardians[/{guardian_id}]` | guardian links (relation, primary, emergency) |
| `GET /students/export` | Excel, filtered like the list, audited under `exports` |
| `GET /students/import/template`, `POST /students/import`, `GET /students/import/{job}`, `POST /students/import/{job}/commit` | upload = dry run (every row's errors, nothing written), then commit (all or nothing, or `skip_errors`) |
| `GET /parents`, `GET /parents/export` | guardians with login status (`none`, `pending`, `sent`, `failed`, `active`), filter `login=` and `q=` |
| `POST /parents/{guardian_id}/send-login`, `POST /parents/send-login`, `POST /parents/create-logins` | one click / bulk (no ids = everyone still waiting) |
| `POST /parents/list-import` (JSON), `POST /parents/list-import/file` | `scholar no, name, email, mobile` rows grouped by email; `dry_run` defaults to true |
| `PATCH /parents/{guardian_id}` | edit a guardian |
| `GET/POST /admissions`, `GET/PATCH /admissions/{id}`, `POST /admissions/{id}/status`, `POST /admissions/{id}/enrol`, `GET /admissions/export` | enquiry, applied, approved, rejected; `enrol` needs `approved` |
| `GET /parent/children`, `GET /parent/children/{student_id}` | the child switcher and a child's profile (parent token) |
| `GET /auth/me` | for a parent also returns `children` |

### Rules worth knowing
- **One transaction.** Enrolment (direct, from an admission, or each import row) is one database transaction. The login email is sent last. If anything fails nothing is saved, not even the scholar number.
- **Scholar number** is the highest all-digit number + 1 (keeps its zero padding), serialised per school. Give your own to override.
- **Guardians are per email.** The same email (case-insensitive) in a school is one guardian and one parent login, linked to every child (`uq_guardians_school_email`). New guardians need a name and a mobile. An email that already belongs to staff, the owner or another school is refused (`email_taken`).
- **Parent login** = `users` row `kind=parent`, `must_change_password=true`, `credential_invites`. Sending creates a fresh temporary password, never stored. At enrolment only parents who have never signed in are sent one, so a sibling's enrolment never resets a working password.
- **Left students**: enrollment closed, status `left`, history kept. The parent still sees the child with `read_only: true`. Rejoin reuses that year's enrollment row (unique per student and year).
- **Class capacity** is checked (class row locked) on enrol, import, rejoin and transfer.
- **Import** columns: Scholar No, First Name, Last Name, Class (`8-A`), Roll No, Date of Birth, Gender, Admission Date, Category, Blood Group, Samagra ID, PEN, Address, Previous School, Medical Notes, Emergency Contact/Phone, Guardian Name/Relation/Mobile/Email and the same for Guardian 2. Required: First Name, Class, Guardian Name, Guardian Mobile. `.xlsx` or `.csv`, 5 MB and 2000 rows at most. `create_logins=true` on upload also creates parent logins at commit. Commit re-checks every row.
- Exports neutralise text that starts with `=`, `+`, `-` or `@`.

### Helpers for other modules
```python
from app.services.students import (
    get_student_or_404, class_of_student, current_enrollment, current_year_or_none, full_name, class_label,
    can_read_all_students, visible_class_ids, assert_can_view_student,
    add_student_event, mark_left, mark_tc_issued, mark_passed_out, ensure_capacity, next_roll_no,
)
from app.services.guardians import (
    parent_child_ids, assert_parent_child, guardian_user_ids_of_student, guardians_of_student, ensure_parent_login,
)
from app.services.enrolment import enrol_student, register_enrol_hook   # fees: register a hook for fee_options
from app.services.sheets import read_table, build_xlsx, XLSX              # shared Excel read/write
from app.api.deps import require_parent, parent_children, parent_child
```
- `class_of_student(db, id)` returns the class of the active enrollment this year (None if left or passed out); `active_only=False` also returns a closed one.
- `require_parent` (403 for non-parents), `parent_children` (dependency: list of the parent's child ids), `parent_child` (dependency for routes with `{student_id}`: returns the `Student` or 404). For something a parent changes, also call `assert_parent_child(db, user_id, student_id, writable=True)`, which refuses a child who has left (`child_read_only`).
- `guardian_user_ids_of_student` gives the parent logins to notify.
- `mark_tc_issued` (certificates) and `mark_passed_out` (rollover) set the status, close the enrollment and write the event.
- Fees: `register_enrol_hook(async def hook(db, ctx: EnrolContext))` runs inside the enrolment transaction with `ctx.fee_options` (the body's `fee_options`, passed through untouched). Raise to roll the enrolment back.
- `send_login(..., category=AuditCategory.students)` now takes the audit category.
