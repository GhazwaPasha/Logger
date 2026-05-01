# Task writes vs reads — API contract & client cache

Use this when integrating **another client** (mobile, scripts, partner service) or reasoning about **why the web app avoids full refetches** after saves. Linked from [[00-map-overview]], [[apps-api]], [[apps-web]].

## Mental model (layman)

- **Saving** something (create task, edit task, reschedule, archive) returns a **small answer**: current task + checklist + assignees + permissions + **only the new activity rows from that save**.
- **Loading** a task for the full history panel still uses **GET task by id**, which returns **everything** (full ledger, newest-first).

Do **not** assume `POST /organizations/:orgId/tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/reschedule`, or `POST /tasks/:id/archive` return the same JSON shape as **`GET /tasks/:id`**.

## Server (`apps/api`)

### Slim mutation payload (`TaskMutationResult`)

Returned by:

- `POST /organizations/:organizationId/tasks` (**create**)
- `PATCH /tasks/:taskId` (**patch** — fields + optional bulk subtasks)
- `POST /tasks/:taskId/reschedule`
- `POST /tasks/:taskId/archive`

Shape (conceptual):

| Field | Meaning |
|-------|---------|
| `task` | Full persisted task row after automation (`assigned` / `late` reconciliation may run). |
| `assigneeUserIds` | Current assignees. |
| `subtasks` | All checklist rows for that task (newest-first order matches list endpoints). |
| `capabilities` | `canDeleteTask`, `canReschedule`, `canAppendLedger`. |
| `ledgerDelta` | **Only** ledger rows inserted during **this** request — append client-side to existing history; do not treat as full ledger. |

Full detail for audit UI remains:

- **`GET /tasks/:taskId`** → unchanged “fat” response (`task`, `assigneeUserIds`, `subtasks`, **`ledger`** full list, `capabilities`).

### Bulk checklist on write (single round-trip)

Validated in **`@work-ledger/contracts`** (`packages/contracts`):

- **Create:** body may include **`initialSubtasks`**: `[{ title }]`, max **`MAX_SUBTASKS_PER_TASK_MUTATION`** (100).
- **Patch:** body may include **`subtasksToCreate`**: same shape/cap — inserted in the **same DB transaction** as other patch fields.

Prefer these over **N × `POST …/subtasks`** after create/patch when building new clients.

### Workspace bootstrap still batches subtasks

`GET /organizations/:organizationId/workspace` loads tasks with **`includeSubtasks: true`** on the server — **one batched subtasks query** per bootstrap, not per-task calls from the API design side.

### Idempotent / separate endpoints (unchanged)

- **`PATCH /tasks/:taskId/subtasks/:subtaskId`** — toggle done / edit title; returns the **subtask row** only (no task mutation envelope).
- **`POST /tasks/:taskId/ledger`** — append activity (own response shape).

## Web app (`apps/web`)

### Types

- **`TaskMutationResult`** — `apps/web/src/lib/ledger-types.ts` (matches slim API writes).
- **`TaskDetail`** — used for **`GET /tasks/:id`** and React Query **`taskKeys.detail`**.

### Cache strategy (work board)

- After **create / save / quick PATCH / subtask PATCH**, the client updates **`workspaceKeys.workspace`** and **`taskKeys.detail`** with **`queryClient.setQueryData`**, merging **`ledgerDelta`** onto the front of **`detail.ledger`** when the detail cache exists.
- **Invalidating** the whole workspace after every checkbox click was intentionally avoided for perceived speed.

### UX patterns on the board

- **Optimistic** updates for status/priority PATCH and subtask done (TanStack **`useMutation`**, rollback from snapshot on error).
- Status/priority controls are **not** globally disabled for the whole row while a mutation is in flight (avoids “sticky” UI).

### Files (anchors)

- Board logic: `apps/web/src/app/(authenticated)/[workspaceId]/work/page.tsx`
- Detail hook: `apps/web/src/hooks/useTaskDetail.ts`

## Checklist for a **new** client

1. Use **slim** response types for **write** endpoints; use **`GET /tasks/:id`** when you need **full** `ledger`.
2. Prefer **`initialSubtasks`** / **`subtasksToCreate`** instead of many subtask POSTs.
3. If you maintain a local store, **merge** `ledgerDelta` into existing history; don’t replace history with `ledgerDelta` alone.
4. Expect **`task.status`** after writes to reflect **automation** (e.g. assignee/due-driven `assigned` / `late`) — see [[domain-authorization-and-tasks]].

## Related

- [[packages-and-data-layer]] — Zod schemas live in **`@work-ledger/contracts`**.
- [[domain-authorization-and-tasks]] — who can change what; ledger event types.
- Inbox: **`Inbox/Chat-inbox.md`** — search “Instant-feeling tasks” for the implementation date and file list.
