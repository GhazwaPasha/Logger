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

  // When the user returns to the tab, retry only if the query is in a bad state
  // (error or no data). Refetching healthy cached data needlessly risks hitting
  // an expired-token 401 which would trigger the wl:auth-expired flow.
  useEffect(() => {
    if (!token) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const state = queryClient.getQueryState(orgKeys.all);
      if (state?.status === "error" || !state?.data) {
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
