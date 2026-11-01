# Year-end rollover: one smooth cycle

Goal: at the end of the session, the academic team presses **one button** and in a few calm steps the school moves to the new year. Students are promoted, last year is archived, the new year starts with classes, subjects, teachers and fees already filled in, and every parent gets a push saying where their child is now. Next year the same button does it again.

## Principles
1. **Defaults do 90%.** Everything is prefilled from last year. The user only fixes exceptions.
2. **Nothing is final until Apply.** Each step saves a draft that can be resumed by anyone with the Academic permission. Apply is the only irreversible moment and it is one all-or-nothing action.
3. **Never lose history.** Last year stays readable forever (classes, attendance, results, report cards, fees). The new year is a new set of classes and enrolments, not an overwrite.
4. **Warn, do not block.** Readiness checks show problems with a link to fix them, but the school can still go ahead.
5. **Everything is logged** (audit log) and every student gets a history entry.

## Life of an academic year
`draft` (being prepared) → `current` (the only one running) → `completed` (archived, read-only).
Applying a rollover completes the old year and makes the new one current in the same moment.

## Where it starts
- **Promotion page** and a **banner on the dashboard and Classes page** for the Academic team: "Session 2026-27 ends on 31 Mar. Start year-end" (shown from 45 days before the year end date, always available from the Promotion page).
- The same flow is also reachable as **Promote** on one class card (it opens the wizard at the Students step filtered to that class), but a rollover completes the whole school at the end.

## The wizard (5 steps + a readiness check)
Progress bar on top, Back and Next at the bottom, "Save draft and close" always available, a live summary on the side on desktop.

**0. Readiness check** (a card, not a blocker)
- Results not published for: list of exam and class (link to Results).
- Pending leave requests (link).
- Unpaid fees: total and number of students. These can be carried forward in step 4.
- Classes without a class teacher.
- Students with missing key details (emergency contact).

**1. Students**
- One panel per class, **everyone selected by default** with the decision **Promote**. Last grade (12) defaults to **Passed out**. Per student a three-way choice: **Promote**, **Stay in this class** (detained), **Leaving school** (will be marked as left, offers a transfer certificate afterwards). Bulk actions: select all, "Mark selected as stay", "Mark selected as leaving".
- Helpful hints per student so decisions are easy: overall result %, attendance %, fee balance, and a "Below pass marks" tag.
- **Where they go:** each class shows "8-A becomes 9-A" with the destination editable (change section or pick another class). Missing destination sections are created automatically. For custom classes (Nursery, LKG, UKG...) the chain is set once as "next class" and shown here.
- Roll numbers restart in the new class (alphabetical, or keep old order: a switch).
- A small card: **Approved admissions waiting for next year** (count) so they can be placed afterwards (admission enrolment itself stays in Admissions).

**2. New year**
- Name suggested ("2027-28"), start and end dates (default 1 April to 31 March, editable).
- The list of new classes and sections, derived from step 1. Add an extra section (9-C) or remove an empty one. Capacity copied from last year.

**3. Subjects and teachers**
- A grid of the **new classes x subjects**, prefilled from the same grade last year. Add a brand new subject inline, tick which classes study it.
- **Teachers**: choose one starting point: **Same teachers for the same class** (default), **Move teachers up with their class**, or **Start empty**. Then adjust in the same matrix used in setup (class teacher + one subject teacher per subject). Counter "31 of 54 slots filled". It is fine to finish later: unfilled slots appear in the checklist after Apply.
- Timetable: **Copy last year's** (default) or start empty.

**4. Fees**
- A grid of **new class x fee head**, prefilled from this year's amounts for the *new* grade (a student moving to class 9 pays class 9 fees). Edit any cell. Bulk tools: **Increase all by [ ]%** and **Round to nearest ₹[ ]**. Add or remove a fee head.
- **Concessions**: each concession shows a switch **Carry over to next year** (RTE and staff child on, merit off by default).
- **Previous dues**: **Carry forward to the new invoice** (default) or **Write off** (needs a reason, flagged sensitive in the audit log).
- **First invoices**: **Create Term 1 invoices now** (choose due date) or **Later**. New year always starts with every student's payments empty. Last year's paid invoices are archived.

**5. Review and apply**
- Cards: students promoted / staying / leaving / passed out; new classes; subjects; teacher slots filled; fees total per class summary; dues carried forward; **parents who will get a notification: N**.
- A plain list of what will happen. A required tick: "I have checked this." The **Apply rollover** button shows a spinner and then a success screen.

## After Apply: the success screen and checklist
"Welcome to 2027-28. Here is what is left." A checklist with deep links and counts:
- Assign teachers to N empty slots.
- Set or check the timetable.
- Generate Term 1 invoices (if skipped) and send fee reminders.
- Publish the exam date sheet.
- Place approved admissions.
- Download the promotion list (Excel) and the new class lists.
Closing the screen keeps the checklist on the dashboard for the academic team until all done.

## What Apply does (one transaction)
1. Old year becomes `completed` (read-only). New year is created `current`.
2. New classes are created in the new year. Old classes stay as the archive of last year.
3. For every student: the old enrolment is closed (`promoted`, `detained`, `left` or `passed_out`) and, unless passed out or leaving, a new enrolment starts in the destination class. Student status becomes `passed_out` or `left` where it applies. A history entry is written for each ("Promoted from 8-A to 9-A, 2027-28").
4. Subjects per class and teacher assignments are created as chosen in step 3. Timetable copied if chosen.
5. Fee structure for the new year, carried concessions, and previous dues are recorded. Optional first invoice run.
6. Parent notifications are created for every promoted, staying and passed-out student, and pushed to their devices.
7. One audit summary (sensitive) plus per-student history. The draft is closed.
If anything fails, nothing changes.

## Parent notifications (push and in-app)
- Promoted: **"Congratulations! {Name} is now in Class {Class} for {Year}."**
- Stays: **"{Name} will continue in Class {Class} for {Year}."**
- Passed out: **"Congratulations! {Name} has completed Class {Class}."**
- Students marked as leaving get no automatic message (the school handles that personally).
- The parent app also shows a **Congratulations card on Home for 14 days** ("{Name} is now in Class 9-A"), the child's class label updates everywhere, and last year's results and report cards stay available under past years.

## Rules and edge cases
- Only one rollover per year (`promotion_batches`: draft → applied). A draft is shared: one active draft per school.
- Students with unpaid dues can still be promoted (warning in the review). Dues follow them.
- A student marked "Leaving" is marked left on Apply with the leaving date set to the year end date and appears in the checklist to issue a transfer certificate.
- Students who already left earlier are not listed.
- Class teachers cannot run a rollover. It needs `academic.manage` or admin.
- After Apply the old year cannot be reopened. To correct one student afterwards, use the student profile (class change with a history entry).
- The new year is available for setup (draft) before the old one ends, so the school can prepare early and apply on the last day.

## Data model additions
- `academic_years.status`: `draft | current | completed`.
- `promotion_batches` (from year, to year, status, created_by, applied_at) and `promotion_items` (enrolment, decision, destination class) as in the ERD, plus `rollover_drafts` (school, jsonb of all wizard choices, updated_at, updated_by).
- `classes.next_class_id` (for custom class chains) and `classes.academic_year_id`.
- `fee_carry_forwards` (student, from invoice, to invoice or written off, reason) so write-offs are traceable.
- Notification types: `promotion_promoted`, `promotion_stayed`, `promotion_completed`.
