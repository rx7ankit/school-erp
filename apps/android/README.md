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
- `domain/` models, `Ist` (the only date/time formatter), `Money` (paise, Indian grouping), `Load` state
- `data/` `Repository`, `MockRepository`, `ApiRepository` (stub), `PrefsStore` (DataStore: selected child, theme)
- `features/<screen>/` screen + view model: login, password, home, attendance, results, messages, fees, notices, profile, more, settings, staff
- `app/` `MainActivity`, nav graph (`ScoolApp`), `BottomBar`, `SessionViewModel`, `AppContainer`

## Rules implemented

- `*_at` are UTC ISO strings, shown only through `Ist` (Asia/Kolkata). `*_on` dates are `LocalDate`, never zone-shifted.
- Money is `Long` paise, shown as `₹18,500` / `₹12,34,567`.
- Parents are read-only except messaging and changing password. Fees show "Pay at the school office."
- No dynamic colour, no shadows (elevation 0), orange only for the active tab and primary actions.
- Attendance %: half-day counts 0.5; leave counts as a school day not attended; holidays and unmarked days are excluded.
- Login is not persisted across launches (mock auth). Selected child and theme are.
