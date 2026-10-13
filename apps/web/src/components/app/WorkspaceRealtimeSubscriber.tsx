"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RealtimeClient } from "@work-ledger/client-core";
import { REALTIME_EVENTS, type WorkspaceChangedEvent } from "@work-ledger/contracts";
import { useEffect } from "react";
import { io } from "socket.io-client";
import { useApiSession } from "@/hooks/useApiSession";
import { orgKeys, performanceKeys, roadmapKeys, taskKeys, workspaceKeys } from "@/lib/query-keys";
import { getApiBaseUrl, tokenManager } from "@/lib/session";
import { useOnlinePresence } from "./OnlinePresenceProvider";

const IDLE_AFTER_MS = 10 * 60 * 1000; // 10 minutes
/** Coalesce a burst of change events (autosave, bulk moves) into one targeted refresh. */
const INVALIDATE_DEBOUNCE_MS = 750;

/**
 * Keeps this workspace live: one long-lived socket (see `RealtimeClient`) whose change events
 * refresh only what the change could affect. Session problems are handled by the token manager —
 * nothing here can trigger token refreshes or app-wide refetches.
 */
export function WorkspaceRealtimeSubscriber({ workspaceId }: { workspaceId: string }) {
  const { token } = useApiSession();
  const signedIn = token !== null;
  const queryClient = useQueryClient();
  const { setOnlineUserIds, setAwayUserIds } = useOnlinePresence();

  useEffect(() => {
    if (!signedIn) return;

    let lastVersion = 0;
    let pending: { taskIds: Set<string>; workspace: boolean } = { taskIds: new Set(), workspace: false };
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      const { taskIds, workspace } = pending;
      pending = { taskIds: new Set(), workspace: false };
      const ws = workspaceKeys.workspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: ws, exact: true });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.activity(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: [...ws, "task-counts"] });
      void queryClient.invalidateQueries({ queryKey: [...ws, "series-summary"] });
      void queryClient.invalidateQueries({ queryKey: [...ws, "series-occurrences"] });
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: [...performanceKeys.all, workspaceId] });
      for (const id of taskIds) void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      if (workspace) {
        void queryClient.invalidateQueries({ queryKey: [...ws, "archived-tasks"] });
        void queryClient.invalidateQueries({ queryKey: [...ws, "deletion-log"] });
        void queryClient.invalidateQueries({ queryKey: orgKeys.all });
      }
    };

    const onWorkspaceChanged = (e: WorkspaceChangedEvent) => {
      // Versions are monotonic per org; a stale or duplicate delivery carries nothing new.
      if (e.version <= lastVersion) return;
      lastVersion = e.version;
      if (e.scope === "task" && e.taskId) pending.taskIds.add(e.taskId);
      else pending.workspace = true;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, INVALIDATE_DEBOUNCE_MS);
    };

    const client = new RealtimeClient({
      io,
      url: getApiBaseUrl(),
      organizationId: workspaceId,
      tokens: tokenManager,
      onWorkspaceChanged,
      onPresenceSync: (p) => {
        const away = new Set(p.awayUserIds ?? []);
        setAwayUserIds(away);
        setOnlineUserIds(new Set(p.onlineUserIds.filter((id) => !away.has(id))));
      },
      onPresenceUpdate: (p) => {
        setAwayUserIds((prev) => {
          const next = new Set(prev);
          if (p.status === "away") next.add(p.userId);
          else next.delete(p.userId);
          return next;
        });
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (p.status === "online") next.add(p.userId);
          else next.delete(p.userId);
          return next;
        });
      },
    });

    // Idle detection: tell teammates we're away after inactivity.
    let isAway = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const goAway = () => {
      if (isAway) return;
      isAway = true;
      client.emit(REALTIME_EVENTS.presenceAway);
    };
    const comeBack = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (isAway) {
        isAway = false;
        client.emit(REALTIME_EVENTS.presenceActive);
      }
      idleTimer = setTimeout(goAway, IDLE_AFTER_MS);
    };
    const activityEvents = ["mousemove", "keydown", "click", "touchstart"] as const;
    activityEvents.forEach((ev) => window.addEventListener(ev, comeBack, { passive: true }));
    idleTimer = setTimeout(goAway, IDLE_AFTER_MS);

    return () => {
      client.close();
      setOnlineUserIds(new Set());
      setAwayUserIds(new Set());
      activityEvents.forEach((ev) => window.removeEventListener(ev, comeBack));
      if (idleTimer) clearTimeout(idleTimer);
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [signedIn, workspaceId, queryClient, setOnlineUserIds, setAwayUserIds]);

  return null;
}
