/**
 * Which activity-log entries become notifications (the web and mobile bells, and push). Shared so every
 * surface agrees. The feed itself keeps everything; this only decides what's worth interrupting someone for.
 *
 * Only people involved in a task hear about it (its assignees and whoever assigned it), never about their own
 * actions, and only for changes that affect them:
 *
 * - assigned / unassigned        → the people added or removed, and the assigner
 * - status: started work         → the assigner (their delegated work is moving)
 * - status: done / cancelled / reopened → everyone involved
 * - due date moved               → everyone involved
 * - priority raised to high      → the assignees
 * - new comment                  → everyone involved
 * - archived                     → the assignees
 * - acknowledged                 → the assigner
 *
 * Everything else — title / description / channel edits, subtasks, attachments, blockers, comment edits and
 * deletions, recurring-task bookkeeping — stays in the activity log only.
 */
export type NotifiableLedgerEntry = {
  type: string;
  actorId: string;
  payload: unknown;
};

export type NotificationAudience = {
  /** The task's assignees after the change. */
  assigneeUserIds: readonly string[];
  /** Who assigned the task (its creator unless reassigned). */
  assignerId?: string | null;
};

const idsOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];

/** Legacy statuses fold into the current ones (`open` / `assigned` → pending, `late` → in progress). */
function stage(raw: unknown): string {
  if (raw === "open" || raw === "assigned") return "pending";
  if (raw === "late") return "in_progress";
  return typeof raw === "string" ? raw : "";
}

export function isLedgerEntryNotifiableToUser(
  entry: NotifiableLedgerEntry,
  userId: string,
  { assigneeUserIds, assignerId }: NotificationAudience,
): boolean {
  if (entry.actorId === userId) return false;

  const isAssigner = !!assignerId && assignerId === userId;
  const isAssignee = assigneeUserIds.includes(userId);
  const p = (entry.payload ?? {}) as Record<string, unknown>;

  switch (entry.type) {
    case "assignee_change": {
      const before = idsOf(p.previousAssigneeUserIds);
      const after = idsOf(p.assigneeUserIds);
      const added = after.includes(userId) && !before.includes(userId);
      const removed = before.includes(userId) && !after.includes(userId);
      return added || removed || isAssigner;
    }
    case "status_change": {
      const from = stage(p.oldStatus);
      const to = stage(p.newStatus);
      if (from === to) return false;
      const closedOrReopened =
        to === "done" || to === "cancelled" || from === "done" || from === "cancelled";
      if (closedOrReopened) return isAssignee || isAssigner;
      return to === "in_progress" && isAssigner;
    }
    case "reschedule":
    case "comment_added":
      return isAssignee || isAssigner;
    case "priority_change":
      return p.newPriority === "high" && isAssignee;
    case "archive":
      return isAssignee;
    case "ack":
      return isAssigner;
    default:
      return false;
  }
}

/** The user ids an entry notifies, from a candidate list (e.g. for push fan-out). */
export function notificationRecipients(
  entry: NotifiableLedgerEntry,
  candidates: Iterable<string>,
  audience: NotificationAudience,
): string[] {
  return [...new Set(candidates)].filter((id) => isLedgerEntryNotifiableToUser(entry, id, audience));
}
