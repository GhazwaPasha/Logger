import {
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { api } from '@/lib/api';
import { afterCreation } from '@/lib/pending-creation';
import type { ManualTaskStatus, TaskPriority } from '@/lib/task-board';
import type {
  Dept,
  LedgerRow,
  ListRow,
  Org,
  SubtaskRow,
  TaskDetail,
  TaskDueRepeat,
  TaskMutationResult,
  TaskPage,
  TaskRow,
  WorkspaceBootstrap,
} from '@/lib/types';

/** Scope a task query by category / channel / assignee — the same filter fields the web board sends. */
export type BoardFilter = {
  listId?: string | null;
  departmentId?: string | null;
  assigneeUserId?: string | null;
};

export const qk = {
  orgs: ['orgs'] as const,
  bootstrap: (orgId: string) => ['bootstrap', orgId] as const,
  tasksRoot: ['tasks'] as const,
  column: (orgId: string, filter: BoardFilter, status: string) => ['tasks', orgId, 'column', filter, status] as const,
  counts: (orgId: string, filter: BoardFilter) => ['tasks', orgId, 'counts', filter] as const,
  seriesSummary: (orgId: string, filter: BoardFilter, statuses: readonly string[]) =>
    ['tasks', orgId, 'series-summary', filter, statuses] as const,
  seriesOccurrences: (orgId: string, seriesId: string) => ['tasks', orgId, 'series', seriesId] as const,
  active: (orgId: string) => ['tasks', orgId, 'active'] as const,
  archived: (orgId: string) => ['tasks', orgId, 'archived'] as const,
  task: (taskId: string) => ['task', taskId] as const,
  activity: (orgId: string) => ['activity', orgId] as const,
};

const COLUMN_PAGE_SIZE = 25;

const filterParams = (f: BoardFilter) => ({
  listId: f.listId ?? undefined,
  departmentId: f.departmentId ?? undefined,
  assigneeUserId: f.assigneeUserId ?? undefined,
});

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export function useOrgs() {
  return useQuery({ queryKey: qk.orgs, queryFn: () => api<Org[]>('/organizations') });
}

/** Categories, channels and members in one round trip (`GET /organizations/:id/workspace`). */
export function useWorkspaceBootstrap(orgId: string | undefined) {
  return useQuery({
    queryKey: qk.bootstrap(orgId ?? ''),
    queryFn: () => api<WorkspaceBootstrap>(`/organizations/${orgId}/workspace`),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/** One kanban column (= one status): cursor-paginated, scoped like the web's `ColumnList`. */
export function useBoardColumn(orgId: string | undefined, filter: BoardFilter, status: ManualTaskStatus, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.column(orgId ?? '', filter, status),
    enabled: !!orgId && enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<TaskPage>(`/organizations/${orgId}/tasks`, {
        params: { ...filterParams(filter), status, limit: COLUMN_PAGE_SIZE, cursor: pageParam },
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** True per-status totals for the column headers. */
export function useBoardCounts(orgId: string | undefined, filter: BoardFilter) {
  return useQuery({
    queryKey: qk.counts(orgId ?? '', filter),
    enabled: !!orgId,
    queryFn: () => api<Record<string, number>>(`/organizations/${orgId}/tasks/counts`, { params: filterParams(filter) }),
  });
}

/** Collapsed-card stats for a recurring chain — mirrors the web's `SeriesSummaryRow` (`useWorkTaskStats.ts`). */
export type SeriesSummaryRow = {
  seriesId: string;
  count: number;
  latest: { id: string; title: string; createdAt: string };
  lastDone: {
    id: string;
    completedAt: string | null;
    dueAt: string | null;
    lastSubmittedAt: string | null;
    assigneeUserIds: string[];
  } | null;
};

/** RecurringSeriesCard header stats (count + latest + last completion), grouped by chain. */
export function useSeriesSummaries(
  orgId: string | undefined,
  filter: BoardFilter,
  statuses: readonly string[],
  enabled = true,
) {
  const q = useQuery({
    queryKey: qk.seriesSummary(orgId ?? '', filter, statuses),
    queryFn: () =>
      api<SeriesSummaryRow[]>(`/organizations/${orgId}/tasks/series-summary`, {
        params: { ...filterParams(filter), status: statuses.join(',') },
      }),
    enabled: !!orgId && enabled && statuses.length > 0,
    staleTime: 30_000,
  });
  return { summaries: q.data ?? [], isLoading: q.isPending && !!orgId };
}

type SeriesOccurrencesPage = { tasks: TaskRow[]; nextCursor: string | null };

/** Frontend-only cap on how far back a card's occurrence list will page — see the web's `RecurringSeriesCard`. */
const OCCURRENCE_CAP = 30;

/** Occurrence list for one recurring chain — only fetched once its card is expanded, paginated by cursor. */
export function useSeriesOccurrences(
  orgId: string | undefined,
  seriesId: string | undefined,
  opts: { statuses?: readonly string[]; enabled: boolean },
) {
  const qc = useQueryClient();
  const statusParam = opts.statuses?.length ? opts.statuses.join(',') : undefined;
  const queryKey = qk.seriesOccurrences(orgId ?? '', seriesId ?? '');

  const q = useQuery({
    queryKey,
    queryFn: () =>
      api<SeriesOccurrencesPage>(`/organizations/${orgId}/tasks/series/${seriesId}`, {
        params: { limit: 25, status: statusParam },
      }),
    enabled: !!orgId && !!seriesId && opts.enabled,
    staleTime: 15_000,
  });

  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const loadedCount = q.data?.tasks.length ?? 0;
  const rawNextCursor = q.data?.nextCursor ?? null;
  const capReached = loadedCount >= OCCURRENCE_CAP;
  const nextCursor = capReached ? null : rawNextCursor;
  /** More history exists on the server past what the cap let us load. */
  const hasMoreBeyondCap = capReached && Boolean(rawNextCursor);

  const loadMore = useCallback(async () => {
    if (!orgId || !seriesId || !rawNextCursor || capReached) return;
    const limit = Math.min(25, OCCURRENCE_CAP - loadedCount);
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = await api<SeriesOccurrencesPage>(`/organizations/${orgId}/tasks/series/${seriesId}`, {
        params: { limit, cursor: rawNextCursor, status: statusParam },
      });
      qc.setQueryData<SeriesOccurrencesPage>(queryKey, (old) => {
        if (!old) return page;
        const existingIds = new Set(old.tasks.map((t) => t.id));
        return {
          tasks: [...old.tasks, ...page.tasks.filter((t) => !existingIds.has(t.id))],
          nextCursor: page.nextCursor,
        };
      });
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [orgId, seriesId, rawNextCursor, capReached, loadedCount, statusParam, qc, queryKey]);

  return {
    tasks: q.data?.tasks ?? [],
    isLoading: q.isFetching && !q.data,
    nextCursor,
    hasMoreBeyondCap,
    loadingMore,
    loadMoreError,
    loadMore,
  };
}

/** Every pending / in-progress task in the workspace (paged internally) — sidebar counts and dashboard stats. */
export function useActiveTasks(orgId: string | undefined) {
  return useQuery({
    queryKey: qk.active(orgId ?? ''),
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async () => {
      const out: TaskRow[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        const res = await api<TaskPage>(`/organizations/${orgId}/tasks`, {
          params: { status: 'pending,in_progress', limit: 100, cursor, includeSubtasks: 'true' },
        });
        out.push(...res.tasks);
        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }
      return out;
    },
  });
}

export function useArchivedTasks(orgId: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.archived(orgId ?? ''),
    enabled: !!orgId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<TaskPage>(`/organizations/${orgId}/tasks`, {
        params: { archived: 'true', limit: COLUMN_PAGE_SIZE, cursor: pageParam, includeSubtasks: 'false' },
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** A task title match from `GET /organizations/:id/search` (`SearchTaskResult` in the API). */
export type SearchTaskResult = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  listId: string;
};

/** Task title search (the API needs at least 2 characters and returns up to 20 matches). */
export function useSearchTasks(orgId: string | undefined, query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['search', orgId ?? '', q] as const,
    enabled: !!orgId && q.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: () => api<SearchTaskResult[]>(`/organizations/${orgId}/search`, { params: { q } }),
  });
}

/** A task's row from whichever board / list cache already holds it. */
function cachedTaskRow(qc: QueryClient, taskId: string): TaskRow | undefined {
  for (const [, data] of qc.getQueriesData({ queryKey: qk.tasksRoot })) {
    const rows = Array.isArray(data)
      ? (data as TaskRow[])
      : data && typeof data === 'object' && 'pages' in data
        ? (data as InfiniteData<TaskPage>).pages.flatMap((p) => p.tasks)
        : [];
    const row = rows.find((t) => t?.id === taskId);
    if (row) return row;
  }
  return undefined;
}

/**
 * One task's detail. Opens instantly from the row the board already has (the web's `useTaskDetail`
 * placeholder) while the full detail loads, and isn't refetched on every visit: our own saves write the
 * server's answer into this cache, and teammates' changes arrive over the socket (`invalidateWorkspace`).
 */
export function useTaskDetail(taskId: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.task(taskId ?? ''),
    queryFn: async () => {
      await afterCreation(taskId ?? '');
      return api<TaskDetail>(`/tasks/${taskId}`);
    },
    enabled: !!taskId,
    staleTime: 15_000,
    placeholderData: (): TaskDetail | undefined => {
      const row = taskId ? cachedTaskRow(qc, taskId) : undefined;
      return row ? detailFromRow(row) : undefined;
    },
  });
}

/** A detail stand-in built from a board row, until `GET /tasks/:id` lands. */
function detailFromRow(row: TaskRow): TaskDetail {
  return {
    task: row,
    // Field edits are gated on the client-side caps until the server's arrive.
    capabilities: { canArchiveTask: false, canEditFields: false, canParticipate: true },
    assigneeUserIds: row.assigneeUserIds ?? [],
    subtasks: row.subtasks ?? [],
    ledger: [],
  };
}

/**
 * Makes sure an edit has a cached detail to land in. While a task is still showing its board-row stand-in
 * (placeholder data lives outside the cache), an optimistic update would have nowhere to go and the
 * screen wouldn't move; seeding the cache from that row fixes it. The detail fetch in flight is left
 * running — it replaces the seed when it lands.
 */
function ensureDetail(qc: QueryClient, taskId: string): boolean {
  if (qc.getQueryData(qk.task(taskId)) !== undefined) return true;
  const row = cachedTaskRow(qc, taskId);
  if (!row) return false;
  qc.setQueryData<TaskDetail>(qk.task(taskId), detailFromRow(row));
  return false;
}

/** After a save lands: a detail fetch that started before it would bring back pre-save data, so fetch again. */
function refetchIfRacing(qc: QueryClient, taskId: string) {
  if (qc.getQueryState(qk.task(taskId))?.fetchStatus === 'fetching') {
    void qc.invalidateQueries({ queryKey: qk.task(taskId) });
  }
}

export type ActivityFeed = {
  entries: (LedgerRow & { taskId: string })[];
  tasksById: Record<string, { id: string; title: string; assignerId?: string | null; dueAt?: string | null }>;
  /** Assignees of the tasks referenced in `entries` (authoritative for notification eligibility). */
  assigneesByTaskId?: Record<string, string[]>;
};

export function useOrgActivity(orgId: string | undefined, enabled = true, refetchInterval?: number) {
  return useQuery({
    queryKey: qk.activity(orgId ?? ''),
    enabled: !!orgId && enabled,
    refetchInterval,
    queryFn: () => api<ActivityFeed>(`/organizations/${orgId}/activity`),
  });
}

// ---------------------------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------------------------

/**
 * Tasks this device just wrote. The API echoes every write back over the socket as `workspace_changed`; for our
 * own saves the caches already hold the server's answer, so those echoes are skipped instead of refetching
 * the whole workspace a second time.
 */
const ownWrites = new Map<string, number>();
const OWN_WRITE_ECHO_MS = 5000;
export function markOwnWrite(taskId: string) {
  ownWrites.set(taskId, Date.now());
}
function isOwnEcho(taskId: string) {
  const at = ownWrites.get(taskId);
  return at !== undefined && Date.now() - at < OWN_WRITE_ECHO_MS;
}

/** Rewrites one task wherever a board / list cache holds it. */
function updateTaskRows(qc: QueryClient, taskId: string, fn: (t: TaskRow) => TaskRow) {
  qc.setQueriesData({ queryKey: qk.tasksRoot }, (old) => mapTaskRows(old, (t) => (t.id === taskId ? fn(t) : t)));
}

const ACTIVE_STATUSES = new Set(['pending', 'in_progress']);

/** Keeps the active-task list (dashboard stats) right in place: drops a task that closed, adds one that (re)opened. */
export function syncActiveRow(qc: QueryClient, row: TaskRow) {
  qc.setQueriesData<TaskRow[]>({ queryKey: qk.tasksRoot, predicate: (q) => q.queryKey[2] === 'active' }, (old) => {
    if (!Array.isArray(old)) return old;
    const open = ACTIVE_STATUSES.has(row.status) && !row.deletedAt;
    const has = old.some((t) => t.id === row.id);
    if (open) return has ? old.map((t) => (t.id === row.id ? row : t)) : [row, ...old];
    return has ? old.filter((t) => t.id !== row.id) : old;
  });
}

/**
 * Board columns, counts and series summaries — the lists whose membership a status / channel / assignee /
 * due change can alter. Only the mounted ones refetch; the (paged, heavy) active-task list is kept in sync
 * in place by {@link syncActiveRow} instead of being re-crawled.
 */
export function refreshTaskLists(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: qk.tasksRoot, predicate: (q) => q.queryKey[2] !== 'active' });
}

/** Whether a task belongs in a board scoped by `filter` (channel or assignee); `null` when that can't be told locally. */
function inFilter(filter: BoardFilter | undefined, t: TaskRow): boolean | null {
  if (!filter) return null;
  if (filter.listId) return t.listId === filter.listId;
  if (filter.assigneeUserId) return (t.assigneeUserIds ?? []).includes(filter.assigneeUserId);
  if (filter.departmentId) return null;
  return true;
}

/**
 * Moves a task between cached board columns and adjusts the column counts, the moment its status / channel /
 * assignees change — so a card lands in its new column instantly instead of after a refetch of every column.
 */
function relocateTask(qc: QueryClient, before: TaskRow | undefined, after: TaskRow) {
  for (const q of qc.getQueryCache().findAll({ queryKey: qk.tasksRoot })) {
    const [, , kind, filter, status] = q.queryKey as [string, string, string, BoardFilter | undefined, string | undefined];
    if (kind === 'column') {
      const data = q.state.data as InfiniteData<TaskPage> | undefined;
      if (!data?.pages.length) continue;
      const belongs = inFilter(filter, after);
      if (belongs === null) continue;
      const has = data.pages.some((p) => p.tasks.some((t) => t.id === after.id));
      const should = belongs && status === after.status && !after.deletedAt;
      if (has && !should) {
        qc.setQueryData<InfiniteData<TaskPage>>(q.queryKey, {
          ...data,
          pages: data.pages.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== after.id) })),
        });
      } else if (!has && should) {
        qc.setQueryData<InfiniteData<TaskPage>>(q.queryKey, {
          ...data,
          pages: [{ ...data.pages[0]!, tasks: [after, ...data.pages[0]!.tasks] }, ...data.pages.slice(1)],
        });
      }
    } else if (kind === 'counts' && before) {
      const counts = q.state.data as Record<string, number> | undefined;
      if (!counts) continue;
      const was = inFilter(filter, before);
      const is = inFilter(filter, after);
      if (was === null || is === null) continue;
      const next = { ...counts };
      if (was && !before.deletedAt) next[before.status] = Math.max(0, (next[before.status] ?? 0) - 1);
      if (is && !after.deletedAt) next[after.status] = (next[after.status] ?? 0) + 1;
      qc.setQueryData(q.queryKey, next);
    }
  }
}

