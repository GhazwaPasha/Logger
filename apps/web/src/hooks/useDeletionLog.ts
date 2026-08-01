"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { DeletionLogEntry } from "@/lib/ledger-types";

/** Owner-only permanent tombstone log — everything hard-deleted in this org, survives independent of activity_ledger. */
export function useDeletionLog(token: string | null, organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: workspaceKeys.deletionLog(organizationId ?? ""),
    queryFn: () =>
      apiJson<DeletionLogEntry[]>(`/organizations/${organizationId}/deletion-log?limit=500`, { token }),
    enabled: Boolean(token && organizationId && enabled),
    staleTime: 30_000,
  });
}
