# Slov mobile apps: parent side (iOS + Android)

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
- Demo account: `parent@demo.in` / `Slov@123` (parent with two children). `staff@demo.in` / `Slov@123` (staff, shows placeholder). `new@demo.in` / `Temp@1234` (must change password).

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

### 12. Languages
The product stays English-only except the **parent experience**, which has **English and Hindi (हिन्दी)**. The staff placeholder and the web app are English.
- **First launch** (no stored choice): a full screen chooser with the bilingual heading "Choose your language / अपनी भाषा चुनें" and two big buttons, **English** and **हिन्दी**. The choice is stored (iOS `UserDefaults` key `slov.lang`, Android DataStore/SharedPreferences key `slov.lang`; values `en` / `hi`).
- **Change anytime, no restart**: a compact **EN | हि** switch at the top of Home (between the child switcher and the bell, and on Login), plus an English | हिन्दी control in Settings. The in-app choice overrides the device language.
- **Strings**: iOS String Catalog `Localizable.xcstrings` (`en`, `hi`), Android `values/strings.xml` and `values-hi/strings.xml`. Every user-visible string is a key. "Slov", UPI, IST and school data (names, notice text, teacher messages) stay as the school typed them. Hindi is simple and gender-neutral where possible: उपस्थिति, फीस, परिणाम, छुट्टी का आवेदन, समय सारणी, सूचनाएँ (notifications), नोटिस (notices), संदेश.
- **Dates and money**: still the single IST formatter, now with locale `en_IN` or `hi_IN` (Latin digits, Indian grouping: ₹1,50,000). Month and weekday names follow the language. Fee receipt and report card PDFs use the app language for labels; the receipt amount in words stays English and money prints as "Rs.".
- **Layout**: Hindi text is longer, so no fixed widths or heights that cut text; headings keep the bold weight. iOS uses the system font for Hindi (Plus Jakarta Sans has no Devanagari).
- **Backend**: when signed in, a language change is sent fire-and-forget as `PATCH /parent/preferences {language: "en" | "hi"}` (repository `setLanguage(code)`), and the current choice is sent once after each sign-in, so push texts can follow it.
  - **Android**: language switching uses `AppCompatDelegate.setApplicationLocales` (androidx.appcompat 1.7, `MainActivity` extends `AppCompatActivity`, `res/xml/locales_config.xml` with `en` and `hi`, `android:localeConfig`, and the `AppLocalesMetadataHolderService` entry with `autoStoreLocales` so Android 12 and older also remember it across process death). The activity is recreated with the new resources; ViewModels and navigation state stay. `LanguageStore` (`AppCompatLanguageStore`) wraps it; the "has the parent chosen yet" flag lives in DataStore (`language_chosen`), the language itself in AppCompat/system. The first launch chooser is a card at the top of Login (the first screen); the compact EN | हि switch is at the top of Login (after the first choice), Home and Settings. `Ist` reads `AppLanguage.current` (en-IN or hi-IN); `Money` is language independent. Plus Jakarta Sans stays for Latin, Devanagari falls back to the system font (Noto Sans Devanagari); Hindi typography uses taller explicit line heights and no negative letter spacing.

### 13. Notifications
- **Notification centre**: a bell on Home (top right, with an unread dot) opens a list, newest first, each with an icon, title, body, IST time and unread state. "Mark all read". Tapping opens the related screen. Filter by the selected child; notifications for other children show a small child name tag.
- Types and exact texts:
  - Attendance, present: `{Name} is present today`
  - Attendance, absent: `{Name} is absent today`
  - Attendance, half day: `{Name} attended the first half only` (or `second half only`)
  - Fee reminder: `Fee reminder: ₹{amount} is due for {Name} by {date}`
  - Notice, exam date sheet, result published, feedback requested: short title + one line.
- **Settings > Notifications**: switches for Attendance, Fees, Notices and exams, Results, Messages (all on by default).
- **Push**: register the device after login (`registerDevice(token, platform)` on the repository, stub for now). iOS: ask for permission with `UNUserNotificationCenter`, `registerForRemoteNotifications`, forward the token. Android: Android 13+ `POST_NOTIFICATIONS` permission, create channels (attendance, fees, general), FCM wiring left as a clearly documented TODO in the README (needs `google-services.json`). Push payload carries `type`, `childId`, `deepLink`.
- Mock repository returns a realistic list for each child (one per type, times in IST).

### 14. Fee receipts (download as PDF)
- In Fees, every recorded payment has **Download receipt**. The app builds a one-page **A5 PDF** locally and opens the system share/save sheet (iOS `UIGraphicsPDFRenderer` + `ShareLink`/`UIActivityViewController`; Android `PdfDocument` + `FileProvider` + share intent).
- Receipt content: school name and city, "Fee receipt", receipt number, date and time in IST, student name, class, scholar number, invoice number and period, amount (and in words in English), payment mode and reference, received by, and "This is a computer generated receipt". Use "Rs." or the ₹ glyph only if the PDF font supports it.

### 15. Exam date sheet (Notices & calendar)
- Notices & calendar gets an **Exams** segment: exam name, date range, and a per-subject date sheet (date, weekday, start time in IST, subject), for the selected child's class only. An exam notice also appears as a notification.

