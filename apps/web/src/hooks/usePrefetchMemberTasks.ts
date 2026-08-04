"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiJson } from "@/lib/api";
import { performanceKeys } from "@/lib/query-keys";
import type { MemberTaskRow } from "@/lib/ledger-types";

/**
 * Warms the `useMemberTasks` cache entry ahead of a click (e.g. hovering a member chip) so the
 * detail panel often renders instantly once selected. Must mirror `useMemberTasks`'s
 * queryKey/queryFn exactly, or this lands in a separate cache entry instead of the one the panel
 * actually reads from.
 */
export function usePrefetchMemberTasks(
  token: string | null,
  organizationId: string | null,
  range: { dateFrom?: string; dateTo?: string },
) {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string) => {
      if (!token || !organizationId || !userId) return;
      const sp = new URLSearchParams();
      if (range.dateFrom) sp.set("dateFrom", range.dateFrom);
      if (range.dateTo) sp.set("dateTo", range.dateTo);
      const qs = sp.toString();
      void queryClient.prefetchQuery({
        queryKey: performanceKeys.memberTasks(organizationId, userId, range.dateFrom, range.dateTo),
        queryFn: () =>
          apiJson<MemberTaskRow[]>(
            `/organizations/${organizationId}/performance/scorecards/${userId}/tasks${qs ? `?${qs}` : ""}`,
            { token },
          ),
        staleTime: 30_000,
      });
    },
    [queryClient, token, organizationId, range.dateFrom, range.dateTo],
  );
}
