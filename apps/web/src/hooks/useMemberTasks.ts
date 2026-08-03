"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import type { MemberTaskRow } from "@/lib/ledger-types";
import { performanceKeys } from "@/lib/query-keys";

/** Lazy — pass `enabled` only when the member's row is actually expanded. */
export function useMemberTasks(
  token: string | null,
  organizationId: string | null,
  userId: string | null,
  enabled: boolean,
  range: { dateFrom?: string; dateTo?: string },
) {
  return useQuery({
    queryKey: performanceKeys.memberTasks(organizationId ?? "", userId ?? "", range.dateFrom, range.dateTo),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (range.dateFrom) sp.set("dateFrom", range.dateFrom);
      if (range.dateTo) sp.set("dateTo", range.dateTo);
      const qs = sp.toString();
      return apiJson<MemberTaskRow[]>(
        `/organizations/${organizationId}/performance/scorecards/${userId}/tasks${qs ? `?${qs}` : ""}`,
        { token },
      );
    },
    enabled: Boolean(token && organizationId && userId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
