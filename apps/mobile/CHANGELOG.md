# LogBase mobile — changelog

Every release build bumps the version in `app.json`: `version` (shown in Settings), plus `android.versionCode`
and `ios.buildNumber`, which must go up by one for every build you install over an older one or upload.
Release APKs go in `releases/android/` at the repo root (git-ignored), named `LogBase-<version>-build<code>.apk`.

## 1.6.2 (build 9) — 2026-09-24

- Home header: the workspace switcher and the bell + avatar pill always sit in their place, lined up with the
  page (their slide-in could be cut short and leave them slightly off). The pill still springs as teammates
  come online.

## 1.6.1 (build 8) — 2026-09-24

- Picker sheets (Discord channel, status, priority, workspace…) are capped at ~60% of the screen and scroll;
  long lists get a search field, and the current choice is ticked.

## 1.6.0 (build 7) — 2026-09-24

- Push notifications work: the app now asks for notification permission on Android 13+ (it never showed the
  prompt, so the device never registered for push). Settings has a Notifications row to turn push on, or to
  open system settings if it was blocked.
- Home no longer loads twice on launch: the workspace is picked only once the saved choice is read, and a
  background session re-check no longer remounts the signed-in app.
- Task screen: subtasks sit right under the title, with the properties list below them.
- No more in-app toast notifications (new activity shows on the bell). Live updates no longer replay Home's
  ring fill; it fills once, then updates in place.

## 1.5.0 (build 6) — 2026-09-24

- Task editor updates on screen instantly: an edit made while a task was still loading no longer leaves the
  screen stale until you go back and forth (removing an assignee, etc.).
- Send to Discord: owners can switch it on (channel + "required") for any task, including new ones. Attaching
  a file shows a real upload progress bar, then "Posting to #channel…"; delivered files stay listed as
  "<file> sent to Discord". Failed sends show why, with retry.
- Archive / restore are instant, with an "Archived" banner and Restore on the task screen (Archive now lives in
  the ⋯ menu at the top).
- Removing an attachment is instant.
- Moving a task to another status is instant: the card moves to its new column at once, counts update, and the
  board no longer shows a full refresh or replays the card's slide-in. Pull-to-refresh spinner only on a pull.
- Task screen redesigned for the app: large title, one clean properties list (Status, Priority, Assignee, Due,
  Channel — each opens its picker), a quiet "Saving" indicator, calmer spacing and a staggered entrance.
- One assignee per task (the picker replaces; AI fill keeps the first person).
- Subtasks are inline — no box; edit a line where it sits, add lines one after another.

## 1.4.0 (build 5) — 2026-09-24

- Task editing is live: changes show instantly and save in the background, and only the lists a change
  actually affects refetch (no more reloading the whole workspace after every edit or comment).
- Tasks open instantly from the board while the full details load.
- AI fill saves everything (fields, assignees, subtasks) in one request; a due time already in the past no
  longer makes the whole fill fail. AI assignee matching also handles names / emails (web `/api/ai/task-fill`).
- AI fill sits above the title in the task editor.
- Home header: the workspace switcher no longer clips its name or animates twice; the bell + avatar pill
  springs again as teammates come online; the status ring no longer flashes its colours before filling.
- Taller task cards in list and kanban views; the subtask chevron points right and turns down when open.
- Scrollbars hidden everywhere.

## 1.3.0 (build 4) — 2026-09-24

- Creating a task is one page: it opens straight in the editor with autosave, like the web.
- Assignees are picked from a bottom sheet; AI fill (describe a task in plain language) is in the editor.
- Task cards slide in from the left in list and kanban views.
- Home loads in one sequence: header chips, cards and charts appear first, numbers fill in after.
- Cleaner email sign-in screen; signing out no longer flashes back into the app.

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