function invalidateTasks(qc: QueryClient, taskId?: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.tasksRoot }),
    taskId ? qc.invalidateQueries({ queryKey: qk.task(taskId) }) : undefined,
    qc.invalidateQueries({ queryKey: ['activity'] }),
  ]);
}

/**
 * Someone changed the workspace (the API's `workspace_changed` socket event): refetch what could be stale.
 * `taskIds` are the tasks named by the events being handled; their detail and comments refetch too.
 */
export function invalidateWorkspace(qc: QueryClient, orgId: string, taskIds: Iterable<string>, untargeted = false) {
  const ids = [...taskIds].filter((id) => !isOwnEcho(id));
  // Only echoes of this device's own saves: every cache already has the result.
  if (!untargeted && ids.length === 0) return Promise.resolve();
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['tasks', orgId] }),
    qc.invalidateQueries({ queryKey: qk.bootstrap(orgId) }),
    qc.invalidateQueries({ queryKey: qk.activity(orgId) }),
    qc.invalidateQueries({ queryKey: ['roadmap', orgId] }),
    qc.invalidateQueries({ queryKey: ['search', orgId] }),
    ...ids.map((id) => qc.invalidateQueries({ queryKey: qk.task(id) })),
    ...ids.map((id) => qc.invalidateQueries({ queryKey: ['comments', id] })),
  ]);
}

