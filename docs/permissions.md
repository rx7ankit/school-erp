# Permissions and the Home layout

There are four permissions and no separate admin.

| Permission | What it covers |
|---|---|
| `academic.manage` | classes, subjects, timetable, students and parents, results, certificates, rollover, staff attendance and cover, analytics |
| `fees.manage` | fee heads, structures, invoices, payments, dues, fee reports |
| `announcements.manage` | write notices and circulars to the whole school or to any class (a teacher can always write to the classes they teach; academic managers can read every notice) |
| `people.manage` | staff accounts and logins, who holds which permission, which teacher is assigned to which class and subject, the audit log |

**Full access** means holding all four: what used to be the admin. A new school's first person is created with all four.
Full access is what the school's Krevo bill and logo need, and it can decide any student's leave and mark any class's
attendance.

Class teacher and subject teacher are **assignments**, not permissions. A teacher with no permission sees only their own
classes and students.

## Rules
- A school always keeps at least one active person with `people.manage`. Removing or reducing the last one is refused
  (`last_people_manager`). Whoever holds `people.manage` can grant any permission, including to themselves, so treat it
  as the top-level one. Every change is written to the audit log as a sensitive entry.
- `users.is_admin` is only a mirror of "holds all four", kept so platform-owner queries stay simple. Never read it for
  access checks; use `Principal.has(...)` or `Principal.full_access`.
- The retired `staff.manage` is read as `people.manage` when a client sends it, and is still listed in `/auth/me` and
  `/staff` for anyone holding `people.manage`, so app builds from before the change keep working. Remove that alias
  (`app/services/permissions.py`) once every client uses the four permissions.
- Create a staff member with `permissions: [...]` on `POST /staff`; change them with `PUT /staff/{id}/permissions`.
  `GET /staff/access-options` returns the four permissions with plain-language labels and the one-tap presets (Full
  access, Academic head, Front office, Accountant, Teacher).

## The Home layout (server decides)
`GET /home/layout` returns what a staff member's app shows, so the iPhone, Android and web apps draw the same thing
and a new block needs no app release:

| Field | Contents |
|---|---|
| `tabs` | `home`, `messages` always; then `academic`, `fees` for whoever holds that permission |
| `menu` | `people` for whoever holds `people.manage` (in the profile menu, not a tab) |
| `blocks` | `my_day`, `my_classes`, `notices` for everyone; then `academic`, `fees`, `people` by permission |
| `has_assignments` | whether the person teaches any class |

Each block loads its own small request in parallel, so a slow block never holds up Home. Data for the blocks:
`my_classes` and `my_day` from the person's assignments (`/home` data endpoints already used by the apps), `academic` from
`/dashboard` and `/attendance/overview`, and `fees` from the fees summary.
Apps draw the block types they know and skip the rest.
