# Online Team Presence — Feature Overview

Shows which teammates are actively connected to the same workspace, displayed as stacked avatar circles in the app header to the left of the notification bell. Your own profile avatar always carries a green dot to indicate you are online.

---

## What Was Built

### Visual Result

```
[ LogBase ]                    [ AB ][ CD ] [ 🔔 ] [ ⚙ ] [ GH● ]
                                  ↑ online teammates    ↑ green dot = you're online
```

- **Stacked circles** (28 px, `size-7`) with a `ring-2` cutout matching the header background — up to 5 shown, then a `+N` chip for overflow
- **Green dot** (`size-2.5`) on each teammate's circle, positioned outside the clip region
- **Tooltip** (native `title`) on hover shows the member's name
- **Initials fallback** — since the app has no profile images, each circle shows 1–2 letter initials derived from the user's name or email
- **Self-excluded** — you never see your own circle in the stack (you're indicated by the green dot on your profile button instead)
- **Hides when alone** — if no other members are connected, the section renders nothing

---

## Architecture

### Presence Flow

```
User connects via Socket.IO
        │
        ▼
OrgCollaborationGateway.verifyAndJoin()
  ├─ joins org room (org:<orgId>)
  ├─ writes to in-memory presence map (orgId → userId → Set<socketId>)
  ├─ emits  presence_sync   → connecting client only   { onlineUserIds: string[] }
  └─ emits  presence_update → rest of org room          { userId, status: "online" }

User disconnects
        │
        ▼
OrgCollaborationGateway.handleDisconnect()
  ├─ removes socket from presence map
  └─ if last socket for that user → emits presence_update { status: "offline" } to org room
```

The in-memory map handles **multiple tabs per user**: a user is only marked offline when their last socket disconnects.

### Frontend State

```
OnlinePresenceProvider  (React context, lives in WorkspaceShell)
  └─ state: Set<userId>   ← written by WorkspaceRealtimeSubscriber

WorkspaceRealtimeSubscriber  (null-render component)
  ├─ listens: presence_sync   → replaces the full Set
  ├─ listens: presence_update → adds or removes one userId
  └─ on cleanup: resets Set to empty

OnlineMembersAvatars  (rendered in AppHeader)
  ├─ reads: members[]       from useWorkspaceData()
  ├─ reads: onlineUserIds   from useOnlinePresence()
  └─ filters: members where userId ∈ onlineUserIds AND userId ≠ currentUser
```

---

## Files Changed

### Backend — `apps/api/`

| File | Change |
|------|--------|
| `src/realtime/org-collaboration.gateway.ts` | Added `OnGatewayDisconnect`; in-memory `presence` map (`Map<orgId, Map<userId, Set<socketId>>>`); emits `presence_sync` on connect and `presence_update` on connect/disconnect |
| `src/organizations/organizations.service.ts` | `listMembers()` now selects and returns `image` from the `user` table |

### Frontend — `apps/web/`

| File | Change |
|------|--------|
| `src/lib/ledger-types.ts` | Added `image?: string \| null` to `MemberRow` type |
| `src/components/app/OnlinePresenceProvider.tsx` | **New** — React context holding `Set<userId>` of online users + `useOnlinePresence()` hook |
| `src/components/app/WorkspaceRealtimeSubscriber.tsx` | Added `presence_sync` and `presence_update` socket listeners; clears presence on disconnect |
| `src/components/app/OnlineMembersAvatars.tsx` | **New** — stacked avatar component; reads from both workspace members and presence context |
| `src/components/app/AppHeader.tsx` | Imports `OnlineMembersAvatars`; renders it before the notification bell (when in workspace); adds green dot to own profile avatar |
| `src/components/app/WorkspaceShell.tsx` | Wraps the workspace tree with `<OnlinePresenceProvider>` so both subscriber and header share the same presence state |

---

## Socket Events Reference

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `presence_sync` | server → connecting client | `{ onlineUserIds: string[] }` | On every successful socket connect |
| `presence_update` | server → org room (excl. sender) | `{ userId: string, status: "online" \| "offline" }` | When any member connects or disconnects |

---

## Known Requirement

**The API server must be restarted** after the gateway changes for presence events to be emitted. Next.js HMRs the frontend automatically, but NestJS requires a full process restart to load the new gateway code.

To verify it's working after restart:
1. DevTools → Network → WS → click the Socket.IO connection
2. Messages tab should show a `presence_sync` frame shortly after page load
3. Open a second browser window with a different account in the same workspace — each should see the other's avatar appear

---

## Limitations / Future Work

- **In-memory only** — presence resets if the API server restarts; no persistence
- **Single-instance** — the in-memory map is not shared across API instances (not an issue with a single API pod; Redis adapter is already wired for `workspace_changed` if scaling is needed)
- **No idle/away state** — presence is binary (connected socket = online, no socket = offline); no activity-based idle detection
- **No click action** — avatar circles have a tooltip but are not clickable; could link to a member profile page in the future
