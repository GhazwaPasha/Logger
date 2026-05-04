"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { Dept, ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";

export type WorkspaceBundle = {
  depts: Dept[];
  lists: ListRow[];
  tasks: TaskRow[];
  members: MemberRow[];
};

type WorkspaceBootstrapResponse = {
  departments: Dept[];
  lists: ListRow[];
  tasks: TaskRow[];
  members: MemberRow[];
};

async function fetchWorkspace(token: string, orgId: string): Promise<WorkspaceBundle> {
  const b = await apiJson<WorkspaceBootstrapResponse>(`/organizations/${orgId}/workspace`, { token });
  return {
    depts: b.departments,
    lists: b.lists,
    tasks: b.tasks,
    members: b.members,
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
    // No push channel yet: other users' edits only reach this client via refetch.
    refetchOnWindowFocus: true,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
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

  const empty = useMemo(
    (): WorkspaceBundle => ({ depts: [], lists: [], tasks: [], members: [] }),
    [],
  );

  const data = q.data ?? empty;

  return {
    depts: data.depts,
    lists: data.lists,
    tasks: data.tasks,
    members: data.members,
    error,
    setError,
    reload,
    isLoading: q.isPending && Boolean(token && orgId),
  };
}
