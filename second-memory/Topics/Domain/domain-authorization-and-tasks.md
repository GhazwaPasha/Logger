# Domain & logic brain: orgs, tasks, authorization

Vocabulary and **who can do what** encoded in `AuthorizationService` + `TasksService`. Linked from [[00-map-overview]].

## Hierarchy (workspace model)

- **Organization** — top-level tenant; UI often calls this a **workspace**.
- **Department** — subdivision inside an org (**“level”** in UI copy).
- **List** — belongs to **one department** and **one org**; tasks sit on a list.
- **Task** — belongs to org + list; has **`assignerId`** (creator assigner), optional **assignees** (many-to-many), **subtasks**, **activity ledger**.

Product rename note: **LogBase** is the user-facing name; **`assigner`** in code means “user who created/owns assignment responsibility,” not “manager” in HR sense.

## Roles (`organization_members.role`)

| Role | Meaning |
|------|---------|
| **owner** | Full org; sees **all non-deleted tasks** in org |
| **manager** | Bound to **`departmentId`**; sees all tasks in lists under that department |
| **member** | Org member; task visibility driven by assignment (see below) |

**Invite/upsert** (owner-only API): **`POST /organizations/:id/members`** with email + role + optional `departmentId` (required for managers).

## Task visibility (`listTasksForUser`)

- **Owner:** all tasks in org (`deletedAt` null).
- **Manager:** tasks whose **`listId`** is in lists for **`manager.departmentId`**.
- **Member / assignee-only path:** tasks where user appears in **`task_assignees`** for that org (users invited only via assignment still get org access through assignee linkage — `listOrganizationIdsForUser` unions membership + assignee orgs).

## Task access (`getTaskAccess`)

User may open a task if **owner**, **dept manager for task’s list’s department**, or **assignee**. Otherwise **403**.

Returned **`role`** label includes **`assignee_only`** when not in `organization_members` but assigned (edge case for cross-invite flows).

## Capabilities (`taskCapabilities`)

Derived from access + task state:

- **`canDeleteTask`** — effectively tied to **assigner** + active task (archive flow uses assigner guard).
- **`canReschedule`** — owner, dept manager, or assignee; active task.
- **`canAppendLedger`** — same group; drives notes, acks, status_change entries, subtask mutations tied to that permission.

**Archive:** only **`tasks.assignerId`** (`AssignerOnlyGuard` on archive endpoint).

## Task creation

- Caller must be **org member**; **`assignerId`** set to **`userId`**.
- **`listId`** validated to belong to org (`ListsService.assertListInOrg`).
- Initial ledger row: **`note`** payload “Task created.”

## Ledger (`activity_ledger`)

**Types (enum):** `ack`, `note`, `reschedule`, `status_change`, `archive`.

**Appendable from client (schema):** `ack`, `note`, `status_change` — via **`appendLedgerSchema`**.

**System-written:** reschedule entries when due changes; archive flows may write `archive` type through service logic (see `TasksService`).

**Payload:** JSON; **`clientMutationId`** optional dedupe key on append.

## Due date & repeat

- **`due_at`** — single instant (timestamptz).
- **`due_repeat`** — `daily` | `weekly` | `monthly` | `yearly` | null; **stored for UX / future** — no recurrence engine generates follow-up tasks yet (see [[Chat-inbox]]).

## Soft delete

- **`tasks.deletedAt`** set on archive; excluded from listings via `isNull(tasks.deletedAt)`.

## PDF report

- **`GET /tasks/:id/report.pdf`** — server renders task context for assigner/access-permitted users (`pdf-lib`).
