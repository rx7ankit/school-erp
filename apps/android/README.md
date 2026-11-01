# Scool for Android (parent app)

Kotlin, Jetpack Compose (Material 3), single activity, Navigation Compose, ViewModel + StateFlow.
Spec: `docs/mobile/parent-app-spec.md`. Tokens: `packages/tokens/tokens.json`. Icons: `packages/brand/png`.

- Package / application id: `in.scool.app` (Kotlin needs backticks: ``package `in`.scool.app``)
- minSdk 26, target/compile SDK 35, AGP 8.7.3, Kotlin 2.0.21, Compose BOM 2024.10.01
- No Hilt, no Retrofit. Manual DI in `app/AppContainer.kt`. `data/ApiRepository.kt` is a stub (TODO).

## Run

1. Open `apps/android` in Android Studio (Ladybug or newer, JDK 17). Let Gradle sync.
2. Pick an emulator or device (API 26+) and press Run.

Command line: `./gradlew :app:assembleDebug` (needs the Android SDK, `ANDROID_HOME` or `local.properties` with `sdk.dir`).

If the wrapper files are missing, create them once with `gradle wrapper --gradle-version 8.10.2`
(run from an empty folder if the project does not configure yet, then copy `gradlew`, `gradlew.bat`, `gradle/wrapper/`).

## Demo accounts (mock data, no network)

| Email | Password | Result |
|---|---|---|
| `parent@demo.in` | `Scool@123` | Parent with two children (Aarav 8-B, Diya 6-A) |
| `staff@demo.in` | `Scool@123` | Staff placeholder screen |
| `new@demo.in` | `Temp@1234` | Forced Change password first |
| `left@demo.in` | `Scool@123` | Extra: Diya plus Riya, who left school (shows the "Left school on" banner, messaging off) |

## Font (Plus Jakarta Sans)

