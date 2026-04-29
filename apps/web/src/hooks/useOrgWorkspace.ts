"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import type { Dept, ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";

export function useOrgWorkspace(token: string | null, orgId: string | null) {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !orgId) {
      setDepts([]);
      setLists([]);
      setTasks([]);
      setMembers([]);
      return;
    }
    setError(null);
    try {
      const [d, l, t, m] = await Promise.all([
        apiJson<Dept[]>(`/organizations/${orgId}/departments`, { token }),
        apiJson<ListRow[]>(`/organizations/${orgId}/lists`, { token }),
        apiJson<TaskRow[]>(`/organizations/${orgId}/tasks`, { token }),
        apiJson<MemberRow[]>(`/organizations/${orgId}/members`, { token }),
      ]);
      setDepts(d);
      setLists(l);
      setTasks(t);
      setMembers(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workspace");
    }
  }, [token, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { depts, lists, tasks, members, error, setError, reload: load };
}
