import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  computeTrackerStats,
  trackerSlotKey,
  type TrackerDetail,
  type TrackerEntry,
  type CreateTrackerInput,
  type TrackerSummary,
  type UpdateTrackerInput,
  type UpsertTrackerEntryInput,
} from '@work-ledger/contracts';

import { api } from '@/lib/api';

export type MyTrackers = { today: string; canManage: boolean; trackers: TrackerSummary[] };

export const trackerQk = {
  root: (orgId: string) => ['trackers', orgId] as const,
  mine: (orgId: string) => ['trackers', orgId, 'mine'] as const,
};

/**
 * Trackers visible to the signed-in person, with today's log state: their own for members, every
 * tracker for owners and managers (the screen splits "yours" from the team's).
 */
export function useMyTrackers(orgId: string | undefined) {
  return useQuery({
    queryKey: trackerQk.mine(orgId ?? ''),
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: () => api<MyTrackers>(`/organizations/${orgId}/trackers`, { params: { scope: 'all' } }),
  });
}

export type TrackerDetailResponse = TrackerDetail & { canManage: boolean };

export function useTrackerDetail(orgId: string | undefined, trackerId: string | undefined) {
  return useQuery({
    queryKey: ['trackers', orgId ?? '', 'detail', trackerId ?? ''] as const,
    enabled: !!orgId && !!trackerId,
    queryFn: () => api<TrackerDetailResponse>(`/organizations/${orgId}/trackers/${trackerId}`),
  });
}

/** Create / update / archive / delete. Each settles by refreshing every tracker query for the workspace. */
export function useTrackerWrites(orgId: string | undefined) {
  const qc = useQueryClient();
  const refresh = () => {
    if (orgId) void qc.invalidateQueries({ queryKey: trackerQk.root(orgId) });
  };
  return {
    create: async (input: CreateTrackerInput) => {
      const d = await api<TrackerDetailResponse>(`/organizations/${orgId}/trackers`, { method: 'POST', body: input });
      refresh();
      return d;
    },
    update: async (id: string, input: UpdateTrackerInput) => {
      const d = await api<TrackerDetailResponse>(`/organizations/${orgId}/trackers/${id}`, { method: 'PATCH', body: input });
      refresh();
      return d;
    },
    remove: async (id: string) => {
      await api(`/organizations/${orgId}/trackers/${id}`, { method: 'DELETE' });
      refresh();
    },
  };
}

/** How many logs are due and not yet in — for the Home line. */
export function useDueLogCount(orgId: string | undefined, userId: string | null): number {
  const q = useMyTrackers(orgId);
  return (q.data?.trackers ?? []).filter((t) => t.assigneeId === userId && t.stats.dueKey && !t.stats.dueLogged).length;
}

type LogVars = { trackerId: string; date: string; input: UpsertTrackerEntryInput };

/**
 * Optimistic: the log is applied to the cached list (pace recomputed with the same engine the API
 * uses) before the request goes out, so saving feels instant. A failure restores the list.
 */
export function useLogProgress(orgId: string | undefined) {
  const qc = useQueryClient();
  const key = trackerQk.mine(orgId ?? '');
  return useMutation({
    mutationFn: (v: LogVars) =>
      api<TrackerDetail>(`/organizations/${orgId}/trackers/${v.trackerId}/entries/${v.date}`, {
        method: 'PUT',
        body: v.input,
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MyTrackers>(key);
      if (prev) {
        qc.setQueryData<MyTrackers>(key, {
          ...prev,
          trackers: prev.trackers.map((t) => {
            if (t.id !== v.trackerId) return t;
            const slot = trackerSlotKey(t.checkIn, v.date);
            const entry: TrackerEntry = {
              id: t.dueEntry?.entryDate === slot ? t.dueEntry.id : `pending-${slot}`,
              entryDate: slot,
              userId: t.assigneeId ?? '',
              note: v.input.note ?? null,
              values: v.input.values,
              updatedAt: new Date().toISOString(),
            };
            // The list carries only the current slot's entry, so fold this log into the totals by
            // adding it as an extra entry (replacing the old current one if it is being corrected).
            const base: TrackerEntry[] = [];
            const old = t.dueEntry && t.dueEntry.entryDate === slot ? t.dueEntry : null;
            const totals: Record<string, number> = {};
            t.metrics.forEach((m, i) => {
              if (m.kind !== 'input') return;
              const sum = t.stats.metrics[i]?.value ?? 0;
              totals[m.id] = sum - (old?.values[m.id] ?? 0);
            });
            base.push({ id: 'totals', entryDate: '0000-00-00', userId: t.assigneeId ?? '', note: null, values: totals, updatedAt: '' });
            const loggedKeys = t.stats.slots.filter((s) => s.state === 'logged' && s.key !== slot).map((s) => s.key);
            for (const k of loggedKeys) base.push({ id: `l-${k}`, entryDate: k, userId: t.assigneeId ?? '', note: null, values: {}, updatedAt: '' });
            const stats = computeTrackerStats(t, t.metrics, [...base, entry], prev.today);
            return { ...t, stats, dueEntry: stats.dueKey === slot ? entry : t.dueEntry };
          }),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      if (orgId) void qc.invalidateQueries({ queryKey: trackerQk.root(orgId) });
    },
  });
}
