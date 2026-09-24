# LogBase mobile — changelog

Every release build bumps the version in `app.json`: `version` (shown in Settings), plus `android.versionCode`
and `ios.buildNumber`, which must go up by one for every build you install over an older one or upload.
Release APKs go in `releases/android/` at the repo root (git-ignored), named `LogBase-<version>-build<code>.apk`.

## 1.2.0 (build 3) — 2026-09-24

- Push notifications on Android (Firebase Cloud Messaging), for the same events as the in-app bell. Tapping
  one opens the task; a newer update on the same task replaces the older notification. Needs the API's
  `FIREBASE_SERVICE_ACCOUNT` and the `0042_mobile_push_tokens` migration.
- Signing out stops push to that device.

## 1.1.0 (build 2) — 2026-09-24

- Starts on Home after signing in (it could open on Search, with Back looping between the two).
- No more double blink on sign-in / sign-out.
- New connecting screen for Discord / Google sign-in, matching the web app.
- Native Google sign-in (system account picker instead of a browser).
- Android app icon: logo scaled down to standard launcher proportions.
- Dashboard load animations play in order instead of all at once, and the ring fills smoothly.
- Leaving Search no longer creates a Back loop.
- Task lists and task details update live when teammates make changes.
- Notifications: far fewer, only what matters to you (assignments, work started / finished, due-date moves,
  comments, priority raised to high), with the same rule on web, mobile and push. The panel now uses the
  web's coloured formatting.

## 1.0.0 (build 1)

- First release APK.
