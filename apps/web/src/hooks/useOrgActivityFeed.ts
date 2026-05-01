"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import type { OrgActivityFeedResponse } from "@/lib/ledger-types";
import { workspaceKeys } from "@/lib/query-keys";

export function useOrgActivityFeed(token: string | null, organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: workspaceKeys.activity(organizationId ?? ""),
    queryFn: () => apiJson<OrgActivityFeedResponse>(`/organizations/${organizationId}/activity`, { token }),
    enabled: Boolean(token && organizationId && enabled),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
