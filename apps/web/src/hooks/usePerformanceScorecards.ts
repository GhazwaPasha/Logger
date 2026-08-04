"use client";

import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiJsonConditional } from "@/lib/api";
import type { PerformanceScorecardsResponse } from "@/lib/ledger-types";
import { performanceKeys } from "@/lib/query-keys";

export function usePerformanceScorecards(
  token: string | null,
  organizationId: string | null,
  enabled: boolean,
  range: { dateFrom?: string; dateTo?: string },
) {
  const queryClient = useQueryClient();
  /** Last-seen ETag per org+date-range — a repeat view (tab switch back) skips re-sending the full scorecards payload when unchanged. */
  const etagRef = useRef<Map<string, string>>(new Map());

  const queryKey = performanceKeys.scorecards(organizationId ?? "", range.dateFrom, range.dateTo);
  const cacheKey = queryKey.join("|");

  return useQuery({
    queryKey,
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (range.dateFrom) sp.set("dateFrom", range.dateFrom);
      if (range.dateTo) sp.set("dateTo", range.dateTo);
      const qs = sp.toString();
      const path = `/organizations/${organizationId}/performance/scorecards${qs ? `?${qs}` : ""}`;
      const result = await apiJsonConditional<PerformanceScorecardsResponse>(path, {
        token,
        etag: etagRef.current.get(cacheKey) ?? null,
      });
      if (result.notModified) {
        const existing = queryClient.getQueryData<PerformanceScorecardsResponse>(queryKey);
        if (existing) return existing;
        etagRef.current.delete(cacheKey);
        return apiJson<PerformanceScorecardsResponse>(path, { token });
      }
      if (result.etag) etagRef.current.set(cacheKey, result.etag);
      else etagRef.current.delete(cacheKey);
      return result.data!;
    },
    enabled: Boolean(token && organizationId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
