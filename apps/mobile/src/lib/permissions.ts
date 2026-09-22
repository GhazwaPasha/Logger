import type { ListRow, MemberRow, TaskRow } from '@/lib/types';

/** Owners may delete levels, lists, and tasks. */
export function isWorkspaceOwner(members: MemberRow[], userId: string | null | undefined): boolean {
  return !!userId && members.some((m) => m.userId === userId && m.role === 'owner');
}

/** Performance data is owner- and manager-only — mirrors the API's `PerformanceService` gate. */
export function canViewPerformance(members: MemberRow[], userId: string | null | undefined): boolean {
  const me = members.find((m) => m.userId === userId);
  return me?.role === 'owner' || me?.role === 'manager';
}

/** Owners, department managers, and the task's creator may edit its fields or archive it. */
export function taskEditCaps(
  task: TaskRow,
  lists: ListRow[],
  userId: string | null | undefined,
  members: MemberRow[],
): { canArchiveTask: boolean; canEditFields: boolean } {
  if (!userId || task.deletedAt) return { canArchiveTask: false, canEditFields: false };
  const me = members.find((m) => m.userId === userId);
  const isOwner = me?.role === 'owner';
  const isAssigner = task.assignerId === userId;
  let isDeptManager = false;
  if (me?.role === 'manager') {
    const deptId = lists.find((l) => l.id === task.listId)?.departmentId;
    isDeptManager = !!deptId && (me.managedDepartmentIds ?? []).includes(deptId);
  }
  const canAct = isOwner || isAssigner || isDeptManager;
  return { canArchiveTask: canAct, canEditFields: canAct };
}
