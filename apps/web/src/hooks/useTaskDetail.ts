"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { taskKeys } from "@/lib/query-keys";
import type { TaskDetail, TaskRow } from "@/lib/ledger-types";

/** Lets the edit panel render from workspace list data before GET /tasks/:id finishes. */
function taskRowToPlaceholderDetail(row: TaskRow): TaskDetail {
  return {
    task: row,
    capabilities: {
      canDeleteTask: true,
      canReschedule: true,
      canAppendLedger: false,
    },
    assigneeUserIds: row.assigneeUserIds ?? [],
    subtasks: row.subtasks ?? [],
    ledger: [],
  };
}

export function useTaskDetail(
  token: string | null,
  taskId: string | null,
  /** Task row from workspace bundle (e.g. org tasks list); enables instant modal content. */
  listTaskRow?: TaskRow | null,
) {
  const [manualError, setManualError] = useState<string | null>(null);

  const placeholderData = useMemo((): TaskDetail | undefined => {
    if (!taskId || !listTaskRow || listTaskRow.id !== taskId) return undefined;
    return taskRowToPlaceholderDetail(listTaskRow);
  }, [taskId, listTaskRow]);

  const q = useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => apiJson<TaskDetail>(`/tasks/${taskId}`, { token }),
    enabled: Boolean(token && taskId),
    staleTime: 15_000,
    placeholderData,
    refetchOnWindowFocus: true,
  });

  const error = useMemo(
    () => manualError ?? (q.error ? (q.error as Error).message : null),
    [manualError, q.error],
  );

  const reload = useCallback(async () => {
    setManualError(null);
    await q.refetch();
  }, [q]);

  const setError = useCallback((msg: string | null) => {
    setManualError(msg);
  }, []);

  return {
    detail: q.data ?? null,
    error,
    setError,
    reload,
    /** True only when there is no detail yet (no list row and fetch not resolved). */
    isLoading: Boolean(token && taskId) && q.data == null && q.isPending,
  };
}
