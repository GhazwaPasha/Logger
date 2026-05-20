# Chat inbox

Cursor Agent turns append **here** when something is worth keeping beyond this chat (newest first). See **`second-memory/README.md`** and rule **`second-memory`**.

---

### 2026-05-20 — Notifications for assigner (not only assignees)

- **Context:** Task updates only notified assignees; assigner (task creator) saw nothing.
- **What we did:** **`isLedgerEntryNotifiableToUser`** + push **`notifyLedgerActivity`** include **`assignerId`**. Activity **`tasksById`** returns **`assignerId`**. Panel copy updated. Actor still excluded from their own edits.
- **Code / repo:** `notification-eligibility.ts`, `push-notifications.service.ts`, `tasks.service.ts`, `organizations.service.ts`, `ledger-types.ts`, `WorkspaceNotificationsProvider.tsx`.

### 2026-05-20 — Missing task update notifications (assignee map + ledger gaps)

- **Context:** Many task-update notifications stopped appearing (bell, live island, push); used to work.
- **Root causes:** (1) **`WorkspaceNotificationsProvider`** filtered activity using **`assigneeUserIds` from workspace board cache** (~150 paginated tasks), but **`GET …/activity`** includes ledger for **all** visible tasks — tasks off the loaded board had **empty assignees** → filtered out. (2) **Title-only** PATCH and **subtask** CRUD (per-item API) wrote **no `activity_ledger` rows** → no feed entry and no push.
- **What we did:** Activity API returns **`assigneesByTaskId`** for tasks in the feed; web uses it (board map as fallback). Client requests **`?limit=500`**. **`TasksService`**: ledger note + push for title change; **`recordTaskActivityNote`** for subtask add/update/complete/remove.
- **Deploy:** API + web.
- **Code / repo:** `organizations.service.ts`, `tasks.service.ts`, `ledger-types.ts`, `useOrgActivityFeed.ts`, `WorkspaceNotificationsProvider.tsx`.

### 2026-05-20 — Header: online teammates by search, no status dots

- **Context:** Teammate avatars placement + remove green/amber dots on stacked circles.
- **What we did:** **`OnlineMembersAvatars`** in a flex group **immediately left of** **`GlobalSearch`** (right header cluster, not by logo). **`GlobalSearch`** reserves width when open. No status dots. Avatars use **`gap-1.5`** + border (no overlapping `-ml-2` stack).
- **Code / repo:** `AppHeader.tsx`, `OnlineMembersAvatars.tsx`, `GlobalSearch.tsx`.

### 2026-05-20 — Push notification click opens production (not localhost)

- **Context:** Opening a push notification sent users to **`http://localhost:3000`** instead of the live site.
- **Root cause:** API **`notifyLedgerActivity`** built absolute URLs from **`PUBLIC_WEB_ORIGIN`**, defaulting to localhost when unset on the API host (prod often has **`NEXT_PUBLIC_APP_URL`** but not **`PUBLIC_WEB_ORIGIN`**).
- **What we did:** Payload **`url`** is now **path-only** (`/{slug}/work?task=…`) so **`notificationclick`** resolves on the subscriber’s origin. **`sw.js`** **`resolveNotificationTarget`** rewrites legacy absolute localhost (or same-origin) links to path + query. **`Client.navigate`** when an app window is already open.
- **Deploy:** Redeploy **API** (new payloads) and **web** (updated **`sw.js`**). Users may need a refresh so the SW updates; old notifications already in the tray still get localhost rewrite on click.
- **Code / repo:** `apps/api/src/push/push-notifications.service.ts`, `apps/web/public/sw.js`.

### 2026-05-20 — Task delete/archive fixes + context menu Edit

- **Context:** Delete showed no loading; editor/board right-click delete seemed broken; slow disappear from board.
- **Fixes:** Shared **`useArchiveTask`** (optimistic cache remove + **`Working…`** on confirm). Context menu defers actions via **`queueMicrotask`** (confirm dialog race). **Edit task** on right-click. API + caps: **task creator** may delete (assigner). Errors surface in banner; dialog stays open on failure.
- **Code / repo:** `useArchiveTask.ts`, `task-mutation-cache.ts`, `ConfirmDialog.tsx`, `SimpleContextMenu.tsx`, `TaskEditor.tsx`, `work/page.tsx`, `tasks.service.ts`, `authorization.service.ts`, `workspace-permissions.ts`.

### 2026-05-20 — Mandatory task title (frontend gate)

- **What we did:** Placeholder **Untitled Task**; label **Task title** with red `*`. Leaving without a real title → dialog **Keep editing** / **Delete task** (archives draft, removes from board). Uses `hasMeaningfulTitle` + extended `useTaskFormNavigationGuard`.
- **Code / repo:** `task-default-title.ts`, `TaskEditor.tsx`, `useTaskFormNavigationGuard.ts`.

### 2026-05-20 — New task: create before opening editor (no Saving on open)

- **Context:** Auto-mint on the create form showed **Saving** as soon as the page opened — felt wrong.
- **What we did:** **`createDraftTask`** + **`useOpenNewTask`**: POST draft task **before** `router.push` to `/work/task/{id}`. Work board **+ New task** / **N** shortcut use the hook. `/work/task/new` redirects via same hook. **`TaskEditor`** is **existing-only** (`taskId` prop); no on-page mint. **`useLayoutEffect`** establishes sync baseline on open to avoid spurious pending state.
- **Code / repo:** `lib/create-draft-task.ts`, `hooks/useOpenNewTask.ts`, `work/page.tsx`, `work/task/new/page.tsx`, `TaskEditor.tsx`.

### 2026-05-20 — New task: auto-mint with sentinel title

- **Context:** User wanted Todoist-style flow — no blocking UI until title commit; invisible prepopulation for API.
- **What we did:** **`TASK_DEFAULT_TITLE`** (`"Untitled task"`) in `task-default-title.ts`. On new task open (when **list** is set), **auto-POST** with sentinel if title empty; title field stays **empty** (placeholder only). First keystroke **PATCH**es real title. Removed Enter/blur mint and “save title first” hints. **`history.replaceState`** after mint (no remount).
- **Code / repo:** `lib/task-default-title.ts`, `TaskEditor.tsx`.

### 2026-05-20 — Task editor: instant title save + stable subtask rows

- **Context:** Title save felt slow; subtasks jumped up/down while toggling/editing, then snapped back when saved.
- **Root causes:** **`router.replace`** after mint remounted the editor; **`TaskSubtaskList`** re-sorted on every render; cache patches used **`sortSubtasksChronological`**; React **`key`** changed when optimistic id → server id.
- **What we did:** Mint updates URL with **`history.replaceState`** + **`mintedTaskId`** state (no remount). **`patchTaskSubtasksInCache({ preserveOrder: true })`**; list displays cache order as-is. **`useTaskSubtasks`** stable keys via **`getStableKey`**. Title edits call **`scheduleSave()`** when task exists.
- **Code / repo:** `TaskEditor.tsx`, `TaskSubtaskList.tsx`, `useTaskSubtasks.ts`, `task-subtask-cache.ts`.

### 2026-05-20 — New task: mint on title commit (fix 1-char title bug)

- **Context:** New task autosaved after 400ms with only the first typed character; navigation re-hydrated form from server → one-letter title.
- **What we did:** **No debounced POST while typing.** Create runs on **title blur or Enter** via `mintCreate()`. Full title stored in `sessionStorage` before `router.replace` as backup on hydrate. Hint: “Press Enter or leave title to save.”
- **Code / repo:** `useTaskFieldsSync.ts` (`autoCreate: false`, `mintCreate`), `TaskEditor.tsx`.

### 2026-05-20 — Task editor Phase 1+2: unified Todoist-style flow

- **Context:** User asked to implement unified task create/edit (Phase 1) and hardening (Phase 2) — one real-time edit model, not separate create/edit stacks.
- **What we did:** **`TaskEditor`** component (`mode: new | existing`) — single UI, header **Task**, one **`useTaskFieldsSync`** (POST mint once → PATCH only). **Routes:** canonical `work/task/[taskId]`; `work/task/new` thin wrapper; `work/task/[taskId]/edit` → redirect. After mint: **`router.replace`** to `/work/task/{id}` (not `/edit`). Removed **`TaskSubtaskDraftList`** — pre-mint subtasks = pending list in POST `initialSubtasks`; after mint = **`TaskSubtaskList`** only. **Phase 2:** debounced workspace invalidation (1.5s) in **`WorkspaceRealtimeSubscriber`**; kept detail cache rules.
- **Code / repo:** `components/tasks/TaskEditor.tsx`, `hooks/useTaskFieldsSync.ts`, `work/task/[taskId]/page.tsx`, `work/task/new/page.tsx`, `work/task/[taskId]/edit/page.tsx`, `TaskViewPanel.tsx`.

### 2026-05-20 — MCP test: create task + 5 subtasks; duplicate POST fix

- **Context:** Chrome DevTools MCP test with `test-workledger-mcp@example.local` on MCP Test Org.
- **Found:** (1) **Duplicate POST** on create — drain loop fired second create before `taskIdRef` set. (2) Sync pill showed **“Saved”** on empty form (idle mislabeled). (3) Spurious PATCH right after create before baseline.
- **Fixed:** `creatingRef` + set `taskIdRef` immediately after POST; `establishBaseline` after create in `useTaskFormPersistence`; idle indicator → **“Auto-save”**; removed redundant `formReady` on new page.
- **Verified:** One POST with 5 `initialSubtasks`, all subtasks in order, delete subtask + title PATCH kept 4 subtasks (no zombie reappear).

### 2026-05-20 — Task form autosave rework (standard local-first)

- **Context:** Autosave felt broken — refetches, UI blink, deleted subtasks reappearing; dual POST/PATCH hooks on create fought each other.
- **Root causes:** (1) `applyTaskMutationToCache` replaced `subtasks` on every field PATCH, racing subtask API/optimistic cache. (2) `workspace_changed` socket invalidated `taskKeys.detail`, triggering GET refetches during edits. (3) Create page used two `useTaskAutoSync` instances + `useTaskDetail` refetch-on-focus.
- **What we did:** **`applyTaskMutationToCache`** — field PATCH updates task/assignees/ledger only; subtasks unchanged unless `syncSubtasks: true` (POST seed). **Realtime** — stop invalidating task detail on `workspace_changed`. **`useTaskDetail({ formSession: true })`** — no refetch on focus/mount while editing. **`useTaskFormPersistence`** — single debounced save (POST until `taskId`, then PATCH); due baseline ref avoids cache-driven due flicker. **Create** — one hook, draft subtasks not in fingerprint (avoid duplicate POSTs).
- **Code / repo:** `task-mutation-cache.ts`, `useTaskFormPersistence.ts`, `useTaskDetail.ts`, `WorkspaceRealtimeSubscriber.tsx`, `work/task/new/page.tsx`, `work/task/[taskId]/edit/page.tsx`.

### 2026-05-20 — Create task: stay on create page after first autosave

