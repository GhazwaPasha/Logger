"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
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
    staleTime: 30_000,
  });

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