export type TaskPatch = {
  status?: ManualTaskStatus;
  priority?: TaskPriority;
  title?: string;
  listId?: string;
  assigneeUserIds?: string[];
  dueAt?: string | null;
  dueRepeat?: TaskDueRepeat | null;
  discordChannelId?: string | null;
  discordSubmissionRequired?: boolean;
  attachmentRequired?: boolean;
  timeTrackingEnabled?: boolean;
  /** Checklist lines added in the same request (and transaction) as the field changes. */
  subtasksToCreate?: { title: string }[];
};

/** Field changes that can move a task between board columns / filtered lists. */
const MEMBERSHIP_FIELDS: (keyof TaskPatch)[] = ['status', 'listId', 'assigneeUserIds', 'dueAt', 'dueRepeat'];

const PATCH_KEY = ['patchTask'] as const;

export function usePatchTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: PATCH_KEY,
    mutationFn: async ({ taskId, patch }: { taskId: string; patch: TaskPatch }) => {
      await afterCreation(taskId);
      return api<TaskMutationResult>(`/tasks/${taskId}`, { method: 'PATCH', body: patch });
    },
    // Optimistic, like the web: the screen and every board show the change at once; the server's answer
    // replaces it when it lands, and nothing is refetched unless the change can move the task between lists.
    onMutate: async ({ taskId, patch }) => {
      markOwnWrite(taskId);
      // Cancelling only an overwrite of real data: cancelling a task's first load would strand the screen on
      // its stand-in (that was the "only updates after going back and forth" bug).
      if (ensureDetail(qc, taskId)) await qc.cancelQueries({ queryKey: qk.task(taskId) });
      const moves = MEMBERSHIP_FIELDS.some((k) => patch[k] !== undefined);
      // A board refetch already in flight would land pre-move data on top of the move; cancel those (only ones
      // that already hold data — cancelling a first load would leave that list empty).
      if (moves) await qc.cancelQueries({ queryKey: qk.tasksRoot, predicate: (q) => q.state.data !== undefined });
      const prevDetail = qc.getQueryData<TaskDetail>(qk.task(taskId));
      const snapshots = qc.getQueriesData({ queryKey: qk.tasksRoot });
      const before = cachedTaskRow(qc, taskId) ?? prevDetail?.task;
      const { assigneeUserIds, subtasksToCreate, ...fields } = patch;
      const apply = (t: TaskRow): TaskRow => ({ ...t, ...fields, ...(assigneeUserIds ? { assigneeUserIds } : {}) });
      qc.setQueryData<TaskDetail>(qk.task(taskId), (old) =>
        old ? { ...old, task: apply(old.task), assigneeUserIds: assigneeUserIds ?? old.assigneeUserIds } : old,
      );
      updateTaskRows(qc, taskId, apply);
      if (before && moves) {
        const after = apply(before);
        relocateTask(qc, before, after);
        syncActiveRow(qc, after);
      }
      return { prevDetail, snapshots, before };
    },
    onError: (_e, { taskId }, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.prevDetail) qc.setQueryData(qk.task(taskId), ctx.prevDetail);
      void qc.invalidateQueries({ queryKey: qk.task(taskId) });
    },
    onSuccess: (res, { taskId, patch }, ctx) => {
      // With another save of this task still in flight, this answer predates it: keep the optimistic state
      // (the last save to land writes the final one) instead of flashing old values back.
      const newer =
        qc.isMutating({
          mutationKey: PATCH_KEY,
          predicate: (m) => (m.state.variables as { taskId?: string } | undefined)?.taskId === taskId,
        }) > 1;
      qc.setQueryData<TaskDetail>(qk.task(taskId), (old) =>
        old
          ? newer
            ? { ...old, ledger: [...old.ledger, ...res.ledgerDelta] }
            : {
                ...old,
                task: { ...old.task, ...res.task },
                capabilities: res.capabilities,
                subtasks: res.subtasks,
                assigneeUserIds: res.assigneeUserIds,
                ledger: [...old.ledger, ...res.ledgerDelta],
              }
          : old,
      );
      const moves = MEMBERSHIP_FIELDS.some((k) => patch[k] !== undefined);
      if (!newer) {
        const merge = (t: TaskRow): TaskRow => ({ ...t, ...res.task, assigneeUserIds: res.assigneeUserIds, subtasks: res.subtasks });
        updateTaskRows(qc, taskId, merge);
        const merged = merge(cachedTaskRow(qc, taskId) ?? res.task);
        // Settle on the server's answer (a no-op when it matches the optimistic move). No counts change here:
        // they were adjusted once, in onMutate.
        if (moves) relocateTask(qc, undefined, merged);
        syncActiveRow(qc, merged);
      }
      refetchIfRacing(qc, taskId);
      // The move is already on every board. Only what can't be worked out here is fetched for real: a new
      // recurring occurrence, or a recurring task entering / leaving Done·Cancelled (its series card changes).
      // Everything else is just marked stale, for the next time those boards open.
      const recurringMove = !!(ctx?.before?.recurringSeriesId || res.task.recurringSeriesId) && patch.status !== undefined;
      if (res.spawnedRecurringTaskId || recurringMove) void refreshTaskLists(qc);
      else if (moves) {
        void qc.invalidateQueries({
          queryKey: qk.tasksRoot,
          predicate: (q) => q.queryKey[2] !== 'active',
          refetchType: 'none',
        });
      }
      if (res.ledgerDelta.length) void qc.invalidateQueries({ queryKey: ['activity'] });
    },
    onSettled: (_r, _e, { taskId }) => markOwnWrite(taskId),
  });
}

