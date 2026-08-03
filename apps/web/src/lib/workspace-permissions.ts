import type { ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";

/** Workspace owner may delete levels, lists, and tasks (soft-delete via archive API). */
export function isWorkspaceOwner(members: MemberRow[], userId: string | null | undefined): boolean {
  if (!userId) return false;
  return members.some((m) => m.userId === userId && m.role === "owner");
}

/** Performance/compliance data is owner- and manager-only — mirrors the API's `PerformanceService` gate. */
export function canViewPerformance(members: MemberRow[], userId: string | null | undefined): boolean {
  if (!userId) return false;
  const me = members.find((m) => m.userId === userId);
  return me?.role === "owner" || me?.role === "manager";
}

/** Level the viewer manages/created/owns for this task, or null if they have no special standing. */
function taskStanding(
  task: TaskRow,
  lists: ListRow[],
  userId: string | null | undefined,
  members: MemberRow[],
): { isOwner: boolean; isAssigner: boolean; isDeptManager: boolean } {
  if (!userId) return { isOwner: false, isAssigner: false, isDeptManager: false };
  const me = members.find((m) => m.userId === userId);
  const isOwner = me?.role === "owner";
  const isAssigner = task.assignerId === userId;
  let isDeptManager = false;
  if (me?.role === "manager") {
    const list = lists.find((l) => l.id === task.listId);
    const deptId = list?.departmentId;
    isDeptManager = Boolean(deptId && (me.managedDepartmentIds ?? []).includes(deptId));
  }
  return { isOwner, isAssigner, isDeptManager };
}

/**
 * Two-step delete: owners, department managers, and the task creator can all archive (reversible) —
 * mirrors the API's `canArchiveTask` rule. `canEditFields` mirrors the API's owner/manager/creator
 * scope-edit gate — used to show/hide title, priority, due/recurrence, assignee, and subtask
 * add/edit/delete controls client-side.
 */
export function taskEditCaps(
  task: TaskRow,
  lists: ListRow[],
  userId: string | null | undefined,
  members: MemberRow[],
): { canArchiveTask: boolean; canEditFields: boolean } {
  if (!userId || task.deletedAt) return { canArchiveTask: false, canEditFields: false };
  const { isOwner, isAssigner, isDeptManager } = taskStanding(task, lists, userId, members);
  const canAct = isOwner || isAssigner || isDeptManager;
  return { canArchiveTask: canAct, canEditFields: canAct };
}

/**
 * Capabilities for an already-archived task (the Archived page): restoring follows the same circle
 * of people who could have archived it; permanent purge is owner/creator only — mirrors the API's
 * `canRestoreTask` / `canPurgeTask` rules.
 */
export function archivedTaskCaps(
  task: TaskRow,
  lists: ListRow[],
  userId: string | null | undefined,
  members: MemberRow[],
): { canRestore: boolean; canPurge: boolean } {
  if (!userId || !task.deletedAt) return { canRestore: false, canPurge: false };
  const { isOwner, isAssigner, isDeptManager } = taskStanding(task, lists, userId, members);
  return { canRestore: isOwner || isAssigner || isDeptManager, canPurge: isOwner || isAssigner };
}
