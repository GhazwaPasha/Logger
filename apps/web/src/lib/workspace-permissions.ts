import type { ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";

/** Workspace owner may delete levels, lists, and tasks (soft-delete via archive API). */
export function isWorkspaceOwner(members: MemberRow[], userId: string | null | undefined): boolean {
  if (!userId) return false;
  return members.some((m) => m.userId === userId && m.role === "owner");
}

/**
 * Manager may archive tasks whose list sits under a managed level.
 * `canEditFields` mirrors the API's owner/manager/creator scope-edit gate — used to show/hide
 * title, priority, due/recurrence, assignee, and subtask add/edit/delete controls client-side.
 */
export function taskEditCaps(
  task: TaskRow,
  lists: ListRow[],
  userId: string | null | undefined,
  members: MemberRow[],
): { canArchiveTask: boolean; canDeleteTask: boolean; canEditFields: boolean } {
  if (!userId || task.deletedAt) return { canArchiveTask: false, canDeleteTask: false, canEditFields: false };
  const me = members.find((m) => m.userId === userId);
  if (!me) return { canArchiveTask: false, canDeleteTask: false, canEditFields: false };
  if (me.role === "owner") return { canArchiveTask: false, canDeleteTask: true, canEditFields: true };
  if (task.assignerId === userId) return { canArchiveTask: false, canDeleteTask: true, canEditFields: true };
  if (me.role !== "manager") return { canArchiveTask: false, canDeleteTask: false, canEditFields: false };
  const list = lists.find((l) => l.id === task.listId);
  const deptId = list?.departmentId;
  if (!deptId) return { canArchiveTask: false, canDeleteTask: false, canEditFields: false };
  const isManagerHere = (me.managedDepartmentIds ?? []).includes(deptId);
  return { canArchiveTask: isManagerHere, canDeleteTask: false, canEditFields: isManagerHere };
}