/** Ids of tasks with a save in flight — cards show a spinner on those (the web's `patchTaskPendingId`). */
export function usePendingTaskIds(): Set<string> {
  const vars = useMutationState({
    filters: { mutationKey: PATCH_KEY, status: 'pending' },
    select: (m) => (m.state.variables as { taskId: string } | undefined)?.taskId,
  });
  return new Set(vars.filter((v): v is string => !!v));
}

/** Applies `fn` to every cached task row (paged columns and the active-task list). */
function mapTaskRows(old: unknown, fn: (t: TaskRow) => TaskRow): unknown {
  if (Array.isArray(old)) return old.map(fn);
  if (old && typeof old === 'object' && 'pages' in old) {
    const data = old as InfiniteData<TaskPage>;
    return { ...data, pages: data.pages.map((p) => ({ ...p, tasks: p.tasks.map(fn) })) };
  }
  return old;
}

/** Tick / untick a checklist item from a card or the detail screen, updating every cache optimistically. */
export function useSetSubtaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['subtaskDone'],
    mutationFn: (v: { taskId: string; subtaskId: string; done: boolean }) =>
      api(`/tasks/${v.taskId}/subtasks/${v.subtaskId}`, { method: 'PATCH', body: { done: v.done } }),
    onMutate: async (v) => {
      markOwnWrite(v.taskId);
      const flip = (s: SubtaskRow) => (s.id === v.subtaskId ? { ...s, done: v.done } : s);
      const snapshots = qc.getQueriesData({ queryKey: qk.tasksRoot });
      const prevDetail = qc.getQueryData<TaskDetail>(qk.task(v.taskId));
      qc.setQueriesData({ queryKey: qk.tasksRoot }, (old) =>
        mapTaskRows(old, (t) => (t.id === v.taskId && t.subtasks ? { ...t, subtasks: t.subtasks.map(flip) } : t)),
      );
      qc.setQueryData<TaskDetail>(qk.task(v.taskId), (old) => (old ? { ...old, subtasks: old.subtasks.map(flip) } : old));
      return { snapshots, prevDetail };
    },
    onError: (_e, v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.prevDetail) qc.setQueryData(qk.task(v.taskId), ctx.prevDetail);
    },
    onSettled: (_r, _e, v) => afterSubtaskWrite(qc, v.taskId),
  });
}

