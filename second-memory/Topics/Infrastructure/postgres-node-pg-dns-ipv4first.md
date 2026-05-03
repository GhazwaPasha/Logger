# Postgres / `pg`: DNS result order (`ipv4first`)

**Status:** Active (as of 2026-05-03).  
**Related:** [[packages-and-data-layer]], [[Chat-inbox]] (search *Postgres DNS* / *ETIMEDOUT*).

## Why this exists

On some networks (often home Wi‑Fi / ISPs), a hostname resolves to **both** IPv4 (**A**) and IPv6 (**AAAA**), but the **IPv6 path does not reach the internet**. Node’s default resolution order can try IPv6 first; **`pg`** then sits until **TCP timeout** (~24s), which showed up as **`ETIMEDOUT`** on Better Auth sign-in (user lookup query). Switching networks “fixed” it because the path or DNS order changed.

## What we changed

We call Node’s **`dns.setDefaultResultOrder('ipv4first')`** **once per process**, **before** any `pg` `Pool` connects, so dual-stack hosts prefer **IPv4 first**.

- **IPv6-only** hosts (no **A** record): Node still returns **AAAA** only — this does **not** remove IPv6-only support.
- This is **process-wide** for the Node runtime (web dev server, API server, migrate CLI). It affects any code in that process using the default DNS lookup behavior, not only Postgres.

### Files

| File | Role |
|------|------|
| `packages/db/src/pg-dns-order.ts` | Side-effect module: runs `setDefaultResultOrder('ipv4first')` when available (Node 17+). |
| `packages/db/src/index.ts` | **First import** is `./pg-dns-order.js` so every consumer of `@work-ledger/db` sets order before pools. |
| `packages/db/src/migrate-cli.ts` | Imports `./pg-dns-order.js` **before** `pg` so `npm run db:migrate` does not skip the hook. |

**Consumers (no code change required):** `apps/web` (Better Auth pool via `@work-ledger/db`), `apps/api` (`DbModule` imports `@work-ledger/db` before creating `Pool`), `packages/db` seed via `createDb` from index.

## How to reverse / remove

1. **Delete** `packages/db/src/pg-dns-order.ts`.
2. In **`packages/db/src/index.ts`**, remove the line `import "./pg-dns-order.js";` (keep other imports as they were).
3. In **`packages/db/src/migrate-cli.ts`**, remove the line `import "./pg-dns-order.js";`.
4. Rebuild the package: from repo root, `npm run build -w @work-ledger/db`.
5. Restart **Next** and **API** dev servers (and redeploy if you had shipped this).

Optional: if you only want to **change policy** instead of removing:

- Restore Node’s default dual-stack ordering: call **`dns.setDefaultResultOrder('verbatim')`** in the same place (still early, before `pg` connects). Document why — usually only if `ipv4first` causes a problem on an IPv6-first network you control.

## References

- Node.js: [`dns.setDefaultResultOrder(order)`](https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder)
