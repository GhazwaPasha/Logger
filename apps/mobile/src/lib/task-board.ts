/**
 * Task workflow rules and display helpers — a port of `apps/web/src/lib/task-board.ts` so the
 * native board behaves exactly like the web board (same stages, same "late" logic, same sorts).
 */
import { alpha, Tone, type Palette } from '@/constants/theme';
import type { TaskRow } from '@/lib/types';

/** Kanban columns + user-selectable stages (API PATCH). */
export const TASK_FLOW_ORDER = ['pending', 'in_progress', 'done', 'cancelled'] as const;
export type ManualTaskStatus = (typeof TASK_FLOW_ORDER)[number];

export const AUTOMATED_TASK_STATUSES = ['assigned', 'late'] as const;
export type BoardTaskStatus = ManualTaskStatus | (typeof AUTOMATED_TASK_STATUSES)[number];

export const STATUS_LABELS: Record<BoardTaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In progress',
  late: 'Late',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const FLOW_COLUMN_LABELS: Record<ManualTaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export type TaskPriority = 'high' | 'medium' | 'low';
export const PRIORITY_LABELS: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
export const PRIORITIES = ['high', 'medium', 'low'] as const;

export function normalizeTaskStatus(raw: string): BoardTaskStatus {
  if (raw === 'open') return 'pending';
  if ((TASK_FLOW_ORDER as readonly string[]).includes(raw)) return raw as BoardTaskStatus;
  if ((AUTOMATED_TASK_STATUSES as readonly string[]).includes(raw)) return raw as BoardTaskStatus;
  return 'pending';
}

/** Map stored status to the kanban column / manual-control bucket. */
export function storedStatusToFlowColumn(stored: BoardTaskStatus): ManualTaskStatus {
  if (stored === 'cancelled') return 'cancelled';
  if (stored === 'done') return 'done';
  if (stored === 'in_progress' || stored === 'late') return 'in_progress';
  return 'pending';
}

/** The task's board column straight from a row. */
export const taskFlowColumn = (task: Pick<TaskRow, 'status'>): ManualTaskStatus =>
  storedStatusToFlowColumn(normalizeTaskStatus(task.status));

/** Next manual stage along Pending → In progress → Done (not cancel). */
export function nextWorkflowManualStatus(stored: BoardTaskStatus): ManualTaskStatus | null {
  const col = storedStatusToFlowColumn(stored);
  if (col === 'done' || col === 'cancelled') return null;
  const next = TASK_FLOW_ORDER[TASK_FLOW_ORDER.indexOf(col) + 1];
  return !next || next === 'cancelled' ? null : next;
}

/**
 * Stage targets for the status menu: the current stage, the next stage (when one exists), and
 * Cancelled (when allowed). Cancelled tasks only offer reopening to Pending.
 */
export function stageControlDropdownOptions(stored: BoardTaskStatus, canCancel = true): ManualTaskStatus[] {
  const manual = storedStatusToFlowColumn(stored);
  if (manual === 'cancelled') return ['cancelled', 'pending'];
  const next = nextWorkflowManualStatus(stored);
  const out: ManualTaskStatus[] = [manual];
  if (next) out.push(next);
  if (canCancel) out.push('cancelled');
  return out;
}

export function taskPriority(task: Pick<TaskRow, 'priority'>): TaskPriority {
  const p = task.priority;
  return p === 'high' || p === 'low' ? p : 'medium';
}

const prioritySortKey = (p: TaskPriority) => (p === 'high' ? 0 : p === 'medium' ? 1 : 2);

export function taskIsOverdue(task: Pick<TaskRow, 'dueAt'>, now: Date = new Date()): boolean {
  if (!task.dueAt) return false;
  const t = new Date(task.dueAt).getTime();
  return !Number.isNaN(t) && t < now.getTime();
}

/** Pending or in progress with a due time in the past — surfaces the late styling (not a stored status). */
export function taskShowsLateFooter(task: TaskRow, now: Date = new Date()): boolean {
  const col = taskFlowColumn(task);
  return (col === 'pending' || col === 'in_progress') && taskIsOverdue(task, now);
}

