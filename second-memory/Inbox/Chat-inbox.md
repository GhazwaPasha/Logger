# Chat inbox

Cursor Agent turns append **here** when something is worth keeping beyond this chat (newest first). See **`second-memory/README.md`** and rule **`second-memory`**.

---

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
