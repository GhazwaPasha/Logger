import type { TaskRow } from "@/lib/ledger-types";
import { endOfDayInTz, endOfWeekInTz, startOfDayInTz, startOfWeekInTz } from "@/lib/date";

/** Kanban columns + user-selectable stages (API PATCH). */
export const TASK_FLOW_ORDER = ["pending", "in_progress", "done", "cancelled"] as const;

export type ManualTaskStatus = (typeof TASK_FLOW_ORDER)[number];

export const AUTOMATED_TASK_STATUSES = ["assigned", "late"] as const;

/** Persisted / displayed task status including automated labels. */
export type BoardTaskStatus = ManualTaskStatus | (typeof AUTOMATED_TASK_STATUSES)[number];

/**
 * URL `status=` values only (composite buckets for dashboard KPIs / deep links).
 */
export type PendingWorkUrlFilter = "pending_work";
/** **In progress** column (overdue work shows **Late** in the card footer, not here). */
export type ActiveWorkUrlFilter = "active_work";

export type UrlStatusFilter = BoardTaskStatus | PendingWorkUrlFilter | ActiveWorkUrlFilter;

/** Label for drilldown banner when `status=pending_work`. */
export const PENDING_WORK_URL_FILTER_LABEL = "Pending work";

/** Label for drilldown banner when `status=active_work`. */
export const ACTIVE_WORK_URL_FILTER_LABEL = "Active work";

/**
 * Whether a task matches a Work URL `status=` / composite filter.
 * `assigned` / `late` filters are derived from assignees + in-progress overdue (not stored statuses).
 */
export function taskMatchesUrlStatusFilter(task: TaskRow, filter: UrlStatusFilter, now: Date = new Date()): boolean {
  const st = normalizeTaskStatus(task.status);
  const col = storedStatusToFlowColumn(st);

  if (filter === "pending_work") return col === "pending";
  if (filter === "active_work") return col === "in_progress";

  if (filter === "late") return taskShowsLateFooter(task, now);

  if (filter === "assigned") {
    return taskHasAssignees(task) && col !== "done" && col !== "cancelled";
  }

  if (filter === "pending") return col === "pending";
  if (filter === "in_progress") return col === "in_progress";

  return st === filter;
}

export function taskHasAssignees(task: Pick<TaskRow, "assigneeUserIds">): boolean {
  return (task.assigneeUserIds?.length ?? 0) > 0;
}

export function taskIsOverdue(task: Pick<TaskRow, "dueAt">, now: Date = new Date()): boolean {
  if (!task.dueAt) return false;
  const t = new Date(task.dueAt).getTime();
  return !Number.isNaN(t) && t < now.getTime();
}

/** In progress with a due time in the past — surfaces **Late** badge + due styling (not a stored status). */
export function taskShowsLateFooter(task: TaskRow, now: Date = new Date()): boolean {
  const st = normalizeTaskStatus(task.status);
  const manual = manualStatusFromStored(st);
  return manual === "in_progress" && taskIsOverdue(task, now);
}

/** Shared due-date indicator color (list/kanban clock icon, side panel, editor): red once late, green while actively worked on, blue for any other due date, muted when unset. */
export function dueIndicatorColorClass(task: TaskRow, now: Date = new Date()): string {
  if (taskShowsLateFooter(task, now)) return "text-red-500 dark:text-red-400";
  if (!task.dueAt) return "text-[var(--muted)]";
  const flowCol = storedStatusToFlowColumn(normalizeTaskStatus(task.status));
  if (flowCol === "in_progress") return "text-green-600 dark:text-green-400";
  return "text-blue-500 dark:text-blue-400";
}

/** Assignee control chrome (sky) when the task has at least one assignee. */
export const TASK_ASSIGNED_CHROME_CLASS =
  "border-sky-500/35 bg-sky-500/14 text-sky-800 dark:border-sky-500/28 dark:bg-sky-500/10 dark:text-sky-200";

/** Due control chrome (orange) when the task is in progress and overdue. */
export const TASK_LATE_DUE_CHROME_CLASS =
  "border-orange-500/45 bg-orange-500/16 text-orange-900 dark:border-orange-500/38 dark:bg-orange-500/12 dark:text-orange-100";

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

/** Human-readable status (activity log / legacy rows may still reference **Assigned** / **Late**). */
export function taskStatusDisplayLabel(stored: BoardTaskStatus): string {
  if (stored === "assigned") return STATUS_LABELS.assigned;
  if (stored === "late") return STATUS_LABELS.late;
  return STATUS_LABELS[stored];
}

/**
 * Tinted backgrounds for status pills (list / kanban / stats).
 * Labels use **`--fg`** (not `dark:` text) so pills stay readable when the app theme is light while the OS prefers dark.
 * Light mode uses slightly stronger fills (**`/22`–`/25`**) so hues read closer to dark-theme **`/15`** on elevated surfaces.
 */
