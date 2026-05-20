import type { ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";

/** Workspace owner may delete levels, lists, and tasks (soft-delete via archive API). */
export function isWorkspaceOwner(members: MemberRow[], userId: string | null | undefined): boolean {
  if (!userId) return false;
  return members.some((m) => m.userId === userId && m.role === "owner");
}

/** Manager may archive tasks whose list sits under a managed level. */
export function taskArchiveDeleteCaps(
  task: TaskRow,
  lists: ListRow[],
  userId: string | null | undefined,
  members: MemberRow[],
): { canArchiveTask: boolean; canDeleteTask: boolean } {
  if (!userId || task.deletedAt) return { canArchiveTask: false, canDeleteTask: false };
  const me = members.find((m) => m.userId === userId);
  if (!me) return { canArchiveTask: false, canDeleteTask: false };
  if (me.role === "owner") return { canArchiveTask: false, canDeleteTask: true };
  if (task.assignerId === userId) return { canArchiveTask: false, canDeleteTask: true };
  if (me.role !== "manager") return { canArchiveTask: false, canDeleteTask: false };
  const list = lists.find((l) => l.id === task.listId);
  const deptId = list?.departmentId;
  if (!deptId) return { canArchiveTask: false, canDeleteTask: false };
  const managed = me.managedDepartmentIds ?? [];
  return { canArchiveTask: managed.includes(deptId), canDeleteTask: false };
}
