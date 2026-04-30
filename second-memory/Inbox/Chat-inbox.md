# Chat inbox

Cursor Agent turns append **here** when something is worth keeping beyond this chat (newest first). See **`second-memory/README.md`** and rule **`second-memory`**.

---

### 2026-05-01 — Task due repeat (daily / weekly / monthly / yearly)

- **Context:** Create/edit task due popover needed **repeat** choices under time; product does not yet run recurrence engine—value is **stored** on the task.
- **What we did:** **`DueDateTimePanel`** (below time when a date is selected): **Repeat** grid **Daily · Weekly · Monthly · Yearly**; tap again to clear. **`DueDateTimePopover`** passes **`dueRepeat` / `onDueRepeatChange`**. Work page state **`dueRepeat` / `editDueRepeat`**; cleared when due cleared; edit syncs from **`parseTaskDueRepeat`**. **POST create** / **PATCH** include **`dueRepeat`**; API clears repeat when **due is cleared**. DB **`tasks.due_repeat`** text nullable; migration **`0004_task_due_repeat.sql`**. Contracts **`taskDueRepeatSchema`**; **`TaskRow.dueRepeat`** + **`parseTaskDueRepeat`** in **`ledger-types`**. Mobile **`TaskRow`** optional field.
- **Follow-up:** Due popover **date** control switched from **`react-day-picker`** to native **`type="date"`** (same **`input h-10 … rounded-lg text-sm`** as task toolbar **due filter**); removed **`react-day-picker`** dep and **`due-date-picker.css`**. **Native control visibility:** **`color-scheme`** on `:root` / **`html[data-theme]`** / **`system`** media (fixes dark **date/time** picker affordances); **`select.input` / `select.input-compact`** **`appearance: none`** + **SVG chevron** `background-image` (fixes invisible **Status/Priority** dropdown arrows on dark surfaces).
- **Code / repo:** `packages/db` (`schema.ts`, `drizzle/0004_task_due_repeat.sql`), `packages/contracts/src/index.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/web/src/components/tasks/DueDateTimePanel.tsx`, `DueDateTimePopover.tsx`, `apps/web/src/app/app/w/[workspaceId]/work/page.tsx`, `apps/web/src/lib/ledger-types.ts`, `apps/mobile/App.tsx`.
- **Takeaway:** Run DB migrations (e.g. **`packages/db`** migrate pipeline) before deploy. Recurrence execution TBD.

### 2026-05-01 — Work page: task create/edit as right side panel

- **Context:** Create and edit task UI was a centered modal; switched to a **right-hand side panel** on the work page.
- **What we did:** Replaced the centered overlay with a dimmed full-screen backdrop (`div`, click to close) and a **`fixed` right column** (`max-w-xl`, `border-l`, scrollable `section` with `role="dialog"`). **`taskPanelOpen`** drives visibility. Added **body `overflow: hidden`** while open and **Escape** to close (same handlers as backdrop). Comment in **`useTaskDetail`** updated (panel vs modal). **Status + Priority** sit **on the same row** as the panel title (“Edit task” / “New task”), with **Close** on the right (`flex-wrap` + `min-w-0` for narrow width); loading/error edit states keep title + Close only. **List** stays below assignees/due (edit: read-only list block). Refined header row: **`input-compact`** selects at fixed **~6.5–7.25rem** (status) / **~4.5–4.875rem** (priority), **`text-xs`**, full-bleed **bottom border** (`TASK_PANEL_HEADER_*` constants). **Title left**; **Status, Priority, text “Close”** grouped **right** (`flex-col` stacks on narrow, `sm:flex-row` + `justify-between`). Task panel **assignees**: **`AssigneeSearchField` only when toggle expanded**; default collapsed; toggle shows **`assigneeToggleLabel`** (names / `Alice +2` / **Add assignee**); `title` + `aria-label` list; collapse when create/edit panel closes (`useEffect` on `createModalOpen` / `editTaskId`). **List + kanban** task rows: **⋮ overflow** (`IconEllipsisVertical`, `TASK_ROW_OVERFLOW_MENU_BTN`) to the **right of priority** opens **`openEditTask`** (edit side panel).
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