- **Context:** First autosave on **Create Task** called `router.replace` to the edit route, remounting the page and flipping UX into “edit mode” (jarring refresh, wrong mental model).
- **What we did:** After first POST, set `createdTaskId`, seed React Query cache, enable PATCH autosync — **no Next.js navigation**. URL only updates via `window.history.replaceState` to the edit path (bookmarkable) while UI stays **“Create Task”**. Subtasks switch from draft list to API list once detail exists. List selector disabled after create. `useTaskSubtasks` no-ops when `taskId` empty.
- **Takeaway:** Create flow = one continuous screen; POST once then PATCH; URL can change without remount.
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/task/new/page.tsx`, `useTaskSubtasks.ts`.

### 2026-05-20 — Subtasks: chronological order + instant optimistic saves

- **Context:** New subtasks appeared at top (wrong checklist order); saves felt slow (awaiting network + spinners).
- **What we did:** API + cache sort **oldest-first** (`asc(createdAt)`); optimistic create **appends**; `sortSubtasksChronological` in UI/cache. **TaskSubtaskList** uses fire-and-forget `mutate` (no `await`, no row spinners) — optimistic cache updates feel immediate.
- **Code / repo:** `tasks.service.ts`, `useTaskSubtasks.ts`, `TaskSubtaskList.tsx`, `task-subtask-cache.ts`, `lib/subtask-order.ts`.

### 2026-05-20 — Subtasks: per-item API mutations (not task PATCH autosave)

- **Context:** Bundling subtasks into debounced task PATCH caused duplicates, glitches, and slow saves; user asked for a standard approach, not more stitching.
- **What we did:** **Edit** — `TaskSubtaskList` + `useTaskSubtasks` (React Query): `POST/PATCH/DELETE /tasks/:id/subtasks[/:subtaskId]` with optimistic cache updates via `task-subtask-cache.ts`. Removed subtasks from `useTaskAutoSync` fingerprint. **Create** — local `TaskSubtaskDraftList` only until first POST (subtasks in `initialSubtasks` once via ref, not in autosave fingerprint). **API** — `DELETE :taskId/subtasks/:subtaskId`.
- **Takeaway:** Task autosave = title, status, priority, due, assignees only. Each subtask action = one immediate API call (same pattern as work board checklist).
- **Code / repo:** `useTaskSubtasks.ts`, `TaskSubtaskList.tsx`, `TaskSubtaskDraftList.tsx`, `task-subtask-cache.ts`, `tasks.controller.ts`, `tasks.service.ts`, `edit/page.tsx`, `new/page.tsx`.

### 2026-05-20 — Task auto-save: queue drain, faster sync, pill UI

- **Context:** Follow-up — concurrent edits dropped during save; 700ms debounce felt slow; sync indicator layout weak.
- **What we did:** **`useTaskAutoSync`** — drain loop saves until fingerprint matches; only marks saved if no newer edits during request; chains saves without extra debounce. **350ms** debounce for text; **`scheduleSave`** (microtask) on status/priority/due/list/assignees for instant flush. **Edit** — `onSaved` clears only subtasks that were in the PATCH payload (not all pending). **`TaskFormSyncIndicator`** — compact right-aligned pill (`h-7`, uppercase labels: Pending / Saving / Saved / Draft), error detail below.
- **Code / repo:** `useTaskAutoSync.ts`, `TaskFormSyncIndicator.tsx`, `edit/page.tsx`, `new/page.tsx`.

### 2026-05-20 — Task create/edit: auto-save, sync indicator, leave warning

- **Context:** User wanted task create and edit pages to save automatically (no Save/Cancel), show sync status on the right, and warn when leaving with unsaved changes.
- **What we did:** Shared **`useTaskAutoSync`** (700ms debounce, queue while in flight), **`TaskFormSyncIndicator`**, **`useTaskFormNavigationGuard`** (confirm dialog + `beforeunload`). **Edit** — PATCH all form fields (title, status, priority, due, repeat, assignees, subtask create/update/delete); stay on page after save. **Create** — auto-POST when title + list, then **`router.replace`** to edit URL; draft-only leave warning when list/title missing. Removed manual save/cancel buttons; Back uses guard.
- **Takeaway:** Comments, attachments, dependencies, time tracker still save via their own components (unchanged).
- **Code / repo:** `apps/web/src/hooks/useTaskAutoSync.ts`, `useTaskFormNavigationGuard.ts`, `useDebounce.ts`, `components/tasks/TaskFormSyncIndicator.tsx`, `lib/task-mutation-cache.ts`, `work/task/new/page.tsx`, `work/task/[taskId]/edit/page.tsx`.

### 2026-05-20 — Auto browser notification permission (no Enable push)

- **Context:** “Enable push” in the notification panel felt redundant; product should trigger the **browser permission prompt** directly.
- **What we did:** Removed push UI block from **`WorkspaceNotificationsProvider`** panel. On workspace entry, if permission is **`default`**, call **`Notification.requestPermission()`** once ( **`wl:push:permission`** in localStorage after grant/deny). If already **`granted`**, subscribe silently via **`subscribeWebPush`**. Opening the **bell** retries when mount-time prompt was blocked (no user gesture). Errors still use **`liveIsland`**.
- **Code / repo:** `apps/web/src/components/notifications/WorkspaceNotificationsProvider.tsx`.

### 2026-05-20 — Header live island (Dynamic Island–style toasts)

- **Context:** User wanted live notifications in the **center of the app header**, Apple Dynamic Island–inspired but on LogBase theme—not floating Sonner cards at the top of the viewport.
- **What we did:** **`HeaderLiveIsland`** + imperative **`liveIsland`** store (`apps/web/src/components/app/live-island/`). **AppHeader** — 3-column grid: brand | island | actions. Pill animates **compact → expanded → compact → dismiss**; tap toggles expand; optional action + dismiss. **WorkspaceNotificationsProvider** — activity + push feedback use **`liveIsland`** instead of Sonner. Removed **`AppToaster`** from root layout; island styles in **`globals.css`** (`.header-live-island*`).
- **Takeaway:** Island only renders when **`AppHeader`** mounts (authenticated chrome). Queue shows one alert at a time. Sonner CSS left commented as legacy if reintroduced elsewhere.
- **Code / repo:** `apps/web/src/components/app/AppHeader.tsx`, `live-island/*`, `WorkspaceNotificationsProvider.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`.

### 2026-05-20 — Attachments: image compression, dedup blobs, orphan cleanup

- **Context:** Storage efficiency — compress images, deduplicate identical files, remove stale R2 keys.
- **What we did:** **`attachment_blobs`** table (`content_sha256`, `storage_key`, `ref_count`) + **`task_attachments.blob_id`** (migration **`0021_attachment_blobs`**). Upload path: **sharp** resize/WebP → SHA-256 → reuse blob or **`attachments/blobs/{aa}/{hash}.webp`** in R2. Delete decrements **`ref_count`**; R2 delete when 0. **Orphan job** `@Cron` 03:00 daily — `ListObjects` under `attachments/` vs DB, delete unknown keys older than 24h (`ATTACHMENT_ORPHAN_CLEANUP=false` to disable). Presign/confirm unchanged (legacy blob rows).
- **Code / repo:** `packages/db/drizzle/0021_attachment_blobs.sql`, `apps/api/src/attachments/attachment-image.util.ts`, `attachments-storage.util.ts`, `attachments-orphan-cleanup.service.ts`, `attachments.service.ts`, `sharp`, `@nestjs/schedule`.
- **Takeaway:** Run **`npm run migrate -w @work-ledger/db`** on each environment before deploy.

### 2026-05-20 — Attachment upload: API proxy (fix “Failed to fetch” / R2 CORS)

- **Context:** Browser presigned PUT to `*.r2.cloudflarestorage.com` from `localhost:3000` / Vercel failed with **Failed to fetch** (typical R2 bucket CORS gap).
- **What we did:** **`POST /tasks/:taskId/attachments/upload`** — multipart `file` → API **`PutObject`** to R2 + DB row (same limits/MIME rules). **Web** `AttachmentZone` uses `FormData` instead of presign→PUT→confirm. **`apiFetch`** skips `Content-Type` for `FormData`. Presign/confirm endpoints kept for optional direct upload if bucket CORS is configured later.
- **Takeaway:** Redeploy **Render** after pull; restart local **`dev:api`**. Optional: R2 bucket CORS for `PUT` from app origins if reverting to browser-direct upload.
- **Code / repo:** `apps/api/src/attachments/*`, `apps/web/src/components/tasks/AttachmentZone.tsx`, `apps/web/src/lib/api.ts`.

### 2026-05-20 — R2 public URL for attachment downloads

- **Context:** Task attachments list builds download URLs as `R2_PUBLIC_URL` + `storageKey`; bucket exposes public reads via Cloudflare `r2.dev` (S3 API still used for presigned PUT / delete).
- **What we did:** Set **`R2_PUBLIC_URL`** in root **`.env`** (no trailing slash). Left commented placeholders for **`R2_ACCOUNT_ID`**, **`R2_ACCESS_KEY_ID`**, **`R2_SECRET_ACCESS_KEY`**, **`R2_BUCKET_NAME`** — required for presign/upload/delete.
- **Takeaway:** Restart **`npm run dev:api`** after env changes; mirror vars on Render/production. Upload fails until S3 credentials are filled.
- **Code / repo:** `apps/api/src/attachments/attachments.service.ts`, `.env`.

### 2026-05-05 — Delete / archive: API + context menus + org danger zone

- **Context:** Product rule: **owners** delete org / levels / lists / tasks; **managers** archive tasks in their levels only; **members** no structural or archive rights. UI: right-click menus on sidebar + work board; org delete in settings.
- **What we did:** **API** — `DELETE /organizations/:id`, `DELETE .../departments/:id`, `DELETE .../lists/:id` (owner-only; DB FK cascades). **`POST /tasks/:id/archive`** — owner or dept manager (removed **`AssignerOnlyGuard`**). **`taskCapabilities`** adds **`canArchiveTask`** / **`canDeleteTask`** per rules. **Contracts** — `canArchiveTask` on capability schema. **Web** — **`apiVoid`**, **`SimpleContextMenu`**, **`workspace-permissions`** helpers; sidebar level/list context delete; work page list + kanban task context + edit panel buttons; org settings typed-name delete + redirect (`/app` if no orgs left). **`useTaskDetail`** placeholder uses same cap rules until GET returns.
- **Follow-up (same feature):** Replaced **`window.confirm`** with **`ConfirmDialog`** (portal + backdrop). Destructive labels use **white text** on **red-600** (context menu rows, edit-panel delete, org danger zone on **red-700** panel with white copy).
- **Code / repo:** `apps/api/src/authorization/authorization.service.ts`, `tasks.service.ts`, `tasks.controller.ts`, `tasks.module.ts` (guard removed), `departments/*`, `lists/*`, `organizations/*`, `packages/contracts`, `apps/web/src/lib/api.ts`, `workspace-permissions.ts`, `SimpleContextMenu.tsx`, **`ConfirmDialog.tsx`**, `WorkspaceSidebar.tsx`, `work/page.tsx`, `organization-settings/page.tsx`, `useTaskDetail.ts`, `ledger-types.ts`.
- **Links:** [[Topics/Domain/domain-authorization-and-tasks]], [[Topics/Infrastructure/apps-api]].

### 2026-05-05 — Notification badge + Sonner toasts (header layering)

- **Context:** Bell unread badge looked pill/accent-colored; toasts were small/default Sonner styling and easy to sit under other chrome.
- **What we did:** **AppHeader** — red (`red-600`) squarish badge (`rounded-[3px]`), `h-5`, `tabular-nums`, `11px` count, ring matching icon button surface. **AppToaster** — `className="app-toaster"`, `richColors={false}`, `gap={16}`, `offset` top `12px`. **globals.css** — wider cards (`--width` ~26rem), `surface-elevated` + `--radius-xl`, larger title/description/icon/close, left stripe by `data-type`, `z-index: 160` (above header `z-40`, overlays `z-60`, popovers `z-[100]`).
- **Code / repo:** `apps/web/src/components/app/AppHeader.tsx`, `AppToaster.tsx`, `apps/web/src/app/globals.css`.

### 2026-05-05 — “Enable push” / web push not configured

- **Context:** Notification panel **Enable push** showed toast: *The server may not be configured for web push yet.*
- **What we did:** Explained fix only (no code change). **`subscribeWebPush`** returns false when **`GET /push/vapid-public-key`** has no **`publicKey`** — API **`PushNotificationsService`** only enables VAPID when **`WEB_PUSH_VAPID_PUBLIC_KEY`** and **`WEB_PUSH_VAPID_PRIVATE_KEY`** are set (loaded from monorepo root **`.env`** / **`.env.local`** per **`apps/api/src/app.module.ts`**). Optional: **`WEB_PUSH_CONTACT`** (e.g. **`mailto:…`**), **`PUBLIC_WEB_ORIGIN`** for notification URLs. Generate keys: **`npx web-push generate-vapid-keys`**. Restart API after env change; set same vars on **Railway** (or host) for production.
- **Code / repo:** `apps/api/src/push/push-notifications.service.ts`, `apps/web/src/lib/web-push-client.ts`, `WorkspaceNotificationsProvider.tsx`.

### 2026-05-05 — Shared loading UI: dashboard, org, workspaces, session

- **Context:** Same **sync ribbon** language as task cards for dashboard, activity, org settings, sidebar bootstrap, and full-page gates.
- **What we did:** **`LoadingFrame`** / **`LoadingScreen`** / **`LoadingLinesBlock`** (`**apps/web/src/components/ui/LoadingFrame.tsx**`); **`.task-sync-ribbon-track--rounded-2xl`** in **`globals.css`**. Dashboard overview **`LoadingFrame`** while workspace pending; activity log frame + mono pulse lines; org settings fetch skeleton + save **`InlineSpinner`**; sidebar levels skeleton **`LoadingFrame`**; **`WorkspaceShell`** / **`AppAuthenticatedProviders`** / route **`Suspense`** via **`AppSectionSuspenseFallback`** → **`LoadingScreen`**.
- **Code / repo:** `LoadingFrame.tsx`, `AppSectionSuspenseFallback.tsx`, `DashboardOverview.tsx`, `OrgActivityTerminal.tsx`, `organization-settings/page.tsx`, `WorkspaceSidebar.tsx`, `WorkspaceShell.tsx`, `AppAuthenticatedProviders.tsx`, `app/(authenticated)/layout.tsx`, `globals.css`.

### 2026-05-05 — Task + workspace loading UX (work page, sidebar)

- **Context:** Inline task actions and task panel submits had little or no visible busy state; sidebar only showed plain text while workspace loaded.
- **What we did:** Shared **`InlineSpinner`** for buttons and controls. **Create / Save** primary actions show spinner + label, disable panel close (backdrop, Escape, header) and key fields while saving. **`patchTask`** pending: **one** top **sync ribbon** on list row + kanban card (**`task-sync-ribbon-*`** in **`globals.css`**, reuses **`task-ai-fill-indeterminate`**), tinted border/background, controls dimmed/disabled **without** multiple spinners; status pill keeps a muted chevron; priority loses overlay spinner. **`patchSubtask`** still uses tiny spinners on checklist rows. **WorkspaceSidebar:** initial-load skeleton only; per-row spinners for add level/list; no global refetch bar.
- **Code / repo:** `apps/web/src/components/ui/InlineSpinner.tsx`, `apps/web/src/hooks/useOrgWorkspace.ts`, `apps/web/src/components/app/WorkspaceSidebar.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`, `apps/web/src/app/globals.css`.

### 2026-05-05 — Retire duplicate Nest API on Vercel

- **Context:** API production host moved to **Railway**; old **separate Vercel project** (e.g. `logger-api-*.vercel.app`) is redundant and risks wrong env / 404 workspace packages if mis-rooted.
- **What we did (repo):** Documented canonical deploy in **`Topics/Infrastructure/apps-api.md`** (Railway + monorepo root) and **`00-map-overview.md`**. **Ops (you):** In Vercel → open the **API-only** project → **Settings → Delete Project** (or remove Git integration / disable deploys) **after** **`NEXT_PUBLIC_API_URL`** on the **web** project points at Railway and smoke tests pass. Remove DNS/custom domains from the old API if any. Rotate any API keys tied only to that host if applicable.
- **Code / repo:** `second-memory/Topics/Infrastructure/apps-api.md`, `00-map-overview.md`.

### 2026-05-05 — Railway: monorepo root + explicit API build/start

- **Context:** Service **root directory** was **`/apps/api`**, so install could not resolve workspace packages **`@work-ledger/db`** / **`@work-ledger/contracts`** (404 from registry).
- **What we did:** Repo-root **`railway.json`** — **`buildCommand`:** **`npm ci && npm run build:api`**, **`startCommand`:** **`npm run start:api`**, **`healthcheckPath`:** **`/health`**. Root **`package.json`** scripts **`build:api`** (**`npm run build -w @work-ledger/api`**, relies on API **`prebuild`** for db/contracts) and **`start:api`**. **Railway:** clear **Root Directory** (use repo root).
- **Code / repo:** `railway.json`, `package.json`.

### 2026-05-05 — Socket.IO org collaboration (Nest + web)

- **Context:** Multi-user UI; move toward push instead of polling-only.
- **What we did:** **`RealtimeModule`** — **`CollaborationService`** (**`notifyOrgChanged`**, **`emitWorkspaceChanged`**), **`OrgCollaborationGateway`** (handshake **`auth.token`** + **`auth.organizationId`**, **`assertOrgMember`**, room **`org:{id}`**; **`collaboration_auth_error`** before disconnect on auth failure). **`TasksService`**, **`OrganizationsService`** (create / patch / member upsert), **`ListsService`**, **`DepartmentsService`** notify after writes. **`JwtAuthGuard`** skips **`ws`**. **`main.ts`:** **`cors-origins.ts`**, **`PORT ?? API_PORT`**. Optional **`REDIS_URL`** → **`@socket.io/redis-adapter`** + **`redis`**; gateway **`onModuleDestroy`**. **Web:** **`WorkspaceRealtimeSubscriber`** — **`collaboration_auth_error`** + **`connect_error`** (auth-like) → **`wl:auth-expired`**; invalidate **`workspace`**, **`activity`**, **`task.detail`**. **`getApiBaseUrl`**. Removed **`refetchInterval`** on **`useOrgWorkspace`** / **`useTaskDetail`** (kept **`refetchOnWindowFocus`**).
- **Takeaway / follow-ups:** Set **`REDIS_URL`** on Railway when API replicas > 1. Tune **`connect_error`** heuristics if false-positive auth refresh.
- **Code / repo:** `apps/api/src/realtime/*`, `cors-origins.ts`, `main.ts`, `jwt-auth.guard.ts`, `tasks.service.ts`, `organizations.service.ts`, `organizations.module.ts`, `lists.service.ts`, `lists.module.ts`, `departments.service.ts`, `departments.module.ts`, `WorkspaceRealtimeSubscriber.tsx`, `WorkspaceShell.tsx`, `apps/web/src/lib/api.ts`, `useOrgWorkspace.ts`, `useTaskDetail.ts`. [[Topics/Infrastructure/websocket-railway-plan]].

### 2026-05-05 — Prod CORS “random” sessions: merge origins + optional Vercel + preflight headers

- **Context:** User saw intermittent **Failed to fetch** / CORS in production across sessions — often **different `Origin`** per session (custom domain vs **`*.vercel.app`**, preview vs prod, **`www`** vs apex) while the API allowed only a subset. **`API_CORS_ORIGINS`** previously **replaced** **`NEXT_PUBLIC_APP_URL`**, so partial env easily dropped an allowed origin.
- **What we did:** **`corsAllowedOrigins()`** in **`apps/api/src/main.ts`** now **dedupe-merges** explicit **`API_CORS_ORIGINS`** with **`NEXT_PUBLIC_APP_URL`**. Optional **`API_CORS_ALLOW_VERCEL_APP`** (`1`/`true`) adds regex **`https://*.vercel.app`**. **`enableCors`** sets explicit **`methods`** and **`allowedHeaders`** (`Authorization`, `Content-Type`, `Accept`). Docs: **`Topics/Infrastructure/apps-api.md`**.
- **Takeaway / follow-ups:** In DevTools → Network, confirm failed calls show **`(blocked:cors)`** or missing **`Access-Control-Allow-Origin`** on **OPTIONS** vs true network errors. On the **API** host (e.g. Vercel), list every origin users actually open; use **`API_CORS_ALLOW_VERCEL_APP`** only if previews must talk to that API (JWT still gates data).
- **Code / repo:** `apps/api/src/main.ts`, `second-memory/Topics/Infrastructure/apps-api.md`.

### 2026-05-05 — Multi-user UI: poll workspace + task detail

- **Context:** Edits from another teammate did not show until a full manual refresh; only the acting client’s mutations updated React Query via **`setQueryData`** (no WebSocket/SSE).
- **What we did:** **`useOrgWorkspace`** and **`useTaskDetail`** gained **`refetchOnWindowFocus: true`** and short-interval **`refetchInterval`** (later **removed** once Socket.IO collaboration shipped — see **Socket.IO org collaboration** entry above).
- **Takeaway / follow-ups:** Superseded for freshness by push + invalidation; **`refetchOnWindowFocus`** kept as safety net.
- **Code / repo:** `apps/web/src/hooks/useOrgWorkspace.ts`, `apps/web/src/hooks/useTaskDetail.ts`.

### 2026-05-05 — Stay signed in: secure cookies on localhost + session length + UI

- **Context:** Users had to log in on every visit; no “remember me” in the UI. Common cause: **`NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` set to `https://…`** while running **`next dev` on `http://localhost`** — Better Auth then uses **`__Secure-*`** session cookies, which the browser **drops on non-HTTPS** origins, so the session never sticks.
- **What we did:** **`advanced.useSecureCookies`** is **`false` when `NODE_ENV !== "production"`**, and in production **`true` on Vercel** or when **`NEXT_PUBLIC_APP_URL`** is **`https://…`**. Escape hatches: **`AUTH_FORCE_INSECURE_COOKIES`**, **`AUTH_FORCE_SECURE_COOKIES`** (values **`1`/`true`**). **`session.expiresIn`** **30d**, **`updateAge`** **24h**. Login/sign-up: **“Stay signed in on this device”** checkbox (default on) → **`rememberMe`** on **`signIn.email` / `signUp.email`**.
- **Takeaway:** For local dev, either keep **`NODE_ENV=development`** (default for `next dev`) or set a **http** app URL in **`.env.local`**; use force flags if you run a **production build on http** locally with prod env.
- **Code / repo:** `apps/web/src/lib/auth.ts`, `apps/web/src/app/login/LoginForm.tsx`. See also [[Topics/Infrastructure/auth-jwt-and-env]].

### 2026-05-05 — Notification bell badge: don’t seed last-seen on first visit

- **Context:** Toasts and the notifications panel worked, but the header bell never showed a count.
- **What we did:** **`WorkspaceNotificationsProvider`** no longer writes **`Date.now()`** to **`wl:notif:lastSeen:*`** when there is no stored value. That old behavior marked the entire existing activity feed as “already seen” before the user opened the panel, so **`unreadCount`** stayed **0** while the list still showed historical items. First visit now uses **`lastSeenTs = 0`** until the user opens the panel (which persists a real last-seen timestamp).
- **Code / repo:** `apps/web/src/components/notifications/WorkspaceNotificationsProvider.tsx`.

### 2026-05-05 — Prod CORS: `log-base` → `logger-api` preflight

- **Context:** Browser reported no **`Access-Control-Allow-Origin`** on **`OPTIONS`** for **`https://logger-api-blond.vercel.app/organizations`** from **`https://log-base.vercel.app`**; intermittent across browsers/networks (cached failed queries, different origins, preflight vs simple requests).
- **What we did:** **`corsAllowedOrigins()`** in **`apps/api/src/main.ts`** now splits comma-separated **`NEXT_PUBLIC_APP_URL`** the same way **`AuthService`** does for issuer/audience, so multiple web origins in one env var get CORS without requiring **`API_CORS_ORIGINS`**. **Deploy fix:** on the **API** Vercel project set **`NEXT_PUBLIC_APP_URL`** and/or **`API_CORS_ORIGINS`** so the set includes the **exact** origin users open (e.g. **`https://log-base.vercel.app`**, plus custom domains / `www` if used).
- **Code / repo:** `apps/api/src/main.ts`.

### 2026-05-04 — List row: assigned / late icon chips match `h-8` row

- **What:** **`LIST_ROW_FOOTER_META_ICON_CHIP`** (`size-8`) replaces **`TASK_FOOTER_META_ICON_CHIP`** (`size-7`) for has-assignee + in-progress-overdue hints in **`ListTaskCard`** so they align with assignee tile, due chip, and overflow (**`h-8`**). Kanban mid-footer unchanged (**`h-7`** + **`KANBAN_SUBTASK_BELOW_BADGE_HEIGHT`**).
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-04 — Kanban card: meta grid (status, priority, due, assignee)

- **Context:** User wanted **equal width** for the four controls, **no divider** between the old two-row layout, then a **2×2 grid** that **fills card width**.
- **What we did:** **`TaskCard`** — **`border-t border-[var(--border-subtle)]/50 pt-1.5`** wraps the meta **grid** so a divider sits **below title + subtasks** and above status/priority/due/assignee. Grid: **`grid w-full grid-cols-2 gap-x-1.5 gap-y-1.5`** — row 1 **status | priority**, row 2 **due | assignee**; each cell **`min-w-0 min-h-8`**. **`StatusPillSelect`** optional **`shellLayoutClassName`** — **`KanbanStatusPill`** only (kanban **`KANBAN_STATUS_SHELL_LAYOUT`**); **list rows** use **`ListRowStatusPill`** (default fixed **`STATUS_PILL_LAYOUT`**). Due in kanban: **`KANBAN_DUE_CHIP_CELL`** (**`!w-full !min-w-0 !shrink`**) + flex wrapper so the chip fills the grid cell. **`KanbanPriorityPill`**: **`KANBAN_PRIORITY_SHELL_LAYOUT`**. Assignee **`h-8 w-full`**, **`size-6`** avatars.
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-04 — Task status: retire automated **Assigned** / **Late** as stored states

- **Context:** **Assigned** was pending + assignee; **Late** was in progress + overdue. They should not appear in the workflow status pill; assignee/due chrome + footer badges carry that signal.
- **What we did:** **API** — `coerceLegacyTaskStatus` in `apps/api/src/tasks/task-status-automation.ts` maps legacy **`assigned`→`pending`**, **`late`→`in_progress`** on list/detail; no assignee/due-driven status writes. **DB** — migration `packages/db/drizzle/0010_normalize_task_status_legacy.sql` + journal entry. **Contracts** — comment only (enum unchanged for reads). **Web** — `task-board.ts`: `taskMatchesUrlStatusFilter`, `taskShowsLateFooter`, `taskHasAssignees`, footer badge + assignee/due chrome class helpers; **`due=` late preset** = in-progress overdue; URL **`status=assigned` / `late`** use derived rules. **Work** — status pill uses manual stage only; **Has assignee** / **in progress overdue** as profile (**sky**) + stopwatch (**orange**) outlined chips: **list** — beside level + list badges in the title row; **kanban** — second footer strip (`border-t`, `px-2.5`) **above** `TaskCardLastActivity`; last-activity footer ledger-only; assignee control uses sky chrome when anyone is assigned; due chip uses orange when late rule matches. **Dashboard** — status mix bar + KPIs use four manual stages; **Late** KPI counts in-progress overdue via `taskShowsLateFooter`.
- **Takeaway:** Run **`npm run db:migrate`** so existing rows normalize. Activity log still renders historical **`assigned`/`late`** status_change payloads via `taskStatusDisplayLabel`.
- **Code / repo:** `apps/api/src/tasks/task-status-automation.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/web/src/lib/task-board.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`, `apps/web/src/components/dashboard/DashboardOverview.tsx`, `packages/contracts/src/index.ts`, `packages/db/drizzle/0010_normalize_task_status_legacy.sql`.

### 2026-05-04 — TaskPanelAiFill: status-pill-style highlight

- **Context:** AI fill block should read like workflow **status pills** (tinted surface + border).
- **What we did:** Outer shell uses **Tailwind `blue-500`** tints (**`/22`** light, **`/15`** dark), not **sky** / not **`statusPillPaletteClasses("assigned")`**; **`rounded-xl`**, **`border-[var(--border-subtle)]`**, **`shadow-sm`**; header hover **`hover:bg-black/[0.06]`** / **`dark:hover:bg-white/[0.08]`**; expanded body **`surface-base`** overlay + **`border-t`**. **Textarea + “Ai fill” button** use **`blue-*`** fills and focus rings + subtle borders. Success hint: **`Success: …`** (Tasks, Subtask, Member, Due Date, Recurrence, Status, Priority when set).
- **Code / repo:** `apps/web/src/components/tasks/TaskPanelAiFill.tsx`.

### 2026-05-04 — Work task panel: AI fill (Gemini, natural language)

- **Context:** Task create/edit side panel should support filling fields from plain-language descriptions using a Gemini API key.
- **What we did:** **`POST /api/ai/task-fill`** (Next Route Handler) calls Google **`generateContent`** with JSON schema output, **`auth.api.getSession`** for auth, and **`GEMINI_API_KEY`** (or **`GOOGLE_GENERATIVE_AI_API_KEY`**) server-side only. **`GEMINI_MODEL`** optional: when unset, the server calls **`models.list`** and uses the **first** model that advertises **`generateContent`** (Google’s order), cached ~**20m** per key fingerprint—no hardcoded default model id. Response is sanitized (assignees must match roster `userId`s; status/priority/repeat enums; local due **`YYYY-MM-DDTHH:mm`**). **`TaskPanelAiFill`** collapsible block on work page create + edit panels; client sends **`timeZone`**, **`nowIso`**, and workspace **members** for grounding. **Quota UX:** when Google returns **`free_tier` + `limit: 0`**, the route appends a short hint (allocation / billing project vs RPM). When the model returns JSON but **no fields apply** after normalize (**`taskAiFillResultIsEmpty`**), **422** message: **`I failed to understand, please try again!`**
- **Takeaway:** Add the key to **repo-root `.env.local`** (loaded by **`apps/web/next.config.mjs`**); never expose in `NEXT_PUBLIC_*`. Pin a model with **`GEMINI_MODEL`** if discovery picks one with bad quota. **`limit: 0` on `generate_content_free_tier_requests`** is usually the **GCP project behind the key**, not “rate limit used”—link **billing** to that project or use a key from a project that has Gemini allowance.
- **Code / repo:** `apps/web/src/app/api/ai/task-fill/route.ts`, `apps/web/src/lib/task-ai-fill.ts`, `apps/web/src/components/tasks/TaskPanelAiFill.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-04 — Task AI fill: playbook + resilient JSON parsing

- **Context:** Model sometimes returned non-JSON; need a clear contract for allowed task fields vs API.
- **What we did:** **`task-ai-playbook.ts`**: `TASK_AI_SYSTEM_INSTRUCTION`, `GEMINI_TASK_FILL_RESPONSE_SCHEMA` (enums), `buildTaskFillUserTurn` (roster + `CURRENT_USER_ID` for “me”). **`task-ai-json.ts`**: `extractJsonObjectFromModelText` (fences + first balanced `{…}`). Route uses **`systemInstruction`**, lower temperature, larger **`maxOutputTokens`**, parse fallback + clearer 502 snippet. Subtasks sanitize max **100**. Human playbook doc: **`apps/web/docs/task-ai-fill-playbook.md`** (not second-memory).
- **Code / repo:** `apps/web/src/lib/task-ai-playbook.ts`, `apps/web/src/lib/task-ai-json.ts`, `apps/web/src/app/api/ai/task-fill/route.ts`, `apps/web/src/lib/task-ai-fill.ts`, `apps/web/docs/task-ai-fill-playbook.md`.

### 2026-05-03 — Postgres DNS: prefer IPv4 when dual-stack (`ipv4first`)

- **Context:** Local sign-in sometimes **`ETIMEDOUT`** on networks with broken IPv6; other networks fine (see also entry below on env vs network).
- **What we did:** **`dns.setDefaultResultOrder('ipv4first')`** before **`pg`** connects via side-effect **`packages/db/src/pg-dns-order.ts`**, imported first from **`packages/db/src/index.ts`** and **`packages/db/src/migrate-cli.ts`**.
- **Rollback:** Step-by-step in vault note [[postgres-node-pg-dns-ipv4first]] (delete file, remove two imports, `npm run build -w @work-ledger/db`, restart servers).
- **Code / repo:** `packages/db/src/pg-dns-order.ts`, `packages/db/src/index.ts`, `packages/db/src/migrate-cli.ts`.

### 2026-05-03 — POST `/api/auth/sign-in/email` 500 (~24s): DB `ETIMEDOUT`

- **Context:** Sign-in returned 500 after ~24s; Next attributed slowness to application code.
- **Root cause:** Better Auth runs a Drizzle/pg query on `"user"` by email; the driver raised **`ETIMEDOUT`** (Postgres host unreachable or TCP blocked), not an auth bug. Terminal showed failed query + `AggregateError` with `code: 'ETIMEDOUT'`.
- **Localhost vs prod:** Prod (e.g. Vercel) env can be fine while local fails if **repo-root `.env.local` overrides a bad/stale `DATABASE_URL`** — **`apps/web/next.config.mjs`** loads **`../../.env`** then **`../../.env.local`** with **`override: true`**, so **`.env.local` wins**. Align local URL with the working production value or remove the duplicate key. If the URL matches prod and still times out on **Windows**, suspect **IPv6 routing / firewall on port 5432** for that machine.
- **Follow-ups:** Verify **`DATABASE_URL`** (correct Neon project/branch, pooled host if recommended, machine can reach **:5432**), firewall/VPN, and that the DB is not mis-pointed. `apps/web` uses `pg` `Pool` in **`apps/web/src/lib/auth.ts`**.
- **Code / repo:** `apps/web/src/lib/auth.ts`, `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/next.config.mjs`.

### 2026-05-03 — Marketing home: hero headline + secondary phrase

- **What we did:** Hero H1 is three rows: **Optimize** / **Organize** / **Orchestrate** plus smaller baseline-aligned phrases (**your plan**, **your workforce**, **your Outcome**). New **`.home-hero-sub`** in **`globals.css`** (muted mix, ~**`0.36em`** with clamp). Slight vertical **`gap`** between rows.
- **Code / repo:** `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`.

### 2026-05-03 — Marketing home: hero eyebrow copy

- **What we did:** Pill **Accountability & Audit** → **Task Management with Accountability**.
- **Code / repo:** `apps/web/src/app/page.tsx`.

### 2026-05-03 — Marketing home: hero headline words

- **What we did:** Hero H1 → **Optimize / Organize / Orchestrate**.
- **Code / repo:** `apps/web/src/app/page.tsx`.

### 2026-05-03 — Marketing home: less side gutter

- **What we did:** Widen page shell (**`max-w-7xl`** default, **`lg:max-w-[90rem]`**, **`2xl:max-w-[min(100%,100rem)]`**) and reduce horizontal padding (**`px-4` / `sm:px-6` / `lg:px-8` / `2xl:px-10`**) so content uses more viewport width.
- **Code / repo:** `apps/web/src/app/page.tsx`.

### 2026-05-03 — Marketing hero: no Live pill, wider mock

- **What we did:** Removed **Live** pill from **`HeroProductMock`**; deleted **`home-live-*`** animation/CSS. Hero grid narrows copy (**`30rem` / `34rem`** max) and slightly tighter gaps so the mock column is wider; shimmer bars use percentage widths so they scale with the wider card.
- **Code / repo:** `apps/web/src/components/marketing/HeroProductMock.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`.

### 2026-05-03 — Marketing hero: larger product mock

- **What we did:** Increased **`HeroProductMock`** min-heights (**`400px` / `420px` xl / `500px` 2xl**), slightly stronger shadow, larger chrome (padding, dots, shimmer bars, type). Hero grid gives the mock column more width (**`38rem` / `42rem`** max copy vs **`42rem` / `46rem`** before) via **`minmax(0,1fr)`** on the second track.
- **Code / repo:** `apps/web/src/components/marketing/HeroProductMock.tsx`, `apps/web/src/app/page.tsx`.

### 2026-05-03 — Marketing hero: removed SYNCED / EXPORT floating chips

- **What we did:** Removed the decorative **SYNCED** and **EXPORT** labels beside the hero window mock; dropped unused **`home-chip-*`** keyframes and animation classes from **`globals.css`**.
- **Code / repo:** `apps/web/src/components/marketing/HeroProductMock.tsx`, `apps/web/src/app/globals.css`.

### 2026-05-03 — Workspace main: tighter page gutters

- **What we did:** Reduced **`WorkspaceShell`** `<main>` horizontal padding (**`px-3 sm:px-4 lg:px-5`**) and top padding (**`pt-3 sm:pt-4`**, bottom stays **`pb-6`**). Same on **`app`** entry **`AddWorkspacePanel`** main. **`AppHeader`** inner row matches horizontal padding.
- **Code / repo:** `apps/web/src/components/app/WorkspaceShell.tsx`, `apps/web/src/app/(authenticated)/app/page.tsx`, `apps/web/src/components/app/AppHeader.tsx`.

### 2026-05-03 — Tighter dashboard + work/kanban card spacing

- **Context:** Dashboard panels and kanban/list task cards felt too airy; horizontal gaps (e.g. work header grid, kanban columns, pipeline stats row) read larger than vertical rhythm.
- **What we did:** Reduced padding/gaps on **`DashboardOverview`** KPI tiles and panels; **`dashboard/page`** vertical stack + activity card. **`WorkBoardStatsCard`** and main work **`lg` grid**: smaller horizontal gaps, slightly larger row gap for balance. **`KanbanBoard`**: narrower column gap, tighter column chrome and card stack; **`TaskCard`** / **`ListTaskCard`** inner padding and section spacing; **`TaskCardLastActivity`** compact footer padding.
- **Dashboard (wider + denser KPIs):** **`max-w-[min(100%,104rem)]`**, **`text-3xl`** page title, KPI **`text-4xl`** with **`p-3.5`** panels; segmented bars **`h-2`**; slightly taller KPI wave SVG. Removed bottom **Go to Work / Team** buttons; section stack **`space-y-3`**; card grids use **`gap-x-4 gap-y-3`**. **Hero band:** KPIs **`lg`** **`2×2`** grid left; **Needs attention** narrow **`lg:col-start-3`** **`row-span-2`**, links **`lg:flex-col`** full-width. KPI 1 **Pending work** (`pending` + **`assigned`**) → **`?status=pending_work`**; KPI 2 **Active work** (**`in_progress` + `late`**) → **`?status=active_work`** (**`normalizedStatusMatchesUrlFilter`**); KPI 4 **Workspace** — members + levels + lists.

### 2026-05-03 — Notifications: bell panel, toasts, web push

- **Context:** User wanted in-app notifications + mobile web push, a bell next to settings, a slide-over panel like the task panel, and toast alerts.
- **What we did:**
  - **Web:** **`WorkspaceNotificationsProvider`** polls **`GET /organizations/:id/activity`** every 45s, filters ledger rows to the current user (assignee / assignment-change logic in **`notification-eligibility`**), slide-over panel (**`createPortal`**, same chrome pattern as task panel). **`AppHeader`** bell + unread badge; **`sonner`** **`AppToaster`** in root layout. Service worker always registered; **`public/sw.js`** handles **`push`** + **`notificationclick`** (deep link uses absolute **`PUBLIC_WEB_ORIGIN`** from API).
  - **API:** **`push`** module — public **`GET /push/vapid-public-key`**, authenticated **`POST`/`DELETE /push/subscription`**; **`TasksService`** fires **`notifyLedgerActivity`** after **`taskMutationResult`** and **`appendLedger`** inserts (assignees except actor).
  - **DB:** **`push_subscriptions`** table + migration **`0009_push_subscriptions.sql`**.
- **Takeaway / follow-ups:** Run DB migrate for **`0009`**. Configure **`WEB_PUSH_VAPID_PUBLIC_KEY`**, **`WEB_PUSH_VAPID_PRIVATE_KEY`**, **`WEB_PUSH_CONTACT`** (e.g. **`mailto:`…**), and **`PUBLIC_WEB_ORIGIN`** (canonical browser origin for notification URLs). Generate keys: **`npx web-push generate-vapid-keys`**. Push delivery depends on browser/OS background behavior for PWAs.
- **Code / repo:** `apps/web/src/components/notifications/WorkspaceNotificationsProvider.tsx`, `AppHeader.tsx`, `WorkspaceShell.tsx`, `AppToaster.tsx`, `ServiceWorkerRegister.tsx`, `public/sw.js`, `web-push-client.ts`, `notification-eligibility.ts`, `useOrgActivityFeed.ts`; `apps/api/src/push/*`, `tasks.service.ts`, `tasks.module.ts`; `packages/db/src/schema.ts`, `drizzle/0009_push_subscriptions.sql`.

### 2026-05-03 — Kanban: removed workflow / drag intro paragraph

- **What we did:** Deleted the muted intro paragraph above the board (**`KanbanBoard`**); column header cards remain the primary labels.
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — Kanban column header cards (status labels)

- **Context:** Kanban columns had no visible titles beyond intro copy and **`aria-label`** on regions.
- **What we did:** **`KanbanBoard`**: above each column’s task list, compact header card with **`FLOW_COLUMN_LABELS`** + task count; styling uses **`statusPillPaletteClasses(col)`** + border/shadow for consistency with status pills.
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — Kanban drag matches list stage rules (next + Cancelled)

- **Context:** Stage menus already use **`stageControlDropdownOptions`**; kanban drag still allowed backward moves (e.g. Done → In progress).
- **What we did:** **`kanbanAllowedManualTransitions`** delegates to **`stageControlDropdownOptions`** so **`kanbanTransitionAllowedFromStored`** matches list/kanban menus. Kanban intro copy + invalid-drop message updated.
- **Code / repo:** `apps/web/src/lib/task-board.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — Kanban: top cards no longer clip on hover lift

- **Context:** Kanban task cards use **`hover:-translate-y-px`**; the column list is **`overflow-y-auto`**, so the first card’s upward motion was clipped at the scrollport top (and visually against content above the column).
- **What we did:** Kanban column **`ul`**: added **`py-1`** so the scroll area has vertical padding and hover translate stays inside the visible region.
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx` (**`KanbanBoard`** column list).

### 2026-05-03 — Dropdowns: opaque menus (no frosted “light through”)

- **Context:** User disliked bright bleed-through on opened dropdowns.
- **What we did:** **`AppHeader`** account menu: removed **`supports-[backdrop-filter]:backdrop-blur-md`** and translucent **`color-mix`** surface override — menu stays **`bg-[var(--surface-elevated)]`**. Shadow is **`shadow-lg shadow-black/10`** (`dark:shadow-black/40`) instead of a large soft **`color-mix`** glow. **`WorkspaceSidebar`** workspace switcher panel: same shadow swap for consistency.
- **Code / repo:** `apps/web/src/components/app/AppHeader.tsx`, `WorkspaceSidebar.tsx`.

### 2026-05-03 — Fix: task panel clipped (`ui-page-enter` + `fixed`)

- **Context:** Create/edit task panel uses **`position: fixed`**; it appeared clipped after route-enter animation on **`[workspaceId]`** pages.
- **What we did:** **`ui-page-enter`** keyframes use **opacity only** (no **`transform`**). Non-**`none`** **`transform`** on an ancestor creates a new containing block for **`fixed`** descendants, so the panel was positioned inside **`overflow-hidden`** workspace **`main`** instead of the viewport. **`ui-auth-card-enter`** / **`ui-dropdown-pop`** end state **`transform: none`** (same pitfall for identity transforms). Later: task create/edit overlay **`createPortal(..., document.body)`** with **`z-[60]`** (above **`AppHeader`** **`z-40`** / account **`z-50`**, below status dropdown **`80`** and due popovers **`z-[100]`**).
- **Code / repo:** `apps/web/src/app/globals.css`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — Authenticated UI: motion without ambient backdrop

- **Context:** Extend marketing-style motion (enter transitions, micro-interactions) across app chrome and key surfaces; user opted **out** of animated ambient backdrop layers.
- **What we did:** **`(authenticated)/[workspaceId]/template.tsx`** and **`app/template.tsx`**: **`ui-page-enter`** on route changes. **`AppHeader`**: translucent **`backdrop-blur`** where supported, **`active:scale`** on icon/profile, account menu **`ui-dropdown-pop`** + shadow. **`WorkspaceSidebar`** / **`AppEntryAccountSidebar`**: **`ui-sidebar-chrome`**, smoother nav rows, workspace switcher **`origin-top-left`** dropdown pop. **`globals.css`**: **`ui-*`** enter/pop/chrome/panel classes; **`dashboard-kpi-card`** + **`ui-elevated-panel`** hover lift; **`prefers-reduced-motion`** disables enter pops and hover lifts. **`DashboardOverview`**: **`ui-elevated-panel`** on major panels. **`LoginForm`**: static radial wash (no motion) + **`ui-auth-card-enter`** on card. Removed **`AppAmbientBackdrop`** and all **`ui-ambient-*`** CSS.
- **Follow-up:** Dense views (**`/work`**) can adopt lighter transitions if desired.
- **Code / repo:** `WorkspaceShell.tsx`, `AppHeader.tsx`, `WorkspaceSidebar.tsx`, `AppEntryAccountSidebar.tsx`, `apps/web/src/app/login/LoginForm.tsx`, `apps/web/src/app/(authenticated)/app/page.tsx`, `apps/web/src/app/(authenticated)/app/template.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/template.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/components/dashboard/DashboardOverview.tsx`.

### 2026-05-03 — Marketing home: motion + layered backdrop

- **Context:** Redesign public landing (`/`) with animations and moving elements while keeping existing copy and structure.
- **What we did:** **`MarketingBackground`**: drifting blurred blobs, panning grid, small orbiting dots, breathing gradient wash. **`HeroProductMock`**: floating mock window, traffic-light pulse, shimmer skeleton bars, checkbox glow, live dot, floating SYNCED/EXPORT chips. **`Reveal`** (client): intersection-based fade-up for nav, trust strip, capability/how/CTA/footer; staggered delays on cards. Hero: 3D/blur word stagger on title lines; fade-up chain on badge, body, CTAs. Trust strip: animated gradient border (mask). Section cards: hover lift + shadow. **`globals.css`**: marketing keyframes + **`prefers-reduced-motion`** disables motion and shows static content. No new npm deps.
- **Code / repo:** `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/components/marketing/MarketingBackground.tsx`, `HeroProductMock.tsx`, `Reveal.tsx`.

### 2026-05-03 — Sidebar: rename levels/lists (owners only)

- **Context:** Rename existed on API (**`PATCH`** departments / lists) but not in UI; controls should appear only for users allowed to call those endpoints (**workspace owners**).
- **What we did:** **`WorkspaceSidebar`**: derive **`canRenameOrgStructure`** from **`members`** (**`userId === session.user.id`** and **`role === "owner"`**). Owners see a pencil next to each level and list; click opens inline rename (Enter / blur commit, Escape cancel). **`PATCH`** merges updated **`Dept`** / **`ListRow`** into **`workspaceKeys.workspace`** cache (sorted by name). Non-owners see no rename affordances.
- **Follow-up:** Pencil uses **`group/level`** & **`group/list`** — **`opacity-0`** until row hover (**`group-hover/…:opacity-100`**) or **`focus-visible`** (keyboard); placed beside the name via split links (name · rename · count) so it doesn’t reserve a permanent column.
- **Code / repo:** `apps/web/src/components/app/WorkspaceSidebar.tsx`.

### 2026-05-03 — Sidebar: instant level/list rows after create

- **Context:** Creating a level or list felt slow: typed label vanished, then the row appeared only after a **full workspace refetch**.
- **What we did:** **`WorkspaceSidebar`** **`addLevel`** / **`addList`**: after POST, **`queryClient.setQueryData`** on **`workspaceKeys.workspace(workspaceId)`** merges the returned **`Dept`** / **`ListRow`** into the cached **`WorkspaceBundle`** (sorted by name). Removed **`await reload()`** so we don’t block on **`/workspace`**.
- **Code / repo:** `apps/web/src/components/app/WorkspaceSidebar.tsx`.

### 2026-05-03 — Sidebar + task panel: commit draft on blur (level, list, subtask)

- **Context:** Adding a level, list, or subtask required **Enter**; focusing away discarded sidebar drafts and felt broken.
- **What we did:** **`WorkspaceSidebar`**: **level** and **list** inputs **`onBlur`** — if trimmed text, **`void addLevel()`** / **`void addList(d.id)`**; if empty, cancel inline UI (same as before). Still **`return`** early when **`addingLevel`** / **`addingList`** so in-flight requests don’t get cancelled. **`work/page.tsx`**: **New task** and **Edit task** subtask draft inputs **`onBlur`** commit trimmed line to **`subtaskItems`** / **`editNewSubtasks`** (Enter unchanged).
- **Code / repo:** `apps/web/src/components/app/WorkspaceSidebar.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — Work board list: last activity in card footer (kanban parity)

- **Context:** User wanted list-view task rows to show **last activity** in the **card footer** like kanban cards, not under the title; then **title + level/list badges** on the **same row** as assignee / due / priority (not wrapping to a separate line).
- **What we did:** **`ListTaskCard`**: **`TaskCardLastActivity`** **`compact`** footer after subtasks expand block. Main row: status + checklist, chevron, then one **`flex-1 min-w-0`** segment with **truncating title** (**`flex-1`**), **badges**, and **`ml-auto`** chip group (assignee, due, priority, overflow) — **`items-center`**, no outer **`flex-wrap`** so the meta chips stay on the title row.
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — UI font: Inter → DM Sans (Google Fonts)

- **Context:** User chose **DM Sans** as the primary UI sans instead of Inter.
- **What we did:** **`layout.tsx`**: **`next/font/google`** **`DM_Sans`** with **`--font-dm-sans`** on **`body`**. **`globals.css`**: **`body`**, **`@theme --font-sans`**, and **`.font-outfit`** fallback now use **`var(--font-dm-sans)`** (replacing **`--font-inter`**). **`AppHeader`** brand **`Link`** uses **`font-outfit`** so **LogBase** matches sidebar/marketing **Outfit**, not DM Sans.
- **Code / repo:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/components/app/AppHeader.tsx`.

### 2026-05-03 — Workspace sidebar: smaller, bolder nav type + Outfit

- **Context:** User wanted sidebar labels **bold but smaller**, then **Outfit** for sidebar typography (aligned with marketing wordmark).
- **What we did:** **`WorkspaceSidebar`**: shared **`rowBase`** links use **`text-sm font-semibold`** (step up from **`text-xs`** for readability). Account + workspace titles **`text-sm font-bold`**. Level rows, counts, helpers, and add-list inputs match **`text-sm`**; Outfit via **`font-outfit`** on **`aside`**. Root **`layout`**: load **Outfit** as **`--font-outfit`** (weights 500–700). **`globals.css`**: **`.font-outfit`** utility; sidebar **`aside`** uses **`font-outfit`**.
- **Code / repo:** `apps/web/src/components/app/WorkspaceSidebar.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`.

### 2026-05-03 — Status pills: readable labels + stronger light tints

- **Context:** In **light app theme** with **dark OS preference**, Tailwind **`dark:text-white`** applied to pills while backgrounds stayed **`*/15`** → white-on-wash, illegible. User wanted light pills to feel like dark-theme tint strength.
- **What we did:** **`statusPillPaletteClasses`** (`task-board.ts`): label **`text-[var(--fg)]`** (cancelled **`text-[var(--muted)]`**); light **`bg-*-500/22`** (late **`/24`**) vs unchanged dark **`/15`** overlays.
- **Code / repo:** `apps/web/src/lib/task-board.ts`.

### 2026-05-03 — Web ESLint: fix FlatCompat crash, align with Next 16

- **Context:** `npx eslint` on a few files exited **2** with `TypeError: Converting circular structure to JSON` from `@eslint/eslintrc` / `FlatCompat` when extending Next configs.
- **What we did:** Replaced **`eslint.config.mjs`** with Next 16’s native flat config (`eslint/config` **`defineConfig`**, spreads from **`eslint-config-next/core-web-vitals`** + **`typescript`**, **`globalIgnores`**). Removed direct **`@eslint/eslintrc`** devDependency. **`lint`** script is **`eslint .`** ( **`next lint`** removed in Next 16 ). Turned off **`react-hooks/set-state-in-effect`** so existing effect + setState patterns don’t fail the build; **10** **`react-hooks/exhaustive-deps`** / **`no-img-element`** / **`jsx-a11y`** warnings remain (exit **0**).
- **Code / repo:** `apps/web/eslint.config.mjs`, `apps/web/package.json`, `package-lock.json`.

### 2026-05-03 — Dashboard overview: light-theme KPI stat tiles

- **Context:** User wanted the top dashboard metric cards to match a pastel mobile-style reference (colored tiles + soft hill/wave art), **light appearance only** — no layout/copy changes, **no global accent token edits**, **dark theme unchanged**.
- **What we did:** **`globals.css`**: **`.dashboard-kpi-card`** base uses **`var(--surface-elevated)`** + **`var(--border-subtle)`**; tone modifiers (**periwinkle / lavender / mint / amber**) and border tints apply only under **`html[data-theme="light"]`** or **`system` + `prefers-color-scheme: light`**. **`.dashboard-kpi-wave`** visible only in those same light contexts (hidden in dark). **`DashboardOverview.tsx`**: top grid of four stats wrapped in **`dashboard-kpi-card`** + tone class; **`DashboardKpiWave`** SVG (two layered paths) sits behind content (**`z-[1]`**); completed count still uses **`text-emerald-600 dark:text-emerald-400`**.
- **Code / repo:** `apps/web/src/app/globals.css`, `apps/web/src/components/dashboard/DashboardOverview.tsx`.

### 2026-05-03 — UI: flat surfaces (no elevation shadows)

- **Context:** User wanted shadows removed from the UI for a flatter look.
- **What we did:** Dropped **`--shadow-primary`** and all **`box-shadow`** on buttons, brand mark, glass primary, and **`.auth-card`**. Input focus uses **`outline`** on **`:focus-visible`** instead of a glow ring via **`box-shadow`**. Removed Tailwind **`shadow-*`** / arbitrary shadow utilities across landing, login, dashboard, work board, settings, popovers, and menus.
- **Takeaway / follow-ups:** **`focus-visible:ring-*`** (Tailwind) remains for keyboard focus on many controls; notification dot still uses **`ring-2`** as a halo—not drop shadows.
- **Code / repo:** `apps/web/src/app/globals.css`, `apps/web/src/app/page.tsx`, `apps/web/src/app/login/LoginForm.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/dashboard/page.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/people/page.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/settings/page.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/organization-settings/page.tsx`, `apps/web/src/components/dashboard/DashboardOverview.tsx`, `apps/web/src/components/app/AppHeader.tsx`, `apps/web/src/components/app/AddWorkspacePanel.tsx`, `apps/web/src/components/tasks/DueDateTimePopover.tsx`, `apps/web/src/components/tasks/DueRepeatPopover.tsx`, `apps/web/src/components/tasks/AssigneeSearchField.tsx`.

### 2026-05-03 — Late vs overdue: single concept in UI

- **Context:** User treats **Late** (stored status) as the only notion of “running late”; separate **Overdue** wording/filter was redundant.
- **What we did:** **`DatePreset`** renamed **`overdue` → `late`**; **`taskMatchesDatePreset(..., "late")`** matches **`normalizeTaskStatus(task.status) === "late"`** (not due-date-only). **`dueQueryToDatePreset`**: legacy **`due=overdue`** URLs still map to the Late preset. Work board preset label **Late**, URL **`due=late`**. Dashboard **Needs attention**: removed second chip; kept **`status=late`** link + count. Ledger **`status_change` → late**: copy uses **Late** pill (**`StatusInlineLabel`**).
- **Code / repo:** `apps/web/src/lib/task-board.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`, `apps/web/src/components/dashboard/DashboardOverview.tsx`, `apps/web/src/components/tasks/LedgerLineDescription.tsx`.

### 2026-05-03 — Activity log: natural-language ledger lines

- **Context:** Task history and dashboard activity used stilted copy (“marked In progress as Cancelled”).
- **What we did:** **`LedgerLineDescription`** maps **`status_change`** to short sentences (cancel, complete, overdue, started work, acknowledged + started, reopened, rollbacks with status pills where useful); **`assignee_change`** → “assigned this task to …” / “reassigned …”; **`ack`** → “acknowledged this assignment”; reschedule wording tweak. **`TaskPanelHistoryCard`** creation footer → “{creator} created this task · {id}”.
- **Code / repo:** `apps/web/src/components/tasks/LedgerLineDescription.tsx`, `apps/web/src/components/tasks/TaskPanelHistoryCard.tsx`.

### 2026-05-03 — Recurring tasks model B (spawn next row on done)

- **Context:** Implement recurrence by **inserting a new task** when a repeating task is marked **done** (not roll-forward on one row).
- **What we did:** Migration **`0008_task_recurrence_series.sql`**: **`tasks.recurring_series_id`**, **`tasks.spawned_from_task_id`** (self-FK in SQL only; Drizzle column has no `.references` to avoid circular TS), partial **unique** on **`spawned_from_task_id`** (one child per parent), index on **`recurring_series_id`**, backfill **`recurring_series_id = id`** where **`due_repeat`** set. **`compute-next-due.ts`**: daily / weekly / **`addMonthsPreserveDay`** for monthly & yearly. **`TasksService.create`**: sets **`recurring_series_id`** to new task id when **`dueRepeat`** + **`dueAt`**. **`patchTask`**: when transitioning to **`done`**, if prior **`dueAt`** + valid **`due_repeat`** and due not cleared in same PATCH, and no row exists with **`spawned_from_task_id`** = this task, inserts sibling task (same list/title/priority/assignees/`due_repeat`, **`due_at`** = next instant, **`recurring_series_id`** carried, **`spawned_from_task_id`** set); ledgers: child **Task created.** + optional assignee_change; parent note **Next occurrence created.** Returns **`spawnedRecurringTaskId`** on **`TaskMutationResult`**. Web **`patchTaskMutation`** + **`saveEditTask`**: **`invalidateQueries`** **`workspace`** when that id present so the new card loads (with **`lastLedger`**). **`ledger-types`**: **`TaskRow.recurringSeriesId`**, **`spawnedFromTaskId`**. Contracts comment updated.
- **Takeaway / follow-ups:** Re-marking **done** after reopening does **not** spawn again (unique child per parent). No cron yet (completion-driven only). UI grouping by **`recurring_series_id`** still optional. Run **`npm run db:migrate`** (or repo migrate pipeline) before deploy.
- **Code / repo:** `packages/db/drizzle/0008_task_recurrence_series.sql`, `packages/db/src/schema.ts`, `apps/api/src/tasks/compute-next-due.ts`, `apps/api/src/tasks/tasks.service.ts`, `packages/contracts/src/index.ts`, `apps/web/src/lib/ledger-types.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — Work board: last activity on list + kanban cards

