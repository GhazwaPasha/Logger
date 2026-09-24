import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { getApiToken } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { invalidateWorkspace } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

type PresenceSyncPayload = { onlineUserIds: string[]; awayUserIds?: string[] };
type PresenceUpdatePayload = { userId: string; status: 'online' | 'offline' | 'away' };
type WorkspaceChangedPayload = { organizationId?: string; taskId?: string | null };

/** Coalesce a burst of `workspace_changed` events (e.g. autosave, bulk moves) into one refetch, like the web. */
const WORKSPACE_REFETCH_DEBOUNCE_MS = 1500;

/** Teammates currently online in this workspace (away ones excluded), in the order they came online. */
const OnlinePresenceContext = createContext<string[]>([]);

/**
 * Live "who's online" for the workspace, from the API's collaboration socket (`org-collaboration.gateway.ts`,
 * the same channel the web header uses): a `presence_sync` snapshot on connect, then `presence_update`s.
 * Connected only while the app is in the foreground, so this device counts as online only while it's open.
 * The same socket carries `workspace_changed`, which refetches tasks and the rest of the workspace live.
 */
export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const { org } = useWorkspace();
  const orgId = org?.id;
  const qc = useQueryClient();
  const [online, setOnline] = useState<string[]>([]);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!orgId || !foreground) return;
    let socket: Socket | null = null;
    let cancelled = false;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const changedTaskIds = new Set<string>();
    // An event without a task (channels, members…) always refetches; task events skip this device's own saves.
    let untargeted = false;

    void getApiToken()
      .then((token) => {
        if (cancelled) return;
        socket = io(API_URL, {
          path: '/socket.io/',
          auth: { token, organizationId: orgId },
          transports: ['websocket'],
          reconnectionAttempts: 8,
          reconnectionDelay: 1500,
        });
        socket.on('presence_sync', (p: PresenceSyncPayload) => {
          const away = new Set(p.awayUserIds ?? []);
          setOnline(p.onlineUserIds.filter((id) => !away.has(id)));
        });
        socket.on('presence_update', (p: PresenceUpdatePayload) => {
          setOnline((prev) => {
            const rest = prev.filter((id) => id !== p.userId);
            return p.status === 'online' ? [...rest, p.userId] : rest;
          });
        });
        // Tasks, comments, channels… changed by anyone (this device included — a refetch is harmless).
        socket.on('workspace_changed', (p: WorkspaceChangedPayload) => {
          if (p?.organizationId !== orgId) return;
          if (p.taskId) changedTaskIds.add(p.taskId);
          else untargeted = true;
          if (refetchTimer) clearTimeout(refetchTimer);
          refetchTimer = setTimeout(() => {
            refetchTimer = null;
            void invalidateWorkspace(qc, orgId, changedTaskIds, untargeted);
            changedTaskIds.clear();
            untargeted = false;
          }, WORKSPACE_REFETCH_DEBOUNCE_MS);
        });
      })
      .catch(() => {
        // Not signed in / offline: no presence, the header just shows the bell and avatar.
      });

    return () => {
      cancelled = true;
      if (refetchTimer) clearTimeout(refetchTimer);
      socket?.disconnect();
      setOnline([]);
    };
  }, [orgId, foreground, qc]);

  return <OnlinePresenceContext.Provider value={online}>{children}</OnlinePresenceContext.Provider>;
}

/** Other members online right now (you're left out — your own status is the dot on your avatar). */
export function useOnlineTeammates() {
  const online = useContext(OnlinePresenceContext);
  const { members, userId } = useWorkspace();
  return useMemo(() => {
    const byId = new Map(members.map((m) => [m.userId, m]));
    return online.filter((id) => id !== userId).flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
  }, [online, members, userId]);
}