/**
 * After a checklist write: the caches already hold the result, so nothing refetches now. The detail is only
 * marked stale (the server also logged a history note) and picks that up on its next visit.
 */
function afterSubtaskWrite(qc: QueryClient, taskId: string) {
  markOwnWrite(taskId);
  refetchIfRacing(qc, taskId);
  return qc.invalidateQueries({ queryKey: qk.task(taskId), refetchType: 'none' });
}

/** Rewrites a task's checklist in its detail and every board row. */
function setSubtasks(qc: QueryClient, taskId: string, fn: (subtasks: SubtaskRow[]) => SubtaskRow[]) {
  ensureDetail(qc, taskId);
  qc.setQueryData<TaskDetail>(qk.task(taskId), (old) => (old ? { ...old, subtasks: fn(old.subtasks) } : old));
  updateTaskRows(qc, taskId, (t) => (t.subtasks ? { ...t, subtasks: fn(t.subtasks) } : t));
}

export function useAddSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      await afterCreation(taskId);
      return api<SubtaskRow>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: { title } });
    },
    onMutate: (title) => {
      markOwnWrite(taskId);
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSubtasks(qc, taskId, (list) => [...list, { id: tempId, taskId, title, done: false }]);
      return { tempId };
    },
    onSuccess: (row, _title, ctx) => setSubtasks(qc, taskId, (list) => list.map((s) => (s.id === ctx?.tempId ? row : s))),
    onError: (_e, _title, ctx) => setSubtasks(qc, taskId, (list) => list.filter((s) => s.id !== ctx?.tempId)),
    onSettled: () => afterSubtaskWrite(qc, taskId),
  });
}

