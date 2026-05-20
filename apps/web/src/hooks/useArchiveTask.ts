"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import {
  applyTaskMutationToCache,
  removeTaskFromWorkspaceCache,
} from "@/lib/task-mutation-cache";
import { workspaceKeys } from "@/lib/query-keys";
import type { TaskMutationResult } from "@/lib/ledger-types";

export function useArchiveTask() {
  const { token } = useApiSession();
  const { workspaceId } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const archiveTask = useCallback(
    async (taskId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!token) return { ok: false, error: "Not signed in" };
      setIsArchiving(true);
      setArchiveError(null);
      removeTaskFromWorkspaceCache(queryClient, workspaceId, taskId);
      try {
        const saved = await apiJson<TaskMutationResult>(`/tasks/${taskId}/archive`, {
          method: "POST",
          token,
        });
        applyTaskMutationToCache(queryClient, workspaceId, taskId, saved);
        removeTaskFromWorkspaceCache(queryClient, workspaceId, taskId);
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
        return { ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not delete task";
        setArchiveError(message);
        await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
        return { ok: false, error: message };
      } finally {
        setIsArchiving(false);
      }
    },
    [token, queryClient, workspaceId],
  );

  return { archiveTask, isArchiving, archiveError, clearArchiveError: () => setArchiveError(null) };
}
