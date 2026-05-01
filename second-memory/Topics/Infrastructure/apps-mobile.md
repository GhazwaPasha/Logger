# apps-mobile (Expo)

Companion client demonstrating **same backend contract** as web: Better Auth client + REST with Bearer JWT. Linked from [[00-map-overview]].

## Stack

- **Expo** (~54), **React Native** 0.81, **better-auth** client.
- **expo-sqlite** — local **`work-ledger.db`** (filename is a legacy technical name; product is LogBase).
- **expo-haptics** — light UX feedback.

## API usage

- **`apps/mobile/src/api.ts`** — `apiFetch` / `apiJson` toward configured API base (parallel to web’s `api.ts`).
- **`authClient.token()`** — obtains JWT for `Authorization` header; failed refresh clears token.

## Offline behavior

- **`outbox`** module — queues failed POSTs to SQLite; **`flushOutbox`** runs after successful task list load when token present.

## CORS

- API `main.ts` allows **`exp://`** origins so Expo can call local API during development.

## Scope

- UI is intentionally smaller than web (orgs picker, task list, basic ledger/subtask flows); feature parity is not implied.
