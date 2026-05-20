import type { QueryClient } from "@tanstack/react-query";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import type { TaskDetail, TaskMutationResult } from "@/lib/ledger-types";

/**
 * Updates workspace list + task detail after a task write.
 *
 * By default **does not** replace `subtasks` — subtasks are owned by dedicated
 * subtask API calls and optimistic cache updates. Replacing subtasks from a
 * field-only PATCH (or a racing GET refetch) was causing deleted items to reappear.
 */
export function applyTaskMutationToCache(
  queryClient: QueryClient,
  workspaceId: string,
  taskId: string,
  saved: TaskMutationResult,
  options?: { syncSubtasks?: boolean },
) {
  const syncSubtasks = options?.syncSubtasks ?? false;

  queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
    if (!old) return old;
    return {
      ...old,
      tasks: old.tasks.map((t) =>
        t.id !== taskId
          ? t
          : {
              ...t,
              ...saved.task,
              assigneeUserIds: saved.assigneeUserIds,
              ...(syncSubtasks ? { subtasks: saved.subtasks } : {}),
            },
      ),
    };
  });
  queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), (old) => {
    if (!old) {
      if (!syncSubtasks) return old;
      return {
        task: saved.task,
        assigneeUserIds: saved.assigneeUserIds,
        subtasks: saved.subtasks,
        capabilities: saved.capabilities,
        ledger: saved.ledgerDelta,
      };
    }
    return {
      ...old,
      task: { ...old.task, ...saved.task },
      assigneeUserIds: saved.assigneeUserIds,
      ...(syncSubtasks ? { subtasks: saved.subtasks } : {}),
      capabilities: saved.capabilities,
      ledger: [...saved.ledgerDelta, ...old.ledger],
    };
  });
  if (saved.spawnedRecurringTaskId) {
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
  }
}

/** Hide a soft-deleted task from the board immediately (before refetch finishes). */
export function removeTaskFromWorkspaceCache(
  queryClient: QueryClient,
  workspaceId: string,
  taskId: string,
) {
  queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
    if (!old) return old;
    return {
      ...old,
      tasks: old.tasks.filter((t) => t.id !== taskId),
    };
  });
  queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
}
