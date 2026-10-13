import { useQueryClient } from '@tanstack/react-query';
import { RealtimeClient } from '@work-ledger/client-core';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';

import { tokenManager } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { invalidateWorkspace } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

/** Coalesce a burst of `workspace_changed` events (e.g. autosave, bulk moves) into one refetch, like the web. */
const WORKSPACE_REFETCH_DEBOUNCE_MS = 750;

/** Teammates currently online in this workspace (away ones excluded), in the order they came online. */
const OnlinePresenceContext = createContext<string[]>([]);

/**
 * Live "who's online" and live workspace updates, over the API's collaboration socket (shared
 * `RealtimeClient`, same as the web). The socket lives as long as the workspace is open: it is
 * suspended in the background and resumed in the foreground, and re-reads the current token on every
 * reconnect, so token renewal never interrupts it. Handshake refusals are typed — a removed member
 * stops for good instead of retrying.
 */
export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const { org } = useWorkspace();
  const orgId = org?.id;
  const qc = useQueryClient();
  const [online, setOnline] = useState<string[]>([]);

  useEffect(() => {
    if (!orgId) return;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    let lastVersion = 0;
    const changedTaskIds = new Set<string>();
    // An event without a task (channels, members…) always refetches; task events skip this device's own saves.
    let untargeted = false;

    const client = new RealtimeClient({
      io,
      url: API_URL,
      organizationId: orgId,
      tokens: tokenManager,
      transports: ['websocket'],
      onPresenceSync: (p) => {
        const away = new Set(p.awayUserIds ?? []);
        setOnline(p.onlineUserIds.filter((id) => !away.has(id)));
      },
      onPresenceUpdate: (p) => {
        setOnline((prev) => {
          const rest = prev.filter((id) => id !== p.userId);
          return p.status === 'online' ? [...rest, p.userId] : rest;
        });
      },
      onWorkspaceChanged: (e) => {
        if (e.version <= lastVersion) return;
        lastVersion = e.version;
        if (e.scope === 'task' && e.taskId) changedTaskIds.add(e.taskId);
        else untargeted = true;
        if (refetchTimer) clearTimeout(refetchTimer);
        refetchTimer = setTimeout(() => {
          refetchTimer = null;
          void invalidateWorkspace(qc, orgId, changedTaskIds, untargeted);
          changedTaskIds.clear();
          untargeted = false;
        }, WORKSPACE_REFETCH_DEBOUNCE_MS);
      },
      onStatus: (s) => {
        if (s.state !== 'connected') setOnline([]);
      },
    });

    // Only count as online while the app is open.
    if (AppState.currentState !== 'active') client.suspend();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.resume();
      else client.suspend();
    });

    return () => {
      sub.remove();
      if (refetchTimer) clearTimeout(refetchTimer);
      client.close();
      setOnline([]);
    };
  }, [orgId, qc]);

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
