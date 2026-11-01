# Scool mobile apps: parent side (iOS + Android)

One app per platform. **Single login, routed by user type.** Parents get the parent UI. Staff get a placeholder screen for now ("Staff app is coming. Use the web app today.").

## Locked rules (same as web)
1. Timestamps (`*_at`) are UTC ISO-8601 strings. **Always display in IST** (`Asia/Kolkata`), never the device zone.
2. Calendar dates (`*_on`, `"2026-11-01"`) are plain school dates. Do not zone-shift them.
3. Money is integer paise. Show as `₹18,500`, Indian grouping.
4. Parents are **read-only** except messaging and changing password. Fees are paid offline at school; the app only shows invoices and receipts.
5. No shadows anywhere. Flat grey cards. Orange only for the active tab, the primary action and key highlights.

## Design language (see packages/tokens/tokens.json)
- Font: Plus Jakarta Sans (bundle it). Headings Bold 700. Two-tone headings: ink phrase then grey phrase.
- Light: bg `#FFFFFF`, card `#F5F5F7`, fill `#E8E8ED`, text `#1D1D1F`, secondary `#6E6E73`, tertiary `#86868B`, separator `#D2D2D7`, accent `#F26A1B`, on-accent `#FFFFFF`, solid `#000000`, on-solid `#FFFFFF`, success `#1E8E3E`, warning `#B25E00`, danger `#D70015`.
- Dark: bg `#000000`, card `#1C1C1E`, fill `#2C2C2E`, text `#F5F5F7`, secondary `#A1A1A6`, tertiary `#6E6E73`, separator `#38383A`, accent `#FF7A2E`, on-accent `#000000`, solid `#FFFFFF`, on-solid `#000000`, success `#30D158`, warning `#FFB340`, danger `#FF453A`.
- Radius: card 20, control 12, pill = full. Primary buttons are pills: black/white (solid) or orange (brand).
- Parent app is **clean and minimal**: big titles, generous space, few elements per screen.
- iOS 26+: Liquid Glass on floating chrome only (tab bar, top child switcher, floating buttons). Content cards stay flat grey. iOS 17-25: same layout using `.ultraThinMaterial` / flat fills, no glass APIs. Android: Material 3 components restyled with our tokens, no dynamic colour, elevation 0.

## Auth
- Email + password. Credentials are created by the school: staff add parent emails, the system generates a password, staff click "Send login email".
- First login with a temporary password forces **Change password** before anything else.
- API (future): `POST /auth/login {email,password}` returns `{access_token, user:{id,name,kind:"parent"|"staff", must_change_password}}`. Until the backend exists use `MockAuthRepository`.
- Demo account: `parent@demo.in` / `Scool@123` (parent with two children). `staff@demo.in` / `Scool@123` (staff, shows placeholder). `new@demo.in` / `Temp@1234` (must change password).

## Navigation
Tabs: **Home, Attendance, Results, Messages, More**. More holds Fees, Notices & calendar, Child profile, Settings (theme, sign out).

### Child switcher (Home, top-left)
A parent can have several children under one email. Top-left of Home shows the selected child's avatar + first name + a chevron. Tap opens a sheet/menu listing all children (name, class). Selecting one switches the **whole app** (all tabs) to that child. Selection persists across launches. If only one child, no chevron.

## Screens
1. **Login**. Logo, two-tone title "Welcome back. Sign in to continue.", email, password, Sign in. Inline error text.
2. **Change password** (first login). New password, confirm, rules hint.
3. **Home**. Header: child switcher left, notification dot right. Two-tone greeting. Cards: *Today* (attendance for today: present / absent / half-day first or second half / not marked yet, with time marked in IST), *Fees* (due amount + due date, or "All paid"), *Latest result* (exam, percentage), *Latest notice*. Pull to refresh.
4. **Attendance**. Month calendar. Day marker: present (no mark), absent (red dot), half-day (half-filled dot), leave (grey dot), holiday (grey text). Month stats: attendance % (half-day counts 0.5), present days, absent days, half days. Previous/next month.
5. **Results**. List of published exams. Detail: subjects with marks, max, grade; total and percentage; class teacher remark; "Published {IST datetime}".
6. **Messages**. Segmented control: *Class* | *Personal*. Class: broadcast feed from teachers, each item shows subject chip, teacher name, text, attachment chip, IST time. Personal: threads with the class teacher and subject teachers; chat with composer. Parents can reply only in personal threads.
7. **Fees** (More). Invoices list with status (paid / partial / unpaid), detail with line items and payment receipts (mode, receipt no, IST time). No pay button; footer "Pay at the school office."
8. **Notices & calendar** (More). Notices list; holidays/exams/events list.
9. **Child profile** (More). Name, class, roll no, scholar no, DOB, guardians, status. Show "Left school on {date}" banner if status is left (records stay readable, messaging disabled).
10. **Settings**. Appearance (System/Light/Dark), Change password, Sign out, app version.

### 11. Feedback (More, with a dot on More and a card on Home while something is pending)
The school asks parents to rate teachers. List of **open** requests for the selected child's class, with the closing date in IST. Opening one shows each teacher of the child (name, subject, "Class teacher" label where it applies) with a **1 to 5 star** control and an **optional comment** (max 500 chars, counter). One **Submit** button sends all ratings the parent filled in (at least one star required). After submitting the screen shows the stars read-only with "Thank you. Your feedback is anonymous to teachers." A request already answered for this child shows read-only. Closed requests are hidden. Repository: `feedbackRequests(childId)` and `submitFeedback(requestId, childId, ratings: [{targetId, rating, comment?}])`. If the child has left school, the list is empty.

## Architecture (both platforms)
- Layers: `Design` (tokens, components) · `Domain` (models) · `Data` (repository protocol + Mock + Api stub) · `Features/<Screen>` (view + view model) · `App` (routing, session).
- `Repository` interface: `login`, `changePassword`, `children`, `today(childId)`, `attendanceMonth(childId, yyyy-MM)`, `exams(childId)`, `examDetail(id)`, `broadcasts(childId)`, `threads(childId)`, `messages(threadId)`, `send(threadId,text)`, `invoices(childId)`, `notices`, `calendar`, `feedbackRequests(childId)`, `submitFeedback(...)`.
- Mock data is shared in shape with `apps/web/src/lib/mock.ts` (Rewa Public School; siblings Aarav Tiwari class 8-B and Diya Tiwari class 6-A).
- A single `IST` formatter utility; nothing else formats dates.
- Accessibility: Dynamic Type / font scaling, VoiceOver / TalkBack labels, 44pt / 48dp touch targets, contrast per tokens.
- App id: `in.scool.app`. Name: Scool. Icons from `packages/brand/png`.
