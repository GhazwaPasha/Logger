import type { LedgerRow } from "@/lib/ledger-types";

/** Whether this ledger row should surface as an in-app notification for `userId`. */
export function isLedgerEntryNotifiableToUser(
  entry: LedgerRow,
  userId: string,
  taskAssigneeUserIds: string[],
): boolean {
  if (entry.actorId === userId) return false;

  if (entry.type === "assignee_change") {
    const payload = entry.payload as {
      previousAssigneeUserIds?: unknown;
      assigneeUserIds?: unknown;
    };
    const prev = Array.isArray(payload.previousAssigneeUserIds)
      ? payload.previousAssigneeUserIds.filter((x): x is string => typeof x === "string")
      : [];
    const next = Array.isArray(payload.assigneeUserIds)
      ? payload.assigneeUserIds.filter((x): x is string => typeof x === "string")
      : [];
    return prev.includes(userId) || next.includes(userId);
  }

  return taskAssigneeUserIds.includes(userId);
}
