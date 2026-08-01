"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { workspaceKeys, taskKeys } from "@/lib/query-keys";
import type { TaskMutationResult } from "@/lib/ledger-types";

export function useRestoreTask() {
  const { token } = useApiSession();
  const { workspaceId } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const restoreTask = useCallback(
    async (taskId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!token) return { ok: false, error: "Not signed in" };
      setIsRestoring(true);
      setRestoreError(null);
      try {
        await apiJson<TaskMutationResult>(`/tasks/${taskId}/restore`, { method: "POST", token });
        queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.archivedTasks(workspaceId) });
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
        return { ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not restore task";
        setRestoreError(message);
        return { ok: false, error: message };
      } finally {
        setIsRestoring(false);
      }
    },
    [token, queryClient, workspaceId],
  );

  return { restoreTask, isRestoring, restoreError, clearRestoreError: () => setRestoreError(null) };
}
