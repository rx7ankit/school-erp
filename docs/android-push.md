# Android push notifications

Parents get a push on their Android phone when the school does something that concerns their child (absent mark,
fee invoice, result, notice, message, leave decision, and so on). It uses Firebase Cloud Messaging (FCM). iPhones do not
use Firebase: the API sends them straight to Apple (see `apps/api/app/services/push.py`).

## How it works

```
school action (e.g. attendance saved)
  -> API notify(): stores the inbox row, then after the DB commit sends the push
  -> device_tokens table: one row per phone (token + platform)
  -> FcmPushSender  --HTTPS-->  Firebase (FCM)  -->  the phone
  -> phone: Android draws the notification (app closed/background) or KrevoMessagingService does (app open)
  -> tap: opens the app on the right screen for the right child
```

1. **Register.** After a parent signs in, the app asks for the notification permission (Android 13+), fetches its FCM token
   and calls `POST /parent/notifications/devices` with `{platform: "android", token}`. It does this on every sign in, and
   `KrevoMessagingService.onNewToken` repeats it when Firebase rotates the token. A token belongs to one person at a time:
   signing in on a phone moves it from the previous person.
2. **Send.** `services/notifications.py` sends every push with these `data` keys (all strings):

   | key | meaning |
   |---|---|
   | `kind` | what happened: `attendance_absent`, `fee_invoice`, `fee_payment`, `fee_reminder`, `result`, `exam`, `message`, `broadcast`, `feedback`, `leave_decided`, `library_due`, `certificate_issued`, ... |
   | `student_id` | the child it is about |
   | `notification_id` | the inbox row |

   plus module ids such as `invoice_id`. Parents who switched push off for a category (Settings > Notifications) get no push,
   but the inbox row is still stored. A parent whose language is Hindi gets the Hindi title and body.
3. **Show.** The server sends a notification payload, so Android draws it itself while the app is closed or in the background
   (channel `general`, icon `ic_krevo_mark`, set in the manifest). While the app is open, `KrevoMessagingService.onMessageReceived`
   draws it, on the channel for the kind (`fees`, `attendance` or `general`).
4. **Tap.** Both paths put `kind` and `student_id` on the intent that opens `MainActivity` (`singleTop`). `PushLinks` hands
   them to `KrevoApp`, which waits until a parent is signed in, switches to that child and opens the screen:

   | kind | opens |
   |---|---|
   | `fee_*`, `library_due` | Fees |
   | `attendance_*`, `leave_decided` | Attendance |
   | `result` | Results |
   | `exam` | Notices > Exams |
   | `message`, `broadcast` | Messages |
   | `feedback` | Feedback |
   | anything else | Notification centre |

Code: `apps/android/app/src/main/java/tech/krevo/app/app/Push.kt` (channels, token, tap routing, messaging service),
`KrevoApp.kt` (register after sign in, open the tapped screen), `MainActivity.kt` (hands the intent over),
`AndroidManifest.xml` (service, default channel and icon). Server: `apps/api/app/services/push.py` (`FcmPushSender`).

Parents only for now: teachers and admins do not register a token yet. Signing out does not unregister the token.

## One-time Firebase setup (do once, for local and production)

1. Create a project at https://console.firebase.google.com (Analytics not needed). This repo uses `krevo-25c70`.
2. Add an **Android app** with package name exactly `tech.krevo.app`. Download `google-services.json` and put it in
   `apps/android/app/`. (No SHA-1 is needed for push.)
3. **Project settings > Service accounts > Generate new private key.** This downloads a service account key (`*.json`).
   It lets the server send pushes to every user: treat it like a password.

**Never commit the service account key.** `.gitignore` ignores `*-firebase-adminsdk-*.json` and
`fcm-service-account*.json`. Keep the service account key outside the repo, for example `~/.config/krevo/fcm-service-account.json`
(`chmod 600`). If a key is ever shared or leaked, delete it in the Firebase console and generate a new one.

A checkout without `google-services.json` still builds: the Google services plugin is only applied when the file exists, and the app
then runs with no push (`PushSetup.deviceToken()` returns `null`).

## Run it locally

You need: the API running (see `apps/api/README.md`), the two Firebase files, JDK 17, and an emulator with **Google APIs**
(or a real phone). The emulator needs internet access.

1. **API settings** in `apps/api/.env`:

   ```
   PUSH_BACKEND=apns
   FCM_PROJECT_ID=krevo-25c70
   FCM_SERVICE_ACCOUNT=/Users/<you>/.config/krevo/fcm-service-account.json
   ```

   `PUSH_BACKEND=apns` sends iPhones to Apple and Android through FCM. Use `console` to only log pushes. Restart the API.
