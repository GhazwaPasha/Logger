"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiVoid } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { workspaceKeys, taskKeys } from "@/lib/query-keys";

/** Permanently deletes an already-archived task ("purge"). Owner/creator only, enforced server-side. */
export function usePurgeTask() {
  const { token } = useApiSession();
  const { workspaceId } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const purgeTask = useCallback(
    async (taskId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!token) return { ok: false, error: "Not signed in" };
      setIsPurging(true);
      setPurgeError(null);
      try {
        await apiVoid(`/tasks/${taskId}`, { method: "DELETE", token });
        queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.archivedTasks(workspaceId) });
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.deletionLog(workspaceId) });
        return { ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not delete task";
        setPurgeError(message);
        return { ok: false, error: message };
      } finally {
        setIsPurging(false);
      }
    },
    [token, queryClient, workspaceId],
  );

  return { purgeTask, isPurging, purgeError, clearPurgeError: () => setPurgeError(null) };
}
