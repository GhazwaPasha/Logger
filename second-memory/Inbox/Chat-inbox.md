# Chat inbox

Cursor Agent turns append **here** when something is worth keeping beyond this chat (newest first). See **`second-memory/README.md`** and rule **`second-memory`**.

---

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
