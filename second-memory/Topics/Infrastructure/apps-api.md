# apps-api (NestJS)

Nest HTTP service for **organizations, structure (departments/lists), tasks, ledger, PDF**. Linked from [[00-map-overview]].

## Runtime

- **Bootstrap:** `apps/api/src/main.ts` — loads env via `load-env`, enables **CORS** from **`NEXT_PUBLIC_APP_URL`** (comma-separated, default `http://localhost:3000`) **merged** with **`API_CORS_ORIGINS`** when the latter is set (deduped), plus localhost regex and `exp://` for Expo. Optional **`API_CORS_ALLOW_VERCEL_APP`** (`1` / `true`) adds **`https://*.vercel.app`** for branch/preview deploys. Explicit **`methods`** + **`allowedHeaders`** (`Authorization`, `Content-Type`, `Accept`) for preflight. If the browser **`Origin`** is missing from this set, **`fetch`** fails with **Failed to fetch** / CORS — list **every** real web origin (custom domain, apex vs `www`, production vs preview) on the **API** host (see **Deployment** below).
- **Port:** **`PORT`** (e.g. Railway) **or** **`API_PORT`**, default **4000**.
- **Config:** `@nestjs/config` reads **repo-root** `.env` / `.env.local` (paths resolved from `dist/` up three levels in `app.module.ts`).

## Deployment (production)

- **Canonical API host:** **Railway** (long-lived Node: REST + Socket.IO). Repo root **`railway.json`** + **`npm run build:api`** / **`npm run start:api`** — **do not** set Railway **Root Directory** to `apps/api`; the monorepo root must install workspace packages **`@work-ledger/db`** and **`@work-ledger/contracts`**.
- **Web** stays on **Vercel** (`apps/web` only). **`NEXT_PUBLIC_API_URL`** on Vercel must be the **public HTTPS base URL** of the Railway API (no trailing slash).
- **Retired:** a **second Vercel project** that deployed only **`apps/api`** — remove it in the Vercel dashboard once traffic uses Railway (avoids duplicate env, cost, and confusion). CORS / JWT env vars for the API live on **Railway**, not on a Vercel API project.
- **Shared CORS config** with Socket.IO: `apps/api/src/cors-origins.ts`.

## Global authentication

- **`AuthModule`** registers **`JwtAuthGuard`** as **`APP_GUARD`** (`apps/api/src/auth/auth.module.ts`).
- Every route is protected unless marked **`@Public()`** (e.g. `GET /health`).
- Client sends **`Authorization: Bearer <jwt>`**; guard calls **`AuthService.verifyBearerJwt`** (JWKS + issuer/audience). See [[auth-jwt-and-env]].

## Modules (domain boundaries)

| Module | Responsibility |
|--------|----------------|
| `DbModule` | Drizzle `AppDatabase` injection token `DRIZZLE` |
| `AuthorizationModule` | Org membership, task access, list filtering by role |
| `AuthModule` | JWT verification only (no session cookies here) |
| `OrganizationsModule` | Orgs CRUD + member upsert |
| `DepartmentsModule` | Departments within org |
| `ListsModule` | Lists (belong to department + org) |
| `TasksModule` | Task CRUD surface (two controllers — see below) |

## HTTP route map (conceptual)

**Organizations**

- `GET/POST /organizations`
- `GET/PATCH /organizations/:organizationId`
- `DELETE /organizations/:organizationId` — **owner only**; cascades full org data (FK).
- `GET/POST /organizations/:organizationId/members`

**Departments** — `GET/POST /organizations/:organizationId/departments`, `PATCH .../departments/:departmentId`, `DELETE .../departments/:departmentId` (**owner**; cascades lists + tasks)

**Lists** — `GET/POST /organizations/:organizationId/lists`, `PATCH .../lists/:listId`, `DELETE .../lists/:listId` (**owner**; cascades tasks)

**Tasks (org-scoped list + create)**

- `GET /organizations/:organizationId/tasks` — list filtered by [[domain-authorization-and-tasks]]
- `POST /organizations/:organizationId/tasks` — create; **`assignerId`** = current user; optional **`initialSubtasks`** (bulk checklist in one transaction). Response is **slim** — see [[task-write-contracts-and-cache]] (not the same as `GET` detail).

**Workspace shell**

- `GET /organizations/:organizationId/workspace` — departments, lists, members, tasks with **batched subtasks** (avoids N per-task subtask fetches for the board).

**Tasks (by id)**

- `GET /tasks/:taskId` — **full** task detail including **complete** `ledger` (use this when you need full history).
- `PATCH /tasks/:taskId` — Zod `patchTaskSchema` (optional **`subtasksToCreate`** for bulk new lines). Response is **slim** — [[task-write-contracts-and-cache]].
- `POST /tasks/:taskId/ledger` — append ack/note/status_change
- `POST /tasks/:taskId/reschedule` — due change + reason → ledger type `reschedule`; response **slim**
- `POST /tasks/:taskId/status` — status transition (delegates to patch)
- `GET/POST /tasks/:taskId/subtasks`, `PATCH .../subtasks/:subtaskId`
- `POST /tasks/:taskId/archive` — **owner** or **department manager** for the task’s list’s level; soft-delete (`deletedAt` + ledger `archive`); response **slim**
- `GET /tasks/:taskId/report.pdf` — PDF attachment (`pdf-lib`)

## Guards beyond JWT

- (Archive is enforced in **`TasksService.archive`** after **`getTaskAccess`** — no separate guard.)

## Validation & shared types

- Request bodies parsed with **Zod schemas** from **`@work-ledger/contracts`** inside `TasksService` / org services — single source of truth with optional reuse on clients.

## Health

- `GET /health` → `{ ok: true }` (public).

## Build dependency

- `prebuild` / `predev` build **`@work-ledger/db`** and **`@work-ledger/contracts`** first (CJS-compatible outputs for Nest). See [[packages-and-data-layer]].
