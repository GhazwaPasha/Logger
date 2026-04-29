import type { TaskRow } from "@/lib/ledger-types";

export const KANBAN_STATUS_ORDER = [
  "pending",
  "assigned",
  "in_progress",
  "late",
  "done",
  "cancelled",
] as const;

export type BoardTaskStatus = (typeof KANBAN_STATUS_ORDER)[number];

export const STATUS_LABELS: Record<BoardTaskStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  late: "Late",
  done: "Done",
  cancelled: "Cancelled",
};

export type TaskPriority = "high" | "medium" | "low";

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function normalizeTaskStatus(raw: string): BoardTaskStatus {
  if (raw === "open") return "pending";
  if ((KANBAN_STATUS_ORDER as readonly string[]).includes(raw)) return raw as BoardTaskStatus;
  return "pending";
}

export function taskPriority(task: TaskRow): TaskPriority {
  const p = task.priority;
  if (p === "high" || p === "low") return p;
  return "medium";
}

export function prioritySortKey(p: TaskPriority): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

export type DatePreset = "all" | "overdue" | "this_week" | "no_due";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekLocal(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeekLocal(d: Date): Date {
  const s = startOfWeekLocal(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return endOfLocalDay(e);
}

export function taskMatchesDatePreset(task: TaskRow, preset: DatePreset): boolean {
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const st = normalizeTaskStatus(task.status);
  if (preset === "all") return true;
  if (preset === "no_due") return due === null;
  if (preset === "overdue") {
    if (!due || st === "done" || st === "cancelled") return false;
    return due < startOfLocalDay(new Date());
  }
  if (preset === "this_week") {
    if (!due) return false;
    const now = new Date();
    return due >= startOfWeekLocal(now) && due <= endOfWeekLocal(now);
  }
  return true;
}

export function taskMatchesDueRange(task: TaskRow, fromYmd: string, toYmd: string): boolean {
  if (!fromYmd && !toYmd) return true;
  const due = task.dueAt ? new Date(task.dueAt) : null;
  if (!due) return false;
  if (fromYmd) {
    const from = startOfLocalDay(new Date(`${fromYmd}T12:00:00`));
    if (due < from) return false;
  }
  if (toYmd) {
    const to = endOfLocalDay(new Date(`${toYmd}T12:00:00`));
    if (due > to) return false;
  }
  return true;
}

export type SortMode = "priority_desc" | "priority_asc" | "due_asc" | "due_desc";

export function sortTasks(rows: TaskRow[], mode: SortMode): TaskRow[] {
  const out = [...rows];
  out.sort((a, b) => {
    const titleCmp = a.title.localeCompare(b.title);
    if (mode === "priority_desc" || mode === "priority_asc") {
      const diff = prioritySortKey(taskPriority(a)) - prioritySortKey(taskPriority(b));
      if (diff !== 0) return mode === "priority_desc" ? diff : -diff;
      return titleCmp;
    }
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (da !== db) return mode === "due_asc" ? da - db : db - da;
    return titleCmp;
  });
  return out;
}