export function statusPillPaletteClasses(st: BoardTaskStatus): string {
  const label = "text-[var(--fg)]";
  if (st === "pending") return `bg-slate-500/22 dark:bg-slate-500/15 ${label}`;
  if (st === "assigned") return `bg-sky-500/22 dark:bg-sky-500/15 ${label}`;
  if (st === "in_progress") return `bg-violet-500/22 dark:bg-violet-500/15 ${label}`;
  if (st === "late") return `bg-orange-500/24 dark:bg-orange-500/15 ${label}`;
  if (st === "done") return `bg-emerald-500/22 dark:bg-emerald-500/15 ${label}`;
  if (st === "cancelled") return "bg-neutral-500/15 text-[var(--muted)]";
  return `bg-neutral-500/15 ${label}`;
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
 * Stage targets for the **board/list status pill** menu: always includes the current stage,
 * the **next** stage along Pending → In progress → Done (when one exists), and **Cancelled**
 * whenever the task is not already cancelled. Cancelled tasks only offer reopen → **pending**.
 */
export function stageControlDropdownOptions(stored: BoardTaskStatus): ManualTaskStatus[] {
  const manual = manualStatusFromStored(stored);
  if (manual === "cancelled") {
    return ["cancelled", "pending"];
  }
  const next = nextWorkflowManualStatus(stored);
  const out: ManualTaskStatus[] = [manual];
  if (next) out.push(next);
  out.push("cancelled");
  return out;
}

/**
 * Allowed targets for **drag-and-drop** between kanban columns — same as {@link stageControlDropdownOptions}
 * (list row + kanban stage menu): **next** workflow stage only (Pending → In progress → Done), plus **Cancelled**,
 * or **Pending** when reopening from cancelled (**Done** only moves to Cancelled, not backward via drag).
 */
export function kanbanAllowedManualTransitions(current: ManualTaskStatus): ManualTaskStatus[] {
  return stageControlDropdownOptions(current);
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

export type DatePreset = "all" | "late" | "this_week" | "no_due";

/** Parse `status=` query values from dashboard / deep links (aliases tolerated). */
export function parseUrlStatusFilter(raw: string): UrlStatusFilter | null {
  const k = raw
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (k === "pending_work" || k === "pendingwork") return "pending_work";
  if (k === "active_work" || k === "activework") return "active_work";
  const map: Record<string, BoardTaskStatus> = {
    open: "pending",
    pending: "pending",
    assigned: "assigned",
    in_progress: "in_progress",
    inprogress: "in_progress",
    late: "late",
    done: "done",
    cancelled: "cancelled",
    canceled: "cancelled",
  };
  return map[k] ?? null;
}

export function taskMatchesDatePreset(task: TaskRow, preset: DatePreset, timeZone: string): boolean {
  const due = task.dueAt ? new Date(task.dueAt) : null;
  if (preset === "all") return true;
  if (preset === "no_due") return due === null;
  if (preset === "late") {
    return taskShowsLateFooter(task);
  }
  if (preset === "this_week") {
    if (!due) return false;
    const now = new Date();
    return due >= startOfWeekInTz(now, timeZone) && due <= endOfWeekInTz(now, timeZone);
  }
  return true;
}

export type DueWindow = "all" | "1d" | "3d" | "1w" | "1m" | "custom";

const DUE_WINDOWS = ["all", "1d", "3d", "1w", "1m", "custom"] as const satisfies readonly DueWindow[];

export function isDueWindow(v: string): v is DueWindow {
  return (DUE_WINDOWS as readonly string[]).includes(v);
}

/** Tasks due between now and the end of the window (upcoming only — past-due tasks fall outside every window but "all"). "custom" is matched separately via {@link taskMatchesDueRange}. */
export function taskMatchesDueWindow(task: TaskRow, window: DueWindow): boolean {
  if (window === "all" || window === "custom") return true;
  const due = task.dueAt ? new Date(task.dueAt) : null;
  if (!due) return false;
  const now = new Date();
  const end = new Date(now);
  if (window === "1w") end.setDate(end.getDate() + 7);
  else if (window === "1m") end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + Number(window[0]));
  return due >= now && due <= end;
}

/** Custom range match for the "custom" due window; `fromYmd`/`toYmd` are `yyyy-mm-dd` date-input values, either may be blank. */
export function taskMatchesDueRange(task: TaskRow, fromYmd: string, toYmd: string, timeZone: string): boolean {
  if (!fromYmd && !toYmd) return true;
  const due = task.dueAt ? new Date(task.dueAt) : null;
  if (!due) return false;
  if (fromYmd) {
    const from = startOfDayInTz(new Date(`${fromYmd}T12:00:00Z`), timeZone);
    if (due < from) return false;
  }
  if (toYmd) {
    const to = endOfDayInTz(new Date(`${toYmd}T12:00:00Z`), timeZone);
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
