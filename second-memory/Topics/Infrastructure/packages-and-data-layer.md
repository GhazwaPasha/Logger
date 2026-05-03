# Packages: DB + contracts

Shared libraries consumed by **web**, **api**, and optionally tooling. Linked from [[00-map-overview]].

## `@work-ledger/db`

- **ORM:** Drizzle against **PostgreSQL**.
- **Exports:** `.` (DB factory + helpers), `./schema` (table definitions + relations).
- **Dual build:** ESM `dist/` + CJS `dist-cjs/` with `exports` map — required because **Nest** runs as CommonJS in production (avoids `ERR_REQUIRE_ESM`). Same pattern as contracts.
- **`normalizeDatabaseUrl()`** — upgrades legacy `sslmode` values for `pg` warning compatibility; used when creating pools (web auth, API DB module).
- **DNS / dual-stack:** `@work-ledger/db` loads **`pg-dns-order`** first so Node prefers **IPv4 before IPv6** when both exist (`dns.setDefaultResultOrder('ipv4first')`), avoiding long **`ETIMEDOUT`** on broken IPv6 routes. See [[postgres-node-pg-dns-ipv4first]] for behavior and **how to reverse** it.
- **Scripts (via root `npm run db:*`):**
  - `db:generate` — Drizzle kit migrations from schema drift
  - `db:migrate` — apply migrations (`tsx src/migrate-cli.ts`)
  - `db:studio` — Drizzle Studio
  - `db:seed` — seed script

Schema tables split mentally into:

- **Auth schema** (Better Auth): `user`, `session`, `account`, `verification`, `jwks`
- **App schema:** `organizations`, `organization_members`, `departments`, `lists`, `tasks`, `subtasks`, `task_assignees`, `activity_ledger`

Full column list and enums: see `packages/db/src/schema.ts`. High-level domain relationships are summarized in [[domain-authorization-and-tasks]].

## `@work-ledger/contracts`

- **Zod** schemas for API boundaries: org/member/list/task create-update, ledger append, reschedule, patch task (status, priority, title, assignees, **`dueAt`**, **`dueRepeat`**), etc.
- Versioned alongside migrations when fields change (e.g. **`due_repeat`** column).

## Repo workspace name

- NPM package name **`work-ledger`** at root; workspaces `apps/*`, `packages/*`. This is independent of the **LogBase** product name.
