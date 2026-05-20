import type { QueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import { TASK_DEFAULT_TITLE } from "@/lib/task-default-title";
import type { TaskDetail, TaskMutationResult, TaskRow } from "@/lib/ledger-types";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";

export type CreateDraftTaskInput = {
  listId: string;
  title?: string;
};

/** POST a placeholder task and seed React Query so the editor opens with no create-time sync. */
export async function createDraftTask(
  queryClient: QueryClient,
  workspaceId: string,
  token: string,
  input: CreateDraftTaskInput,
): Promise<TaskMutationResult> {
  const created = await apiJson<TaskMutationResult>(`/organizations/${workspaceId}/tasks`, {
    method: "POST",
    token,
    body: JSON.stringify({
      title: input.title?.trim() || TASK_DEFAULT_TITLE,
      listId: input.listId,
      assigneeUserIds: [],
      status: "pending",
      priority: "medium",
    }),
  });

  const row: TaskRow = {
    ...created.task,
    assigneeUserIds: created.assigneeUserIds,
    subtasks: created.subtasks,
  };
  queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
    if (!old) return old;
    return { ...old, tasks: [row, ...old.tasks] };
  });
  const detailSeed: TaskDetail = {
    task: created.task,
    assigneeUserIds: created.assigneeUserIds,
    subtasks: created.subtasks,
    capabilities: created.capabilities,
    ledger: created.ledgerDelta,
  };
  queryClient.setQueryData(taskKeys.detail(created.task.id), detailSeed);

  return created;
}