The TTFs could not be downloaded when this project was generated, so none are bundled. The theme looks fonts up by
resource name at runtime (`design/Type.kt`) and falls back to `FontFamily.Default` when they are absent, so the app builds and runs either way.
To bundle the font, download Plus Jakarta Sans (OFL, https://fonts.google.com/specimen/Plus+Jakarta+Sans) and add these files to
`app/src/main/res/font/`: `plus_jakarta_sans_regular.ttf`, `plus_jakarta_sans_medium.ttf`, `plus_jakarta_sans_semibold.ttf`, `plus_jakarta_sans_bold.ttf`.
No code change is needed.

## Structure (`app/src/main/java/in/scool/app`)

- `design/` tokens (Color, Type, Theme) and flat components (cards, pill buttons, fields, segmented control, layout helpers)
- `domain/` models, `Ist` (the only date/time formatter, English, Locale en-IN), `Money` (paise, Indian grouping), `Load` state
- `data/` `Repository`, `MockRepository`, `ApiRepository` (stub), `PrefsStore` (DataStore: selected child, theme)
- `features/<screen>/` screen + view model: login, password, home, attendance, results, messages, fees, notices (+ exam date sheet), notifications, feedback, leave, timetable, profile, more, settings, staff
- `app/` `MainActivity`, nav graph (`ScoolApp`), `BottomBar`, `SessionViewModel`, `AppContainer`

## Rules implemented

- `*_at` are UTC ISO strings, shown only through `Ist` (Asia/Kolkata). `*_on` dates are `LocalDate`, never zone-shifted.
- Money is `Long` paise, shown as `₹18,500` / `₹12,34,567`.
- Parents are read-only except messaging and changing password. Fees show "Pay at the school office."
- No dynamic colour, no shadows (elevation 0), orange only for the active tab and primary actions.
- Attendance %: half-day counts 0.5; leave counts as a school day not attended; holidays and unmarked days are excluded.
- Login is not persisted across launches (mock auth). Selected child and theme are.

## Strings

The app is English only. User-facing text lives in `app/src/main/res/values/strings.xml` (notification texts follow section 13 of the spec).
Content that comes from the school (notice text, teacher messages, exam and subject names, fee line titles) is shown as given.

## Notifications

- Notification centre: bell on Home (orange dot while the selected child has unread items), newest first, "Mark all read",
  filter "{child} | All children" (items of other children carry a name tag), tap opens the related screen (`deepLink` is a nav route; a sibling's item switches the child first).
- Settings > Notifications: Attendance, Fees, Notices and exams, Results, Messages (all on by default, stored in `PrefsStore`).
- Android 13+: `POST_NOTIFICATIONS` is requested after login; channels `attendance`, `fees`, `general` are created in `MainActivity` (`app/Push.kt`).
  `Repository.registerDevice(token, "android")` is called after login with a placeholder token (mock only).
- TODO (FCM): add `google-services.json` to `app/`, apply the `com.google.gms.google-services` plugin (not added, so the project still syncs),
  add `firebase-messaging`, create a `FirebaseMessagingService` that (a) forwards `onNewToken` to `registerDevice` and (b) posts a notification
  from the payload `type`, `childId`, `deepLink` to `NotificationChannels.idFor(category)`, honouring the Settings switches. Not wired or tested here.

## Fee receipts

Invoice detail > each payment > "Download receipt" builds a one-page A5 PDF (`features/fees/ReceiptPdf.kt`, `PdfDocument`), writes it to `cache/receipts/`
and opens the share sheet via `FileProvider` (`${applicationId}.fileprovider`, `res/xml/file_paths.xml`). Labels are English and the amount reads "Rs. 18,500"
because the platform font may lack the rupee glyph; the amount in words is English, Indian grouping (lakh, crore).

## Exam date sheet

Notices and calendar > Exams: exam name, date range and per-subject papers (weekday, date, start time in IST) for the selected child's class (`Repository.examSchedules(childId)`).

## Leave

More > Leave: the child's requests, newest first (dates, half-day note, reason, status chip, teacher's note). "Apply for leave" opens a form with Material 3 date pickers
(days before today, or before the From date for To, are disabled; the picker value is converted back to a plain school date with `Ist.fromPickerMillis`, no device zone),
"Full day / First half / Second half" (only when From = To) and a reason (required, 200 characters, counter). A pending request can be cancelled after a confirm dialog.
A child who has left school sees a note instead of the Apply button and cannot cancel. `MockRepository` validates the same rules and keeps requests in memory (3 samples per child).
Notifications `leave_approved` / `leave_rejected` use the Attendance switch, `report_card` uses the Results switch (`NotificationType.category`).

## Report card

Results detail > "Download report card" draws a one-page A4 PDF (`features/results/ReportCardPdf.kt`): school header, exam, student, class, scholar no, subject table (marks, maximum, grade),
total, percentage, overall grade, attendance % for 1 April to the publish date (half day = 0.5, from the mock attendance), class teacher remark and the issue date in IST.
It is written to `cache/receipts/` and shared through the same FileProvider helper (`sharePdf`) as fee receipts. Plain English text, no rupee glyph.

## Timetable

More > Timetable: Monday to Saturday across, periods down (6 periods and a break; Saturday is a half day in the mock). Period times are `LocalTime` clock times shown as written, never zone-converted.
The grid scrolls sideways on narrow screens, today's column header is black/white and its cells are shaded, and today's substitutions show "Substitute: {teacher}" (`Repository.timetable(childId)` returns the periods, slots and today's substitutions).

## Fees detail

Invoice detail lists fee heads, discount lines (negative, e.g. "-₹1,000"), late fee and previous dues, then the total; paid counts only ACTIVE payments, balance = total - paid.
Payments show instalment amount, mode, reference, receipt number, IST time and "Download receipt". A cancelled payment is struck through with "Cancelled by school" and has no download.
Mock: Aarav has a concession and a late fee on Term 1 and two instalments on Term 2; Diya has a cancelled cash payment plus a replacement UPI payment on Term 2; Riya carries previous dues.
