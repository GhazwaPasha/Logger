"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { taskKeys } from "@/lib/query-keys";
import type { TaskDetail } from "@/lib/ledger-types";

export function useTaskDetail(token: string | null, taskId: string | null) {
  const [manualError, setManualError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => apiJson<TaskDetail>(`/tasks/${taskId}`, { token }),
    enabled: Boolean(token && taskId),
    staleTime: 15_000,
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
    isLoading: q.isPending && Boolean(token && taskId),
  };
}