// ---------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------

/** Tinted status-pill background (light mode uses slightly stronger fills, like the web). */
export function statusPillColors(st: BoardTaskStatus, dark: boolean, theme: Palette): { bg: string; fg: string } {
  const a = dark ? 0.15 : 0.22;
  switch (st) {
    case 'pending':
      return { bg: alpha(Tone.slate500, a), fg: theme.fg };
    case 'assigned':
      return { bg: alpha(Tone.sky500, a), fg: theme.fg };
    case 'in_progress':
      return { bg: alpha(Tone.violet500, a), fg: theme.fg };
    case 'late':
      return { bg: alpha(Tone.orange500, dark ? 0.15 : 0.24), fg: theme.fg };
    case 'done':
      return { bg: alpha(Tone.emerald500, a), fg: theme.fg };
    default:
      return { bg: alpha(Tone.neutral500, 0.15), fg: theme.muted };
  }
}

/** Due-chip chrome: red once late, green while in progress, blue otherwise, muted when unset. */
export function dueChipColors(
  task: TaskRow,
  dark: boolean,
  theme: Palette,
): { bg: string; border: string; fg: string } {
  const tint = (base: string, text: string) => ({
    bg: alpha(base, dark ? 0.1 : 0.12),
    border: alpha(base, dark ? 0.25 : 0.3),
    fg: text,
  });
  if (taskShowsLateFooter(task)) return tint(Tone.red500, dark ? Tone.red400 : Tone.red600);
  if (!task.dueAt) return { bg: theme.surfaceMuted, border: theme.borderSubtle, fg: theme.muted };
  if (taskFlowColumn(task) === 'in_progress') return tint(Tone.green500, dark ? Tone.green400 : Tone.green600);
  return tint(Tone.blue500, dark ? Tone.blue400 : Tone.blue600);
}

export function priorityColor(p: TaskPriority, dark: boolean, theme: Palette): string {
  if (p === 'high') return dark ? Tone.amber400 : Tone.amber500;
  if (p === 'low') return dark ? Tone.sky400 : Tone.sky500;
  return theme.muted;
}

// ---------------------------------------------------------------------------------------------
// Sorting & due windows
// ---------------------------------------------------------------------------------------------

export type SortMode = 'priority_desc' | 'priority_asc' | 'due_asc' | 'due_desc';

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'priority_desc', label: 'Priority · high first' },
  { value: 'priority_asc', label: 'Priority · low first' },
  { value: 'due_asc', label: 'Due · soonest' },
  { value: 'due_desc', label: 'Due · latest' },
];

export function sortTasks(rows: TaskRow[], mode: SortMode): TaskRow[] {
  return [...rows].sort((a, b) => {
    const titleCmp = a.title.localeCompare(b.title);
    if (mode === 'priority_desc' || mode === 'priority_asc') {
      const diff = prioritySortKey(taskPriority(a)) - prioritySortKey(taskPriority(b));
      return diff !== 0 ? (mode === 'priority_desc' ? diff : -diff) : titleCmp;
    }
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return da !== db ? (mode === 'due_asc' ? da - db : db - da) : titleCmp;
  });
}

export type DueWindow = 'all' | '1d' | '3d' | '1w' | '1m';

export const DUE_WINDOW_OPTIONS: { value: DueWindow; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '1d', label: '1D' },
  { value: '3d', label: '3D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
];

/** Tasks due between now and the end of the window (upcoming only). */
export function taskMatchesDueWindow(task: TaskRow, window: DueWindow): boolean {
  if (window === 'all') return true;
  const due = task.dueAt ? new Date(task.dueAt) : null;
  if (!due) return false;
  const now = new Date();
  const end = new Date(now);
  if (window === '1w') end.setDate(end.getDate() + 7);
  else if (window === '1m') end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + Number(window[0]));
  return due >= now && due <= end;
}
