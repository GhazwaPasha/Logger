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

/**
 * The subset of the work board's active filters that the pipeline card and RecurringSeriesCards
 * track too — list/level scope, due-date range, and assignee. Status/goal/milestone filters are
 * deliberately not part of this (see the backend's `boardFilterConditions` doc comment for why).
 */
export type BoardFilterOpts = {
  listId?: string | null;
  departmentId?: string | null;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  assigneeUserId?: string | null;
  unassigned?: boolean;
};

function filterParams(opts: BoardFilterOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.listId) params.set("listId", opts.listId);
  if (opts.departmentId) params.set("departmentId", opts.departmentId);
  if (opts.dueDateFrom) params.set("dueDateFrom", opts.dueDateFrom);
  if (opts.dueDateTo) params.set("dueDateTo", opts.dueDateTo);
  if (opts.assigneeUserId) params.set("assigneeUserId", opts.assigneeUserId);
  if (opts.unassigned) params.set("unassigned", "true");
  return params;
}

/** Pipeline card counts — own query, own loading state; never derived from paginated task rows. */
export function useTaskCounts(token: string | null, orgId: string | null, opts: BoardFilterOpts) {
  const params = filterParams(opts);
  const q = useQuery({
    queryKey: workspaceKeys.taskCounts(orgId ?? "", params.toString()),
    queryFn: () => {
      const qs = params.toString();
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
  opts: BoardFilterOpts & { statuses: readonly string[] },
) {
  const params = filterParams(opts);
  params.set("status", opts.statuses.join(","));
  const q = useQuery({
    queryKey: workspaceKeys.seriesSummary(orgId ?? "", opts.statuses, params.toString()),
    queryFn: () =>
      apiJson<SeriesSummaryRow[]>(`/organizations/${orgId}/tasks/series-summary?${params.toString()}`, {
        token,
      }),
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
