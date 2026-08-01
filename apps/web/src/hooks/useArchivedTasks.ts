"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { TaskRow } from "@/lib/ledger-types";

type TaskPageResponse = {
  tasks: TaskRow[];
  nextCursor: string | null;
  total: number;
};

/** Archived tasks visible to the viewer (same owner/manager/member scoping as the active task list). */
export function useArchivedTasks(token: string | null, organizationId: string | null) {
  return useQuery({
    queryKey: workspaceKeys.archivedTasks(organizationId ?? ""),
    queryFn: () =>
      apiJson<TaskPageResponse>(
        `/organizations/${organizationId}/tasks?archived=true&limit=100&includeSubtasks=false`,
        { token },
      ),
    enabled: Boolean(token && organizationId),
    staleTime: 15_000,
  });
}
