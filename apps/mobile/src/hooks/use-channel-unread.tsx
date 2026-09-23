import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useActiveTasks } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

/** Per-workspace blob of `{ listId: lastSeenEpochMs }`, mirroring the web's per-list `localStorage` keys. */
const listLastSeenKey = (orgId: string) => `logbase.listLastSeen.${orgId}`;

type ChannelUnreadValue = {
  /** Channel has activity newer than the last time it was opened (the Discord-style unread pill). */
  hasUnread: (listId: string) => boolean;
  /** Open (not done / cancelled) tasks per channel, from the same active-task fetch. */
  openCount: (listId: string) => number;
  markListSeen: (listId: string) => void;
  /** Newest task activity on a channel (epoch ms), 0 when none. */
  latestActivity: (listId: string) => number;
  lastSeen: (listId: string) => number;
};

const ChannelUnreadContext = createContext<ChannelUnreadValue | null>(null);

/**
 * Unread state for channels, shared by the channel list and the board so opening a board clears its pill
 * everywhere (mirrors `WorkspaceSidebar.tsx` on the web).
 */
export function ChannelUnreadProvider({ children }: { children: ReactNode }) {
  const { org } = useWorkspace();
  const orgId = org?.id;
  const active = useActiveTasks(orgId);

  const { latestByList, countByList } = useMemo(() => {
    const latest = new Map<string, number>();
    const count = new Map<string, number>();
    for (const t of active.data ?? []) {
      count.set(t.listId, (count.get(t.listId) ?? 0) + 1);
      const iso = t.lastLedger?.createdAt ?? t.updatedAt ?? t.createdAt;
      if (!iso) continue;
      const ts = new Date(iso).getTime();
      if (Number.isNaN(ts)) continue;
      if (ts > (latest.get(t.listId) ?? 0)) latest.set(t.listId, ts);
    }
    return { latestByList: latest, countByList: count };
  }, [active.data]);

  const [seen, setSeen] = useState<{ orgId: string; byList: Record<string, number> } | null>(null);

  /** Hydrate this workspace's last-seen timestamps once its id is known. */
  useEffect(() => {
    if (!orgId) return;
    let live = true;
    SecureStore.getItemAsync(listLastSeenKey(orgId))
      .then((raw) => {
        if (!live) return;
        try {
          setSeen({ orgId, byList: raw ? (JSON.parse(raw) as Record<string, number>) : {} });
        } catch {
          setSeen({ orgId, byList: {} });
        }
      })
      .catch(() => live && setSeen({ orgId, byList: {} }));
    return () => {
      live = false;
    };
  }, [orgId]);

  const byList = useMemo(() => (seen && seen.orgId === orgId ? seen.byList : {}), [seen, orgId]);

  const markListSeen = useCallback(
    (listId: string) => {
      if (!orgId) return;
      setSeen((prev) => {
        const base = prev && prev.orgId === orgId ? prev.byList : {};
        const next = { ...base, [listId]: Date.now() };
        SecureStore.setItemAsync(listLastSeenKey(orgId), JSON.stringify(next)).catch(() => {});
        return { orgId, byList: next };
      });
    },
    [orgId],
  );

  const value = useMemo<ChannelUnreadValue>(
    () => ({
      // Until the stored timestamps load, nothing reads as unread (no flash of pills on start-up).
      hasUnread: (listId) => !!seen && (latestByList.get(listId) ?? 0) > (byList[listId] ?? 0),
      openCount: (listId) => countByList.get(listId) ?? 0,
      markListSeen,
      latestActivity: (listId) => latestByList.get(listId) ?? 0,
      lastSeen: (listId) => byList[listId] ?? 0,
    }),
    [seen, latestByList, countByList, byList, markListSeen],
  );

  return <ChannelUnreadContext.Provider value={value}>{children}</ChannelUnreadContext.Provider>;
}

export function useChannelUnread(): ChannelUnreadValue {
  const ctx = useContext(ChannelUnreadContext);
  if (!ctx) throw new Error('useChannelUnread must be used inside <ChannelUnreadProvider>');
  return ctx;
}
