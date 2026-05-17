"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { Dept, ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";

export type ColumnMeta = {
  nextCursor: string | null;
  total: number;
};

export type WorkspaceBundle = {
  depts: Dept[];
  lists: ListRow[];
  tasks: TaskRow[];
  members: MemberRow[];
  columnMeta: Record<string, ColumnMeta>;
};

type BootstrapResponse = {
  departments: Dept[];
  lists: ListRow[];
  members: MemberRow[];
};

type TaskPageResponse = {
  tasks: TaskRow[];
  nextCursor: string | null;
  total: number;
};

async function fetchWorkspace(token: string, orgId: string): Promise<WorkspaceBundle> {
  const [bootstrap, pending, inProgress, done, cancelled] = await Promise.all([
    apiJson<BootstrapResponse>(`/organizations/${orgId}/workspace`, { token }),
    apiJson<TaskPageResponse>(
      `/organizations/${orgId}/tasks?status=pending&limit=50&includeSubtasks=true`,
      { token },
    ),
    apiJson<TaskPageResponse>(
      `/organizations/${orgId}/tasks?status=in_progress&limit=50&includeSubtasks=true`,
      { token },
    ),
    apiJson<TaskPageResponse>(
      `/organizations/${orgId}/tasks?status=done&limit=25&includeSubtasks=true`,
      { token },
    ),
    apiJson<TaskPageResponse>(
      `/organizations/${orgId}/tasks?status=cancelled&limit=25&includeSubtasks=true`,
      { token },
    ),
  ]);

  return {
    depts: bootstrap.departments,
    lists: bootstrap.lists,
    members: bootstrap.members,
    tasks: [...pending.tasks, ...inProgress.tasks, ...done.tasks, ...cancelled.tasks],
    columnMeta: {
      pending: { nextCursor: pending.nextCursor, total: pending.total },
      in_progress: { nextCursor: inProgress.nextCursor, total: inProgress.total },
      done: { nextCursor: done.nextCursor, total: done.total },
      cancelled: { nextCursor: cancelled.nextCursor, total: cancelled.total },
    },
  };
}

export function useOrgWorkspace(token: string | null, orgId: string | null) {
  const queryClient = useQueryClient();
  const [manualError, setManualError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: workspaceKeys.workspace(orgId ?? ""),
    queryFn: () => fetchWorkspace(token!, orgId!),
    enabled: Boolean(token && orgId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const error = manualError ?? (q.error ? (q.error as Error).message : null);

  const reload = useCallback(async () => {
    setManualError(null);
    if (orgId) {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(orgId) });
    }
  }, [queryClient, orgId]);

  const setError = useCallback((msg: string | null) => {
    setManualError(msg);
  }, []);

  const emptyColumnMeta: Record<string, ColumnMeta> = useMemo(
    () => ({
      pending: { nextCursor: null, total: 0 },
      in_progress: { nextCursor: null, total: 0 },
      done: { nextCursor: null, total: 0 },
      cancelled: { nextCursor: null, total: 0 },
    }),
    [],
  );

  const empty = useMemo(
    (): WorkspaceBundle => ({
      depts: [],
      lists: [],
      tasks: [],
      members: [],
      columnMeta: emptyColumnMeta,
    }),
    [emptyColumnMeta],
  );

  const data = q.data ?? empty;

  return {
    depts: data.depts,
    lists: data.lists,
    tasks: data.tasks,
    members: data.members,
    columnMeta: data.columnMeta,
    error,
    setError,
    reload,
    isLoading: q.isPending && Boolean(token && orgId),
  };
}
