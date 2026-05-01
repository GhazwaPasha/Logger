# apps-web (Next.js)

Primary **LogBase** UI: marketing `/`, **Better Auth** session, authenticated **`/app`** hub, workspace routes **`/<slug>/...`** (folder **`[workspaceId]`** = slug or legacy uuid; route group **`(authenticated)`**). Linked from [[00-map-overview]].

## Stack

- **Next.js** 16, **React** 19, **Tailwind** 4.
- **Better Auth** (`apps/web/src/lib/auth.ts`) with **Drizzle adapter** → same **`DATABASE_URL`** family as API; **JWT plugin** + **`jwks`** table; **`nextCookies()`**.
- **TanStack React Query** for server state after login.
- **`apiFetch` / `apiJson`** (`apps/web/src/lib/api.ts`) — attaches Bearer token, **`cache: no-store`** default, base URL from **`NEXT_PUBLIC_API_URL`** or `http://localhost:4000`.

## Auth flow (mental model)

1. User signs in via Better Auth routes (session cookie on web origin).
2. Client obtains a **JWT** (e.g. token endpoint used by session providers) for **API** calls.
3. Nest API validates JWT against **`AUTH_JWKS_URL`** (must be the **same** web deployment’s JWKS). Misalignment → `401 Invalid or expired token`. See [[auth-jwt-and-env]].

## Important env vars (names only)

- **`DATABASE_URL`** — Better Auth + Drizzle on the web server.
- **`BETTER_AUTH_SECRET`**, optional **`BETTER_AUTH_URL`**, **`NEXT_PUBLIC_APP_URL`** — base URL / issuer stability (especially on Vercel).
- **`NEXT_PUBLIC_API_URL`** — Must be the **API origin** in production (non-empty); blank previously caused org creation to hit the web app and 404.

Optional Better Auth Infra: **`BETTER_AUTH_API_KEY`**, **`BETTER_AUTH_API_URL`**, **`BETTER_AUTH_KV_URL`** (dash plugin in `auth.ts`).

## Routing & UX landmarks

- **Marketing:** `/` (landing).
- **Login:** under `apps/web/src/app` login routes (see repo).
- **`/app`** — authenticated entry; org/workspace resolution, **Add workspace** flow when empty.
- **Workspace:** **`/<org-slug>/...`** (canonical; legacy **`/<uuid>/...`** redirects to slug). **`/work`** board scope (level/list) is **`sessionStorage`** keyed by org id — not query params. **`/work?task=`** still opens the task modal briefly then cleans the URL.
- **Legacy URLs:** **`next.config.mjs`** **301** **`/app/w/:id/...`** → **`/:id/...`**. **`middleware.ts`** still redirects **`/app/orgs/...`** into **`/:id/...`** (dashboard, work, `?task=` deep links).

## Middleware

- **`apps/web/src/middleware.ts`** — matcher limited to `/app/orgs` paths; maps old org URLs to **`/:id/...`** and task paths to **`/work?task=`**.

## Data loading pattern

- Session gate → organizations → parallel fetches for departments, lists, tasks, members (React Query).
- Refresh cost: session + JWT + API bundle can waterfall; see perf notes in [[Chat-inbox]].

## Package deps on shared code

- **`@work-ledger/db`** — schema import for auth tables only on web; **`normalizeDatabaseUrl`** for pool SSL behavior alignment with API.

## Styling

- Single source: **`apps/web/src/app/globals.css`** (Tailwind v4 + CSS variables + utility classes like **`btn-primary`**, glass tokens, inputs).
- Theme: **`data-theme`** on `<html>` (`system` / `light` / `dark`) via **`useThemePreference`** + **`AppPreferencesProvider`**.
- Detail note: [[web-ui-styling]].
