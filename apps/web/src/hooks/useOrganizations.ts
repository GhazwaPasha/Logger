"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { orgKeys } from "@/lib/query-keys";
import type { Org } from "@/lib/ledger-types";

export function useOrganizations(token: string | null) {
  const queryClient = useQueryClient();
  const [manualError, setManualError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: orgKeys.all,
    queryFn: async () => apiJson<Org[]>("/organizations", { token }),
    enabled: Boolean(token),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  // When the user returns to the tab, invalidate so a stuck or failed orgs
  // query retries immediately rather than waiting for a full page refresh.
  useEffect(() => {
    if (!token) return;
    function onVisible() {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: orgKeys.all });
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient, token]);

  const error = manualError ?? (q.error ? (q.error as Error).message : null);

  const reload = useCallback(async () => {
    setManualError(null);
    await queryClient.invalidateQueries({ queryKey: orgKeys.all });
  }, [queryClient]);

  const setError = useCallback((msg: string | null) => {
    setManualError(msg);
  }, []);

  const orgs = useMemo(() => q.data ?? [], [q.data]);

  return { orgs, error, setError, reload, isLoading: q.isPending && Boolean(token) };
}