- **Context:** User wanted the newest ledger line shown at the bottom of each task card (list + kanban) to orient dense boards and future recurring-task rows.
- **What we did:** **`AuthorizationService`** batches **`lastLedger`** per task via **`activity_ledger`** (**`MAX(created_at)`** join). **`TasksService.taskMutationResult`** attaches **`lastLedger`** to **`task`** so mutations keep the footer fresh. **`TaskRow.lastLedger`** in **`ledger-types`**. **`TaskCardLastActivity`** uses **`formatLogTimestamp`** + **`LedgerLineDescription`**; list + kanban cards use **`compact`** + **`variant="footer"`** (border-top footer). Wired on **`work/page.tsx`** **`ListTaskCard`** + **`TaskCard`**.
- **Code / repo:** `apps/api/src/authorization/authorization.service.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/web/src/lib/ledger-types.ts`, `apps/web/src/components/tasks/TaskCardLastActivity.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — Workspace chrome: viewport-locked shell + sidebar scroll

- **Context:** Sidebar scrolled with the page; user wanted it fixed with its own (hidden) scrollbar.
- **What we did:** **`WorkspaceShell`** uses **`h-[100dvh] max-h-[100dvh] overflow-hidden`** so the document doesn’t grow; the header + sidebar + **`main`** row is **`flex-1 min-h-0 overflow-hidden`**; **`main`** is **`overflow-y-auto overscroll-contain`**. **`WorkspaceSidebar`**: **`md:h-full`** (fills row under header), removed **`nav`** **`overflow-hidden`** so workspace picker isn’t clipped; tree section **`scrollbar-hide overflow-y-auto overscroll-contain`**; mobile cap **`max-h-[min(70dvh,28rem)]`**.
- **Code / repo:** `apps/web/src/components/app/WorkspaceShell.tsx`, `apps/web/src/components/app/WorkspaceSidebar.tsx`.

### 2026-05-03 — Dashboard overview: richer widgets + Work drill-down URLs

- **Context:** Follow-up to UX audit—implement overview infographics and honest KPIs; keep activity log as-is.
- **What we did:** New **`DashboardOverview`**: KPIs (**levels**, **active work** = pipeline excluding done/cancelled, **completed**, **team**); **Needs attention** chips (late status, overdue by date, due this week, unassigned, my tasks); **Status mix** + **Priority** segmented bars + legends; **Checklist progress** when subtasks exist; **Active work by level** + **Assignee load** bar rows—all linking to **`/work`** with query params. Empty workspace state when no levels/lists/tasks. Dashboard subtitle is user-facing. **`task-board`**: **`isDatePreset`**, **`parseUrlStatusFilter`**. **`work/page.tsx`**: effect migrates **`level`/`list`** to scope + strips; strips **`task`** after open; **`due`**, **`status`**, **`mine`**, **`unassigned`**, **`assignee`** stay in the URL (shareable); second effect syncs **`datePreset`** + assignee/status filter state from **`searchParams`**; **`replaceWorkQuery`** keeps the due preset select and **Clear** actions aligned with the URL; **`filteredTasks`** applies synced filters; **“Dashboard filter”** banner reads **`searchParams`**.
- **Takeaway / follow-ups:** Invalid **`status=`** still shows the raw query in the banner while filters ignore it; optional strip. Chart library still unnecessary.
- **Code / repo:** `apps/web/src/components/dashboard/DashboardOverview.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/dashboard/page.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`, `apps/web/src/lib/task-board.ts`.

### 2026-05-03 — Task stage menu: forward + cancel only; themed listbox

- **Context:** Board/list status pill exposed every adjacent workflow transition like the checklist; user wanted only **next** stage plus **Cancelled** anytime (except cancelled → reopen pending).
- **What we did:** **`stageControlDropdownOptions`** in **`task-board.ts`** builds menu targets; **`KanbanStatusPill`** uses it instead of **`kanbanAllowedTransitionsFromStored`**. **`StatusPillSelect`** replaced invisible native **`<select>`** with a button + themed **`role="listbox"`** panel (**`createPortal`** to **`document.body`** + fixed position so list/kanban **`overflow-hidden`** cards don’t clip it). Drag-and-drop still uses **`kanbanTransitionAllowedFromStored`** (one step forward or back). Kanban intro copy updated to distinguish drag vs stage menu.
- **Takeaway / follow-ups:** Edit/create task panels still use full **`TASK_FLOW_ORDER`** in **`StatusPillSelect`** for unrestricted status picks before save.
- **Code / repo:** `apps/web/src/lib/task-board.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-03 — React Query persist: don’t freeze “Failed to fetch” in localStorage

