"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import type { PerformanceScorecardsResponse } from "@/lib/ledger-types";
import { performanceKeys } from "@/lib/query-keys";

export function usePerformanceScorecards(
  token: string | null,
  organizationId: string | null,
  enabled: boolean,
  range: { dateFrom?: string; dateTo?: string },
) {
  return useQuery({
    queryKey: performanceKeys.scorecards(organizationId ?? "", range.dateFrom, range.dateTo),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (range.dateFrom) sp.set("dateFrom", range.dateFrom);
      if (range.dateTo) sp.set("dateTo", range.dateTo);
      const qs = sp.toString();
      return apiJson<PerformanceScorecardsResponse>(
        `/organizations/${organizationId}/performance/scorecards${qs ? `?${qs}` : ""}`,
        { token },
      );
    },
    enabled: Boolean(token && organizationId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
