"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import type { Org } from "@/lib/ledger-types";

export function useOrganizations(token: string | null) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setOrgs([]);
      return;
    }
    setError(null);
    try {
      const data = await apiJson<Org[]>("/organizations", { token });
      setOrgs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organizations");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { orgs, error, setError, reload: load };
}
