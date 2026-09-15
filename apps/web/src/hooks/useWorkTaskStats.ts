"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { apiJson } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { TaskRow } from "@/lib/ledger-types";

/**
 * Three lightweight, independently-loading queries that back the work board's summary UI (kanban
 * column counts + RecurringSeriesCard headers) without ever depending on how far the board's own
 * infinite scroll has paginated. See useOrgWorkspace for the paginated task rows these deliberately
 * avoid.
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

/** Kanban column-header counts — own query, own loading state; never derived from paginated task rows. */
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

type SeriesOccurrencesPage = { tasks: TaskRow[]; nextCursor: string | null };

/** Frontend-only cap on how far back a card's occurrence list will page — see RecurringSeriesCard. */
const OCCURRENCE_CAP = 30;

/**
 * Occurrence list for one recurring chain — only fetched once its card is expanded, and paginated
 * in pages of 25 like the main board. A chain's history is unbounded (that's the whole point of
 * "recurring"), so `loadMore` stops offering further pages once `OCCURRENCE_CAP` items are loaded
 * — older occurrences are still on the server, just not worth fetching into a collapsible summary
 * card. The first page comes back from `useQuery` as usual, and `loadMore` appends subsequent pages
 * by cursor (capped to however many are left under the cap), mirroring the `loadMoreColumn` pattern
 * in useOrgWorkspace. `loadMoreError` is a real, directly-observed try/catch failure — not inferred
 * from cursor/loading-state comparisons — so it can't produce a false-positive retry prompt the way
 * that inference did on the main board.
 */
export function useSeriesOccurrences(
  token: string | null,
  orgId: string | null,
  seriesId: string | null,
  opts: { statuses?: readonly string[]; enabled: boolean },
) {
  const queryClient = useQueryClient();
  const statusParam = opts.statuses?.length ? `&status=${opts.statuses.join(",")}` : "";
  const queryKey = workspaceKeys.seriesOccurrences(orgId ?? "", seriesId ?? "");

  const q = useQuery({
    queryKey,
    queryFn: () =>
      apiJson<SeriesOccurrencesPage>(`/organizations/${orgId}/tasks/series/${seriesId}?limit=25${statusParam}`, {
        token,
      }),
    enabled: Boolean(token && orgId && seriesId && opts.enabled),
    staleTime: 15_000,
  });

  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const loadedCount = q.data?.tasks.length ?? 0;
  const rawNextCursor = q.data?.nextCursor ?? null;
  const capReached = loadedCount >= OCCURRENCE_CAP;
  const nextCursor = capReached ? null : rawNextCursor;
  /** More history exists on the server past what the cap let us load. */
  const hasMoreBeyondCap = capReached && Boolean(rawNextCursor);

  const loadMore = useCallback(async () => {
    if (!token || !orgId || !seriesId || !rawNextCursor || capReached) return;
    const limit = Math.min(25, OCCURRENCE_CAP - loadedCount);
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = await apiJson<SeriesOccurrencesPage>(
        `/organizations/${orgId}/tasks/series/${seriesId}?limit=${limit}&cursor=${rawNextCursor}${statusParam}`,
        { token },
      );
      queryClient.setQueryData<SeriesOccurrencesPage>(queryKey, (old) => {
        if (!old) return page;
        const existingIds = new Set(old.tasks.map((t) => t.id));
        return {
          tasks: [...old.tasks, ...page.tasks.filter((t) => !existingIds.has(t.id))],
          nextCursor: page.nextCursor,
        };
      });
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [token, orgId, seriesId, rawNextCursor, capReached, loadedCount, statusParam, queryClient, queryKey]);

  return {
    tasks: q.data?.tasks ?? [],
    isLoading: q.isFetching && !q.data,
    nextCursor,
    hasMoreBeyondCap,
    loadingMore,
    loadMoreError,
    loadMore,
  };
}