/** Renames a subtask (done-toggling stays on {@link useSetSubtaskDone}, which every board card also uses). */
export function useUpdateSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { subtaskId: string; title: string }) =>
      api<SubtaskRow>(`/tasks/${taskId}/subtasks/${v.subtaskId}`, { method: 'PATCH', body: { title: v.title } }),
    onMutate: (v) => {
      markOwnWrite(taskId);
      const prev = qc.getQueryData<TaskDetail>(qk.task(taskId))?.subtasks.find((s) => s.id === v.subtaskId);
      setSubtasks(qc, taskId, (list) => list.map((s) => (s.id === v.subtaskId ? { ...s, title: v.title } : s)));
      return { prev };
    },
    onError: (_e, v, ctx) => {
      const prev = ctx?.prev;
      if (prev) setSubtasks(qc, taskId, (list) => list.map((s) => (s.id === v.subtaskId ? prev : s)));
    },
    onSettled: () => afterSubtaskWrite(qc, taskId),
  });
}

export function useDeleteSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) => api(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),
    onMutate: (subtaskId) => {
      markOwnWrite(taskId);
      const list = qc.getQueryData<TaskDetail>(qk.task(taskId))?.subtasks ?? [];
      const index = list.findIndex((s) => s.id === subtaskId);
      setSubtasks(qc, taskId, (l) => l.filter((s) => s.id !== subtaskId));
      return { removed: index >= 0 ? list[index] : undefined, index };
    },
    onError: (_e, _id, ctx) => {
      const removed = ctx?.removed;
      if (removed) setSubtasks(qc, taskId, (l) => [...l.slice(0, ctx.index), removed, ...l.slice(ctx.index)]);
    },
    onSettled: () => afterSubtaskWrite(qc, taskId),
  });
}

