"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiJson } from "@/lib/api";
import type { OrgActivityFeedResponse } from "@/lib/ledger-types";
import { workspaceKeys } from "@/lib/query-keys";

type ActivityPage = OrgActivityFeedResponse & { nextCursor: string | null };

/** Server maximum per page; feeds load older pages on demand. */
const ACTIVITY_PAGE_SIZE = 50;

function activityPath(organizationId: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams({ limit: String(ACTIVITY_PAGE_SIZE) });
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  return `/organizations/${organizationId}/activity?${qs}`;
}

/**
 * The most recent page of activity — what notifications need. Kept fresh by realtime invalidation;
 * `refetchIntervalMs` is only a fallback for missed socket events (and costs a 304 when idle).
 */
export function useRecentActivity(
  token: string | null,
  organizationId: string | null,
  enabled: boolean,
  refetchIntervalMs?: number,
) {
  return useQuery({
    queryKey: workspaceKeys.activity(organizationId ?? ""),
    queryFn: () => apiJson<ActivityPage>(activityPath(organizationId!, {})),
    enabled: Boolean(token && organizationId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: refetchIntervalMs && refetchIntervalMs > 0 ? refetchIntervalMs : false,
    refetchIntervalInBackground: false,
  });
}

/** Paginated feed for the activity terminal and performance views; optionally one person's activity. */
export function useActivityFeedPages(
  token: string | null,
  organizationId: string | null,
  enabled: boolean,
  actorId?: string,
) {
  const q = useInfiniteQuery({
    queryKey: [...workspaceKeys.activity(organizationId ?? ""), "pages", actorId ?? ""] as const,
    queryFn: ({ pageParam }) => apiJson<ActivityPage>(activityPath(organizationId!, { cursor: pageParam, actorId })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(token && organizationId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const data = useMemo<OrgActivityFeedResponse | undefined>(() => {
    const pages = q.data?.pages;
    if (!pages) return undefined;
    return {
      entries: pages.flatMap((p) => p.entries),
      tasksById: Object.assign({}, ...pages.map((p) => p.tasksById)),
      assigneesByTaskId: Object.assign({}, ...pages.map((p) => p.assigneesByTaskId)),
    };
  }, [q.data]);

  return {
    data,
    isPending: q.isPending,
    error: q.error,
    hasMore: q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    loadMore: () => void q.fetchNextPage(),
  };
}