2. **Build the app against your local API** (the emulator reaches your computer at `10.0.2.2`):

   ```sh
   cd apps/android
   JAVA_HOME=<a JDK 17> ./gradlew :app:assembleDebug -PkrevoApiBase=http://10.0.2.2:8000/api/v1
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

   Android Studio's bundled JDK is too new for this Gradle version, so use JDK 17.
3. **Sign in as a parent** on the emulator and accept the notification permission. Check the token reached the server:

   ```sh
   psql scool_dev -c "select platform, left(token,12), last_seen_at from device_tokens"
   ```

   You should see an `android` row. (No row: see Troubleshooting.)
4. **Trigger a push.** Anything that notifies a parent works. Easiest: as the school admin post a notice to everyone
   (`POST /messaging/broadcasts`, `{"scope":"school","audience":"all","title":"Test","body":"Hello"}`) or mark a child absent.
   The API log shows `POST https://fcm.googleapis.com/v1/projects/<id>/messages:send ... 200 OK`, and the phone shows the notification.
5. **Tap it.** The app opens on the screen for that kind (a notice opens Messages), on the right child.

To test the closed-app path, press Home first (do not swipe the app away or "Force stop": Android does not deliver pushes to a
force-stopped app).

### Troubleshooting

| What you see | Likely cause |
|---|---|
| No `android` row in `device_tokens` | The build has no `google-services.json` (re-check `apps/android/app/`), the emulator image has no Google Play services (use a "Google APIs" image), the emulator is offline, or the parent has not signed in on this build. |
| The log shows `FCM_SERVICE_ACCOUNT is not set` or `FCM_PROJECT_ID is not set` | The settings are missing from `.env`, or the API was not restarted. |
| The log shows `Google refused the FCM service account` | The key is wrong, revoked, or from a different project than `FCM_PROJECT_ID`. |
| `200 OK` in the log but nothing on the phone | Notifications are off for the app (Android 13+ permission or the system switch), the parent switched that category off in Settings, or the app was force-stopped. |
| `404` or `UNREGISTERED` in the log | The token is stale (app reinstalled or data cleared). The server deletes it; sign in again to register a new one. |
| Tapping opens Home instead of the screen | The parent was not signed in yet when the notification was tapped; sign in and the tap is handled once the app is on its main screen. |

## Production

Pushing this code to GitHub does **not** by itself enable push in production. Two things have to be done by hand:

### 1. The production server needs the Firebase settings

On the server (`krevoctl env` edits `/opt/krevo/config/.env`):

```
PUSH_BACKEND=apns
FCM_PROJECT_ID=krevo-25c70
FCM_SERVICE_ACCOUNT='{"type":"service_account", ... }'
```

- Keep `PUSH_BACKEND=apns` if iPhone push already works: it sends iPhones to Apple and Android through FCM. Do not use `fcm` unless
  the iOS app uses the Firebase SDK (it does not): iPhone pushes would stop.
- The API runs in Docker, so a file path on the server is not visible to it. Put the **key's JSON text on one line, inside single
  quotes**. To make that from the downloaded key:

  ```sh
  python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))))' fcm-service-account.json
  ```

  Paste the output between the single quotes. Then delete your copy of the key from anywhere it should not be.
- Deploy: `./infra/deploy.sh` from your Mac (or `krevoctl deploy` on the server). No server code change is needed: `FcmPushSender` is
  already in the API.
- Check: `krevoctl logs api`. After a parent signs in on the new app and something notifies them, the log shows the
  `messages:send ... 200 OK` line.

### 2. Users need a new Android build

Android apps are installed binaries, so push only reaches users who update to a build that contains this code.

1. Keep `google-services.json` in `apps/android/app/` on the machine that builds the release. It is committed (it is app config, not a secret), so a build
   on another machine (or a CI runner) would have no push.
2. Raise `versionCode` (and `versionName`) in `apps/android/app/build.gradle.kts`: the Play Store rejects an upload whose
   `versionCode` is not higher than the last release (it is `1` today).
3. Build a signed release bundle: Android Studio > Build > Generate Signed App Bundle, with JDK 17. Do not pass
   `-PkrevoApiBase`: the default is the production API, `https://api.krevo.tech/api/v1`.
4. Upload the `.aab` to the Play Console and roll it out. Parents get push after they update and sign in once (the app
   registers its token at sign in).

### Production checklist

- [ ] `krevo-25c70` Firebase project has the Android app `tech.krevo.app` registered
- [ ] `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT` set on the server, `PUSH_BACKEND` is `apns`, API redeployed
- [ ] `google-services.json` present on the build machine, `versionCode` raised
- [ ] Signed release bundle built and uploaded to the Play Console
- [ ] After updating, a test parent signs in, something notifies them, a notification arrives and opens the right screen
