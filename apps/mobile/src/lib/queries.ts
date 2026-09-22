import {
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { ManualTaskStatus, TaskPriority } from '@/lib/task-board';
import type {
  Dept,
  LedgerRow,
  ListRow,
  Org,
  SubtaskRow,
  TaskDetail,
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

export function useTaskDetail(taskId: string | undefined) {
  return useQuery({
    queryKey: qk.task(taskId ?? ''),
    queryFn: () => api<TaskDetail>(`/tasks/${taskId}`),
    enabled: !!taskId,
  });
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

function invalidateTasks(qc: QueryClient, taskId?: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.tasksRoot }),
    taskId ? qc.invalidateQueries({ queryKey: qk.task(taskId) }) : undefined,
    qc.invalidateQueries({ queryKey: ['activity'] }),
  ]);
}

export type TaskPatch = {
  status?: ManualTaskStatus;
  priority?: TaskPriority;
  title?: string;
  assigneeUserIds?: string[];
  dueAt?: string | null;
};

const PATCH_KEY = ['patchTask'] as const;

export function usePatchTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: PATCH_KEY,
    mutationFn: ({ taskId, patch }: { taskId: string; patch: TaskPatch }) =>
      api<TaskMutationResult>(`/tasks/${taskId}`, { method: 'PATCH', body: patch }),
    onSuccess: (res, { taskId }) => {
      qc.setQueryData<TaskDetail>(qk.task(taskId), (old) =>
        old
          ? { ...old, task: res.task, subtasks: res.subtasks, assigneeUserIds: res.assigneeUserIds, ledger: [...old.ledger, ...res.ledgerDelta] }
          : old,
      );
    },
    onSettled: (_r, _e, { taskId }) => invalidateTasks(qc, taskId),
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
      await qc.cancelQueries({ queryKey: qk.tasksRoot });
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
    onSettled: (_r, _e, v) => invalidateTasks(qc, v.taskId),
  });
}

export function useAddSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => api(`/tasks/${taskId}/subtasks`, { method: 'POST', body: { title } }),
    onSettled: () => invalidateTasks(qc, taskId),
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
    onSettled: () => invalidateTasks(qc, taskId),
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

export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api(`/tasks/${taskId}/archive`, { method: 'POST' }),
    onSettled: (_r, _e, taskId) => invalidateTasks(qc, taskId),
  });
}

export function useRestoreTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api(`/tasks/${taskId}/restore`, { method: 'POST' }),
    onSettled: (_r, _e, taskId) => invalidateTasks(qc, taskId),
  });
}

/** Flattened rows from an infinite task query. */
export const flattenPages = (data: InfiniteData<TaskPage> | undefined): TaskRow[] =>
  data?.pages.flatMap((p) => p.tasks) ?? [];

// ---------------------------------------------------------------------------------------------
// Comments & organization settings
// ---------------------------------------------------------------------------------------------

export type CommentRow = {
  id: string;
  taskId: string;
  parentCommentId: string | null;
  authorId: string;
  body: string;
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
    mutationFn: (body: string) => api(`/tasks/${taskId}/comments`, { method: 'POST', body: { body } }),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['comments', taskId] }), invalidateTasks(qc, taskId)]),
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
