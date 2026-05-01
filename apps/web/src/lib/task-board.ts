import type { TaskRow } from "@/lib/ledger-types";

/** Kanban columns + user-selectable stages (API PATCH). */
export const TASK_FLOW_ORDER = ["pending", "in_progress", "done", "cancelled"] as const;

export type ManualTaskStatus = (typeof TASK_FLOW_ORDER)[number];

export const AUTOMATED_TASK_STATUSES = ["assigned", "late"] as const;

/** Persisted / displayed task status including automated labels. */
export type BoardTaskStatus = ManualTaskStatus | (typeof AUTOMATED_TASK_STATUSES)[number];

export const STATUS_LABELS: Record<BoardTaskStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  late: "Late",
  done: "Done",
  cancelled: "Cancelled",
};

/** Column titles match workflow stages; automated states roll up into Pending / In progress. */
export const FLOW_COLUMN_LABELS: Record<ManualTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
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
  const all = [...TASK_FLOW_ORDER, ...AUTOMATED_TASK_STATUSES] as const;
  if ((all as readonly string[]).includes(raw)) return raw as BoardTaskStatus;
  return "pending";
}

/** Map stored status to the kanban column / manual-control bucket. */
export function storedStatusToFlowColumn(stored: BoardTaskStatus): ManualTaskStatus {
  if (stored === "cancelled") return "cancelled";
  if (stored === "done") return "done";
  if (stored === "in_progress" || stored === "late") return "in_progress";
  return "pending";
}

export function manualStatusFromStored(stored: BoardTaskStatus): ManualTaskStatus {
  return storedStatusToFlowColumn(stored);
}

/** Visible workflow label on cards; automated **assigned** / **late** show as single labels (same flow column underneath). */
export function taskStatusDisplayLabel(stored: BoardTaskStatus): string {
  if (stored === "assigned") return STATUS_LABELS.assigned;
  if (stored === "late") return STATUS_LABELS.late;
  return STATUS_LABELS[stored];
}

/**
 * Tinted backgrounds for status pills (list / kanban / stats).
 * Solid black / white labels except **cancelled** (muted).
 */
export function statusPillPaletteClasses(st: BoardTaskStatus): string {
  const solid = "text-black dark:text-white";
  if (st === "pending") return `bg-slate-500/15 ${solid}`;
  if (st === "assigned") return `bg-sky-500/15 ${solid}`;
  if (st === "in_progress") return `bg-violet-500/15 ${solid}`;
  if (st === "late") return `bg-orange-500/15 ${solid}`;
  if (st === "done") return `bg-emerald-500/15 ${solid}`;
  if (st === "cancelled") return "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400";
  return `bg-neutral-500/15 ${solid}`;
}

/** Text-only colors for inline status mentions (activity log); hues align with {@link statusPillPaletteClasses}. */
export function statusLabelTextClasses(st: BoardTaskStatus): string {
  if (st === "pending") return "text-slate-600 dark:text-slate-400";
  if (st === "assigned") return "text-sky-600 dark:text-sky-400";
  if (st === "in_progress") return "text-violet-600 dark:text-violet-400";
  if (st === "late") return "text-orange-600 dark:text-orange-400";
  if (st === "done") return "text-emerald-600 dark:text-emerald-400";
  if (st === "cancelled") return "text-neutral-600 dark:text-neutral-400";
  return "text-neutral-600 dark:text-neutral-400";
}

/**
 * Allowed manual targets from the board controls (one step along {@link TASK_FLOW_ORDER}),
 * cancel from active stages, reopen from terminal states.
 */
export function kanbanAllowedManualTransitions(current: ManualTaskStatus): ManualTaskStatus[] {
  const allowed = new Set<ManualTaskStatus>([current]);
  const i = TASK_FLOW_ORDER.indexOf(current);

  if (current === "cancelled") {
    allowed.add("pending");
    return ["cancelled", "pending"];
  }

  if (current === "done") {
    allowed.add("in_progress");
    allowed.add("cancelled");
    return TASK_FLOW_ORDER.filter((k) => allowed.has(k));
  }

  if (i > 0) allowed.add(TASK_FLOW_ORDER[i - 1]!);
  if (i < TASK_FLOW_ORDER.length - 1) allowed.add(TASK_FLOW_ORDER[i + 1]!);
  allowed.add("cancelled");

  return TASK_FLOW_ORDER.filter((k) => allowed.has(k));
}

export function kanbanAllowedTransitionsFromStored(stored: BoardTaskStatus): ManualTaskStatus[] {
  return kanbanAllowedManualTransitions(storedStatusToFlowColumn(stored));
}

export function kanbanTransitionAllowedFromStored(
  fromStored: BoardTaskStatus,
  toFlowColumn: ManualTaskStatus,
): boolean {
  return kanbanAllowedManualTransitions(storedStatusToFlowColumn(fromStored)).includes(toFlowColumn);
}

/** Next manual stage along Pending → In progress → Done (not cancel). For list checklist “advance one step”. */
export function nextWorkflowManualStatus(stored: BoardTaskStatus): ManualTaskStatus | null {
  const col = storedStatusToFlowColumn(stored);
  if (col === "done" || col === "cancelled") return null;
  const i = TASK_FLOW_ORDER.indexOf(col);
  if (i === -1) return null;
  const next = TASK_FLOW_ORDER[i + 1];
  if (!next || next === "cancelled") return null;
  return next;
}

/** @deprecated Use {@link TASK_FLOW_ORDER} for columns; full status union is {@link BoardTaskStatus}. */
export const KANBAN_STATUS_ORDER = TASK_FLOW_ORDER;

/** @deprecated Use {@link kanbanAllowedTransitionsFromStored}. */
export function kanbanAllowedTransitions(stored: BoardTaskStatus): ManualTaskStatus[] {
  return kanbanAllowedTransitionsFromStored(stored);
}

/** @deprecated Use {@link kanbanTransitionAllowedFromStored}. */
export function kanbanTransitionAllowed(fromStored: BoardTaskStatus, toFlowColumn: ManualTaskStatus): boolean {
  return kanbanTransitionAllowedFromStored(fromStored, toFlowColumn);
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
    return due.getTime() < Date.now();
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
