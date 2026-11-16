"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  computeTrackerStats,
  trackerSlotKey,
  type CreateTrackerInput,
  type TrackerDetail,
  type TrackerEntry,
  type TrackerSummary,
  type UpdateTrackerInput,
  type UpsertTrackerEntryInput,
} from "@work-ledger/contracts";
import { apiJson } from "@/lib/api";
import { trackerKeys } from "@/lib/query-keys";

export type TrackerListResponse = { today: string; canManage: boolean; trackers: TrackerSummary[] };
export type TrackerDetailResponse = TrackerDetail & { canManage: boolean };

export function useTrackerList(
  token: string | null,
  orgId: string | null,
  scope: "all" | "mine" = "all",
  includeArchived = false,
) {
  return useQuery({
    queryKey: [...trackerKeys.list(orgId ?? "", scope), includeArchived ? "archived" : "active"],
    queryFn: () =>
      apiJson<TrackerListResponse>(
        `/organizations/${orgId}/trackers?scope=${scope}${includeArchived ? "&archived=1" : ""}`,
        { token },
      ),
    enabled: Boolean(token && orgId),
    staleTime: 30_000,
  });
}

export function useTrackerDetail(token: string | null, orgId: string | null, trackerId: string | null) {
  return useQuery({
    queryKey: trackerKeys.detail(orgId ?? "", trackerId ?? ""),
    queryFn: () => apiJson<TrackerDetailResponse>(`/organizations/${orgId}/trackers/${trackerId}`, { token }),
    enabled: Boolean(token && orgId && trackerId),
    staleTime: 15_000,
  });
}

/** Writes return the fresh detail, which is put straight into the cache so the UI never waits on a refetch. */
export function useTrackerMutations(token: string | null, orgId: string | null) {
  const qc = useQueryClient();

  const settle = useCallback(
    (detail: TrackerDetailResponse) => {
      if (!orgId) return detail;
      qc.setQueryData(trackerKeys.detail(orgId, detail.id), detail);
      void qc.invalidateQueries({ queryKey: [...trackerKeys.org(orgId), "list"] });
      return detail;
    },
    [qc, orgId],
  );

  const create = useCallback(
    async (input: CreateTrackerInput) =>
      settle(
        await apiJson<TrackerDetailResponse>(`/organizations/${orgId}/trackers`, {
          method: "POST",
          token,
          body: JSON.stringify(input),
        }),
      ),
    [orgId, token, settle],
  );

  const update = useCallback(
    async (trackerId: string, input: UpdateTrackerInput) =>
      settle(
        await apiJson<TrackerDetailResponse>(`/organizations/${orgId}/trackers/${trackerId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(input),
        }),
      ),
    [orgId, token, settle],
  );

  const remove = useCallback(
    async (trackerId: string) => {
      await apiJson(`/organizations/${orgId}/trackers/${trackerId}`, { method: "DELETE", token });
      if (orgId) {
        qc.removeQueries({ queryKey: trackerKeys.detail(orgId, trackerId) });
        void qc.invalidateQueries({ queryKey: [...trackerKeys.org(orgId), "list"] });
      }
    },
    [orgId, token, qc],
  );

  /**
   * Optimistic: the log lands in the cache (and the pace recomputes, using the same engine as the
   * server) before the request goes out, so the screen never waits on the network. A failure restores
   * the previous state and rethrows for the caller to report.
   */
  const logEntry = useCallback(
    async (trackerId: string, date: string, input: UpsertTrackerEntryInput) => {
      const key = trackerKeys.detail(orgId ?? "", trackerId);
      const prev = qc.getQueryData<TrackerDetailResponse>(key);
      if (prev && orgId) {
        const slot = trackerSlotKey(prev.checkIn, date);
        const values = Object.fromEntries(Object.entries(input.values).filter(([, v]) => Number.isFinite(v)));
        const existing = prev.entries.find((e) => e.entryDate === slot);
        const entry: TrackerEntry = {
          id: existing?.id ?? `pending-${slot}`,
          entryDate: slot,
          userId: existing?.userId ?? prev.assigneeId ?? "",
          note: input.note ?? null,
          values,
          updatedAt: new Date().toISOString(),
        };
        const entries = [entry, ...prev.entries.filter((e) => e.entryDate !== slot)].sort((a, b) =>
          a.entryDate < b.entryDate ? 1 : -1,
        );
        const stats = computeTrackerStats(prev, prev.metrics, entries, prev.stats.today);
        const dueEntry = stats.dueKey ? (entries.find((e) => e.entryDate === stats.dueKey) ?? null) : null;
        qc.setQueryData<TrackerDetailResponse>(key, { ...prev, entries, stats, dueEntry });
      }
      try {
        return settle(
          await apiJson<TrackerDetailResponse>(`/organizations/${orgId}/trackers/${trackerId}/entries/${date}`, {
            method: "PUT",
            token,
            body: JSON.stringify(input),
          }),
        );
      } catch (e) {
        if (prev) qc.setQueryData(key, prev);
        throw e;
      }
    },
    [orgId, token, settle, qc],
  );

  const deleteEntry = useCallback(
    async (trackerId: string, date: string) =>
      settle(
        await apiJson<TrackerDetailResponse>(`/organizations/${orgId}/trackers/${trackerId}/entries/${date}`, {
          method: "DELETE",
          token,
        }),
      ),
    [orgId, token, settle],
  );

  return { create, update, remove, logEntry, deleteEntry };
}