- **Context:** Prod workspace error persisted after env/CORS fixes; suspected cache.
- **What we did:** **`PersistQueryClientProvider`** only dehydrated **`organizations`** / **`workspace`** queries without checking **`query.state.status`**, so a **failed** query (e.g. network/CORS **`Failed to fetch`**) could be **written to `localStorage`** and rehydrated for up to **`maxAge`** (24h), masking a fixed backend. **`shouldDehydrateQuery`** now requires **`status === "success"`**. Bumped **`QUERY_CACHE_VERSION`** to **`6`** so existing persisted blobs use a new key prefix. **`ServiceWorkerRegister`** uses **`register(..., { updateViaCache: "none" })`** so **`sw.js`** isn’t stuck on an HTTP-cached copy.
- **Takeaway / follow-ups:** Users who already have a bad persist can also clear site data or keys matching **`wl_rq_*`**. SW is still pass-through-only (no Cache API for API routes).
- **Code / repo:** `apps/web/src/components/app/QueryProvider.tsx`, `apps/web/src/lib/query-cache-version.ts`, `apps/web/src/components/app/ServiceWorkerRegister.tsx`.

### 2026-05-03 — Prod “Failed to fetch” on workspace: CORS / env mismatch analysis

- **Context:** Production showed **Failed to fetch** around workspace UI; test OK; DB and API processes healthy.
- **What we did:** Confirmed workspace shell calls **`GET …/organizations/:id/workspace`** via **`apiFetch`** (`NEXT_PUBLIC_API_URL`). That error string is a **browser network/CORS/mixed-content** failure, not Nest throwing — **`401` JWT misalignment would still return HTTP** with a body. API CORS previously allowed only **one** string origin (**`NEXT_PUBLIC_APP_URL`**) plus localhost/Expo; Better Auth on web already supports multiple origins (custom domain, **`x-forwarded-host`**, **`*.vercel.app`**), so prod users on a **different origin** than the API’s single allowed URL get a **silent CORS block**. Added optional **`API_CORS_ORIGINS`** (comma-separated) in **`apps/api/src/main.ts`**; docs updated in **`Topics/Infrastructure/apps-api.md`** and **`auth-jwt-and-env.md`**.
- **Takeaway / follow-ups:** On Vercel, set **`API_CORS_ORIGINS`** to every real web origin (e.g. `https://log-base.vercel.app,https://your-custom-domain.com`) **or** ensure **`NEXT_PUBLIC_APP_URL` on the API** equals the origin users actually open. Verify **`NEXT_PUBLIC_API_URL`** was present at **web build** time (HTTPS, correct API host). Use DevTools → Network: failed request shows **(blocked:cors)** or **mixed content**. **Migration lag** usually yields **`500`** + PG/Drizzle errors in API logs, not the browser’s generic **`Failed to fetch`** (that implies no normal HTTP response to the client).
- **Code / repo:** `apps/api/src/main.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/hooks/useOrgWorkspace.ts`.