### 16. Leave applications (More > Leave)
- List of the selected child's leave requests, newest first, each with dates (IST calendar dates), half-day note, reason, and a status chip (Pending, Approved, Rejected, Cancelled). Rejected or approved items show the teacher's note.
- **Apply for leave**: from date, to date (not before today, to not before from), optional "Half day only" (first half or second half, only when from = to), reason (required, max 200 chars). Submit button with spinner. A pending request can be **cancelled**. Child who has left school: screen disabled with a note.
- Notifications (English): `Leave approved for {Name}`, `Leave rejected for {Name}`. New notification types `leave_approved`, `leave_rejected`.

### 17. Report card (Results detail)
- Each published exam shows **Download report card**. Build an **A4 PDF** locally and open the share sheet. Content: school name and city, "Report card", exam name, student name, class, scholar number, a table of subject, marks, maximum, grade, total marks and percentage, overall grade, attendance % for the period (half day = 0.5), class teacher remark, issue date in IST. Use "Rs." style safe fonts, no rupee needed. Notification type `report_card`: `{Name}'s report card is ready`.

### 18. Timetable (More > Timetable)
- Weekly grid of the child's class: Monday to Saturday across, periods down, each cell shows subject and teacher. Period start and end times are IST clock times and are never converted. Today's column is highlighted, and today's substitutions show "Substitute: {teacher}".

### 19. Fees detail upgrade
- Invoice detail shows every **line** (fee head, amount), **discount** lines (concessions, negative), **late fee**, **previous dues**, and the total. Below, the **payments** list: instalment amount, mode, reference, receipt number, IST time, **Download receipt**. A cancelled payment is shown struck through with "Cancelled by school" and cannot be downloaded. Balance = total minus active payments.

### 20. Messages: one Updates feed plus a thread per teacher
- The Messages tab has two parts for the selected child.
- **Updates** (pinned at the top): one main feed, newest first, merging **school-level broadcasts** (from the principal or academic team) and **class broadcasts** from teachers. Each item shows a sender name, a **tag** (School, or the subject, or General), text, attachment chip and IST time. A filter row: All, School, then each subject present. Unread count on the row. Parents cannot reply here.
- **Teachers** (below): one row per teacher of the child: initials avatar, name, subject chip, a **Class teacher** tag on the class teacher (listed first), last message preview, IST time, unread dot. Tapping opens a **chat** with a composer (text only).
- **Previous teachers**: teachers who no longer teach this child appear in a separate section, **greyed out**, with the line "No longer teaches {Subject}". Their chat opens read-only: old messages are shown and the composer is replaced by "{Name} no longer teaches {Subject} to {Child}, so you can't reply. Messages from your current {Subject} teacher are under Teachers." If that teacher is assigned to the child's class again, the row moves back to Teachers and is active again with the full history.
- A child who has left school: everything read-only, composer hidden.
- **Notifications**: broadcast `{Sender} · {Subject}` + preview; school-level broadcast `School notice` + preview; message `{Teacher}` + preview. Types `broadcast` and `message`, Settings category Messages.
- Repository: `updates(childId)`, `teacherThreads(childId)` (active and previous), `threadMessages(threadId)`, `sendMessage(threadId, text)` (rejected for inactive threads), `markUpdatesRead(childId)`.
- Mock story to show every state: Aarav (8-B): a school broadcast, three teacher broadcasts, active threads with the class teacher, Maths and Science, one **previous** thread with the former English teacher Anita Joshi (greyed), and an active English thread with the current teacher Sunita Dwivedi.

### 21. Year-end promotion notifications
- New notification types (category Results): `promotion_promoted` "Congratulations! {Name} is now in Class {Class} for {Year}.", `promotion_stayed` "{Name} will continue in Class {Class} for {Year}.", `promotion_completed` "Congratulations! {Name} has completed Class {Class}." Tap opens Home.
- **Home congratulations card** for 14 days after a promotion: a flat card with a small celebration glyph and the same text for the selected child, dismissible. Shown only for `promotion_promoted` and `promotion_completed`.
- After a promotion the child's class label (switcher, profile, Home) shows the new class. Mock: Diya (6-A) was promoted to 7-A three days ago, with the notification and the card; Aarav has none.
- Results has a **Past years** section grouping older exams and report cards by academic year (read-only). Mock: Aarav has 2025-26 Half-yearly and Annual with report cards.

## Architecture (both platforms)
- Layers: `Design` (tokens, components) · `Domain` (models) · `Data` (repository protocol + Mock + Api stub) · `Features/<Screen>` (view + view model) · `App` (routing, session).
- `Repository` interface: `login`, `changePassword`, `children`, `today(childId)`, `attendanceMonth(childId, yyyy-MM)`, `exams(childId)`, `examDetail(id)`, `broadcasts(childId)`, `threads(childId)`, `messages(threadId)`, `send(threadId,text)`, `invoices(childId)`, `notices`, `calendar`, `feedbackRequests(childId)`, `submitFeedback(...)`, `leaveRequests(childId)`, `applyLeave(...)`, `cancelLeave(id)`, `timetable(childId)`, `reportCard(childId, examId)`, `setLanguage(code)`.
- Mock data is shared in shape with `apps/web/src/lib/mock.ts` (Rewa Public School; siblings Aarav Tiwari class 8-B and Diya Tiwari class 6-A).
- A single `IST` formatter utility; nothing else formats dates.
- Accessibility: Dynamic Type / font scaling, VoiceOver / TalkBack labels, 44pt / 48dp touch targets, contrast per tokens.
- App id: `tech.slov.app`. Name: Slov. Icons from `packages/brand/png`.
