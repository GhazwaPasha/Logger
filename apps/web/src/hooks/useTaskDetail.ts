"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { taskKeys } from "@/lib/query-keys";
import type { ListRow, MemberRow, TaskDetail, TaskRow } from "@/lib/ledger-types";
import { taskArchiveDeleteCaps } from "@/lib/workspace-permissions";

type PlaceholderContext = {
  lists: ListRow[];
  members: MemberRow[];
  userId: string | null;
};

/** Lets the edit panel render from workspace list data before GET /tasks/:id finishes. */
function taskRowToPlaceholderDetail(row: TaskRow, ctx?: PlaceholderContext): TaskDetail {
  const caps = ctx?.userId
    ? taskArchiveDeleteCaps(row, ctx.lists, ctx.userId, ctx.members)
    : { canArchiveTask: false, canDeleteTask: false };
  return {
    task: row,
    capabilities: {
      canArchiveTask: caps.canArchiveTask,
      canDeleteTask: caps.canDeleteTask,
      canReschedule: true,
      canAppendLedger: false,
    },
    assigneeUserIds: row.assigneeUserIds ?? [],
    subtasks: row.subtasks ?? [],
    ledger: [],
  };
}

export type UseTaskDetailOptions = {
  /**
   * Active task form session: avoid refetch-on-focus and background refetches
   * that fight local form state and subtask optimistic updates.
   */
  formSession?: boolean;
};

export function useTaskDetail(
  token: string | null,
  taskId: string | null,
  /** Task row from workspace bundle (e.g. org tasks list); enables instant modal content. */
  listTaskRow?: TaskRow | null,
  /** When set, placeholder capabilities match server rules until GET /tasks/:id returns. */
  placeholderContext?: PlaceholderContext,
  options?: UseTaskDetailOptions,
) {
  const formSession = options?.formSession ?? false;
  const [manualError, setManualError] = useState<string | null>(null);

  const placeholderData = useMemo((): TaskDetail | undefined => {
    if (!taskId || !listTaskRow || listTaskRow.id !== taskId) return undefined;
    return taskRowToPlaceholderDetail(listTaskRow, placeholderContext);
  }, [taskId, listTaskRow, placeholderContext]);

  const q = useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => apiJson<TaskDetail>(`/tasks/${taskId}`, { token }),
    enabled: Boolean(token && taskId),
    staleTime: formSession ? Number.POSITIVE_INFINITY : 15_000,
    placeholderData,
    refetchOnWindowFocus: !formSession,
    refetchOnMount: formSession ? false : true,
    refetchOnReconnect: !formSession,
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