### 2026-05-02 — Instant-feeling tasks: slim mutation payloads + optimistic UI

- **Context:** Board actions (status, subtasks, create/save) felt slow; prior **`PATCH`/`POST`** returned **`getDetail`** (full ledger + DB load). Client blocked controls during mutations and used sequential subtask **`POST`**s after create/save; kanban prefetched **`GET …/subtasks`** per card though workspace bootstrap already batches subtasks.
- **What we did:** **Contracts** — **`initialSubtasks`** on **`createTaskSchema`**, **`subtasksToCreate`** on **`patchTaskSchema`** (max **`MAX_SUBTASKS_PER_TASK_MUTATION`** = 100). **API** — **`TasksService.taskMutationResult`** (automation + assignees + subtasks + caps + **`ledgerDelta`** only); **`create`** / **`patchTask`** use transactions with bulk subtask inserts and **`.returning()`** on ledger rows; **`reschedule`** / **`archive`** return the same slim shape. **Web** — **`TaskMutationResult`** in **`ledger-types`**; **`patchTaskMutation`** / **`patchSubtaskMutation`** merge **`workspace`** + **`taskKeys.detail`** (prepend **`ledgerDelta`**); removed **`updatingTaskId`** / **`subtaskUpdatingId`** disables; **create** / **save** send bundled subtasks and **`setQueryData`** instead of **`invalidateQueries`**; dropped kanban N+1 prefetch **`useEffect`**; list expand uses **`task.subtasks ?? []`** only.
- **Takeaway / follow-ups:** **`GET /tasks/:id`** unchanged for full history. Any client expecting **`TaskDetail`** from **`POST …/tasks`** or **`PATCH /tasks/:id`** must switch to **`TaskMutationResult`**. Non-web callers of **`POST …/reschedule`** or **`POST …/archive`** now get the slim payload too.
- **Code / repo:** `packages/contracts/src/index.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/web/src/lib/ledger-types.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.
- **Vault:** Architecture captured for cross-app work in **`Topics/Infrastructure/task-write-contracts-and-cache.md`**; hub notes **`00-map-overview`**, **`apps-api`**, **`apps-web`**, and **`Topics/README`** updated with links.

### 2026-05-02 — App header: logo stays in authenticated app

- **Context:** Logo/name in **`AppHeader`** linked to marketing **`/`**, which drops users out of workspace context.
- **What we did:** **`brandHref`** — with **`workspaceSlug`** → **`/${workspaceSlug}/dashboard`**; otherwise **`/app`** (entry / redirect to last workspace). **`AppHeader`** only mounts in authenticated chrome.
- **Takeaway / follow-ups:** Login/marketing pages keep their own links to **`/`**.
- **Code / repo:** `apps/web/src/components/app/AppHeader.tsx`.

### 2026-05-02 — Dashboard: org-wide activity log (terminal-style)

- **Context:** User wanted the same monospace task-history style on the dashboard for the whole workspace.
- **What we did:** **`GET /organizations/:organizationId/activity`** — ledger for tasks visible to the caller (same as **`TasksService.list`**), **`taskId`** on each row, **`tasksById`** for titles, optional **`limit`** (default 150, max 500). Dashboard toggle **Overview** / **Activity log**; **`OrgActivityTerminal`** uses **`task-activity-log.ts`** (shared with **`TaskPanelHistoryCard`**). **`useOrgActivityFeed`**, **`workspaceKeys.activity`**.
- **Takeaway / follow-ups:** Heavy orgs may want pagination; endpoint runs **`tasks.list`** (includes automated status sync) before querying **`activity_ledger`**.
- **Code / repo:** `apps/api/src/organizations/organizations.controller.ts`, `organizations.service.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/dashboard/page.tsx`, `apps/web/src/components/dashboard/OrgActivityTerminal.tsx`, `apps/web/src/hooks/useOrgActivityFeed.ts`, `apps/web/src/lib/task-activity-log.ts`, `apps/web/src/lib/query-keys.ts`, `apps/web/src/lib/ledger-types.ts`.

### 2026-05-02 — Managers: multiple levels (departments)

- **Context:** Managers were limited to a single `departmentId` on `organization_members`; product wanted multiple levels per manager.
- **What we did:** Junction table **`organization_member_managed_departments`** (`packages/db` schema + migration **`0007_manager_managed_departments.sql`**) with backfill from existing manager rows. **`AuthorizationService`** resolves managed levels from the junction (fallback to legacy column). **`POST /organizations/:id/members`** accepts **`departmentIds`** (preferred) or legacy **`departmentId`**; syncs junction and keeps **`organization_members.department_id`** as the first level for compatibility. Member list / bootstrap returns **`managedDepartmentIds`** plus **`departmentId`** (first). **People** UI uses checkboxes for multi-level selection. PG FK constraint names in the migration are short (**`ommd_*`**) to avoid 63-char truncation collisions.
- **Takeaway / follow-ups:** Run **`npm run db:migrate`**. Old API clients sending only **`departmentId`** still work. See [[Topics/Domain/domain-authorization-and-tasks]].
- **Code / repo:** `packages/db/src/schema.ts`, `packages/db/drizzle/0007_manager_managed_departments.sql`, `packages/contracts/src/index.ts`, `apps/api/src/authorization/authorization.service.ts`, `apps/api/src/organizations/organizations.service.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/people/page.tsx`, `apps/web/src/lib/ledger-types.ts`.

### 2026-05-02 — Task panel: History card + assignee ledger

- **Context:** User wanted an info card at the bottom of the edit task panel showing who created the task, assignment changes, and status changes.
- **What we did:** **`TaskPanelHistoryCard`** (`apps/web/src/components/tasks/TaskPanelHistoryCard.tsx`) renders below Save/Cancel on the work board task panel: **Created** line (`assignerId` + `createdAt`), then ledger rows in chronological order (**status_change**, **assignee_change**, **reschedule**, notes, etc.); skips duplicate **Task created.** note. **API** — new ledger type **`assignee_change`** (`packages/db` enum + **`packages/contracts`**); **`TasksService.create`** logs assignees when present; **`patchTask`** logs assignee updates only when the assignee set actually changes. Migration **`0006_ledger_assignee_change.sql`**. **`TaskRow`** optional **`createdAt`** / **`updatedAt`** for typing.
- **Takeaway / follow-ups:** Run **`npm run db:migrate`** so Postgres accepts **`assignee_change`**. Older tasks have no assignee history until the next assignee edit.
- **Code / repo:** `apps/web/src/components/tasks/TaskPanelHistoryCard.tsx`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`, `apps/api/src/tasks/tasks.service.ts`, `packages/db/src/schema.ts`, `packages/db/drizzle/0006_ledger_assignee_change.sql`, `packages/contracts/src/index.ts`, `apps/web/src/lib/ledger-types.ts`.

