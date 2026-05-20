import type { QueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import { TASK_DEFAULT_TITLE } from "@/lib/task-default-title";
import type { TaskDetail, TaskMutationResult, TaskRow } from "@/lib/ledger-types";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";

export type CreateDraftTaskInput = {
  listId: string;
  title?: string;
  assignerId?: string;
};

const _pendingCreations = new Map<string, Promise<void>>();

/** Returns a Promise that resolves when the background creation POST completes (or undefined if not pending). */
export function getPendingCreation(taskId: string): Promise<void> | undefined {
  return _pendingCreations.get(taskId);
}

/**
 * Synchronously seeds RQ cache with a stub task, fires POST to the server in the background,
 * and returns the client-generated UUID so the caller can navigate before the server responds.
 * Any PATCH for this task will automatically wait for the creation to finish.
 */
export function createDraftTask(
  queryClient: QueryClient,
  workspaceId: string,
  token: string,
  input: CreateDraftTaskInput,
): string {
  const clientId = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = input.title?.trim() || TASK_DEFAULT_TITLE;

  const stubTask: TaskRow = {
    id: clientId,
    title,
    status: "pending",
    priority: "medium",
    dueAt: null,
    dueRepeat: null,
    listId: input.listId,
    assignerId: input.assignerId ?? "",
    deletedAt: null,
    assigneeUserIds: [],
    subtasks: [],
    createdAt: now,
    updatedAt: now,
  };

  queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
    if (!old) return old;
    return { ...old, tasks: [stubTask, ...old.tasks] };
  });

  const stubDetail: TaskDetail = {
    task: stubTask,
    capabilities: { canArchiveTask: false, canDeleteTask: false, canReschedule: false, canAppendLedger: false },
    assigneeUserIds: [],
    subtasks: [],
    ledger: [],
  };
  queryClient.setQueryData(taskKeys.detail(clientId), stubDetail);

  const creationPromise: Promise<void> = (async () => {
    try {
      const created = await apiJson<TaskMutationResult>(`/organizations/${workspaceId}/tasks`, {
        method: "POST",
        token,
        body: JSON.stringify({
          id: clientId,
          title,
          listId: input.listId,
          assigneeUserIds: [],
          status: "pending",
          priority: "medium",
        }),
      });

      const realRow: TaskRow = {
        ...created.task,
        assigneeUserIds: created.assigneeUserIds,
        subtasks: created.subtasks,
      };
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.map((t) => (t.id === clientId ? realRow : t)) };
      });
      queryClient.setQueryData(taskKeys.detail(clientId), {
        task: created.task,
        capabilities: created.capabilities,
        assigneeUserIds: created.assigneeUserIds,
        subtasks: created.subtasks,
        ledger: created.ledgerDelta,
      } satisfies TaskDetail);
    } catch {
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.filter((t) => t.id !== clientId) };
      });
      queryClient.removeQueries({ queryKey: taskKeys.detail(clientId) });
    }
  })();

  _pendingCreations.set(clientId, creationPromise);
  void creationPromise.finally(() => _pendingCreations.delete(clientId));

  return clientId;
}
