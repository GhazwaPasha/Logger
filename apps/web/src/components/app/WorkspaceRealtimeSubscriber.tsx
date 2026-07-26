"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useApiSession } from "@/hooks/useApiSession";
import { getApiBaseUrl } from "@/lib/api";
import { roadmapKeys, workspaceKeys } from "@/lib/query-keys";
import { useOnlinePresence } from "./OnlinePresenceProvider";

const IDLE_AFTER_MS = 10 * 60 * 1000; // 10 minutes
/** Coalesce rapid workspace_changed events (e.g. autosave) into one list refetch. */
const WORKSPACE_INVALIDATE_DEBOUNCE_MS = 1500;

type WorkspaceChangedPayload = {
  type?: string;
  organizationId?: string;
  taskId?: string | null;
};

type PresenceSyncPayload = { onlineUserIds: string[]; awayUserIds?: string[] };
type PresenceUpdatePayload = { userId: string; status: "online" | "offline" | "away" };

/** Subscribes to org collaboration events; invalidates workspace (and optional task) cache. */
export function WorkspaceRealtimeSubscriber({ workspaceId }: { workspaceId: string }) {
  const { token } = useApiSession();
  const queryClient = useQueryClient();
  const { setOnlineUserIds, setAwayUserIds } = useOnlinePresence();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceInvalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAwayRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    const socket = io(getApiBaseUrl(), {
      path: "/socket.io/",
      auth: { token, organizationId: workspaceId },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 8,
      reconnectionDelay: 1200,
    });

    const onWorkspaceChanged = (payload: WorkspaceChangedPayload) => {
      if (payload?.organizationId !== workspaceId) return;
      if (workspaceInvalidateTimerRef.current) {
        clearTimeout(workspaceInvalidateTimerRef.current);
      }
      workspaceInvalidateTimerRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.activity(workspaceId),
        });
        // Task completion/linking elsewhere should refresh roadmap rollups without a manual reload.
        void queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(workspaceId) });
      }, WORKSPACE_INVALIDATE_DEBOUNCE_MS);
      // Task detail is updated by mutation handlers (PATCH / subtask APIs).
    };

    const onPresenceSync = (payload: PresenceSyncPayload) => {
      const away = new Set(payload.awayUserIds ?? []);
      const online = new Set(
        payload.onlineUserIds.filter((id) => !away.has(id)),
      );
      setAwayUserIds(away);
      setOnlineUserIds(online);
    };

    const onPresenceUpdate = (payload: PresenceUpdatePayload) => {
      if (payload.status === "away") {
        setAwayUserIds((prev) => { const next = new Set(prev); next.add(payload.userId); return next; });
        setOnlineUserIds((prev) => { const next = new Set(prev); next.delete(payload.userId); return next; });
      } else if (payload.status === "online") {
        setAwayUserIds((prev) => { const next = new Set(prev); next.delete(payload.userId); return next; });
        setOnlineUserIds((prev) => { const next = new Set(prev); next.add(payload.userId); return next; });
      } else {
        setAwayUserIds((prev) => { const next = new Set(prev); next.delete(payload.userId); return next; });
        setOnlineUserIds((prev) => { const next = new Set(prev); next.delete(payload.userId); return next; });
      }
    };

    const onAuthError = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wl:auth-expired"));
      }
    };

    const onConnectError = (err: Error) => {
      const msg = (err?.message ?? "").toLowerCase();
      if (
        msg.includes("unauthorized") ||
        msg.includes("invalid") ||
        msg.includes("forbidden") ||
        msg.includes("jwt")
      ) {
        onAuthError();
      }
    };

    socket.on("workspace_changed", onWorkspaceChanged);
    socket.on("presence_sync", onPresenceSync);
    socket.on("presence_update", onPresenceUpdate);
    socket.on("collaboration_auth_error", onAuthError);
    socket.on("connect_error", onConnectError);

    // Idle detection
    function goAway() {
      if (isAwayRef.current) return;
      isAwayRef.current = true;
      socket.emit("presence_away");
    }

    function comeBack() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (isAwayRef.current) {
        isAwayRef.current = false;
        socket.emit("presence_active");
      }
      idleTimerRef.current = setTimeout(goAway, IDLE_AFTER_MS);
    }

    const activityEvents = ["mousemove", "keydown", "click", "touchstart"] as const;
    activityEvents.forEach((ev) => window.addEventListener(ev, comeBack, { passive: true }));
    idleTimerRef.current = setTimeout(goAway, IDLE_AFTER_MS);

    return () => {
      socket.off("workspace_changed", onWorkspaceChanged);
      socket.off("presence_sync", onPresenceSync);
      socket.off("presence_update", onPresenceUpdate);
      socket.off("collaboration_auth_error", onAuthError);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
      setOnlineUserIds(new Set());
      setAwayUserIds(new Set());
      activityEvents.forEach((ev) => window.removeEventListener(ev, comeBack));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (workspaceInvalidateTimerRef.current) clearTimeout(workspaceInvalidateTimerRef.current);
    };
  }, [token, workspaceId, queryClient, setOnlineUserIds, setAwayUserIds]);

  return null;
}