### 2026-05-02 — Kanban task cards: visual hierarchy + affordances

- **Context:** User wanted better card UI/UX on the work board Kanban; validated in-browser via Chrome DevTools MCP on local **`/work`** (Kanban view).
- **What we did:** **`TaskCard`** in **`work/page.tsx`** — removed heavy header/footer split; **title + overflow** on one row (overflow visible but muted, full opacity on hover/focus for touch); **stage + priority** on their own row under scope badges (**priority tile matches list rows**: `LIST_ROW_BADGE_TILE` + short label, same **`h-8`** as status pill); **due + assignee** grouped in a lighter footer strip (assignee uses **initial avatar** + name, dashed “Assign” empty state); **subtasks** renamed from all-caps “Checklist” to **Subtasks (count)** with icon and inset panel on **`surface-base`**; card uses subtle **lift + shadow** on hover for drag targets. *(Follow-up: dropped left priority accent stripe; kanban priority chrome unified with list.)*
- **Takeaway / follow-ups:** Column headers are still region-only (no visible titles in the column chrome); add if boards feel unclear without the pipeline explainer line.
- **Code / repo:** `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx` (`TaskCard`).

### 2026-05-02 — Task workflow: manual stages vs automated Assigned / Late

- **Context:** User wanted the visible flow to be **Pending → In progress → Done** with **Cancelled** anytime; **Assigned** and **Late** should be **automatic** from assignees and due date, not kanban columns.
- **What we did:** **API** — `computeAutomatedTaskStatus` in `apps/api/src/tasks/task-status-automation.ts`: pre-start bucket syncs **pending ↔ assigned** from assignee count; active bucket (**in_progress** / **late**) syncs **late** when `dueAt` is in the past; terminal **done** / **cancelled** unchanged; **late** clears to **in_progress** when no longer overdue. Runs after task **get**, on org **task list** (batch DB updates), and relies on **getDetail** after **PATCH** / **create**. **Contracts** — create / PATCH / `POST …/status` accept only **manual** statuses (`pending`, `in_progress`, `done`, `cancelled`; `open` → `pending`). **Web** — kanban columns use **`TASK_FLOW_ORDER`**; stats aggregate by **flow column** (assigned/late roll up); cards show **“Assigned”** / **“Late”** only for those automated statuses via **`taskStatusDisplayLabel`**.
- **Takeaway / follow-ups:** Clearing **late** always returns **in_progress** (no extra DB field for “was pre-start overdue”). If that edge matters, add persistence later. See [[Topics/Domain/domain-authorization-and-tasks]].
- **Code / repo:** `apps/api/src/tasks/task-status-automation.ts`, `apps/api/src/tasks/tasks.service.ts`, `packages/contracts/src/index.ts`, `apps/web/src/lib/task-board.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`.

### 2026-05-02 — Workspace bootstrap includes subtasks (board N+1 fix)

- **Context:** Subtasks were slow in testing and missing or flaky in production; new subtasks could “vanish” on the board after save.
- **What we did:** **`workspaceBootstrap`** now loads tasks with **`includeSubtasks: true`** so the API runs one batched **`attachSubtasks`** query instead of the web client firing **`GET /tasks/:id/subtasks`** per visible task (kanban prefetch storm). **`work/page.tsx`** sync from **`filteredTasks`** overwrites **`subtasksByTaskId`** when the workspace task carries **`subtasks`** (same-array ref check) so refetches after create/edit are not stuck behind stale lazy-loaded state.
- **Takeaway / follow-ups:** If production still shows no subtasks, verify **`subtasks`** table exists (**`0001_lists_subtasks.sql`** / migrate) and API deploy matches this code. CORS / **`NEXT_PUBLIC_API_URL`** issues would affect all endpoints, not only subtasks. Bumped **`QUERY_CACHE_VERSION`** to **`5`** so persisted workspace entries refetch and pick up **`subtasks`** on the task rows without waiting for **`staleTime`**.
- **Code / repo:** `apps/api/src/organizations/organizations.service.ts`, `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`, `apps/web/src/lib/query-cache-version.ts`.

### 2026-05-01 — Login copy: brand-heavy “your base”

- **Context:** User wanted auth clearly **on-brand** (“login to your base,” etc.); earlier split layout was dropped for a **single centered card**.
- **What we did:** **`LoginForm`** — **Outfit** for headline + emphasis; **marketing** mark + bold **LogBase** wordmark; eyebrow **Your base for accountable work**; titles **Log in to / Start** + accent line **your base**; supporting copy about trail/workspace; CTAs **Enter your base** / **Create your base**; loading **Opening your base…** / **Building your base…**; flip **No base yet? Start one free** / **Already have a base? Log in**; mono tagline **Organize · Track · Execute**; soft radial backdrop (marketing-adjacent). **`login/layout.tsx`** title **Your base · LogBase** + matching description.
- **Code / repo:** `apps/web/src/app/login/LoginForm.tsx`, `layout.tsx`, `page.tsx`.

### 2026-05-01 — Marketing home: wide-screen layout

- **Context:** Landing page felt narrow / empty on large monitors (`max-w-6xl`, hero `max-w-3xl`, capped grids).
- **What we did:** Shell **`max-w-7xl`** (lg) and **`2xl:max-w-[88rem]`** + horizontal padding; **xl+ two-column hero** with abstract “workspace / audit trail” preview card; trust strip and **How it works** row use full content width; slightly larger section copy and card padding at **xl/2xl**; closing CTA **lg+** row layout (copy vs actions).
- **Code / repo:** `apps/web/src/app/page.tsx`.

### 2026-05-01 — Installable web app (minimal PWA: standalone window)

- **Context:** User wanted the YouTube Music–style experience: same app in its own window, no offline/caching features.
- **What we did:** **`src/app/manifest.ts`** (LogBase, **`display: standalone`**, **`start_url` `/`**, theme **`#27272a`**, bg **`#fafafa`**). **`public/sw.js`** — installability-only SW; **`fetch`** skips branding paths (icons, **`manifest.webmanifest`**). **`ServiceWorkerRegister`** (production only). **`public/favicon.ico`** via **`scripts/build-favicon.mjs`** (**`prebuild`**). **`getPublicSiteOrigin()`** in **`lib/public-site-url.ts`** (**`NEXT_PUBLIC_APP_URL`** → **`VERCEL_URL`** → localhost): **`metadataBase`** in **`layout.tsx`**, manifest **`id`**, **absolute `icons[].src` URLs**, **`msapplication-TileImage`** — Edge/Windows shell often drew blank/placeholder tiles when icons stayed relative without a stable public origin at build time. **Icons source:** **`gen-pwa-icons.ps1`** writes **`public/icons/logbase-app-*.png`** from **`public/Logos/logbase-dark.png`**; **`favicon.ico`** from **`logbase-app-256.png`**.
- **How to verify:** Production serve (**`next build`**, **`next start`**) over HTTPS or localhost; Chromium → Install LogBase.
- **Code / repo:** `apps/web/src/app/manifest.ts`, `apps/web/public/sw.js`, `apps/web/public/favicon.ico`, `apps/web/public/icons/logbase-app-*.png`, `apps/web/src/app/icon.png`, `apps/web/scripts/build-favicon.mjs`, `apps/web/scripts/gen-pwa-icons.ps1`, `apps/web/src/components/app/ServiceWorkerRegister.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/lib/public-site-url.ts`. Legacy **`Logo-main` / `Logo-black` / `Logo-white`** and unused **`public/*.svg`** removed; install icons moved off **`/pwa-*.png`** to **`/icons/logbase-app-*.png`** so caches pick up current dark mark.

### 2026-05-01 — Workspace URLs: `/<workspaceId>/…` (standard shape)

- **Context:** User wanted simpler, conventional URLs instead of **`/app/w/<uuid>/dashboard`**.
- **What we did:** Moved workspace routes from **`src/app/app/w/[workspaceId]`** into **`src/app/(authenticated)/[workspaceId]`** so URLs are **`/<org-id>/dashboard`**, **`/work`**, **`/settings`**, etc., while **`/app`** and **`/app/workspaces`** stay under the same authenticated layout. **`next.config.mjs`** permanent redirects **`/app/w/:id/:path*`** → **`/:id/:path*`** (and **`.../add-organization`** → **`.../add-workspace`**). **`middleware.ts`** legacy **`/app/orgs`** targets updated to **`/:id/...`**. **`safe-return-path`** allows UUID-first paths and normalizes old **`/app/w/...`** for **`login?next=`**.
- **Follow-up (same thread):** **`organizations.slug`** (DB migration **`0005_organization_slug`**, unique) + API slug on create; web resolves first path segment by **slug or legacy uuid**, **301 client replace** to canonical slug. Work board **level/list** removed from query string → **`work-board-scope`** sessionStorage + sidebar **`WORK_BOARD_SCOPE_EVENT`**. Task deep link still uses **`?task=`** then strips.
- **Incident fix:** Without migration / persisted RQ cache missing **`slug`**, **`/app`** could **`replace('/undefined/dashboard')`** and **`WorkspaceShell`** UUID→slug redirect used **`resolved.slug`** bare → loop with **`/app`**. Fixed: **`workspaceUrlSegment(org)`** (**`slug ?? id`**), canonical redirect only when **`resolved.slug`** set, reject path segment **`undefined`**, bump **`QUERY_CACHE_VERSION`** to **`4`**. Run **`npm run db:migrate`** on every env that deploys slug code.
- **Work board:** Persist effect was writing create-task **`listId`** (defaults to first list in level) into **`work-board-scope`** when **`selectedList`** was null, so level-wide view kept snapping to one list. Persist now follows **`selectedLevel` / `selectedList`** only (`apps/web/.../work/page.tsx`).
- **Code / repo:** `apps/web/src/app/(authenticated)/`, `middleware.ts`, `next.config.mjs`, `safe-return-path.ts`, `workspace-url.ts`, `work-board-scope.ts`, `WorkspaceShell.tsx`, `packages/db` schema + **`0005_organization_slug.sql`**; topic **`[[apps-web]]`**.

### 2026-05-01 — Perf follow-ups: persisted queries, auth timing logs, lean bootstrap tasks

- **Context:** Complete remaining items after the first perf pass.
- **What we did:**
  - **Persisted React Query:** **`@tanstack/react-query-persist-client`** + **`@tanstack/query-sync-storage-persister`**; **`QueryProvider`** wraps **`PersistQueryClientProvider`** with **`localStorage`** key **`wl_rq_${QUERY_CACHE_VERSION}_${userId|guest}`**, **`Fragment` key** per user, **`QUERY_CACHE_VERSION`** in **`lib/query-cache-version.ts`** (bump **`3`** when cache breaks). Dehydrates **`organizations`** + **`workspace`** only when logged in. **`QueryAuthListeners`** drops those caches on **`wl:auth-expired`**; **`apiJson`** dispatches that event on **401**.
  - **Auth timing:** **`apps/web/src/app/api/auth/[...all]/route.ts`** wraps Better Auth handler; logs **`get-session`**, **`token`**, **`sign-in`** when **`AUTH_TIMING_LOG`** unset in dev, **`AUTH_TIMING_LOG=1`** in prod, **`0`**/`false` to silence (**`auth-api-timing.ts`**).
  - **Bootstrap tasks + subtasks (updated 2026-05-02):** **`listTasksForUser`** still supports **`includeSubtasks: false`**; **`workspaceBootstrap`** now uses **`true`** (one batched subtask query) to avoid client N+1. **`GET .../tasks?includeSubtasks=false`** still trims for other clients.
- **Code / repo:** `apps/api/src/authorization/authorization.service.ts`, `tasks.service.ts`, `tasks.controller.ts`, `organizations.service.ts`, `apps/web/src/components/app/QueryProvider.tsx`, `lib/api.ts`, `lib/query-cache-version.ts`, `lib/auth-api-timing.ts`, `app/api/auth/[...all]/route.ts`, `package.json` (web).

### 2026-05-01 — Brand mark from `Logo/` (designer light/dark PNGs)

- **Context:** User supplies separate **`Logo/Logbase light theme.png`** and **`Logo/Logbase darktheme.png`** (no generated variants).
- **What we did:** Canonical static copies under **`apps/web/public/Logos/logbase-light.png`** + **`logbase-dark.png`**; **`LogBaseMark`** stacks two **`img`** tags with existing **`data-theme`** / **system** CSS. **`apps/mobile/assets/`** holds the same files; sign-in uses **`useColorScheme`** to pick asset. Removed **`generate-brand-logos.mjs`**, **`generate:logos`**, and **sharp** devDependency.
- **Follow-up:** **`LogBaseMark`** **`variant`** presets (**`chrome`** 26px, **`marketing`** 32px, **`footer`** 24px, **`auth`** 28px) + tighter gaps / **`min-h`** tap rows on nav links; mobile sign-in mark **32×32**.
- **Code / repo:** `LogBaseMark.tsx`, `globals.css`, `apps/mobile/App.tsx`, `apps/web/package.json`.

### 2026-05-01 — Work task panel: status control matches list row pill

- **Context:** Create/edit task panel used compact `<select>` chrome for status; list view uses colored **`KanbanStatusPill`** (`STATUS_PILL_LAYOUT` + **`statusPillPalette`**).
- **What we did:** Extracted **`StatusPillSelect`** (shared shell + invisible overlay select); **`KanbanStatusPill`** delegates to it with **`kanbanAllowedTransitions`**; edit/new panels use it with full **`KANBAN_STATUS_ORDER`**.
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-05-01 — Web UI: neutral accent, solid primary (no glass)

- **Context:** User wanted to drop the glassy accent look on buttons and surfaces and replace the blue accent with a neutral palette.
- **What we did:** **`globals.css`** — zinc-style **`--accent` / `--accent-hover`**, added **`--on-accent`**, removed glass/blur tokens; **`.btn-primary`**, **`.brand-mark`**, **`.surface-glass-primary`** are solid fills + **`--shadow-primary`**; **`--bg-header`** solid. **`page.tsx`** — opaque surfaces, no backdrop blur on marketing cards/CTA; **`AppHeader`** — no **`backdrop-blur`**. Updated **`[[web-ui-styling]]`** topic.
- **Code / repo:** `apps/web/src/app/globals.css`, `apps/web/src/app/page.tsx`, `apps/web/src/components/app/AppHeader.tsx`, `second-memory/Topics/Design/web-ui-styling.md`.

### 2026-05-01 — Perf plan implemented (bootstrap API, JWT capture, loading UX)

- **Context:** Deliver the roadmap after the MCP perf analysis: fewer round trips, skip redundant `/token` when possible, clearer loading states, gentler React Query refetch.
- **What we did:**
  - **API:** `GET /organizations/:organizationId/workspace` returns `{ departments, lists, tasks, members }` via `Promise.all` in `OrganizationsService.workspaceBootstrap`; **`TasksModule`** now **`exports: [TasksService]`**; **`OrganizationsModule`** imports **`ListsModule`** + **`TasksModule`**.
  - **Web:** **`useOrgWorkspace`** calls the bootstrap route (one HTTP call). **`auth-session-jwt-capture`** patches **`fetch`** to read **`set-auth-jwt`** from **`/api/auth/get-session`**; **`ApiSessionProvider`** uses captured JWT before **`authClient.token()`**; clears capture on sign-out.
  - **React Query:** default **`refetchOnWindowFocus: false`**; workspace **`staleTime` 60s**; org list **`staleTime` 120s** (both **`refetchOnWindowFocus: false`**).
  - **UX:** Sidebar **Loading levels…**; dashboard **…** placeholders; work page **Loading tasks…** + pipeline **…**. **`WorkspaceSidebar`** uses **`session`** from **`useApiSession`** only.
