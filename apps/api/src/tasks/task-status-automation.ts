/**
 * Legacy DB rows may still have `assigned` / `late` from older automation.
 * Those are normalized to manual workflow stages (no new writes of automated statuses).
 */
export function coerceLegacyTaskStatus(status: string): string {
  const s = status === "open" ? "pending" : status;
  if (s === "assigned") return "pending";
  if (s === "late") return "in_progress";
  return s;
}
