# WebSockets + Railway — implementation plan

## Status (2026-05-05)

**v1 shipped in repo:** Socket.IO gateway on Nest (`RealtimeModule`), `workspace_changed` emits from **`TasksService`**, **`OrganizationsService`** (create / patch / member upsert), **`ListsService`**, **`DepartmentsService`**; web **`WorkspaceRealtimeSubscriber`** invalidates workspace + activity + optional task detail; **`collaboration_auth_error`** + **`connect_error`** (auth-like messages) → **`wl:auth-expired`**. **`PORT`** in `main.ts`. **`JwtAuthGuard`** skips `ws`. **`REDIS_URL`:** when set, **`@socket.io/redis-adapter`** + **`redis`** clients enable multi-instance fan-out; gateway **`onModuleDestroy`** quits Redis. **`CollaborationService.notifyOrgChanged`** wraps emits in try/catch. Polling **`refetchInterval`** removed from workspace/task detail (push + refocus).

For [[apps-api]] + [[apps-web]]: org-scoped **push** so teammates see updates without relying on polling. **Neon** unchanged. **Vercel** keeps Next; **Railway** runs Nest (REST + WS).

## Goals

- After **any mutating** API path that should refresh others’ UIs, **broadcast** a tiny event to all sockets in that **organization**.
- **Web** subscribes while `WorkspaceDataProvider` is mounted; on event → **`queryClient.invalidateQueries`** for `workspaceKeys.workspace(orgId)` and optionally `taskKeys.detail(taskId)`.
- **Single Railway service** first; **Redis adapter** when API scales beyond one replica.

## Transport choice (recommended)

| Option | Pros | Cons |
|--------|------|------|
| **Socket.IO** (`@nestjs/platform-socket.io`) | Built-in **rooms**, **reconnect**, official **Redis adapter** for multi-instance | Not “raw” `WebSocket` in DevTools (still WS under the hood) |
| **Native WS** (`@nestjs/platform-ws`) | Minimal deps | Multi-instance fan-out = **custom Redis** code |

**Recommendation:** **Socket.IO** for faster delivery and a clear path to **horizontal scaling**.

## API (`apps/api`)

### 1) Dependencies

- `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`
- Later: `@socket.io/redis-adapter`, `redis` / `ioredis` (only when second replica is real)

### 2) Module layout

- New **`RealtimeModule`** (or `CollaborationModule`):
  - **`OrgCollaborationGateway`** — `@WebSocketGateway({ cors: { origin: … } })` aligned with `main.ts` CORS rules (same env-driven allowlist; credentials if cookies ever used).
  - **`CollaborationService`** — wraps `Server` / `Namespace`; methods like `emitOrgWorkspaceChanged(organizationId, payload)`.
- Register **`RealtimeModule`** in `AppModule`.

### 3) Auth + authorization (handshake)

- Browser `socket.io-client` cannot set `Authorization` header on the initial HTTP upgrade the same way as `fetch` — standard pattern:
  - **`auth: { token: '<jwt>' }`** in client options (Socket.IO puts this in handshake), **or**
  - Query string **`?token=`** (works but leaks in logs/referrer more easily — prefer **`auth`** payload).
- **`WsJwtGuard`** (implements `CanActivate` for `WsException` context):
  - Read token from `client.handshake.auth.token` (or query fallback).
  - Call existing **`AuthService.verifyBearerJwt`** (same as `JwtAuthGuard` in `jwt-auth.guard.ts`).
  - Attach `userId` to `socket.data`.
- **`WsOrgMemberGuard`** (after JWT):
  - Read **`organizationId`** from handshake (client must send org they intend to join).
  - Call **`AuthorizationService.assertOrgMember(userId, organizationId)`** (same as REST).
- **`handleConnection`**: after guards pass, **`client.join(orgRoom(organizationId))`** where `orgRoom(id) = \`org:${id}\``.

### 4) Event contract (minimal v1)

