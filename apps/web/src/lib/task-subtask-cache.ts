import type { QueryClient } from "@tanstack/react-query";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import type { SubtaskRow, TaskDetail } from "@/lib/ledger-types";
import { sortSubtasksChronological } from "@/lib/subtask-order";

export function patchTaskSubtasksInCache(
  queryClient: QueryClient,
  workspaceId: string,
  taskId: string,
  updater: (prev: SubtaskRow[]) => SubtaskRow[],
  options?: { preserveOrder?: boolean },
) {
  const apply = (prev: SubtaskRow[]) => {
    const next = updater(prev);
    return options?.preserveOrder ? next : sortSubtasksChronological(next);
  };

  queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), (old) => {
    if (!old) return old;
    return { ...old, subtasks: apply(old.subtasks) };
  });
  queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
    if (!old) return old;
    return {
      ...old,
      tasks: old.tasks.map((t) =>
        t.id !== taskId ? t : { ...t, subtasks: apply(t.subtasks ?? []) },
      ),
    };
  });
}

/** Next createdAt after existing rows so optimistic rows stay at the bottom in display order. */
export function nextSubtaskCreatedAt(prev: SubtaskRow[]): string {
  const maxMs = prev.reduce(
    (m, s) => Math.max(m, new Date(s.createdAt).getTime()),
    0,
  );
  return new Date(Math.max(Date.now(), maxMs + 1)).toISOString();
}
