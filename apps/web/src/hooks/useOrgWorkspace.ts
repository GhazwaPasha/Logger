"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson, apiJsonConditional } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { Dept, ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";

/**
 * Statuses counted toward the sidebar's per-list "active work" badge (see WorkspaceSidebar's
 * tasksByList). Those badges read straight off the `tasks` array, so if a status is capped by
 * pagination the badge silently undercounts — it has no idea tasks are missing. Eagerly draining
 * these two in the background (independent of scroll/view) keeps the badge correct without the
 * badge itself needing to know pagination exists. done/cancelled aren't counted, so they stay
 * lazily paginated (click/scroll only) — no need to eagerly pull historical tasks.
 */
const EAGERLY_LOADED_STATUSES = ["pending", "in_progress"] as const;

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

/**
 * Fetches the bootstrap piece (departments/lists/members) with ETag revalidation — the server
 * caches this per org and returns `304` when nothing's changed, so a repeat load costs a header
 * comparison instead of three fresh queries. Falls back to a plain fetch if a `304` arrives with
 * no matching cache entry to reuse (e.g. the query cache was cleared independently of this etag).
 */
async function fetchBootstrap(
  token: string,
  orgId: string,
  etag: string | null,
  cached: BootstrapResponse | undefined,
): Promise<{ bootstrap: BootstrapResponse; etag: string | null }> {
  const result = await apiJsonConditional<BootstrapResponse>(`/organizations/${orgId}/workspace`, {
    token,
    etag,
  });
  if (result.notModified) {
    if (cached) return { bootstrap: cached, etag };
    const fresh = await apiJson<BootstrapResponse>(`/organizations/${orgId}/workspace`, { token });
    return { bootstrap: fresh, etag: null };
  }
  return { bootstrap: result.data!, etag: result.etag };
}

async function fetchWorkspace(
  token: string,
  orgId: string,
  bootstrapEtag: string | null,
  cachedBootstrap: BootstrapResponse | undefined,
): Promise<{ bundle: WorkspaceBundle; bootstrapEtag: string | null }> {
  const [{ bootstrap, etag }, pending, inProgress, done, cancelled] = await Promise.all([
    fetchBootstrap(token, orgId, bootstrapEtag, cachedBootstrap),
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
    bundle: {
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
    },
    bootstrapEtag: etag,
  };
}

export function useOrgWorkspace(token: string | null, orgId: string | null) {
  const queryClient = useQueryClient();
  const [manualError, setManualError] = useState<string | null>(null);
  /** Last-seen ETag for the workspace-bootstrap piece, per org — lets a repeat load skip re-sending departments/lists/members when unchanged. */
  const bootstrapEtagRef = useRef<Map<string, string>>(new Map());

  const q = useQuery({
    queryKey: workspaceKeys.workspace(orgId ?? ""),
    queryFn: async () => {
      const cacheKey = orgId!;
      const existing = queryClient.getQueryData<WorkspaceBundle>(workspaceKeys.workspace(cacheKey));
      const cachedBootstrap = existing
        ? { departments: existing.depts, lists: existing.lists, members: existing.members }
        : undefined;
      const { bundle, bootstrapEtag } = await fetchWorkspace(
        token!,
        orgId!,
        bootstrapEtagRef.current.get(cacheKey) ?? null,
        cachedBootstrap,
      );
      if (bootstrapEtag) bootstrapEtagRef.current.set(cacheKey, bootstrapEtag);
      else bootstrapEtagRef.current.delete(cacheKey);
      return bundle;
    },
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

  const [loadingMoreColumn, setLoadingMoreColumn] = useState<string | null>(null);

  const loadMoreColumn = useCallback(
    async (status: string) => {
      if (!token || !orgId) return;
      const meta = data.columnMeta[status];
      if (!meta?.nextCursor) return;
      setLoadingMoreColumn(status);
      try {
        const result = await apiJson<TaskPageResponse>(
          `/organizations/${orgId}/tasks?status=${status}&cursor=${meta.nextCursor}&limit=25&includeSubtasks=true`,
          { token },
        );
        queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(orgId), (old) => {
          if (!old) return old;
          const existingIds = new Set(old.tasks.map((t) => t.id));
          const newTasks = result.tasks.filter((t) => !existingIds.has(t.id));
          return {
            ...old,
            tasks: [...old.tasks, ...newTasks],
            columnMeta: {
              ...old.columnMeta,
              [status]: { nextCursor: result.nextCursor, total: result.total },
            },
          };
        });
      } catch {
        // non-critical — caller can retry
      } finally {
        setLoadingMoreColumn(null);
      }
    },
    [token, orgId, data.columnMeta, queryClient],
  );

  /**
   * Drains pending/in_progress in the background so per-list counters (sidebar badge) are never
   * computed off a truncated task list. Tracks the last cursor it attempted per status so a
   * failed request doesn't retry in a tight loop — the guard only lifts once that status's
   * cursor actually advances (i.e. a later successful load, e.g. a manual retry elsewhere).
   */
  const attemptedCursorRef = useRef<Record<string, string | null>>({});
  useEffect(() => {
    for (const status of EAGERLY_LOADED_STATUSES) {
      const meta = data.columnMeta[status];
      if (!meta?.nextCursor) continue;
      if (loadingMoreColumn === status) continue;
      if (attemptedCursorRef.current[status] === meta.nextCursor) continue;
      attemptedCursorRef.current[status] = meta.nextCursor;
      void loadMoreColumn(status);
    }
  }, [data.columnMeta, loadingMoreColumn, loadMoreColumn]);

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
    loadMoreColumn,
    loadingMoreColumn,
  };
}
