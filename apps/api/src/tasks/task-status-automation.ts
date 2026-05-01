/**
 * Derives persisted `task_status` after user-driven updates.
 * Manual stages: pending, in_progress, done, cancelled.
 * Automated: assigned (pre-start + has assignee), late (active work + overdue).
 */
export function computeAutomatedTaskStatus(
  status: string,
  dueAt: Date | null,
  assigneeCount: number,
  now: Date,
): string {
  const s = status === "open" ? "pending" : status;

  if (s === "done" || s === "cancelled") return s;

  const overdue = dueAt != null && dueAt.getTime() < now.getTime();

  if (s === "late") {
    if (overdue) return "late";
    return "in_progress";
  }

  if (s === "in_progress") {
    return overdue ? "late" : "in_progress";
  }

  // pending | assigned — pre-start bucket
  if (overdue) return "late";

  return assigneeCount > 0 ? "assigned" : "pending";
}
