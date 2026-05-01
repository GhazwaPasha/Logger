# Auth: Better Auth + API JWT

Cross-cutting security and configuration for **web session** vs **API Bearer JWT**. Linked from [[00-map-overview]]; incidents in [[Chat-inbox]].

## Components

1. **Better Auth (Next.js)** — email/password, cookies, Drizzle-stored sessions, **`jwt` plugin** publishing keys in **`jwks`** table.
2. **API** — stateless verification via **`jose`**: remote JWKS URL, issuer, audience.

## API-side env (names only)

- **`AUTH_JWKS_URL`** — Full URL to the **JWKS document** of the Next app that minted the token (e.g. `…/api/auth/jwks` per Better Auth conventions for your deployment).
- **`AUTH_ISSUER`** — Optional; comma-separated list accepted. Falls back to **`NEXT_PUBLIC_APP_URL`** if unset.
- **`AUTH_AUDIENCE`** — Optional; comma-separated. Falls back to **`NEXT_PUBLIC_APP_URL`** if unset.

If issuer/audience don’t match JWT claims → **`401 Invalid or expired token`** (generic message).

## Web-side env (names only)

- **`DATABASE_URL`** — Required for auth adapter.
- **`BETTER_AUTH_URL`** — Preferred canonical base for Better Auth when set.
- **`NEXT_PUBLIC_APP_URL`** — Public site URL; used in **`resolveAuthBaseUrl()`** before **`VERCEL_URL`** so tokens use a **stable issuer** when explicit Better Auth URL is absent.
- **`BETTER_AUTH_SECRET`** — Required in prod (dev fallback exists in code but must not ship).
- **`VERCEL_URL`** — Preview host; combined with trusted origins / fallbacks for CORS and auth base resolution.

## Alignment checklist (local or prod)

1. **Same database** for Better Auth keys as intended environment — JWKS private/public keys live in DB; pointing API at prod JWKS while logging into local web fails.
2. **`AUTH_JWKS_URL`** targets the **same origin** that issued the token you send to the API.
3. **No duplicate env keys** in one file — last wins (classic footgun for `NEXT_PUBLIC_APP_URL`).
4. After changing auth env, **sign out and sign in** to mint a fresh JWT.

## CORS

- API allows browser origin from **`NEXT_PUBLIC_APP_URL`**, localhost variants, and Expo `exp://`.

## Deep references

- Implementation: `apps/api/src/auth/auth.service.ts`, `apps/web/src/lib/auth.ts`
- Better Auth JWKS encryption note: `disablePrivateKeyEncryption: true` on JWT plugin (see comment in `auth.ts` re: deploy secret drift).
