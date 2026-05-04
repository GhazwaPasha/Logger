"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";
import { useApiSession } from "@/hooks/useApiSession";
import { getApiBaseUrl } from "@/lib/api";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";

type WorkspaceChangedPayload = {
  type?: string;
  organizationId?: string;
  taskId?: string | null;
};

/** Subscribes to org collaboration events; invalidates workspace (and optional task) cache. */
export function WorkspaceRealtimeSubscriber({ workspaceId }: { workspaceId: string }) {
  const { token } = useApiSession();
  const queryClient = useQueryClient();

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
    socket.on("collaboration_auth_error", onAuthError);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("workspace_changed", onWorkspaceChanged);
      socket.off("collaboration_auth_error", onAuthError);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [token, workspaceId, queryClient]);

  return null;
}