export function useAddNote(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      api(`/tasks/${taskId}/ledger`, {
        method: 'POST',
        body: {
          type: 'note',
          payload: { message },
          clientMutationId: `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        },
      }),
    onSettled: () => {
      markOwnWrite(taskId);
      return Promise.all([qc.invalidateQueries({ queryKey: qk.task(taskId) }), qc.invalidateQueries({ queryKey: ['activity'] })]);
    },
  });
}

export type NewTask = {
  title: string;
  listId: string;
  priority: TaskPriority;
  assigneeUserIds: string[];
  dueAt?: string | null;
};

export function useCreateTask(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) =>
      api<TaskMutationResult>(`/organizations/${orgId}/tasks`, { method: 'POST', body: task }),
    onSettled: () => invalidateTasks(qc),
  });
}

/** Drops a task from every board / list cache (columns, active list, archived list). */
function removeTaskRows(qc: QueryClient, taskId: string) {
  qc.setQueriesData({ queryKey: qk.tasksRoot }, (old) => {
    if (Array.isArray(old)) return (old as TaskRow[]).filter((t) => t.id !== taskId);
    if (old && typeof old === 'object' && 'pages' in old) {
      const data = old as InfiniteData<TaskPage>;
      return { ...data, pages: data.pages.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== taskId) })) };
    }
    return old;
  });
}

/** Puts a task at the top of the cached archived list (first page). */
function prependArchived(qc: QueryClient, row: TaskRow) {
  qc.setQueriesData<InfiniteData<TaskPage>>(
    { queryKey: qk.tasksRoot, predicate: (q) => q.queryKey[2] === 'archived' },
    (old) =>
      old && old.pages.length
        ? { ...old, pages: [{ ...old.pages[0]!, tasks: [row, ...old.pages[0]!.tasks] }, ...old.pages.slice(1)] }
        : old,
  );
}

/**
 * Archive / restore, both optimistic: the task leaves (or rejoins) the boards and the archived list at once,
 * and its detail flips state, so nothing waits on the server. A failure puts every cache back.
 */
function useArchiveToggle(mode: 'archive' | 'restore') {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['archiveToggle', mode],
    mutationFn: async (taskId: string) => {
      await afterCreation(taskId);
      return api(`/tasks/${taskId}/${mode}`, { method: 'POST' });
    },
    onMutate: async (taskId) => {
      markOwnWrite(taskId);
      // No cancelling of in-flight list loads: cancelling a list's first load would leave it stuck empty.
      const snapshots = qc.getQueriesData({ queryKey: qk.tasksRoot });
      const prevDetail = qc.getQueryData<TaskDetail>(qk.task(taskId));
      const row = prevDetail?.task ?? cachedTaskRow(qc, taskId);
      const deletedAt = mode === 'archive' ? new Date().toISOString() : null;
      removeTaskRows(qc, taskId);
      if (row) {
        const next: TaskRow = { ...row, deletedAt };
        if (mode === 'archive') prependArchived(qc, next);
        else syncActiveRow(qc, next);
      }
      qc.setQueryData<TaskDetail>(qk.task(taskId), (old) =>
        old
          ? {
              ...old,
              task: { ...old.task, deletedAt },
              capabilities: {
                ...old.capabilities,
                canArchiveTask: mode === 'restore',
                canRestoreTask: mode === 'archive',
              },
            }
          : old,
      );
      return { snapshots, prevDetail, row: row ? { ...row, deletedAt } : undefined };
    },
    onError: (_e, taskId, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.prevDetail) qc.setQueryData(qk.task(taskId), ctx.prevDetail);
    },
    onSuccess: (_r, taskId, ctx) => {
      markOwnWrite(taskId);
      // A dashboard load already in flight may have brought the old state back; settle it again.
      if (ctx?.row) syncActiveRow(qc, ctx.row);
      // Counts and filtered columns change; the detail picks up the server's capabilities.
      void refreshTaskLists(qc);
      void qc.invalidateQueries({ queryKey: qk.task(taskId) });
      void qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export const useArchiveTask = () => useArchiveToggle('archive');
export const useRestoreTask = () => useArchiveToggle('restore');

/** Flattened rows from an infinite task query. */
export const flattenPages = (data: InfiniteData<TaskPage> | undefined): TaskRow[] => {
  // De-duplicated: a task moved in locally can also come back on a later page.
  const seen = new Set<string>();
  return (data?.pages.flatMap((p) => p.tasks) ?? []).filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
};

// ---------------------------------------------------------------------------------------------
// Comments & organization settings
// ---------------------------------------------------------------------------------------------

export type CommentRow = {
  id: string;
  taskId: string;
  parentCommentId: string | null;
  authorId: string;
  /** Null when soft-deleted and the viewer is neither the author nor a workspace owner. */
  body: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  authorName: string;
  authorEmail: string;
  authorImage: string | null;
};

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['comments', taskId ?? ''],
    enabled: !!taskId,
    queryFn: () => api<CommentRow[]>(`/tasks/${taskId}/comments`),
  });
}

export function usePostComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { body: string; parentCommentId?: string }) =>
      api(`/tasks/${taskId}/comments`, { method: 'POST', body: v }),
    // The thread and this task's history only; board lists don't show comments.
    onSettled: () => {
      markOwnWrite(taskId);
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['comments', taskId] }),
        qc.invalidateQueries({ queryKey: qk.task(taskId) }),
        qc.invalidateQueries({ queryKey: ['activity'] }),
      ]);
    },
  });
}

export function useEditComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { commentId: string; body: string }) =>
      api(`/comments/${v.commentId}`, { method: 'PATCH', body: { body: v.body } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api(`/comments/${commentId}`, { method: 'DELETE' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useRestoreComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api(`/comments/${commentId}/restore`, { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useUpdateOrganization(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; timeZone?: string }) =>
      api(`/organizations/${orgId}`, { method: 'PATCH', body: patch }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.orgs }),
  });
}

// ---------------------------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------------------------

export type RoadmapStatus = 'on_track' | 'at_risk' | 'done' | 'archived';
export type GoalRow = {
  id: string;
  departmentId: string | null;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  targetDate: string | null;
  progress: { done: number; total: number; pct: number };
};
export type MilestoneRow = {
  id: string;
  goalId: string;
  parentId: string | null;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: RoadmapStatus;
  orderIndex: number;
  progress: { done: number; total: number; pct: number };
};

export function useRoadmap(orgId: string | undefined) {
  return useQuery({
    queryKey: ['roadmap', orgId ?? ''],
    enabled: !!orgId,
    queryFn: () => api<{ goals: GoalRow[]; milestones: MilestoneRow[] }>(`/organizations/${orgId}/roadmap`),
  });
}

// ---------------------------------------------------------------------------------------------
// Workspace structure (owners only — the API rejects everyone else)
// ---------------------------------------------------------------------------------------------

/** Appends the new row to the cached bootstrap, like the web sidebar does. */
function appendToBootstrap(qc: QueryClient, orgId: string, patch: (old: WorkspaceBootstrap) => WorkspaceBootstrap) {
  qc.setQueryData<WorkspaceBootstrap>(qk.bootstrap(orgId), (old) => (old ? patch(old) : old));
}

export function useCreateDepartment(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<Dept>(`/organizations/${orgId}/departments`, { method: 'POST', body: { name } }),
    onSuccess: (created) =>
      orgId &&
      appendToBootstrap(qc, orgId, (old) =>
        old.departments.some((d) => d.id === created.id) ? old : { ...old, departments: [...old.departments, created] },
      ),
  });
}

export function useCreateList(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; departmentId: string }) =>
      api<ListRow>(`/organizations/${orgId}/lists`, { method: 'POST', body: v }),
    onSuccess: (created) =>
      orgId &&
      appendToBootstrap(qc, orgId, (old) =>
        old.lists.some((l) => l.id === created.id) ? old : { ...old, lists: [...old.lists, created] },
      ),
  });
}

export function useRenameDepartment(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { deptId: string; name: string }) =>
      api<Dept>(`/organizations/${orgId}/departments/${v.deptId}`, { method: 'PATCH', body: { name: v.name } }),
    onSuccess: (updated) =>
      orgId &&
      appendToBootstrap(qc, orgId, (old) => ({
        ...old,
        departments: old.departments.map((d) => (d.id === updated.id ? updated : d)),
      })),
  });
}

/** Deleting a category takes every channel (and task) under it with it — same as the web sidebar. */
export function useDeleteDepartment(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deptId: string) => api(`/organizations/${orgId}/departments/${deptId}`, { method: 'DELETE' }),
    onSuccess: (_result, deptId) => {
      if (!orgId) return;
      appendToBootstrap(qc, orgId, (old) => ({
        ...old,
        departments: old.departments.filter((d) => d.id !== deptId),
        lists: old.lists.filter((l) => l.departmentId !== deptId),
      }));
      // The board scope self-heals to another channel once the deleted one is gone from `lists` (see useWorkspace's resolveScope).
      void invalidateTasks(qc);
    },
  });
}

export function useRenameList(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { listId: string; name: string }) =>
      api<ListRow>(`/organizations/${orgId}/lists/${v.listId}`, { method: 'PATCH', body: { name: v.name } }),
    onSuccess: (updated) =>
      orgId &&
      appendToBootstrap(qc, orgId, (old) => ({
        ...old,
        lists: old.lists.map((l) => (l.id === updated.id ? updated : l)),
      })),
  });
}

export function useDeleteList(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => api(`/organizations/${orgId}/lists/${listId}`, { method: 'DELETE' }),
    onSuccess: (_result, listId) => {
      if (!orgId) return;
      appendToBootstrap(qc, orgId, (old) => ({ ...old, lists: old.lists.filter((l) => l.id !== listId) }));
      void invalidateTasks(qc);
    },
  });
}
