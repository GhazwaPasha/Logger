# apps-api (NestJS)

Nest HTTP service for **organizations, structure (departments/lists), tasks, ledger, PDF**. Linked from [[00-map-overview]].

## Runtime

- **Bootstrap:** `apps/api/src/main.ts` — loads env via `load-env`, enables **CORS** for `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`), localhost regex, and `exp://` for Expo.
- **Port:** `API_PORT` env, default **4000**.
- **Config:** `@nestjs/config` reads **repo-root** `.env` / `.env.local` (paths resolved from `dist/` up three levels in `app.module.ts`).

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
- `GET/POST /organizations/:organizationId/members`

**Departments** — `GET/POST /organizations/:organizationId/departments`, `PATCH .../departments/:departmentId`

**Lists** — `GET/POST /organizations/:organizationId/lists`, `PATCH .../lists/:listId`

**Tasks (org-scoped list + create)**

- `GET /organizations/:organizationId/tasks` — list filtered by [[domain-authorization-and-tasks]]
- `POST /organizations/:organizationId/tasks` — create; **`assignerId`** = current user

**Tasks (by id)**

- `GET/PATCH /tasks/:taskId` — detail / patch (Zod `patchTaskSchema` from `@work-ledger/contracts`)
- `POST /tasks/:taskId/ledger` — append ack/note/status_change
- `POST /tasks/:taskId/reschedule` — due change + reason → ledger type `reschedule`
- `POST /tasks/:taskId/status` — status transition
- `GET/POST /tasks/:taskId/subtasks`, `PATCH .../subtasks/:subtaskId`
- `POST /tasks/:taskId/archive` — **`AssignerOnlyGuard`**: only **`tasks.assignerId`** may archive
- `GET /tasks/:taskId/report.pdf` — PDF attachment (`pdf-lib`)

## Guards beyond JWT

- **`AssignerOnlyGuard`** — archive; ensures task exists, not deleted, caller is assigner.

## Validation & shared types

- Request bodies parsed with **Zod schemas** from **`@work-ledger/contracts`** inside `TasksService` / org services — single source of truth with optional reuse on clients.

## Health

- `GET /health` → `{ ok: true }` (public).

## Build dependency

- `prebuild` / `predev` build **`@work-ledger/db`** and **`@work-ledger/contracts`** first (CJS-compatible outputs for Nest). See [[packages-and-data-layer]].
