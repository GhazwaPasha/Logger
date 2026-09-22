import type { LedgerRow } from '@/lib/types';

const ids = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);

/** Whether this ledger row should surface as an in-app notification for `userId` (same rule as the web). */
export function isLedgerEntryNotifiableToUser(
  entry: LedgerRow,
  userId: string,
  taskAssigneeUserIds: string[],
  taskAssignerId?: string | null,
): boolean {
  if (entry.actorId === userId) return false;

  const isAssigner = !!taskAssignerId && taskAssignerId === userId;

  if (entry.type === 'assignee_change') {
    const payload = entry.payload;
    return (
      ids(payload.previousAssigneeUserIds).includes(userId) || ids(payload.assigneeUserIds).includes(userId) || isAssigner
    );
  }

  return taskAssigneeUserIds.includes(userId) || isAssigner;
}

/** The auto-created "Task created." note is noise in a notification feed. */
export function isTaskCreatedNote(entry: LedgerRow): boolean {
  return entry.type === 'note' && entry.payload.message === 'Task created.';
}
