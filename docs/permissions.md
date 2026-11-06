# Permissions

There are three permissions, and no separate admin:

| Permission | What it covers |
|---|---|
| `academic.manage` | classes, subjects, timetable, results, certificates, rollover, students and parents, **staff** (people, logins, permissions, staff attendance), school-wide announcements, analytics |
| `fees.manage` | fee heads, structures, invoices, payments, dues, fee reports |
| `library.manage` | books, copies, loans, fines |

**Full access** means holding all three. That is what used to be the admin. A new school's first person is created with all
three. Only full access can read the audit log, see the school's Krevo bill, change the school logo, and decide any
student's leave or mark any class's attendance.

Class teacher and subject teacher are **assignments**, not permissions. A teacher with no permission sees only their own
classes.

Rules:
- A school always keeps at least one active person with full access: removing or reducing the last one is refused
  (`last_full_access`).
- `users.is_admin` is only a mirror of "holds all three", kept so platform-owner queries stay simple. Do not read it for
  access checks; use `Principal.has(...)` or `Principal.full_access`.
- The retired `staff.manage` is read as `academic.manage` when sent by a client, and is still listed in `/auth/me` and
  `/staff` outputs for anyone holding `academic.manage`, so app builds from before the change keep working.
  Remove that alias (`app/services/permissions.py`) once every client uses the three permissions.
- Create a staff member with `permissions: [...]` on `POST /staff`; change them with `PUT /staff/{id}/permissions`.
