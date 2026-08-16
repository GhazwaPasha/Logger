"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { TaskRow } from "@/lib/ledger-types";

/**
 * Three lightweight, independently-loading queries that back the work board's summary UI (pipeline
 * card + RecurringSeriesCard headers) without ever depending on how far the board's own infinite
 * scroll has paginated. See useOrgWorkspace for the paginated task rows these deliberately avoid.
 */

export type SeriesSummaryRow = {
  seriesId: string;
  count: number;
  latest: { id: string; title: string; createdAt: string };
  lastDone: {
    id: string;
    completedAt: string | null;
    dueAt: string | null;
    lastSubmittedAt: string | null;
    assigneeUserIds: string[];
  } | null;
};

type ScopeOpts = { listId?: string | null; departmentId?: string | null };

function scopeParams(opts: ScopeOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.listId) params.set("listId", opts.listId);
  if (opts.departmentId) params.set("departmentId", opts.departmentId);
  return params;
}

/** Pipeline card counts — own query, own loading state; never derived from paginated task rows. */
export function useTaskCounts(token: string | null, orgId: string | null, opts: ScopeOpts) {
  const q = useQuery({
    queryKey: workspaceKeys.taskCounts(orgId ?? "", opts.listId, opts.departmentId),
    queryFn: () => {
      const qs = scopeParams(opts).toString();
      return apiJson<Record<string, number>>(`/organizations/${orgId}/tasks/counts${qs ? `?${qs}` : ""}`, {
        token,
      });
    },
    enabled: Boolean(token && orgId),
    staleTime: 30_000,
  });
  return { counts: q.data ?? null, isLoading: q.isPending && Boolean(token && orgId) };
}

/** RecurringSeriesCard header stats (count + latest + last completion), grouped by chain. */
export function useSeriesSummaries(
  token: string | null,
  orgId: string | null,
  opts: ScopeOpts & { statuses: readonly string[] },
) {
  const q = useQuery({
    queryKey: workspaceKeys.seriesSummary(orgId ?? "", opts.statuses, opts.listId, opts.departmentId),
    queryFn: () => {
      const params = scopeParams(opts);
      params.set("status", opts.statuses.join(","));
      return apiJson<SeriesSummaryRow[]>(`/organizations/${orgId}/tasks/series-summary?${params.toString()}`, {
        token,
      });
    },
    enabled: Boolean(token && orgId && opts.statuses.length > 0),
    staleTime: 30_000,
  });
  return { summaries: q.data ?? [], isLoading: q.isPending && Boolean(token && orgId) };
}

/** Full occurrence list for one recurring chain — only fetched once its card is expanded. */
export function useSeriesOccurrences(
  token: string | null,
  orgId: string | null,
  seriesId: string | null,
  opts: { statuses?: readonly string[]; enabled: boolean },
) {
  const statusParam = opts.statuses?.length ? `?status=${opts.statuses.join(",")}` : "";
  const q = useQuery({
    queryKey: workspaceKeys.seriesOccurrences(orgId ?? "", seriesId ?? ""),
    queryFn: () =>
      apiJson<{ tasks: TaskRow[] }>(`/organizations/${orgId}/tasks/series/${seriesId}${statusParam}`, { token }),
    enabled: Boolean(token && orgId && seriesId && opts.enabled),
    staleTime: 15_000,
  });
  return { tasks: q.data?.tasks ?? [], isLoading: q.isFetching };
}