- **Follow-ups:** (Done later in **Perf follow-ups: persisted queries…**.) Server-side DB tuning for **`get-session`** remains an ops exercise if latency stays high.
- **Code / repo:** `apps/api/src/organizations/*`, `tasks.module.ts`, `apps/web/src/lib/auth-session-jwt-capture.ts`, `auth-client.ts`, `ApiSessionProvider.tsx`, `useOrgWorkspace.ts`, `useOrganizations.ts`, `query-client.ts`, `WorkspaceSidebar.tsx`, `dashboard/page.tsx`, `work/page.tsx`.

### 2026-05-01 — Second memory: full architecture & logic-brain documentation

- **Context:** User asked for end-to-end documentation of architecture, infrastructure, maps, and domain logic in the **`second-memory`** Obsidian vault.
- **What we did:** Expanded [[00-map-overview]] with a Mermaid flowchart and hub links. Replaced placeholder [[apps-api]] / [[apps-web]] with concrete notes; added [[apps-mobile]], [[packages-and-data-layer]], [[auth-jwt-and-env]], and [[domain-authorization-and-tasks]] (roles, task visibility, ledger, capabilities). Updated [[Topics/README]] index. Follow-up: added [[web-ui-styling]] (Tailwind v4, CSS variables, glass primary, theme `data-theme`, component classes in `globals.css`) and linked from [[apps-web]] + overview.
- **Takeaway / follow-ups:** Treat **`00-map-overview`** as the entry point; keep **`Chat-inbox`** for time-ordered incidents (401s, deploy fixes). When routes or auth env change, update the relevant Topic note in the same PR as code.
- **Code / repo:** `second-memory/Topics/Infrastructure/*.md`, `second-memory/Topics/Domain/domain-authorization-and-tasks.md`, `second-memory/Topics/README.md`.

### 2026-05-01 — Web auth & data perf analysis (MCP, no code)

- **Context:** User asked for a **read-only** report: auth/data speed, API calls, refresh behavior, persistence, efficiency, and improvement ideas (no implementation in that turn).
- **What we did:** Exercised **LogBase** in Chrome via **user-chrome-devtools** MCP: sign-in (`localhost:3000`), hard reload on `/app/w/.../dashboard`, client navigation to **Tasks** (`/work`). Measured **Resource Timing** in-page (`performance.getEntriesByType('resource')`) for `/api/auth/*` and **`NEXT_PUBLIC_API_URL`** (`localhost:4000`). Cross-checked code: **`ApiSessionProvider`**, **`useOrgWorkspace`**, **`QueryProvider`** / **`makeQueryClient`**, **`workspace-storage`**, **`apiFetch`** (`cache: no-store`).
- **Takeaway / follow-ups:** **`get-session`** dominated refresh latency (~**3.9s** in this run); **`/api/auth/token`** ~**0.95s** after it; API bundle (orgs + depts/lists/tasks/members in parallel) ~**3.9–4.9s** each — sequential waterfall **session → JWT → API**. **`kv.better-auth.com/identify`** seen on login-related loads. In-session route changes reused React Query (only Next **\_rsc** fetches). Sidebar/dashboard treat **`depts.length === 0`** as “no levels” without distinguishing **loading**, causing misleading empty UI until data arrives.
- **Code / repo:** `apps/web/src/components/app/ApiSessionProvider.tsx`, `useOrgWorkspace.ts`, `useOrganizations.ts`, `lib/query-client.ts`, `WorkspaceSidebar.tsx`, `dashboard/page.tsx`.

### 2026-05-01 — Product rename: Work Ledger → LogBase

- **Context:** User-facing app name change.
- **What we did:** Replaced **Work Ledger** with **LogBase** in web metadata, landing/login/header, workspace placeholder, mobile shell title, and PDF task report title; logo initials **WL → LB**. Left **`@work-ledger/*`** package scope and mobile **`work-ledger.db`** filename unchanged (technical identifiers).
- **Code / repo:** `apps/web/src/app/layout.tsx`, `page.tsx`, `login/LoginForm.tsx`, `AppHeader.tsx`, `AddWorkspacePanel.tsx`, `apps/mobile/App.tsx`, `apps/api/src/tasks/tasks.service.ts`.

### 2026-05-01 — Commercial landing page (`/`)

- **Context:** Marketing homepage tuned for **commercial-ready** UX and copy.
- **What we did:** Full **`/`** restructure: sticky-style **nav** (anchors **Capabilities** / **How it works**, **Log in**, **Get started**); centered **hero** + dual CTAs + micro-line; **trust strip**; **4-card capabilities** grid with icons; **3-step how it works**; glass-style **closing CTA** band; **footer** columns + copyright. Smaller header wordmark vs earlier hero-only giant lockup. **`layout.tsx`** meta description aligned with positioning.
- **Code / repo:** `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`.

### 2026-05-01 — Home page copy for LogBase

- **Context:** Align marketing **`/`** with new product name after rename.
- **What we did:** (Superseded by commercial landing pass above.) Earlier iterations: eyebrow/hero/footer CTAs, **Outfit** wordmark experiments.
- **Code / repo:** `apps/web/src/app/page.tsx`.

### 2026-05-01 — Glassy primary actions & brand mark (LB)

- **Context:** Solid blue primary CTAs and the logo tile clashed with the app’s neutral elevated aesthetic; user wanted a **glassy** look.
- **What we did:** Added **`--glass-blur`** / **`--glass-primary-*`** / **`--glass-brand-*`** in **`globals.css`** (**`color-mix`** frosted fills, accent-tinted borders, accent-forward label color, soft inset + outer shadow). Rebuilt **`.btn-primary`** with blur + glass surfaces; **`.brand-mark`** for the logo tile; **`.surface-glass-primary`** for compact primary surfaces (due popover **Save**, subtask “done” boxes). Wired **LB** in **`AppHeader`** + landing **`page`**; updated **`DueDateTimePanel`** + **`work/page.tsx`** checkboxes.
- **Code / repo:** `apps/web/src/app/globals.css`, `apps/web/src/components/app/AppHeader.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/components/tasks/DueDateTimePanel.tsx`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-05-01 — List view due chip matches kanban

- **Context:** List due control was briefly a **13.5rem** fixed tile — too wide; user wanted the **kanban** due chip footprint; then tighter **icon vs label** alignment.
- **What we did:** **`TASK_DUE_CHIP_CLASS`** — **`inline-flex`** / **`rounded-lg px-2`** on **`ListTaskCard`** + **`TaskCard`**. **`leading-none`**, **`font-medium`**, **`tabular-nums`**; **`h-8`** + **`min-w-[8.75rem] w-max`** (was **11rem**, too much dead space) so **No due** isn’t tiny but dated chips hug content; long locales still grow via **`w-max`**. SVG **`block`** (**`TASK_DUE_CHIP_ICON_CLASS`**); label inherits **`dueDatePillClass`**.
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-05-01 — Task panel: repeat chip next to due; own popover

- **Context:** Create/edit side panel should show **repeat** beside the **due** trigger; label reflects **Daily** / **Weekly** / etc.; repeat picker not inside the due datetime popover.
- **What we did:** New **`DueRepeatPopover`** (portal, click-outside, Escape) with trigger matching assignee/due row (`btn-secondary`, max width). Shows **Repeat** until a due is set (then disabled); with repeat stored, shows **Daily** etc. **Compact** **`DueDateTimePanel`** no longer renders the repeat grid (**`!compact`** guard). **`DueDateTimePopover`** no longer takes **`dueRepeat`**. Work page: **`showRepeatPanel` / `editShowRepeatPanel`**, mutual close with due popover, clear with modal/task lifecycle.
- **Code / repo:** `apps/web/src/components/tasks/DueRepeatPopover.tsx`, `DueDateTimePopover.tsx`, `DueDateTimePanel.tsx`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-05-01 — Due popover: drop nested black strip behind date picker

- **Context:** Edit/create task side panel **Due** popover showed an extra dark **`surface-base`** band around the native date area vs the popover **`surface-elevated`**; user also wanted no inner box outline; compact header UX (**Pick due** removed, smaller **Clear**, **Save** closes popover).
- **What we did:** Removed **`bg-[var(--surface-base)]`** from the inner wrapper; removed inner **`border` / `rounded-lg` / `overflow-hidden`** (popover already borders the shell). **Compact** mode uses **`p-0`** spacing-only inner wrapper so padding isn’t doubled with the popover’s **`p-2`**. **Compact** header: no **Pick due** label; **`Clear`** / **`Save`** in **`grid grid-cols-2`** with shared **`h-6`** / **`text-[10px]`** + **`w-full min-w-0`** per cell so widths match; **`onSave`** → **`onOpenChange(false)`** from **`DueDateTimePopover`**.
- **Code / repo:** `apps/web/src/components/tasks/DueDateTimePanel.tsx`, `DueDateTimePopover.tsx`.

### 2026-05-01 — Remove AppWorkspaceGate; `/app` empty org copy

- **Context:** User wanted the old **workspace gate** removed and the **main `/app` page** to show **“No organization”** when the user has no orgs.
- **What we did:** Renamed/replaced **`AppWorkspaceGate`** with **`AppAuthenticatedProviders`** (same behavior: unauthenticated → **`/login`**, then **`AppPreferencesProvider`** + **`OrganizationsProvider`**). Empty-org **`/app`** UX was refined again (see next inbox entry). Users with orgs still auto-navigate to **`/app/w/.../dashboard`**.
- **Code / repo:** `apps/web/src/components/app/AppAuthenticatedProviders.tsx` (new), deleted `AppWorkspaceGate.tsx`, `apps/web/src/app/app/layout.tsx`, `apps/web/src/app/app/page.tsx`.

### 2026-05-01 — Add workspace naming (was Add organization)

- **Context:** Product copy and routes use **workspace** for the add/create flow.
- **What we did:** **`AddWorkspacePanel`** (replaces **`AddOrganizationPanel`**), route **`/app/w/[id]/add-workspace`**, sidebar **+ Add workspace**, **`next.config.mjs`** **301** from **`.../add-organization`** → **`.../add-workspace`**.
- **Code / repo:** `apps/web/src/components/app/AddWorkspacePanel.tsx`, `AppEntryAccountSidebar.tsx`, `WorkspaceSidebar.tsx`, `apps/web/src/app/app/w/[workspaceId]/add-workspace/page.tsx`, `next.config.mjs`.

### 2026-05-01 — No-org `/app`: account sidebar + add-workspace main

- **Context:** With no organization, user should see **only** the **sidebar account row** (email/name) expanding to **Add workspace**, and the **main area** should match the add-workspace page (not a separate “no org” card).
- **What we did:** **`AppEntryAccountSidebar`**: same pattern as workspace picker (chevron), dropdown contains only **+ Add workspace** → **`/app`**. **`AddWorkspacePanel`**: shared form + standalone **Theme** row; used by **`/app`** (`variant="standalone"`) and **`/app/w/[workspaceId]/add-workspace`**. **`WorkspaceShell`**: if org list loaded and empty, **`replace('/app')`** so stale **`/app/w/...`** URLs don’t stick.
- **Code / repo:** `apps/web/src/components/app/AppEntryAccountSidebar.tsx`, `AddWorkspacePanel.tsx`, `apps/web/src/app/app/page.tsx`, `apps/web/src/app/app/w/[workspaceId]/add-workspace/page.tsx`, `WorkspaceShell.tsx`.

### 2026-05-01 — User settings page + header profile / gear

- **Context:** User wanted a **settings** page, a **settings icon** beside **Sign out**, and a **profile control** instead of showing **email** in the header.
- **What we did:** New route **`/app/w/[workspaceId]/settings`** (“Your settings”) with session **email/name** and link to **Organization settings**. **`AppHeader`**: optional **`workspaceId`**; **profile** opens a small **account popover** (email, **Your settings** when in a workspace, **Sign out**); **gear** still links to settings; **Sign out** removed from the header bar. **`WorkspaceShell`** passes **`workspaceId`**; **`app/page.tsx`** passes **`orgs[0]?.id`** when redirecting. Sidebar **Your settings** + workspace switcher allow **`/settings`** tail. **Theme** control removed from header; lives under **Your settings → Appearance** (`useAppPreferences`), plus **Theme** row on **create first workspace** (`/app` with no orgs) so theme is still reachable before any workspace exists.
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/settings/page.tsx`, `apps/web/src/components/app/AppHeader.tsx`, `WorkspaceShell.tsx`, `apps/web/src/app/app/page.tsx`, `WorkspaceSidebar.tsx`, `PickerChrome.tsx`.

### 2026-05-01 — Work panel: hide list scope; fix `due_repeat` DB drift

- **Context:** Task create/edit side panel felt redundant showing **list** (and level-style list path); API errors with **`column "due_repeat" does not exist`** when schema was ahead of the database.
- **What we did:** Removed **List** read-only block from **edit** panel and **List** `<select>` from **new task** panel. **`listId`** for create still follows **`?list=`** / **`?level=`** + existing **`useEffect`** (first list in scope). Ran **`npm run db:migrate`** at repo root so pending migration (e.g. **`0004_task_due_repeat`**) applies **`tasks.due_repeat`**.
- **Follow-up:** **Level + list** shown as **`TaskPanelScopeBadges`** above the title input (same **`LEVEL_BADGE_CLASS` / `LIST_BADGE_CLASS`** as list row cards); create uses **`listId`** scope; edit uses **`taskListName` / `taskLevelBadge`** on **`editDetail.task`**.
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`, `packages/db/drizzle`, migrate via root **`npm run db:migrate`**.

### 2026-05-01 — Task due repeat (daily / weekly / monthly / yearly)

- **Context:** Create/edit task due popover needed **repeat** choices under time; product does not yet run recurrence engine—value is **stored** on the task.
- **What we did:** **`DueDateTimePanel`** (below time when a date is selected): **Repeat** grid **Daily · Weekly · Monthly · Yearly**; tap again to clear. **`DueDateTimePopover`** passes **`dueRepeat` / `onDueRepeatChange`**. Work page state **`dueRepeat` / `editDueRepeat`**; cleared when due cleared; edit syncs from **`parseTaskDueRepeat`**. **POST create** / **PATCH** include **`dueRepeat`**; API clears repeat when **due is cleared**. DB **`tasks.due_repeat`** text nullable; migration **`0004_task_due_repeat.sql`**. Contracts **`taskDueRepeatSchema`**; **`TaskRow.dueRepeat`** + **`parseTaskDueRepeat`** in **`ledger-types`**. Mobile **`TaskRow`** optional field.
- **Follow-up:** Due popover **date** control switched from **`react-day-picker`** to native **`type="date"`** (same **`input h-10 … rounded-lg text-sm`** as task toolbar **due filter**); removed **`react-day-picker`** dep and **`due-date-picker.css`**. **Native control visibility:** **`color-scheme`** on `:root` / **`html[data-theme]`** / **`system`** media (fixes dark **date/time** picker affordances); **`select.input` / `select.input-compact`** **`appearance: none`** + **SVG chevron** `background-image` (fixes invisible **Status/Priority** dropdown arrows on dark surfaces).
- **Code / repo:** `packages/db` (`schema.ts`, `drizzle/0004_task_due_repeat.sql`), `packages/contracts/src/index.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/web/src/components/tasks/DueDateTimePanel.tsx`, `DueDateTimePopover.tsx`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`, `apps/web/src/lib/ledger-types.ts`, `apps/mobile/App.tsx`.
- **Takeaway:** Run DB migrations (e.g. **`packages/db`** migrate pipeline) before deploy. Recurrence execution TBD.

### 2026-05-01 — Work page: task create/edit as right side panel

- **Context:** Create and edit task UI was a centered modal; switched to a **right-hand side panel** on the work page.
- **What we did:** Replaced the centered overlay with a dimmed full-screen backdrop (`div`, click to close) and a **`fixed` right column** (`max-w-xl`, `border-l`, scrollable `section` with `role="dialog"`). **`taskPanelOpen`** drives visibility. Added **body `overflow: hidden`** while open and **Escape** to close (same handlers as backdrop). Comment in **`useTaskDetail`** updated (panel vs modal). **Status + Priority** sit **on the same row** as the panel title (“Edit task” / “New task”), with **Close** on the right (`flex-wrap` + `min-w-0` for narrow width); loading/error edit states keep title + Close only. *(Later: list/level path removed from panel; create **`listId`** follows URL scope only.)* Refined header row: **`input-compact`** selects at fixed **~6.5–7.25rem** (status) / **~4.5–4.875rem** (priority), **`text-xs`**, full-bleed **bottom border** (`TASK_PANEL_HEADER_*` constants). **Title left**; **Status, Priority, text “Close”** grouped **right** (`flex-col` stacks on narrow, `sm:flex-row` + `justify-between`). Task panel **assignees**: **`AssigneeSearchField` only when toggle expanded**; default collapsed; toggle shows **`assigneeToggleLabel`** (names / `Alice +2` / **Add assignee**); `title` + `aria-label` list; collapse when create/edit panel closes (`useEffect` on `createModalOpen` / `editTaskId`). **List + kanban** task rows: **⋮ overflow** (`IconEllipsisVertical`, `TASK_ROW_OVERFLOW_MENU_BTN`) to the **right of priority** opens **`openEditTask`** (edit side panel).
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`, `apps/web/src/hooks/useTaskDetail.ts`.

