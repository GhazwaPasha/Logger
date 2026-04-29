"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import type { TaskDetail } from "@/lib/ledger-types";

export function useTaskDetail(token: string | null, taskId: string | null) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !taskId) {
      setDetail(null);
      return;
    }
    setError(null);
    try {
      const d = await apiJson<TaskDetail>(`/tasks/${taskId}`, { token });
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task");
      setDetail(null);
    }
  }, [token, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { detail, error, setError, reload: load };
}
