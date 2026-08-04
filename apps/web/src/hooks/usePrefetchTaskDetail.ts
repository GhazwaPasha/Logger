"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiJson } from "@/lib/api";
import { taskKeys } from "@/lib/query-keys";
import type { TaskDetail } from "@/lib/ledger-types";

/**
 * Warms the `useTaskDetail` cache entry ahead of a click (e.g. on row hover) so the detail panel
 * often opens with no loading flash. Must mirror `useTaskDetail`'s queryKey/queryFn exactly, or
 * this lands in a separate cache entry instead of the one the panel actually reads from.
 */
export function usePrefetchTaskDetail(token: string | null) {
  const queryClient = useQueryClient();

  return useCallback(
    (taskId: string) => {
      if (!token || !taskId) return;
      void queryClient.prefetchQuery({
        queryKey: taskKeys.detail(taskId),
        queryFn: () => apiJson<TaskDetail>(`/tasks/${taskId}`, { token }),
        staleTime: 15_000,
      });
    },
    [queryClient, token],
  );
}
