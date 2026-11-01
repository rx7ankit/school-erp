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
Auth (login, refresh, logout, change and reset password, lockout), platform owner (schools, billing stats), staff (add, bulk, permissions, login emails), academic setup (years, classes and custom classes, subjects, class and subject teachers), audit log (search and filters).

## Next, from the ERD
Students, guardians and parent logins, admissions and enrolment, Excel import, attendance (half days), leave, results and report cards, fees (setup, invoices, instalments, receipts), messaging and broadcasts, notifications and push, timetable and substitutes, certificates, year-end rollover, platform invoices.