Server → client only (client does not need to emit business events in v1):

```json
{
  "type": "workspace_changed",
  "organizationId": "<uuid>",
  "taskId": "<uuid> | null",
  "at": "<ISO timestamp>"
}
```

Optional later: monotonic **`revision`** per org from DB to detect gaps after reconnect.

### 5) Emit from write paths

- Inject **`CollaborationService`** into services that already run after commits:
  - **`TasksService`** — after `patchTask`, create, archive, reschedule, subtask mutations, ledger append (where you already call push / return `taskMutationResult`).
  - **`OrganizationsService`**, **`ListsService`**, **`DepartmentsService`** — any patch that changes workspace bootstrap shape (members, lists, depts).
- **Rule:** emit **after** successful transaction / DB write; **catch errors** in broadcaster so a WS failure never fails the HTTP response.
- **Do not** send full task JSON over WS — keep HTTP as source of truth; WS is a **signal** to refetch.

### 6) Multi-instance (phase 2)

- When Railway **replicas > 1**, enable **Socket.IO Redis adapter** so publishes from instance A reach clients on instance B.
- Env: **`REDIS_URL`** (Railway Redis plugin).

### 7) Railway-specific

- **`PORT`:** Railway sets `PORT`. Nest currently uses **`API_PORT`** in `main.ts`. Set **`API_PORT=$PORT`** in Railway **or** change bootstrap to `Number(process.env.PORT ?? process.env.API_PORT ?? 4000)`.
- **Health:** existing **`GET /health`** — use for Railway health checks.
- **HTTPS / WSS:** Railway provides TLS; browser uses **`wss://`** against `NEXT_PUBLIC_API_URL` host.

## Web (`apps/web`)

### 1) Client module

- New hook **`useOrgCollaborationSocket`** (used inside **`WorkspaceShell`** / near `WorkspaceDataProvider`):
  - Inputs: `token`, `organizationId`, `enabled`.
  - `useEffect`: create `io(apiBase(), { path: '/socket.io/', auth: { token } })` — confirm `path` matches gateway config.
  - On **`workspace_changed`** (same org): `queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(organizationId) })`; if `taskId`, optionally invalidate `taskKeys.detail(taskId)`.
  - Cleanup: `socket.disconnect()` on unmount or org switch.

### 2) Dependencies

- `socket.io-client`

### 3) Polling follow-up

- Once WS is stable in prod, **remove or lengthen** `refetchInterval` on `useOrgWorkspace` / `useTaskDetail` (keep **`refetchOnWindowFocus`** as a safety net).

## Security checklist

- **Never** subscribe without **`assertOrgMember`**.
- **CORS / Socket.IO cors** mirrors REST allowlist (`NEXT_PUBLIC_APP_URL`, `API_CORS_ORIGINS`, preview wildcard).
- **Production:** only **`wss://`** to API; JWT stays short-lived as today.
- **Rate limit** new connections per user/org if abuse becomes a concern (later).

## Testing matrix

- Two browsers, same org: **A** edits task → **B** list updates without refresh.
- Token expiry: disconnect or failed handshake; client should **not** spin forever (reconnect with backoff; 401 → dispatch `wl:auth-expired` if applicable).
- Org switch: socket leaves old room, joins new.
- Railway deploy: no regression on REST.

## Rollout order

1. **`PORT` / `API_PORT`** fix + Railway deploy REST-only (no behavior change for users).
2. **Gateway + guards + join room** (no emits yet) — verify client can connect from Vercel origin.
3. **`CollaborationService.emit`** from **`TasksService`** (highest value).
4. **Web client** hook + invalidate.
5. **Expand emits** to other mutating services.
6. **Tune polling**; add **Redis adapter** when replicas > 1.

## Links

- [[task-write-contracts-and-cache]] — client already merges mutation results; WS complements cross-user stale cache.
- [[apps-web]] — query keys, `WorkspaceDataProvider`.