### 2026-04-30 — Due picker: react-day-picker calendar + time

- **Context:** Native `datetime-local` felt non-standard; wanted a familiar month-grid calendar plus time; then smaller **popover** anchored to the chip (not inline in the modal).
- **What we did:** Added **`react-day-picker`**; **`DueDateTimePanel`** uses **`DayPicker`** + time selects; **`.due-dtp--compact`** shrinks cells. **`DueDateTimePopover`** (`createPortal` to `document.body`, `z-[100]`, click-outside + Escape, `fixed` position from trigger rect) replaces the old inline block on the work modals. Trigger shows **“Set due”** or a short formatted instant. **`useEffect`** closes popover when **`editTaskId`** / **`createModalOpen`** clear.
- **Code / repo:** `apps/web/package.json`, `apps/web/src/components/tasks/DueDateTimePanel.tsx`, `DueDateTimePopover.tsx`, `due-date-picker.css`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-04-30 — Due (single datetime) in modals + PATCH `dueAt`

- **Context:** Task modals used a two-column “deadline + repeat” block; product wants one **due** instant (date & time), clearer UX, aligned naming.
- **What we did:** Replaced modal copy/UI with **`DueDateTimePanel`** (`datetime-local`, clear control) below the chip row next to assignees; buttons **Set due / Edit due / Hide due**. Extended **`PATCH /tasks/:id`** with optional **`dueAt`** (ISO string or `null`); **`TasksService.patchTask`** updates `tasks.due_at` and writes the same **`reschedule`** ledger entry when due changes (`canReschedule` guard). Edit save sends one PATCH (no separate `POST …/reschedule`). Toolbar sort labels shortened to **Due ·**. List/kanban due pills show **time** via **`formatDueForListPill`**; **`taskMatchesDatePreset`** **overdue** now compares **`due.getTime()`** to **`Date.now()`** (honors time-of-day). Mobile task line uses **`formatDueCompact`**.
- **Takeaway:** `POST …/reschedule` remains for callers that want an explicit reschedule + reason body.
- **Code / repo:** `packages/contracts` (`patchTaskSchema`), `apps/api/src/tasks/tasks.service.ts`, `apps/web/src/components/tasks/DueDateTimePanel.tsx`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`, `apps/web/src/lib/task-board.ts`, `apps/mobile/App.tsx`.

### 2026-04-30 — Task modals: searchable assignees

- **Context:** Create/edit task modals listed every member as checkboxes; hard to scan on larger teams.
- **What we did:** Introduced **`AssigneeSearchField`** (`apps/web/src/components/tasks/AssigneeSearchField.tsx`) — search input (name/email), dropdown of matches, chip list with remove; wired into **`work`** create + edit modal assignee panels (`apps/web/src/app/app/w/[workspaceId]/work/page.tsx`). Picker renders **below** the “Add assignee” / “Add deadline” chip row (not inside the Status/Priority/List grid).
- **Takeaway:** Click-outside and Escape dismiss the dropdown; `onMouseDown` preventDefault on option buttons avoids blur-before-click issues.

### 2026-04-30 — Local 401 “Invalid or expired token” vs prod OK

- **Context:** Production auth works; localhost API returns `401` with that message on protected routes.
- **Root cause pattern:** Nest verifies JWTs with `AUTH_JWKS_URL` + issuer/audience (`AUTH_*` or `NEXT_PUBLIC_APP_URL`); any mismatch with the Better Auth instance that minted the token is swallowed as “Invalid or expired token” (`apps/api/src/auth/auth.service.ts`).
- **What to align locally:** (1) `AUTH_JWKS_URL` must be the JWKS URL of the **same** Next app you log into (e.g. dev server `http://localhost:3000/...`), not production’s URL, unless tokens are truly issued by prod. (2) `AUTH_ISSUER` / `AUTH_AUDIENCE` / `NEXT_PUBLIC_APP_URL` must include the `iss` / `aud` claims on the token (inspect Network → Better Auth `token` response, decode payload locally — avoid pasting tokens into third-party sites). (3) If `DATABASE_URL` differs from prod, JWKS keys in Postgres differ — prod `AUTH_JWKS_URL` + local login will always fail. Use `.env.local` overrides for local API auth vars. (4) After fixing env, sign out and sign in again to mint a fresh JWT.
- **Code / repo:** `apps/api/src/auth/auth.service.ts`, `apps/web/src/lib/auth.ts` (`resolveAuthBaseUrl`), `apps/web/src/lib/auth-client.ts` (browser uses `window.location.origin`).
- **Gotcha:** Duplicate keys in the same `.env` file — last assignment wins (e.g. two `NEXT_PUBLIC_APP_URL` lines can silently point local at prod).

### 2026-04-30 — Tasks assignee badge: fixed width + first name

- **Context:** Tasks board assignee chips expanded with long names/emails and reduced scan consistency.
- **What we did:** Updated task assignee badges in list + kanban cards to use fixed-width tiles and render only the first assignee first-name token (fallback to `Unknown` when unresolved).
- **Takeaway / follow-ups:** Display remains compact and aligned; full assignee list still available in hover/aria metadata.
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-04-30 — MCP QA: team users, due dates, repeat gap

- **Context:** End-to-end MCP run requested for tasks due dates + repeat schedule, multi-user creation, assignment, and recurrence verification.
- **What we did:** Logged in as `ghazwairshad@gmail.com`, recovered local run by restarting `dev:web` and `dev:api`, created MCP users (`john@test.com`, `maria@test.com`, `alex@test.com`) via auth UI, added them to the same org in Team page, and created 3 tasks assigned to different users with valid due dates (via authenticated API calls from browser context): `Daily Reconciliation [daily]`, `Weekly Inventory Review [weekly]`, `Monthly Audit Prep [monthly]`.
- **Takeaway / follow-ups:** UI exposes repeat selection in create modal, but backend contract/schema/service has no recurrence field/engine; repeat values are not persisted and no follow-up tasks are generated automatically. Also observed slow auth/session endpoints causing periodic long waits and temporary “Please wait…” login hang while API was down.
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`, `apps/api/src/tasks/tasks.service.ts`, `packages/contracts/src/index.ts`, `packages/db/src/schema.ts`, `test-credentials.local.txt`.

### 2026-04-30 — Prod 401 token mismatch (issuer/audience drift)

- **Context:** API returned `401 Invalid or expired token` on `/organizations` even though login session existed.
- **What we did:** Confirmed browser bearer token had `iss/aud` on a Vercel deployment hostname, not the stable app domain. Updated Better Auth base URL resolution to prefer `NEXT_PUBLIC_APP_URL` before `VERCEL_URL`, so prod tokens use stable issuer when explicit `BETTER_AUTH_URL` is absent. Also hardened API auth config to accept comma-separated issuer/audience lists and fallback to `NEXT_PUBLIC_APP_URL` when `AUTH_ISSUER`/`AUTH_AUDIENCE` are missing.
- **Takeaway / follow-ups:** Set explicit stable values in production (`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`) and re-login users after deploy to mint fresh tokens.
- **Code / repo:** `apps/web/src/lib/auth.ts`, `apps/api/src/auth/auth.service.ts`.

### 2026-04-30 — Fix Vercel API crash: CJS requiring ESM contracts package

- **Context:** After fixing `@work-ledger/db`, API still crashed in prod with `ERR_REQUIRE_ESM` when requiring `@work-ledger/contracts`.
- **What we did:** Applied the same dual-format package strategy to contracts: ESM output in `dist/`, CJS output in `dist-cjs/`, `exports` map with both `import` and `require`, and build step that writes `dist-cjs/package.json` with `type=commonjs`.
- **Takeaway / follow-ups:** Redeploy API after pulling this change; CJS Nest runtime can now import contracts without ESM runtime crash.
- **Code / repo:** `packages/contracts/package.json`, `packages/contracts/tsconfig.cjs.json`.

### 2026-04-30 — Fix Vercel API crash: CJS requiring ESM db package

- **Context:** Production API crashed with `ERR_REQUIRE_ESM` because Nest API runtime (`commonjs`) required `@work-ledger/db` built as ESM-only.
- **What we did:** Made `@work-ledger/db` dual-format: kept ESM build in `dist/`, added CJS build in `dist-cjs/` via `tsconfig.cjs.json`, and updated package `exports` to provide `import` and `require` entrypoints (including `./schema`). Build now writes `dist-cjs/package.json` with `type=commonjs` so Node resolves CJS correctly under package scope.
- **Takeaway / follow-ups:** Re-deploy API so it picks up the dual build; this removes `ERR_REQUIRE_ESM` without migrating Nest runtime to ESM.
- **Code / repo:** `packages/db/package.json`, `packages/db/tsconfig.cjs.json`.

### 2026-04-30 — Postgres sslmode warning hardening

- **Context:** Runtime warning from `pg`/`pg-connection-string` about legacy `sslmode=require|prefer|verify-ca` semantics changing in upcoming major versions.
- **What we did:** Added central `normalizeDatabaseUrl()` in `@work-ledger/db` to auto-upgrade legacy sslmode values to `sslmode=verify-full` unless `uselibpqcompat=true` is explicitly set. Wired this into API pool creation, Better Auth pool creation, and shared DB factory.
- **Takeaway / follow-ups:** Current strict TLS behavior is preserved and warning is silenced without requiring immediate env edits. If libpq compatibility is desired later, set `uselibpqcompat=true`.
- **Code / repo:** `packages/db/src/index.ts`, `apps/api/src/db/db.module.ts`, `apps/web/src/lib/auth.ts`.

### 2026-04-30 — Prod blocker: org API routed to web origin

- **Context:** Production app loaded, but creating the first workspace failed; local worked.
- **What we did:** Reproduced with MCP browser flow and confirmed `POST /organizations` returned 404 from Vercel web app (not API). Updated web API base resolver to treat blank `NEXT_PUBLIC_API_URL` as unset and fall back to `http://localhost:4000` only when no non-empty value exists; also normalized trailing slash handling.
- **Takeaway / follow-ups:** Ensure production has non-empty `NEXT_PUBLIC_API_URL` set to API origin (e.g. `https://<api-domain>`). Blank env values are now safely ignored.
- **Code / repo:** `apps/web/src/lib/api.ts`.

### 2026-04-30 — Edit task modal: instant open via list row placeholder

- **Context:** Edit modal waited on `GET /tasks/:id` and showed “Loading…”, so it felt slow.
- **What we did:** `useTaskDetail` now takes optional **workspace `TaskRow`** and uses React Query **`placeholderData`** to build a minimal `TaskDetail` (task, assignees, subtasks from list payload, empty ledger). Work page passes `tasks.find(…)` for the open id. Server response still replaces cached detail when the fetch completes.
- **Code / repo:** `apps/web/src/hooks/useTaskDetail.ts`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-04-30 — Work page header: lean toolbar + pipeline stats card

- **Context:** Tasks/work board header felt busy (subtitle, rule line, chunky toggle chrome, large primary CTA); wanted toolbar under title and a live overview at the right.
- **What we did:** Removed subtitle (“Switch layout…”), dropped header bottom border, list/kanban control is borderless elevated pill, compact **+ New task**. **Layout:** CSS grid — row1 title + row2 toolbar in column 1; **Pipeline** card spans rows 1–2 in column 2 on `lg+`. Header grid widened (`minmax(26rem,min(52rem,58vw))`) so the overview uses horizontal space. **Card UX:** Wide horizontal strip — slim meta row + single row with **Total** column + equal flex segments (short labels; **Active** = in progress); cancelled as pill in meta row; dividers, hover, `sr-only` full status names, accent wash + top hairline. Counts **memoized** from **`visibleTasks`**; **`visibleTasks`** / **`activeTasks`** in `useMemo`.
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-04-30 — Sidebar: workspace name → all tasks; chevron expands tree

- **Context:** Org row toggled tree only; “All tasks” duplicated navigation.
- **What we did:** Workspace title is a **Link** to **`/work`** (full-board scope). Expand/collapse moved to a **chevron button** beside it (same interaction pattern as level rows). Removed separate **All tasks** row. Active highlight when **`/work`** with **no** `level` / `list` query (`useSearchParams`).
- **Code / repo:** `apps/web/src/components/app/WorkspaceSidebar.tsx`.

### 2026-04-30 — Work board: single status grouping + level badges

- **Context:** “All tasks” view grouped boards **by list** (nested status sections per list); wanted **one** board with tasks tagged by **level** (department).
- **What we did:** Removed per-list `<section>` stacking; **list + kanban** always render **one** `StatusSections` / `KanbanBoard` over `sortedTasks`. Each row/card shows a compact **level** badge (department name from task → list → dept).
- **Code / repo:** `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`.

### 2026-04-30 — Tasks: modal-only editing on work board

- **Context:** List/kanban sent users to a full task page for assignee/due (and links); tasks should behave like the existing **New task** card modal instead.
- **What we did:** **Edit task** modal on `apps/web` work page (`useTaskDetail` + same patterns as create). List/kanban title, assignee badge, due badge, and subtask CTAs open the modal (assignee/due expand the right sections). **`PATCH /tasks/:id`** extended for **`title`** and **`assigneeUserIds`** (validated org members); **`POST /tasks/:id/reschedule`** accepts **`newDueAt: null`** to clear due. Legacy route **`/work/[taskId]`** redirects to **`/work?task=`** (middleware org alias updated too); old full-page detail removed from primary UX.
- **Takeaway:** Deep links and bookmarks still resolve via `?task=`; PDF/ledger-heavy UI is no longer a separate page—say if we need an “advanced” drawer later.
- **Code / repo:** `packages/contracts` (`patchTaskSchema`, `rescheduleTaskSchema`), `apps/api/src/tasks/tasks.service.ts`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`, `apps/web/src/app/app/w/[workspaceId]/work/[taskId]/page.tsx`, `apps/web/src/middleware.ts`.

### 2026-04-30 — Rule: second-memory as default info layer

- **Context:** Align vault usage with “document substantive work by default” and use **`second-memory`** as **basic context** for future sessions in this workspace.
- **What we did:** Rewrote `.cursor/rules/second-memory.mdc`: default agent behavior to log before finishing meaningful tasks; skim/`@` vault when starting related work; inbox template includes **What we did**; narrow skip list; still no secrets.
- **Takeaway:** Prefer a short entry over silence when unsure; README updated to match.
- **Code / repo:** `.cursor/rules/second-memory.mdc`, `second-memory/README.md`.

### 2026-04-30 — Merged `Logger-obsidian-vault` into `second-memory`

- **Context:** Two vault folders existed at repo root: the old Obsidian default (`Logger-obsidian-vault/`) and the Cursor-driven second memory (`second-memory/`).
- **Takeaway:** **One vault only:** `second-memory/`. Copied **`.obsidian`** from the old folder, then **deleted** `Logger-obsidian-vault/` (Welcome boilerplate removed). Open **`second-memory`** in Obsidian.
- **Code / repo:** `second-memory/.obsidian`, `second-memory/README.md`.

### 2026-04-30 — Second memory (vault rename + scope)

- **Context:** Expanded the in-repo vault from infra-only to a general **second memory** for durable project knowledge.
- **Takeaway:** Default capture stays **`Inbox/Chat-inbox.md`**; structured notes live under **`Topics/`** (e.g. `Topics/Infrastructure/`). Vault folder is now **`second-memory/`** (was `infra-map/`).
- **Code / repo:** `.cursor/rules/second-memory.mdc`, `.cursor/hooks/infra-session-log.mjs` (logs to `second-memory/Inbox/_session-log.txt`), `second-memory/`.
