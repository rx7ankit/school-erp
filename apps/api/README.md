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

## Timetable, substitutes, certificates and student documents

Code: `app/services/{timetable,certificates}.py`, routes `app/api/v1/{timetable,certificates}.py`, models `app/models/{timetable,certificate}.py`, migration `0008_timetable_certificates`.

### Timetable and substitutes
| | |
|---|---|
| `GET/POST /timetable/periods`, `PATCH/DELETE /timetable/periods/{id}` | the school's bell periods (number 1-20, IST clock times, no overlap). Write: `academic.manage`. A period used by a slot cannot be deleted |
| `GET /timetable/classes/{class_id}` | periods + all slots of a class (any staff) |
| `POST /timetable/slots`, `PATCH/DELETE /timetable/slots/{id}` | `academic.manage`. Weekday 1 Mon to 6 Sat. `409 class_busy` (class already has a lesson then) or `409 teacher_busy` (teacher in another class then). Also guarded by unique indexes, so concurrent saves cannot double-book. PATCH changes subject/teacher only, and cancels cover already arranged for the old teacher |
| `GET /timetable/me`, `GET /timetable/me/day?on=` | my week; **My day** = own lessons (`teaching`, or `covered` with the substitute's name) plus lessons I cover (`covering`) |
| `GET /timetable/staff/{id}` | a teacher's week: self, or `academic.manage` / `staff.manage` |
| `POST/GET /timetable/absences`, `DELETE /timetable/absences/{id}` | `staff.manage`. Mark a teacher absent for a date; deleting cancels that day's cover |
| `GET /timetable/cover?on=` | slots of absent teachers that day with their substitute (or none) |
| `GET /timetable/free-teachers?on=&period_id=` | active staff with no lesson, not absent, not already covering in that period |
| `POST /timetable/substitutions`, `DELETE /timetable/substitutions/{id}`, `GET /timetable/substitutions?on=` | assign (or change) the cover for a slot and date. Needs the slot's teacher absent, the date on the slot's weekday and inside its year, a free and present substitute (`substitute_busy`, `substitute_absent`, `not_absent`, `wrong_weekday`) |
| `GET /parent/children/{student_id}/timetable?on=` | class week plus the chosen day's periods with `teacher_name` and `substitute_name` (a left child stays visible) |

### Certificates and documents (permission `academic.manage`, admin passes)
| | |
|---|---|
| `POST /certificates` | `{student_id, kind: transfer\|bonafide\|character, issued_on?, reason?, conduct?, remarks?, purpose?, left_on?}` |
| `GET /certificates`, `GET /certificates/{id}` | filters `student_id`, `kind`, `status`, `q` (number, scholar no, name) |
| `POST /certificates/{id}/cancel`, `POST /certificates/{id}/reissue` | reason required. Reissue cancels the old one and issues a new one with a new number (`replaces_id`) |
| `GET /parent/children/{student_id}/certificates` | issued (not cancelled) certificates of the parent's own child, with the snapshot |
| `GET/POST /students/{id}/documents`, `GET /students/{id}/documents/{doc}/url`, `DELETE ...` | birth certificate, previous TC, ID proof, photo, other. Upload with `/files/upload-url` purpose `student_document`, then attach the confirmed file. Every list/open/add/remove is audited as sensitive |

- **Numbers** are `TC-2026-014`, `BON-...`, `CHR-...`: a counter per school, kind and calendar year of `issued_on`, bumped by one atomic upsert (`certificate_counters`), so concurrent issues never share a number and a cancelled number is never reused. Unique per school.
- **Snapshot** (jsonb) holds everything printed (school, student, class, year, guardian, reason, conduct...). A PDF is rendered from it on demand; it is not built here.
- **Transfer certificate**: for a student who has `left`, or an active one when `left_on` is given. It calls `services.students.mark_tc_issued` (status `tc_issued`, enrollment closed, event, audit). One live TC per student (`already_issued`); cancel it to issue another. Cancelling clears `students.tc_number` but leaves the status `tc_issued` (use rejoin to undo). Bonafide and character are for `active` students only.
- All issue, reissue and cancel actions are audited (category `students`, sensitive).
- Helpers: `services.timetable.{year_for_date, my_day, slots_of_staff_on, free_teachers}`, `services.certificates.{issue_certificate, next_number}`.
- Notification hooks (no-ops for now): `services.timetable._notify_substitute_assigned`, `services.certificates._notify_certificate_issued`.

## Attendance and leave module

Tables: `holidays`, `attendance_days`, `attendance_records`, `staff_attendance`, `leave_requests` (migration `0004`, all with row level security).

| Endpoint | Who |
|---|---|
| `GET /attendance/classes/{id}/sheet?day_on=` | assigned teachers, academic managers, admin. Unsaved students are pre-filled `present`, or `leave` where approved leave covers the day |
| `PUT /attendance/classes/{id}/days/{day_on}` | **class teacher** (admin passes). First save lists every active student; a correction may list only the changed students |
| `GET /attendance/classes/{id}/days`, `/stats`, `/stats/export` | per-day summary, per-student and class statistics (month or period), Excel (audited) |
| `GET /attendance/students/{id}/stats`, `/calendar?month=2026-11` | one student, same visibility as the student record |
| `GET /attendance/analytics`, `/analytics/below`, `/analytics/teachers` | school-wide (admin, academic.manage) or the teacher's own classes; teacher-wise needs admin, academic.manage or staff.manage, others see only their own row |
| `GET/PUT /attendance/staff`, `/attendance/staff/{day_on}` | `staff.manage`: teacher and staff days (present, absent, leave) |
| `GET/POST/PATCH/DELETE /holidays` | read: staff; write: `academic.manage`. Kinds `holiday`, `exam`, `event` |
| `GET /leave`, `GET /leave/{id}`, `POST /leave/{id}/decision`, `GET /leave/{id}/attachment-url` | class teacher of the child's class, or admin. Anyone else gets 404 |
| `GET /parent/children/{id}/attendance/calendar`, `/attendance/stats`, `GET /parent/holidays` | parent, own children only |
| `GET/POST /parent/children/{id}/leave`, `POST /parent/leave/{id}/cancel`, `POST /parent/leave/attachments/upload-url` and `/{file_id}/complete`, `GET /parent/leave/{id}/attachment-url` | parent. Applying, cancelling and uploading need a child who has not left (`child_read_only`) |

Rules worth knowing:
- A half day is worth 0.5; `leave` counts as not present but is reported separately (`present + absent + leave = working days`). Percentage = present / working days. Working days = days the class was marked, minus `holidays.kind = holiday`. Stats are computed, never stored. A student's denominator is the days that have a record for them.
- Holidays cannot be marked (`holiday`); future days and days outside the academic year are refused. A class teacher can correct a day for `ATTENDANCE_EDIT_WINDOW_DAYS` (7) days; the admin and `academic.manage` can edit any day of the year. Every save is audited (`attendance.marked`, then `attendance.edited` with one change line per student and half; no change means no audit line).
- Students who left (enrollment not active) get no new records; old records stay in their statistics.
- Leave: from/to date, optional single-day half (`first` or `second`), reason, optional attachment (purpose `leave_attachment`, parents use `/parent/leave/attachments/*` because `/files` is staff only). Starts at most 7 days ago, at most 60 days, no overlap with a pending or approved application (two different halves of one day are allowed). Parents cancel while pending. Approving pre-selects leave on the sheet, and turns `absent` into `leave` on days already saved (audited as `attendance.leave_applied`).
- No per-subject attendance exists (erd v4): "subject-wise" analytics are results by subject (results module).

Helpers for other modules (`app/services/attendance.py`): `student_stats(db, student_id, from_on, to_on)`, `period_stats_for_enrollment(db, enrollment_id, from_on, to_on)` (report cards), `class_stats`, `holiday_exists`, `resolve_period`; `app/services/leave.py`: `decide`, `apply`.

Notification hooks (do nothing yet, marked `# NOTIFY`): `attendance._notify_attendance_saved` (today only; replace earlier notifications for the day) and `leave._notify_leave_decided`.

## Fees module

Heads, class structure, transport routes and optional fees, concessions, late fees, invoices, instalments, receipts, dues, collection, reminders, opening balances. Staff need `fees.manage` (admin passes); parents read only their own children under `/parent/...`.

| Endpoint | What |
|---|---|
| `GET/POST /fees/heads`, `PATCH /fees/heads/{id}` | fee heads, `scope` = `class` or `optional` |
| `GET/PUT /fees/structures`, `POST /fees/structures/copy`, `DELETE /fees/structures/{id}` | amount and frequency per class and head (a class belongs to one year) |
| `GET/POST/PATCH /fees/routes` | transport route price list |
| `GET/PUT /fees/students/{id}/options`, `DELETE .../options/{id}` | optional fee per student (amount prefilled from the route) |
| `GET/POST/PATCH /fees/concessions`, `GET/POST /fees/students/{id}/concessions`, `DELETE .../concessions/{id}` | percent or fixed, whole invoice or one head |
| `GET/POST /fees/late-rules`, `POST /fees/late-fees/apply`, `POST /fees/invoices/{id}/waive-late-fee` | late fee rule, applying it, waiving it with a reason |
| `GET/PUT /fees/settings` | `auto_first_invoice` at enrolment |
| `POST/GET /fees/invoice-runs` | bulk generation: year, period label, due date, frequencies, optional classes |
| `GET /fees/invoices`, `GET /fees/invoices/{id}`, `GET /fees/students/{id}` | lists and a student's fee view |
| `POST /fees/invoices/{id}/payments`, `GET /fees/payments`, `GET /fees/payments/{id}`, `POST /fees/payments/{id}/cancel` | instalments, receipt JSON, cancel |
| `GET /fees/reports/dues`, `.../dues/export`, `GET /fees/reports/collection`, `.../collection/export` | defaulters and collection (by `day`, `head`, `class`, `mode`), Excel |
| `GET /fees/reminders`, `POST /fees/reminders/send` | who to remind, and send (once per 3 days per child; `email: true` also emails) |
| `GET/PUT /fees/opening-balances`, `POST /fees/opening-balances/import`, `GET .../import/{job}`, `POST .../import/{job}/commit`, `GET .../template` | opening balances, with the same check-then-import step as students |
| `GET /parent/fees`, `GET /parent/children/{id}/fees`, `.../fees/invoices/{invoice}`, `.../fees/receipts`, `.../fees/receipts/{payment}` | parent side |

### Rules worth knowing
- **Money** is integer paise everywhere. An invoice stores only its lines (`fee_invoice_items`, concessions are negative). Total = sum of lines, paid = sum of active payments, status (`unpaid`, `partial`, `paid`, `closed`) are computed in SQL (`services/fees.py: invoice_money`). Percent concessions round down and are worked out on the fee lines only.
- **Generation is idempotent**: unique on student, year and period; a second run (even a concurrent one, serialised by an advisory lock per year) skips existing invoices. `frequencies` picks which heads go into the invoice (`monthly`, `quarterly`, `term`, `yearly`, `once`); `yearly` and `once` heads are billed once per year. Only active students get invoices. Class heads come from the structure, optional heads from `student_fee_options`.
- **Carry forward** (default on): the unpaid balance of the student's open invoices becomes a "Previous dues" line and those invoices become `closed` (no more payments or late fees on them; `fee_carry_forwards` records it). A payment on a closed invoice, or cancelling one, is refused.
- **Opening balance** becomes a "Previous dues" line on the student's first invoice of the year and is then locked. Until then it is counted in dues.
- **Late fee** is a line added by `POST /fees/late-fees/apply` (idempotent, only raises). It must also run daily from a worker: call `app.services.fee_invoices.apply_late_fees(db, actor)` with a system actor. Waiving needs a reason, sets the line to 0 and is audited as sensitive.
- **Receipts and invoices** get school-wide sequential numbers (`RCP-000001`, `INV-000001`) from `fee_counters` with one atomic upsert; a second cashier waits for the first transaction. The payment row is locked, so two payments cannot overpay an invoice. Payments are never deleted: cancel keeps the row (who, when, why) and the receipt number is never reused. Parents see "Cancelled by school" and never the reason. Non-cash modes need a reference.
- **Enrolment hook**: `app.services.fee_invoices._on_enrol` is registered with `register_enrol_hook`. `fee_options` entries are either `{"fee_head_id", "route_id"?, "amount_paise"?, "frequency"?, "note"?}` or `{"concession_id", "note"?}`. A bad entry rolls the enrolment back (`invalid_fee_option`). With `auto_first_invoice` on, a first invoice (period "Admission") is made in the same transaction.
- **Collection by head** splits each payment over the invoice's lines in order (previous dues, heads in creation order, late fee) with integer maths; whole-invoice concessions come off the heads first.
- **Notification hooks** are in `services/fee_notify.py` (`_notify_invoice_issued`, `_notify_payment_received`, `_notify_reminder`) and do nothing yet.

## Results, exam date sheet and feedback module

Exams, grading, marks, report cards, the exam date sheet and feedback on teachers. Code: `app/services/{results,datesheet,feedback}.py`, routes `app/api/v1/{results,datesheet,feedback}.py` (each has a staff `router` and a `parent_router`), schemas `app/schemas/results.py`, models `app/models/results.py`, migration `0006_results_feedback`.

### Who may do what
- **Setup** (grading scheme, exams, papers, date sheet, feedback requests): `academic.manage` (admin passes). Any staff can read exams and grading schemes.
- **Enter marks**: the class teacher of the class (any subject) or the assigned subject teacher (own subject only, and only until the results are published). **Remarks and publish/unpublish**: class teacher only. Admin passes all of these.
- **View a class sheet, student result, report card, export**: `academic.manage` or a teacher assigned to the class (else 403).
- **Parents**: `/parent/children/{id}/results...` and `/date-sheet`. Only published results, only their own child (another family's child is 404). A child who has left stays readable.

### Endpoints
| | |
|---|---|
| `GET/POST /grading-schemes`, `PATCH /grading-schemes/{id}`, `POST /grading-schemes/{id}/activate` | bands = minimum percent to grade; a band at 0 is required; one active scheme; audited as sensitive |
| `GET/POST /exams`, `PATCH/DELETE /exams/{id}` | exams per academic year (default current); delete only while no marks |
| `PUT /exams/{id}/papers` | `{class_ids, papers:[{subject_id, max_marks, pass_marks?}]}` replaces the papers of those classes (pass default 33%, rounded up). A paper with marks cannot be removed or lowered under a mark; a published class is locked |
| `GET /exams/{id}/classes` | per class: papers, students, marks entered, published |
| `GET /exams/{id}/classes/{class_id}/sheet` | the class result sheet and marks grid: marks per paper, total, percentage, grade, pass, rank, remark; `papers[].can_edit` for the caller |
| `PUT .../marks` | `{entries:[{enrollment_id, subject_id, marks_obtained, absent, remarks}]}`; no marks and not absent clears an entry |
| `PUT .../remarks`, `POST .../publish`, `POST .../unpublish`, `GET .../export` | remarks per student, release to parents, hide again, Excel |
| `GET /exams/{id}/students/{student_id}/result`, `/report-card` | per student (staff); the report card is JSON, the client prints it |
| `GET /parent/children/{id}/results`, `/results/{exam_id}`, `/results/{exam_id}/report-card` | published only |
| `GET/POST /exam-schedules`, `GET/DELETE /exam-schedules/{id}`, `PUT .../papers`, `POST .../publish`, `.../unpublish` | date sheet: class, subject, IST date and start time. Drafts are visible to managers only |
| `GET /parent/children/{id}/date-sheet` | published sheets, only the papers of the child's class |
| `GET/POST /feedback`, `GET /feedback/{id}`, `POST .../open`, `.../close`, `GET .../export` | managers: averages, 1 to 5 spread, response rate, comments without names |
| `GET /feedback/mine` | a teacher's own summary |
| `GET /parent/feedback`, `PUT /parent/feedback/targets/{target_id}/children/{student_id}` | open requests per child with the teachers to rate; `{rating 1-5, comment?}` (upsert) |

### Rules worth knowing
- **Computation.** Percentage = total / sum of the class's paper maxima. Absent counts as zero and as a fail. Grade = highest band whose minimum is reached (computed on read from the active scheme). A student passes when every paper is at or above its pass mark. Rank is by total, ties share a rank (1, 1, 3), and only students with every paper entered are ranked.
- **Publishing** needs every active student of the class to have every paper entered (or marked absent), else 409 `marks_incomplete` with the list. It writes `exam_publications` and one `report_cards` row per student. Editing a published result is allowed for the class teacher only, and is audited as sensitive (`results.edited`).
- **Audit.** Marks entered/edited (before and after per student and subject), remarks, publish, unpublish, grading changes, papers, exports. Feedback answers are deliberately not audited (they would name the parent).
- **Feedback anonymity.** `guardian_id` only blocks duplicates and is never returned; comments are returned sorted alphabetically without names or times. A teacher sees a request only when `share_with_teachers` is true and the request has closed. A request closes on `closes_on` (IST) by itself (computed on read) or early; answers can be changed until then. Children who have left are not asked and cannot answer.
- Report card `attendance` is `null` for now (see hooks in the code).

### Helpers for other modules
```python
from app.services.results import class_sheet, student_result, report_card, grade_for, load_bands
from app.services.feedback import effective_status
```

## Messaging and notifications

Unified messaging (broadcasts and teacher threads) and the notification service every other module calls. Code: `app/services/{messaging,notifications,push}.py`, routes `app/api/v1/{messaging,parent_messaging,notifications}.py`, models `app/models/{messaging,notification}.py`, migration `0007_messaging_notifications`.

### How other modules send a notification
```python
from app.services.notifications import notify, notify_guardians_of_student

# one or more users (parents or staff), inside YOUR transaction, after your own writes
await notify(db, user_ids=[...], kind="fee_reminder", title="Fee reminder",
             body="Rs 5,000 is due for Aarav by 10 Nov", data={"student_id": sid, "amount_paise": 500000},
             school_id=p.school_id, student_id=sid, dedupe_key=None)

# every parent login of a child (skips a child who left, unless skip_if_left=False)
await notify_guardians_of_student(db, student_id, kind="attendance_absent",
                                  title="Aarav is absent today", body="...", dedupe_key=f"{day}:{student_id}")
```
- Pass the same `db` session your route uses. The inbox rows are written in that transaction, so they commit or roll back with your change. The push to phones goes out **after the commit** (SQLAlchemy `after_commit` hook, in the background) and is dropped on rollback. A push failure is logged and never reaches the caller.
- `notify` never raises: on any error it logs and returns `[]` (the write runs in a savepoint, so your transaction is untouched). It returns the new notification ids.
- Only active users of `school_id` get a row; a foreign or unknown id is skipped.
- `dedupe_key`: older rows of the same user, `kind` and key are replaced (a re-saved attendance sheet replaces its notification instead of sending another).
- `kind` is free text, so a module can add its own. Push preferences work per **category** (`attendance, fees, notices, exams, results, messages, leave, promotion, feedback, general`); the map is `KIND_CATEGORY` in `services/notifications.py` and an unknown kind falls in `general`. Known kinds: `attendance_present|absent|first_half|second_half`, `fee_reminder`, `notice`, `exam`, `result`, `feedback`, `leave_decided`, `leave_requested`, `promotion_promoted|stayed|completed`, `broadcast`, `message`. Add a line there for a new kind that needs its own category.
- Tests: `flush_pushes()` waits for pending pushes; `set_push_sender(MemoryPushSender())` captures them (`sender.sent`). The `clean` fixture in `tests/conftest.py` calls `flush_pushes()` first so a push never holds locks while tables are truncated.

### Push (`services/push.py`, like `services/email.py`)
`PUSH_BACKEND=console` (logs), `memory` (tests) or `fcm`. FCM HTTP v1 through httpx: set `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT` (the Firebase service-account key as JSON text, or a path to the file). The OAuth token is fetched with a signed JWT, cached, and refreshed once on a 401. A token FCM reports as `UNREGISTERED` is deleted. **iOS goes through FCM too**: upload the APNs key in the Firebase console and FCM delivers to iPhones, so a direct APNs sender is deliberately not built. Messages carry `data.kind`, `data.notification_id`, `data.student_id` and the caller's `data` (as strings) for deep links.

### Notification endpoints
The same routes exist for staff under `/notifications` and for parents under `/parent/notifications`.
| | |
|---|---|
| `GET /…/notifications` | inbox, newest first: `unread_only`, `student_id`, `limit`, `offset` -> `{items, total, unread}` |
| `GET /…/notifications/unread-count`, `POST /…/notifications/{id}/read`, `POST /…/notifications/read-all` | badge, mark one or all read (`read-all` takes an optional `student_id`) |
| `POST /…/notifications/devices` `{token, platform: ios\|android}` | register after sign in and whenever the token changes. A token belongs to one person: signing in on the phone moves it |
| `POST /…/notifications/devices/unregister` `{token}` | call on sign out |
| `GET/PUT /…/notifications/preferences` | push on or off per category. The inbox always shows everything |

### Messaging endpoints
| Staff (`/messaging`) | |
|---|---|
| `POST /broadcasts` | `scope=school` (`audience` all, grade, classes): admin or `academic.manage`. `scope=class` + `class_id` + `subject_id`: admin or `academic.manage` for any class, else a teacher assigned to the class (class teacher: any subject or General; subject teacher: only their own subject, 403 `subject_not_yours`; not assigned: 403 `not_assigned`). Attachments by `attachment_ids` |
| `GET /broadcasts`, `GET /broadcasts/{id}` | managers see all, others their own plus school-wide. Each has `recipient_count` and `read_count` |
| `POST /threads` `{student_id, subject_id?}` | a teacher currently assigned to the child's class (`subject_id` null = as class teacher) starts or reopens a thread. Admin cannot |
| `GET /threads`, `GET /threads/{id}`, `GET/POST /threads/{id}/messages`, `POST /threads/{id}/read`, `GET /unread-count` | only the thread's own teacher (others get 404) |
| `GET /files/{attachment_id}/url` | download link, only if the caller may see the broadcast or message |

| Parent (`/parent`) | |
|---|---|
| `GET /updates` | the updates feed: school broadcasts and class broadcasts of the active children, newest first, with a tag (School, a subject, General) and `is_read`. `student_id`, `unread_only` |
| `GET /updates/{id}`, `POST /updates/{id}/read`, `POST /updates/read-all`, `GET /messaging/unread` | read state per parent login; badge `{updates, messages}`. Parents cannot reply to broadcasts |
| `GET /children/{student_id}/teachers` | the child's teachers now, with `thread_id` if a thread exists |
| `POST /threads` `{student_id, staff_id, subject_id?}` | open or reuse a thread with a current teacher of the child |
| `GET /threads`, `GET /threads/{id}`, `GET/POST /threads/{id}/messages`, `POST /threads/{id}/read` | any guardian of the child sees the thread; another family's gets 404 |
| `POST /messaging/upload-url`, `POST /messaging/files/{id}/complete`, `GET /messaging/files/{id}/url` | attach a file to a reply (same flow as `/files`, messages only) |

### Rules worth knowing
- **Threads** are unique per child, teacher and subject (class-teacher threads have `subject_id` null). `active` and the `inactive_notice` shown in place of the composer are **derived** from `class_staff` and the child's status on every read; nothing is moved or deleted. When the assignment returns, the same thread is active again with its history. The new teacher has no thread until a side opens one (the parent's teacher list shows `thread_id: null`).
- A left child (or any non-active status): threads are read-only (`child_read_only` / `thread_inactive`), the teacher list is empty, no new broadcasts reach the family.
- **Read state**: `thread_reads` keeps how far each person has read; `unread` counts messages from others after that; `seen` on your own message is true once the other side opened the thread later. A broadcast read is one row per parent login.
- Messages list newest first (page 1 = latest); the app reverses it. Message and broadcast creation also create a `message` / `broadcast` notification for each recipient. Broadcasts are audited (`messages` category, `broadcast.sent`); individual chat messages are not.
- Attachments use purpose `message_attachment` (staff via `/files/upload-url`), must be `ready`, uploaded by the sender and unused; max 5 per message.
