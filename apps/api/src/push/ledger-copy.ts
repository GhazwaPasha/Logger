import { formatInTimeZone } from "@work-ledger/contracts";
import type { activityLedger } from "@work-ledger/db";

type LedgerRow = typeof activityLedger.$inferSelect;

const STATUS_LABELS: Record<string, string> = {
  open: "Pending",
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  late: "Late",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

export function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function statusLabel(raw: unknown): string {
  return typeof raw === "string" ? (STATUS_LABELS[raw] ?? raw) : "unknown";
}

function priorityLabel(raw: unknown): string {
  return typeof raw === "string" ? (PRIORITY_LABELS[raw] ?? raw) : "unknown";
}

function dueLabel(iso: unknown, timeZone: string): string {
  if (typeof iso !== "string") return "none";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "none";
  return formatInTimeZone(d, timeZone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function idsOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

function namesOf(raw: unknown, names: Map<string, string>): string {
  const ids = idsOf(raw);
  if (ids.length === 0) return "no one";
  return ids.map((id) => names.get(id) ?? "someone").join(", ");
}

/** Collect every userId referenced by a ledger row's payload, so callers can batch-resolve display names. */
export function ledgerEntryUserIds(row: LedgerRow): string[] {
  if (row.type !== "assignee_change") return [];
  const p = row.payload as { assigneeUserIds?: unknown; previousAssigneeUserIds?: unknown };
  return [...idsOf(p.assigneeUserIds), ...idsOf(p.previousAssigneeUserIds)];
}

/** Human-readable "what happened" phrase for one ledger row, e.g. "changed status to Done". */
export function describeLedgerEntry(row: LedgerRow, names: Map<string, string>, timeZone: string): string {
  const p = row.payload as Record<string, unknown>;

  switch (row.type) {
    case "status_change":
      return `changed status to ${statusLabel(p.newStatus)}`;
    case "assignee_change": {
      const prev = idsOf(p.previousAssigneeUserIds);
      if (prev.length === 0) return `assigned this to ${namesOf(p.assigneeUserIds, names)}`;
      return `reassigned this to ${namesOf(p.assigneeUserIds, names)} (was ${namesOf(p.previousAssigneeUserIds, names)})`;
    }
    case "reschedule": {
      const reason = typeof p.reason === "string" && p.reason.trim() ? ` — ${truncate(p.reason, 100)}` : "";
      return `moved the due date to ${dueLabel(p.newDueAt, timeZone)}${reason}`;
    }
    case "archive":
      return "archived this task";
    case "priority_change":
      return `changed priority to ${priorityLabel(p.newPriority)}`;
    case "comment_added": {
      const preview = typeof p.preview === "string" ? p.preview : "";
      return preview ? `commented: "${truncate(preview, 80)}"` : "commented";
    }
    case "comment_edited":
      return "edited a comment";
    case "comment_deleted":
      return "deleted a comment";
    case "attachment_added":
      return `uploaded ${typeof p.fileName === "string" ? p.fileName : "a file"}`;
    case "attachment_deleted":
      return `removed ${typeof p.fileName === "string" ? p.fileName : "a file"}`;
    case "dependency_added":
      return `added blocker ${typeof p.dependsOnTaskTitle === "string" ? p.dependsOnTaskTitle : "a task"}`;
    case "dependency_removed":
      return `removed blocker ${typeof p.dependsOnTaskTitle === "string" ? p.dependsOnTaskTitle : "a task"}`;
    case "ack":
      return "acknowledged this assignment";
    case "note":
      return typeof p.message === "string" && p.message !== "Task created." ? p.message : "updated this task";
    default:
      return "updated this task";
  }
}

/** Push-body summary across one mutation's worth of ledger rows (a patch can touch several fields at once). */
export function summarizeLedgerEntries(rows: LedgerRow[], names: Map<string, string>, timeZone: string): string {
  const meaningful = rows.filter(
    (r) => !(r.type === "note" && (r.payload as { message?: string } | null)?.message === "Task created."),
  );
  const use = meaningful.length > 0 ? meaningful : rows;
  if (use.length === 0) return "updated this task";

  const shown = use.slice(0, 2).map((r) => describeLedgerEntry(r, names, timeZone));
  const extra = use.length - shown.length;
  return extra > 0 ? `${shown.join(" · ")} (+${extra} more)` : shown.join(" · ");
}
