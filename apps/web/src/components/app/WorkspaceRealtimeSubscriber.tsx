"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";
import { useApiSession } from "@/hooks/useApiSession";
import { getApiBaseUrl } from "@/lib/api";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import { useOnlinePresence } from "./OnlinePresenceProvider";

type WorkspaceChangedPayload = {
  type?: string;
  organizationId?: string;
  taskId?: string | null;
};

type PresenceSyncPayload = { onlineUserIds: string[] };
type PresenceUpdatePayload = { userId: string; status: "online" | "offline" };

/** Subscribes to org collaboration events; invalidates workspace (and optional task) cache. */
export function WorkspaceRealtimeSubscriber({ workspaceId }: { workspaceId: string }) {
  const { token } = useApiSession();
  const queryClient = useQueryClient();
  const { setOnlineUserIds } = useOnlinePresence();

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
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.activity(workspaceId),
      });
      const tid = payload?.taskId;
      if (tid) {
        void queryClient.invalidateQueries({ queryKey: taskKeys.detail(tid) });
      }
    };

    const onPresenceSync = (payload: PresenceSyncPayload) => {
      setOnlineUserIds(new Set(payload.onlineUserIds));
    };

    const onPresenceUpdate = (payload: PresenceUpdatePayload) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (payload.status === "online") next.add(payload.userId);
        else next.delete(payload.userId);
        return next;
      });
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

    return () => {
      socket.off("workspace_changed", onWorkspaceChanged);
      socket.off("presence_sync", onPresenceSync);
      socket.off("presence_update", onPresenceUpdate);
      socket.off("collaboration_auth_error", onAuthError);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
      setOnlineUserIds(new Set());
    };
  }, [token, workspaceId, queryClient, setOnlineUserIds]);

  return null;
}
