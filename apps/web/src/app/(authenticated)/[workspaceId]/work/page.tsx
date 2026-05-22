"use client";

import {
  Alarm,
  ArrowLineUp,
  ArrowsDownUp,
  CalendarDots,
  CalendarPlus,
  CaretDoubleDown,
  CaretDoubleUp,
  CaretRight,
  ChatCircle,
  Check,
  CheckSquare,
  Clock,
  ClockUser,
  Columns,
  DotsThreeVertical,
  ListChecks,
  Paperclip,
  Plus,
  Rows,
  Timer,
  UserPlus,
  XSquare,
} from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiJson } from "@/lib/api";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { SimpleContextMenu, type SimpleContextMenuItem } from "@/components/ui/SimpleContextMenu";
import { taskArchiveDeleteCaps } from "@/lib/workspace-permissions";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { TaskCardLastActivity } from "@/components/tasks/TaskCardLastActivity";
import { RecurringSeriesCard } from "@/components/tasks/RecurringSeriesCard";
import { TaskViewPanel } from "@/components/tasks/TaskViewPanel";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { NODE_LABELS } from "@/lib/nodes";
import {
  type MemberRow,
  type SubtaskRow,
  type TaskDetail,
  type TaskMutationResult,
  type TaskRow,
} from "@/lib/ledger-types";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import {
  readWorkBoardScope,
  writeWorkBoardScope,
  WORK_BOARD_SCOPE_EVENT,
} from "@/lib/work-board-scope";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useArchiveTask } from "@/hooks/useArchiveTask";
import { useOpenNewTask } from "@/hooks/useOpenNewTask";
import {
  FLOW_COLUMN_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_ASSIGNED_CHROME_CLASS,
  TASK_FLOW_ORDER,
  TASK_LATE_DUE_CHROME_CLASS,
  type DatePreset,
  type ManualTaskStatus,
  type SortMode,
  type TaskPriority,
  type UrlStatusFilter,
  dueQueryToDatePreset,
  kanbanTransitionAllowedFromStored,
  manualStatusFromStored,
  nextWorkflowManualStatus,
  normalizeTaskStatus,
  parseUrlStatusFilter,
  ACTIVE_WORK_URL_FILTER_LABEL,
  PENDING_WORK_URL_FILTER_LABEL,
  stageControlDropdownOptions,
  sortTasks,
  statusLabelTextClasses,
  statusPillPaletteClasses,
  storedStatusToFlowColumn,
  taskMatchesDatePreset,
  taskMatchesDueRange,
  taskMatchesUrlStatusFilter,
  taskPriority,
  taskShowsLateFooter,
} from "@/lib/task-board";

type ViewMode = "list" | "kanban";

function IconChevron({ className, open }: { className?: string; open: boolean }) {
  return (
    <CaretRight
      className={`${className ?? ""} shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      weight="bold"
      aria-hidden
    />
  );
}

/** Panel header: title left; status, priority, Close grouped on the right (stacked on narrow viewports) */
const TASK_PANEL_HEADER_ROW =
  "-mx-6 flex flex-col gap-2 border-b border-[var(--border-subtle)] px-6 pb-3 pt-0 sm:min-h-10 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-0";

const TASK_PANEL_HEADER_TITLE =
  "min-w-0 truncate text-sm font-semibold leading-tight tracking-tight text-[var(--fg)] sm:min-w-[6rem] sm:flex-1";

const TASK_PANEL_HEADER_RIGHT =
  "flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0 sm:flex-nowrap sm:gap-2";

const TASK_PANEL_HEADER_SELECT =
  "input-compact h-8 max-w-full shrink-0 cursor-pointer rounded-md py-0 pl-2 pr-7 text-xs leading-tight text-[var(--fg)]";

const TASK_PANEL_HEADER_CLOSE_BTN =
  "btn-secondary shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium leading-none";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "priority_desc", label: "Priority · high first" },
  { value: "priority_asc", label: "Priority · low first" },
  { value: "due_asc", label: "Due · soonest" },
  { value: "due_desc", label: "Due · latest" },
];

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "late", label: "Late" },
  { value: "this_week", label: "Due this week" },
  { value: "no_due", label: "No due date" },
];

const SORT_PANEL_MIN_W = 224;
const DATE_PANEL_MIN_W = 288;
const MENU_VIEWPORT_GUTTER = 12;

function firstAssigneeLabel(task: TaskRow, memberRows: MemberRow[]): string | null {
  const ids = task.assigneeUserIds ?? [];
  if (ids.length === 0) return null;
  const member = memberRows.find((row) => row.userId === ids[0]);
  const raw = (member?.name?.trim() || member?.email || "").trim();
  if (!raw) return "Unknown";
  const firstToken = raw.split(/\s+/)[0];
  if (firstToken) return firstToken;
  return raw;
}

/** Task panel assignee toggle: summary label or “Add assignee”. */
function assigneeToggleLabel(ids: string[], members: MemberRow[]): string {
  if (ids.length === 0) return "Add assignee";
  const labels = ids.map((id) => {
    const m = members.find((row) => row.userId === id);
    const raw = (m?.name ?? "").trim() || (m?.email ?? "").trim();
    return raw || "Unknown";
  });
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]!}, ${labels[1]!}`;
  return `${labels[0]!} +${labels.length - 1}`;
}

function assigneeToggleTitle(ids: string[], members: MemberRow[]): string | undefined {
  if (ids.length === 0) return undefined;
  return ids
    .map((id) => {
      const m = members.find((row) => row.userId === id);
      const raw = (m?.name ?? "").trim() || (m?.email ?? "").trim();
      return raw || "Unknown";
    })
    .join(", ");
}

const TASK_PANEL_ASSIGNEE_TOGGLE =
  "btn-secondary min-w-0 max-w-[min(100%,18rem)] rounded-lg px-3 py-1.5 text-left text-xs font-medium";

/** Max subtasks shown on kanban cards before “+ more”. */
const KANBAN_CARD_SUBTASK_PREVIEW = 8;

/** List row assignee / priority — identical footprint (fixed box); subtle corners */
const LIST_ROW_BADGE_TILE =
  "box-border inline-flex h-8 w-[5rem] min-h-[2rem] max-h-[2rem] min-w-[5rem] max-w-[5rem] shrink-0 items-center justify-center overflow-hidden rounded-sm border px-1 py-0.5";
/** Due chip — `min-w` only floors “No due” to ~a short date + time line; `w-max` sizes to content above that (long locales grow); `h-8` matches assignee/priority tiles; icon + label centered in the box. */
const TASK_DUE_CHIP_CLASS =
  "box-border inline-flex h-8 min-h-8 max-h-8 min-w-[8.75rem] w-max max-w-full shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-center text-xs font-medium leading-none tabular-nums";
/** Label inherits chip text color (`dueDatePillClass`). Icon uses currentColor + opacity. */
const TASK_DUE_CHIP_LABEL_CLASS = "min-w-0 shrink";
const TASK_DUE_CHIP_ICON_CLASS =
  "size-3.5 shrink-0 block opacity-80 [stroke-linecap:round] [stroke-linejoin:round]";

/** Kanban only: level + list + icon chips in the mid-footer row share height (`h-7` / `size-7`). */
const KANBAN_SUBTASK_BELOW_BADGE_HEIGHT =
  "box-border h-7 min-h-7 max-h-7 shrink-0 items-center justify-center py-0 leading-none";


const LIST_ROW_BADGE_LABEL =
  "pointer-events-none w-full min-w-0 truncate text-center text-[11px] font-semibold leading-none tracking-wide tabular-nums";

/** List / kanban: overflow control to open task edit panel (matches list badge row height). */
const TASK_ROW_OVERFLOW_MENU_BTN =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]";

/** List name — outlined ghost pill (shared: task rows, kanban, filter scope). */
const LIST_BADGE_CLASS =
  "inline-flex max-w-[min(100%,11rem)] shrink-0 items-center justify-center truncate rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1 text-center text-xs font-medium tabular-nums leading-none text-[var(--fg)]";

/** Level / department — same shell, quieter label color. */
const LEVEL_BADGE_CLASS =
  "inline-flex max-w-[min(100%,11rem)] shrink-0 items-center justify-center truncate rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1 text-center text-xs font-medium tabular-nums leading-none text-[var(--muted)]";

/** Create/edit panel: same pills as list row title badges (`ListTaskCard`). */
function TaskPanelScopeBadges({ level, list }: { level: string | null; list: string | null }) {
  if (!level && !list) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {level ? (
        <span className={LEVEL_BADGE_CLASS} title={`${NODE_LABELS.level}: ${level}`}>
          {level}
        </span>
      ) : null}
      {list ? (
        <span className={LIST_BADGE_CLASS} title={`List: ${list}`}>
          {list}
        </span>
      ) : null}
    </div>
  );
}

/** Same box for every workflow stage (`max-w` keeps dropdowns compact; label truncates). */
const STATUS_PILL_LAYOUT =
  "relative inline-flex h-8 w-[6.875rem] min-w-[6.875rem] max-w-[6.875rem] shrink-0 items-center justify-between gap-0.5 px-1.5";

/** Kanban card meta row: status pill is icon-only, compact. */
const KANBAN_STATUS_SHELL_LAYOUT =
  "relative inline-flex h-6 w-auto min-w-[5.5rem] shrink-0 items-center rounded";

/** Kanban card meta row: priority tile fills an equal-width cell (matches list-row tile height). */
const KANBAN_PRIORITY_SHELL_LAYOUT =
  "relative box-border inline-flex h-8 w-full min-h-8 max-h-8 min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-sm border-0 bg-[var(--surface-muted)] px-1 py-0.5 text-[var(--fg)] hover:opacity-95 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface-elevated)]";

/** Kanban grid: due chip must fill the cell (overrides {@link TASK_DUE_CHIP_CLASS} `w-max` / `min-w` / `shrink-0`). */
const KANBAN_DUE_CHIP_CELL = "!w-full !min-w-0 !shrink justify-start px-1.5";

/** Expanded list subtasks: pill + gap + checklist (`size-7`) + gap + chevron (`size-11`), matching row layout. */
const LIST_ROW_SUBTASK_TREE_MARGIN =
  "ml-[calc(6.875rem+0.25rem+1.75rem+0.25rem+2.75rem+0.25rem)] sm:ml-[calc(6.875rem+0.75rem+1.75rem+0.75rem+2.75rem+0.75rem)]";

function priorityLabelShort(p: TaskPriority): string {
  if (p === "high") return "HIGH";
  if (p === "low") return "LOW";
  return "MED";
}

function tasksToolbarIconButtonClasses(active: boolean) {
  return [
    "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-transparent transition-colors",
    "hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]",
    active ? "bg-[var(--accent-muted)] text-[var(--fg)]" : "text-[var(--muted)]",
  ].join(" ");
}

const BOARD_STATS_SEGMENTS: { status: ManualTaskStatus; label: string; title: string }[] = [
  { status: "pending", label: "Pending", title: FLOW_COLUMN_LABELS.pending },
  { status: "in_progress", label: "In progress", title: FLOW_COLUMN_LABELS.in_progress },
  { status: "done", label: "Done", title: FLOW_COLUMN_LABELS.done },
];

const PIPELINE_BADGE_FRAME =
  "inline-flex min-w-[1.75rem] items-center justify-center rounded-sm border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-semibold tabular-nums leading-none";

function WorkBoardStatsCard({
  counts,
  total,
  loading = false,
}: {
  total: number;
  counts: Record<ManualTaskStatus, number>;
  loading?: boolean;
}) {
  const cancelled = counts.cancelled;
  const n = (v: number) => (loading ? "…" : v);
  return (
    <aside
      className="min-w-0 w-full shrink-0 lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:justify-self-stretch lg:self-start"
      aria-live="polite"
      aria-label="Task counts by workflow stage"
    >
      <div className="relative overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--accent)_45%,transparent)] to-transparent opacity-90"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            background:
              "radial-gradient(100% 140% at 100% -20%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 48%)",
          }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 sm:px-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Pipeline</span>
              <span className="hidden text-[10px] text-[var(--muted)] sm:inline" aria-hidden>
                ·
              </span>
              <span className="hidden truncate text-[10px] text-[var(--muted)]/90 sm:inline">Live · current scope</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-xs font-medium text-[var(--muted)]">Total</span>
              <span
                className={`${PIPELINE_BADGE_FRAME} min-w-[2rem] bg-[var(--surface-muted)] px-2.5 text-sm text-[var(--fg)]`}
              >
                {n(total)}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 px-2.5 pb-2 pt-0 sm:gap-x-2.5 sm:px-3 sm:pb-2 lg:justify-between">
            {BOARD_STATS_SEGMENTS.map(({ status, label, title }) => (
              <div
                key={status}
                className="group flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-[var(--surface-hover)]/60"
                role="group"
                aria-label={`${title}: ${loading ? "loading" : counts[status]}`}
              >
                <span className="truncate text-xs font-medium text-[var(--fg)]">{label}</span>
                <span className={`${PIPELINE_BADGE_FRAME} ${statusPillPaletteClasses(status)}`}>{n(counts[status])}</span>
              </div>
            ))}
            <div
              className="group flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-[var(--surface-hover)]/60"
              role="group"
              aria-label={`${STATUS_LABELS.cancelled}: ${loading ? "loading" : cancelled}`}
            >
              <span className="truncate text-xs font-medium text-[var(--fg)]">{STATUS_LABELS.cancelled}</span>
              <span className={`${PIPELINE_BADGE_FRAME} ${statusPillPaletteClasses("cancelled")}`}>{n(cancelled)}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function WorkItemsInner() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [boardScopeTick, setBoardScopeTick] = useState(0);
  useEffect(() => {
    const fn = () => setBoardScopeTick((n) => n + 1);
    window.addEventListener(WORK_BOARD_SCOPE_EVENT, fn);
    return () => window.removeEventListener(WORK_BOARD_SCOPE_EVENT, fn);
  }, []);
  const boardScope = useMemo(() => readWorkBoardScope(workspaceId), [workspaceId, boardScopeTick]);
  const levelPref = boardScope?.levelId ?? null;
  const listPref = boardScope?.listId ?? null;
  const { token, session } = useApiSession();
  const sessionUserId = session?.user?.id ?? null;
  const queryClient = useQueryClient();
  const { tasks, lists, members, depts, columnMeta, error, setError, isLoading: workspaceLoading } = useWorkspaceData();
  const { openNewTask } = useOpenNewTask();
  const { archiveTask, archiveError: taskArchiveError, clearArchiveError } = useArchiveTask();
  const [listId, setListId] = useState("");
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);
  const [taskContextMenu, setTaskContextMenu] = useState<null | { x: number; y: number; task: TaskRow }>(
    null,
  );
  const [taskActionConfirm, setTaskActionConfirm] = useState<ConfirmDialogOptions | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [listRowExpanded, setListRowExpanded] = useState<Set<string>>(() => new Set());
  const [subtasksByTaskId, setSubtasksByTaskId] = useState<Record<string, SubtaskRow[] | "loading">>({});
  const subtasksByTaskIdRef = useRef(subtasksByTaskId);
  subtasksByTaskIdRef.current = subtasksByTaskId;
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [urlStatusFilter, setUrlStatusFilter] = useState<UrlStatusFilter | null>(null);
  const [urlAssigneeScope, setUrlAssigneeScope] = useState<"all" | "mine" | "unassigned">("all");
  const [urlAssigneeUserId, setUrlAssigneeUserId] = useState<string | null>(null);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [toolbarMenusMounted, setToolbarMenusMounted] = useState(false);
  const [sortPanelStyle, setSortPanelStyle] = useState<CSSProperties>({});
  const [datePanelStyle, setDatePanelStyle] = useState<CSSProperties>({});
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const sortPanelRef = useRef<HTMLDivElement>(null);
  const datePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    setToolbarMenusMounted(true);
  }, []);

  function computePopoverStyle(trigger: HTMLElement, panelWidth: number, maxPanelHeight: number): CSSProperties {
    const r = trigger.getBoundingClientRect();
    const gap = 8;
    let left = r.right - panelWidth;
    left = Math.max(
      MENU_VIEWPORT_GUTTER,
      Math.min(left, window.innerWidth - panelWidth - MENU_VIEWPORT_GUTTER),
    );
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    const maxH = Math.min(maxPanelHeight, (openDown ? spaceBelow : spaceAbove) - MENU_VIEWPORT_GUTTER);
    if (openDown) {
      return {
        position: "fixed",
        top: r.bottom + gap,
        left,
        width: panelWidth,
        maxHeight: Math.max(120, maxH),
        zIndex: 60,
      };
    }
    return {
      position: "fixed",
      left,
      width: panelWidth,
      bottom: window.innerHeight - r.top + gap,
      maxHeight: Math.max(120, maxH),
      zIndex: 60,
    };
  }

  useLayoutEffect(() => {
    if (!sortMenuOpen || !sortTriggerRef.current) return;
    const update = () => {
      const el = sortTriggerRef.current;
      if (!el) return;
      setSortPanelStyle(computePopoverStyle(el, SORT_PANEL_MIN_W, 320));
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [sortMenuOpen]);

  useLayoutEffect(() => {
    if (!dateMenuOpen || !dateTriggerRef.current) return;
    const update = () => {
      const el = dateTriggerRef.current;
      if (!el) return;
      setDatePanelStyle(computePopoverStyle(el, DATE_PANEL_MIN_W, 420));
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [dateMenuOpen]);

  useEffect(() => {
    if (!sortMenuOpen && !dateMenuOpen) return;
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node;
      const inSortTrigger = sortTriggerRef.current?.contains(t);
      const inSortPanel = sortPanelRef.current?.contains(t);
      const inDateTrigger = dateTriggerRef.current?.contains(t);
      const inDatePanel = datePanelRef.current?.contains(t);
      if (sortMenuOpen && !inSortTrigger && !inSortPanel) setSortMenuOpen(false);
      if (dateMenuOpen && !inDateTrigger && !inDatePanel) setDateMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [sortMenuOpen, dateMenuOpen]);

  useEffect(() => {
    if (!sortMenuOpen && !dateMenuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSortMenuOpen(false);
        setDateMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sortMenuOpen, dateMenuOpen]);

  useEffect(() => {
    const levelLists = levelPref ? lists.filter((l) => l.departmentId === levelPref) : lists;
    if (listPref && levelLists.some((l) => l.id === listPref)) {
      setListId(listPref);
      return;
    }
    if (levelLists.length === 0) return;
    setListId((prev) => {
      if (prev && levelLists.some((l) => l.id === prev)) return prev;
      return levelLists[0]!.id;
    });
  }, [lists, levelPref, listPref]);

  // 'N' keyboard shortcut → create draft task, then open editor
  useEffect(() => {
    function handler() {
      openNewTask(listId || undefined);
    }
    window.addEventListener("wl:new-task", handler);
    return () => window.removeEventListener("wl:new-task", handler);
  }, [openNewTask, listId]);

  useEffect(() => {
    if (!viewTaskId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewTaskId(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [viewTaskId]);

  const openViewTask = useCallback((taskId: string) => {
    setViewTaskId(taskId);
  }, []);

  /** Migrate `level` / `list` into session scope and strip; open task panel from `task=` once. Drill-down filters stay in the URL. */
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    const legacyLevel = params.get("level");
    const legacyList = params.get("list");
    if (legacyLevel || legacyList) {
      writeWorkBoardScope(workspaceId, {
        levelId: legacyLevel,
        listId: legacyList,
      });
      params.delete("level");
      params.delete("list");
      changed = true;
    }

    const tid = params.get("task");
    if (tid) {
      setViewTaskId(tid);
      params.delete("task");
      changed = true;
    }

    if (!changed) return;
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [workspaceId, searchParams, pathname, router]);

  useEffect(() => {
    const dueRaw = searchParams.get("due");
    if (!dueRaw) setDatePreset("all");
    else {
      const preset = dueQueryToDatePreset(dueRaw);
      if (preset) setDatePreset(preset);
    }

    const statusRaw = searchParams.get("status");
    setUrlStatusFilter(statusRaw ? parseUrlStatusFilter(statusRaw) : null);

    if (searchParams.get("mine") === "1") {
      setUrlAssigneeScope("mine");
      setUrlAssigneeUserId(null);
    } else if (searchParams.get("unassigned") === "1") {
      setUrlAssigneeScope("unassigned");
      setUrlAssigneeUserId(null);
    } else {
      const assigneeParam = searchParams.get("assignee");
      if (assigneeParam) {
        setUrlAssigneeUserId(assigneeParam);
        setUrlAssigneeScope("all");
      } else {
        setUrlAssigneeScope("all");
        setUrlAssigneeUserId(null);
      }
    }
  }, [searchParams]);

  const replaceWorkQuery = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const patchTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      patch,
    }: {
      taskId: string;
      patch: { status?: ManualTaskStatus; priority?: TaskPriority };
    }) =>
      apiJson<TaskMutationResult>(`/tasks/${taskId}`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ taskId, patch }) => {
      if (!token) return;
      setError(null);
      await queryClient.cancelQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      const previous = queryClient.getQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId));
      if (previous) {
        queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), {
          ...previous,
          tasks: previous.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        });
      }
      return { previous };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(workspaceKeys.workspace(workspaceId), ctx.previous);
      }
      setError(err instanceof Error ? err.message : "Could not update task");
    },
    onSuccess: (detail, { taskId }) => {
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return {
              ...t,
              ...detail.task,
              assigneeUserIds: detail.assigneeUserIds,
              subtasks: detail.subtasks,
            };
          }),
        };
      });
      queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), (old) => {
        if (!old) return old;
        return {
          ...old,
          task: { ...old.task, ...detail.task },
          assigneeUserIds: detail.assigneeUserIds,
          subtasks: detail.subtasks,
          capabilities: detail.capabilities,
          ledger: [...detail.ledgerDelta, ...old.ledger],
        };
      });
      if (detail.spawnedRecurringTaskId) {
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      }
    },
  });

  const patchSubtaskMutation = useMutation({
    mutationFn: async (vars: { taskId: string; subtaskId: string; done: boolean }) =>
      apiJson<SubtaskRow>(`/tasks/${vars.taskId}/subtasks/${vars.subtaskId}`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({ done: vars.done }),
      }),
    onMutate: async ({ taskId, subtaskId, done }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      const previousWorkspace = queryClient.getQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId));
      const previousSubs = { ...subtasksByTaskIdRef.current };
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) => {
            if (t.id !== taskId || !Array.isArray(t.subtasks)) return t;
            return {
              ...t,
              subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)),
            };
          }),
        };
      });
      setSubtasksByTaskId((c) => {
        const cur = c[taskId];
        if (!Array.isArray(cur)) return c;
        return { ...c, [taskId]: cur.map((s) => (s.id === subtaskId ? { ...s, done } : s)) };
      });
      return { previousWorkspace, previousSubs };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previousWorkspace) {
        queryClient.setQueryData(workspaceKeys.workspace(workspaceId), ctx.previousWorkspace);
      }
      if (ctx?.previousSubs) setSubtasksByTaskId(ctx.previousSubs);
      setError(err instanceof Error ? err.message : "Could not update subtask");
    },
    onSuccess: (row, { taskId, subtaskId }) => {
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) => {
            if (t.id !== taskId || !Array.isArray(t.subtasks)) return t;
            return {
              ...t,
              subtasks: t.subtasks.map((s) => (s.id === subtaskId ? row : s)),
            };
          }),
        };
      });
      setSubtasksByTaskId((c) => {
        const cur = c[taskId];
        if (!Array.isArray(cur)) return c;
        return { ...c, [taskId]: cur.map((s) => (s.id === subtaskId ? row : s)) };
      });
      queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), (old) => {
        if (!old) return old;
        return {
          ...old,
          subtasks: old.subtasks.map((s) => (s.id === subtaskId ? row : s)),
        };
      });
    },
  });

  const [loadingMoreColumn, setLoadingMoreColumn] = useState<string | null>(null);

  const loadMoreColumn = useCallback(
    async (status: string) => {
      if (!token || !workspaceId) return;
      const meta = columnMeta[status];
      if (!meta?.nextCursor) return;
      setLoadingMoreColumn(status);
      try {
        const result = await apiJson<{ tasks: TaskRow[]; nextCursor: string | null; total: number }>(
          `/organizations/${workspaceId}/tasks?status=${status}&cursor=${meta.nextCursor}&limit=25&includeSubtasks=true`,
          { token },
        );
        queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
          if (!old) return old;
          const existingIds = new Set(old.tasks.map((t) => t.id));
          const newTasks = result.tasks.filter((t) => !existingIds.has(t.id));
          return {
            ...old,
            tasks: [...old.tasks, ...newTasks],
            columnMeta: {
              ...old.columnMeta,
              [status]: { nextCursor: result.nextCursor, total: result.total },
            },
          };
        });
      } catch {
        // non-critical — user can retry
      } finally {
        setLoadingMoreColumn(null);
      }
    },
    [token, workspaceId, columnMeta, queryClient],
  );

  const patchTaskPendingId =
    patchTaskMutation.isPending && patchTaskMutation.variables
      ? patchTaskMutation.variables.taskId
      : null;

  const patchSubtaskPendingKey =
    patchSubtaskMutation.isPending && patchSubtaskMutation.variables
      ? `${patchSubtaskMutation.variables.taskId}:${patchSubtaskMutation.variables.subtaskId}`
      : null;

  const patchTask = useCallback(
    (taskId: string, patch: { status?: ManualTaskStatus; priority?: TaskPriority }) => {
      if (!token) return;
      patchTaskMutation.mutate({ taskId, patch });
    },
    [token, patchTaskMutation],
  );

  const runTaskArchive = useCallback(
    async (taskId: string) => {
      setError(null);
      clearArchiveError();
      const result = await archiveTask(taskId);
      if (!result.ok) {
        setError(result.error);
        throw new Error(result.error);
      }
      setViewTaskId((id) => (id === taskId ? null : id));
    },
    [archiveTask, clearArchiveError, setError],
  );

  function openTaskContextMenu(e: ReactMouseEvent, task: TaskRow) {
    e.preventDefault();
    setTaskContextMenu({ x: e.clientX, y: e.clientY, task });
  }

  const taskContextMenuItems = useMemo((): SimpleContextMenuItem[] => {
    if (!taskContextMenu) return [];
    const { task } = taskContextMenu;
    const caps = taskArchiveDeleteCaps(task, lists, sessionUserId, members);
    const items: SimpleContextMenuItem[] = [
      {
        id: "edit",
        label: "Edit task",
        onSelect: () => {
          router.push(`/${workspaceSlug}/work/task/${task.id}`);
        },
      },
    ];
    if (caps.canDeleteTask) {
      items.push({
        id: "delete",
        label: "Delete task",
        destructive: true,
        onSelect: () => {
          const taskId = task.id;
          setTaskActionConfirm({
            title: "Delete this task?",
            description:
              "It will be removed from the board. You can still rely on exports or backups outside LogBase if you need a record.",
            confirmLabel: "Delete task",
            variant: "danger",
            onConfirm: async () => {
              await runTaskArchive(taskId);
            },
          });
        },
      });
    }
    if (caps.canArchiveTask) {
      items.push({
        id: "archive",
        label: "Archive task",
        onSelect: () => {
          const taskId = task.id;
          setTaskActionConfirm({
            title: "Archive this task?",
            description: "It will be hidden from the board and treated as archived.",
            confirmLabel: "Archive",
            variant: "default",
            onConfirm: async () => {
              await runTaskArchive(taskId);
            },
          });
        },
      });
    }
    return items;
  }, [taskContextMenu, lists, sessionUserId, members, runTaskArchive, router, workspaceSlug]);

  const toggleListRowExpand = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const embedded = task?.subtasks ?? [];

    setListRowExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
        return next;
      }
      next.add(taskId);
      return next;
    });

    setSubtasksByTaskId((c) => ({ ...c, [taskId]: embedded }));
  }, [tasks]);

  const patchListSubtaskDone = useCallback(
    (taskId: string, subtaskId: string, done: boolean) => {
      if (!token) return;
      patchSubtaskMutation.mutate({ taskId, subtaskId, done });
    },
    [token, patchSubtaskMutation],
  );

  const activeTasks = useMemo(() => tasks.filter((t) => !t.deletedAt), [tasks]);
  const selectedLevel = levelPref && depts.some((d) => d.id === levelPref) ? levelPref : null;
  const selectedLevelName = selectedLevel ? depts.find((d) => d.id === selectedLevel)?.name ?? null : null;
  const levelLists = selectedLevel ? lists.filter((l) => l.departmentId === selectedLevel) : lists;
  const selectedList = listPref && levelLists.some((l) => l.id === listPref) ? listPref : null;
  const selectedListName = selectedList ? levelLists.find((l) => l.id === selectedList)?.name ?? null : null;

  /** Sync storage with the visible board filter only. Never persist create-task `listId` as a list filter when viewing a whole level (`selectedList` null). */
  useEffect(() => {
    if (!lists.length) return;
    const listIdToSave =
      selectedList != null && levelLists.some((l) => l.id === selectedList) ? selectedList : null;
    let levelIdToSave: string | null =
      selectedLevel != null && depts.some((d) => d.id === selectedLevel) ? selectedLevel : null;
    if (listIdToSave != null && levelIdToSave == null) {
      levelIdToSave = lists.find((l) => l.id === listIdToSave)?.departmentId ?? null;
    }
    writeWorkBoardScope(workspaceId, { levelId: levelIdToSave, listId: listIdToSave });
  }, [workspaceId, lists, depts, selectedLevel, selectedList, levelLists]);

  /** Header scope badges (same styles as task cards): level + list when applicable. */
  const filterScopeSegments = useMemo((): { kind: "level" | "list"; label: string }[] => {
    if (selectedListName && selectedLevelName) {
      return [
        { kind: "level", label: selectedLevelName },
        { kind: "list", label: selectedListName },
      ];
    }
    if (selectedListName && selectedList) {
      const listRow = lists.find((l) => l.id === selectedList);
      const deptName = listRow ? depts.find((d) => d.id === listRow.departmentId)?.name : null;
      if (deptName) {
        return [
          { kind: "level", label: deptName },
          { kind: "list", label: selectedListName },
        ];
      }
      return [{ kind: "list", label: selectedListName }];
    }
    if (selectedLevelName) return [{ kind: "level", label: selectedLevelName }];
    return [];
  }, [selectedListName, selectedLevelName, selectedList, lists, depts]);

  const visibleTasks = useMemo(() => {
    if (selectedList) return activeTasks.filter((t) => t.listId === selectedList);
    if (selectedLevel) return activeTasks.filter((t) => levelLists.some((l) => l.id === t.listId));
    return activeTasks;
  }, [activeTasks, selectedList, selectedLevel, levelLists]);

  const boardStatusCounts = useMemo(() => {
    const counts: Record<ManualTaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
    };
    for (const t of visibleTasks) {
      counts[storedStatusToFlowColumn(normalizeTaskStatus(t.status))]++;
    }
    return counts;
  }, [visibleTasks]);

  /** Badges on cards: all tasks → list + level; level filter only → list; single list filter → none */

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      if (urlStatusFilter && !taskMatchesUrlStatusFilter(t, urlStatusFilter)) return false;
      const assignees = t.assigneeUserIds ?? [];
      if (urlAssigneeScope === "mine") {
        if (!sessionUserId || !assignees.includes(sessionUserId)) return false;
      } else if (urlAssigneeScope === "unassigned") {
        if (assignees.length > 0) return false;
      }
      if (urlAssigneeUserId && !assignees.includes(urlAssigneeUserId)) return false;
      if (!taskMatchesDatePreset(t, datePreset)) return false;
      if (dueFrom || dueTo) {
        if (!t.dueAt) return false;
        if (!taskMatchesDueRange(t, dueFrom, dueTo)) return false;
      }
      return true;
    });
  }, [
    visibleTasks,
    datePreset,
    dueFrom,
    dueTo,
    urlStatusFilter,
    urlAssigneeScope,
    urlAssigneeUserId,
    sessionUserId,
  ]);

  const sortedTasks = useMemo(() => sortTasks(filteredTasks, sortMode), [filteredTasks, sortMode]);

  function taskListName(task: TaskRow): string | null {
    return lists.find((l) => l.id === task.listId)?.name ?? null;
  }

  function taskLevelBadge(task: TaskRow): string | null {
    const list = lists.find((l) => l.id === task.listId);
    if (!list) return null;
    const dept = depts.find((d) => d.id === list.departmentId);
    return dept?.name ?? null;
  }

  useEffect(() => {
    setSubtasksByTaskId((c) => {
      let changed = false;
      const next = { ...c };
      for (const t of filteredTasks) {
        if (t.subtasks !== undefined) {
          const cur = next[t.id];
          if (cur !== t.subtasks) {
            next[t.id] = t.subtasks;
            changed = true;
          }
        }
      }
      return changed ? next : c;
    });
  }, [filteredTasks]);

  /** `null` when unassigned; otherwise comma-separated display names (or `"Unknown"` if IDs present but not resolved). */
  function assigneeNamesForTask(task: TaskRow, memberRows: MemberRow[]): string | null {
    const ids = task.assigneeUserIds ?? [];
    if (ids.length === 0) return null;
    const names = ids
      .map((id) => {
        const m = memberRows.find((row) => row.userId === id);
        if (!m) return null;
        const label = (m.name?.trim() || m.email || "").trim();
        return label || null;
      })
      .filter((n): n is string => Boolean(n));
    return names.length > 0 ? names.join(", ") : "Unknown";
  }

  function dueDatePillClass(hasDue: boolean) {
    if (hasDue) {
      return "border border-[var(--accent)]/25 bg-[var(--accent-muted)] text-[var(--accent-hover)] dark:text-[var(--accent)]";
    }
    return "border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--muted)]";
  }

  function dueChipChromeClass(task: TaskRow) {
    if (taskShowsLateFooter(task)) return TASK_LATE_DUE_CHROME_CLASS;
    return dueDatePillClass(Boolean(task.dueAt));
  }

  function formatDueForListPill(dueAt: string) {
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return "—";
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(d);
  }

  function ListTaskCard({ task }: { task: TaskRow }) {
    const taskPatchSyncing = patchTaskPendingId === task.id;
    const p = taskPriority(task);
    const storedStatus = normalizeTaskStatus(task.status);
    const flowCol = storedStatusToFlowColumn(storedStatus);
    const checklistDone = flowCol === "done";
    const checklistDisabled = flowCol === "cancelled";
    const advanceTo = nextWorkflowManualStatus(storedStatus);
    const expanded = listRowExpanded.has(task.id);
    const sid = subtasksByTaskId[task.id];
    const subtasksState =
      sid !== undefined ? sid : task.subtasks !== undefined ? task.subtasks : undefined;
    const subtasksPreview =
      Array.isArray(subtasksState) && subtasksState.length > 0
        ? subtasksState.slice(0, KANBAN_CARD_SUBTASK_PREVIEW)
        : [];
    const assigneeNames = assigneeNamesForTask(task, members);
    const assigneeFirstName = firstAssigneeLabel(task, members);
    const assigneeInitial = assigneeFirstName?.trim().charAt(0).toUpperCase() ?? "";
    return (
      <div
        className={`group/card relative overflow-hidden rounded-xl border transition-[border-color,background-color,transform] duration-200 ${
          taskPatchSyncing
            ? "border-[color-mix(in_srgb,var(--accent)_26%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--surface-elevated)_94%,var(--accent-muted))]"
            : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:-translate-y-px hover:border-[var(--border)]"
        }`}
        onContextMenu={(e) => openTaskContextMenu(e, task)}
      >
        {taskPatchSyncing ? (
          <div className="task-sync-ribbon-track" aria-hidden>
            <div className="task-sync-ribbon-thumb" />
          </div>
        ) : null}

        {/* Header: checkbox + title + status + overflow */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={checklistDone}
            disabled={taskPatchSyncing || checklistDisabled || (!checklistDone && advanceTo == null)}
            title={
              taskPatchSyncing
                ? "Saving…"
                : checklistDisabled
                  ? "Cancelled — use status menu to reopen"
                  : checklistDone
                    ? "Mark as not done"
                    : advanceTo
                      ? `Confirm move to ${FLOW_COLUMN_LABELS[advanceTo]}`
                      : "Cannot advance"
            }
            aria-label={
              checklistDisabled
                ? "Task cancelled"
                : checklistDone
                  ? "Mark task not done"
                  : advanceTo
                    ? `Confirm advancing task to ${FLOW_COLUMN_LABELS[advanceTo]}`
                    : "Cannot advance task"
            }
            aria-busy={taskPatchSyncing || undefined}
            className={`flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
              checklistDone
                ? "surface-glass-primary border-solid text-[var(--fg)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--muted)] hover:border-[var(--accent)]"
            } ${
              taskPatchSyncing || checklistDisabled || (!checklistDone && advanceTo == null)
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:bg-[var(--surface-hover)]"
            }`}
            onClick={() => {
              if (taskPatchSyncing || checklistDisabled) return;
              if (checklistDone) {
                void patchTask(task.id, { status: "in_progress" });
                return;
              }
              if (advanceTo) void patchTask(task.id, { status: advanceTo });
            }}
          >
            {checklistDone ? (
              <Check className="size-[11px] shrink-0" weight="bold" aria-hidden />
            ) : null}
          </button>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => openViewTask(task.id)}
              className={`line-clamp-2 text-left text-sm font-medium leading-snug underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
                flowCol === "cancelled"
                  ? "text-[var(--muted)] line-through decoration-red-500"
                  : checklistDone
                    ? "text-[var(--muted)] line-through decoration-[var(--muted)]"
                    : "text-[var(--fg)]"
              }`}
            >
              {task.title}
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <KanbanStatusPill task={task} />
            <button
              type="button"
              onClick={() => openViewTask(task.id)}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-transparent text-[var(--muted)] opacity-50 transition-[opacity,colors] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)] group-hover/card:opacity-100"
              title="Edit task"
              aria-label={`More options — edit: ${task.title}`}
            >
              <DotsThreeVertical size={16} weight="bold" aria-hidden />
            </button>
          </div>
        </div>

        {/* Subtasks + meta row — always visible */}
        <div className="border-t border-[var(--border-subtle)]/40 px-3 pb-2 pt-2" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            {subtasksPreview.length > 0 ? (
              <button
                type="button"
                onClick={() => toggleListRowExpand(task.id)}
                aria-expanded={expanded}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
              >
                <ListChecks size={16} className="opacity-70" weight="regular" aria-hidden />
                Subtasks
                {Array.isArray(subtasksState) ? (
                  <span className="ml-0.5 tabular-nums text-[var(--muted)]/80">({subtasksState.length})</span>
                ) : null}
                <IconChevron open={expanded} className="opacity-70" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openViewTask(task.id)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                title="Add subtasks"
                aria-label="Add subtasks"
              >
                <ListChecks size={16} className="opacity-70" weight="regular" aria-hidden />
                Subtasks
                <Plus size={16} className="opacity-60" weight="bold" aria-hidden />
              </button>
            )}
            <div className="flex-1" />
            <AssigneeIconBtn task={task} />
            <DueIconBtn task={task} />
            <PriorityIconBtn task={task} />
            <AttachIconBtn task={task} />
          </div>
          {expanded && subtasksPreview.length > 0 && (
            <ul className="mt-1.5 space-y-1 rounded-md bg-[var(--surface-base)]/60 py-1.5 pl-1.5 pr-1 dark:bg-black/15">
              {subtasksPreview.map((s) => {
                const subPending = patchSubtaskPendingKey === `${task.id}:${s.id}`;
                return (
                  <li key={s.id} className="flex items-start gap-2 text-[13px] leading-snug">
                    <button
                      type="button"
                      disabled={subPending}
                      onClick={() => void patchListSubtaskDone(task.id, s.id, !s.done)}
                      aria-busy={subPending || undefined}
                      className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                        s.done
                          ? "surface-glass-primary border-solid"
                          : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--accent)]"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      aria-label={s.done ? "Mark subtask not done" : "Mark subtask done"}
                    >
                      {subPending ? (
                        <InlineSpinner className="size-3 animate-spin motion-reduce:animate-none" />
                      ) : s.done ? (
                        <Check className="size-[9px] shrink-0" weight="bold" aria-hidden />
                      ) : null}
                    </button>
                    <span className={`min-w-0 flex-1 ${s.done ? "text-[var(--muted)] line-through decoration-[var(--muted)]" : "text-[var(--fg)]"}`}>
                      {s.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {task.lastLedger ? <TaskCardLastActivity entry={task.lastLedger} members={members} compact right={<CommentIconBtn task={task} />} /> : null}
      </div>
    );
  }

  function StatusIcon({ status, className, size }: { status: ManualTaskStatus; className?: string; size?: number }) {
    if (status === "done") return <CheckSquare className={className} size={size} weight="fill" aria-hidden />;
    if (status === "in_progress") return <ClockUser className={className} size={size} weight="fill" aria-hidden />;
    if (status === "cancelled") return <XSquare className={className} size={size} weight="fill" aria-hidden />;
    return <Clock className={className} size={size} weight="regular" aria-hidden />;
  }

  /** Same chrome as list-row {@link KanbanStatusPill}; options list is caller-defined (full pipeline vs board menu). */
  function StatusPillSelect({
    "aria-label": ariaLabel,
    value,
    onChange,
    options,
    disabled,
    pending,
    shellLayoutClassName = STATUS_PILL_LAYOUT,
  }: {
    "aria-label": string;
    value: ManualTaskStatus;
    onChange: (next: ManualTaskStatus) => void;
    options: readonly ManualTaskStatus[];
    disabled?: boolean;
    /** Server sync in progress (e.g. PATCH status). */
    pending?: boolean;
    /** Outer box sizing (list row uses fixed width; kanban uses equal flex cells). */
    shellLayoutClassName?: string;
  }) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);
    const listboxId = useId();
    const paletteKey = value;

    useLayoutEffect(() => {
      if (!open || !triggerRef.current) {
        setMenuPos(null);
        return;
      }
      const el = triggerRef.current;
      const sync = () => {
        const r = el.getBoundingClientRect();
        setMenuPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, el.offsetWidth) });
      };
      sync();
      window.addEventListener("scroll", sync, true);
      window.addEventListener("resize", sync);
      return () => {
        window.removeEventListener("scroll", sync, true);
        window.removeEventListener("resize", sync);
      };
    }, [open]);

    useEffect(() => {
      if (pending) setOpen(false);
    }, [pending]);

    useEffect(() => {
      if (!open) return;
      const onDocMouseDown = (e: MouseEvent) => {
        const t = e.target as Node;
        if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
        setOpen(false);
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", onDocMouseDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onDocMouseDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [open]);

    const blocked = disabled || pending;

    return (
      <div
        className={`relative ${shellLayoutClassName} ${statusPillPaletteClasses(paletteKey)} ${pending ? "opacity-[0.88]" : ""}`}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={blocked}
          aria-expanded={open}
          aria-busy={pending || undefined}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-label={ariaLabel}
          id={`${listboxId}-trigger`}
          onClick={() => {
            if (blocked) return;
            setOpen((o) => !o);
          }}
          className="absolute inset-0 z-[1] flex cursor-pointer items-center justify-center rounded-[inherit] px-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="pointer-events-none truncate text-[12px] font-semibold leading-none tracking-tight">
            {FLOW_COLUMN_LABELS[value]}
          </span>
        </button>
        {open && menuPos
          ? createPortal(
              <ul
                ref={menuRef}
                id={listboxId}
                role="listbox"
                style={{
                  position: "fixed",
                  top: menuPos.top,
                  left: menuPos.left,
                  minWidth: menuPos.width,
                  zIndex: 80,
                }}
                className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 dark:bg-[var(--surface-base)]"
              >
                {options.map((s) => (
                  <li key={s} role="presentation" className="px-1">
                    <button
                      type="button"
                      role="option"
                      id={`${listboxId}-opt-${s}`}
                      aria-selected={s === value}
                      className={`flex w-full min-w-[8rem] items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] font-semibold leading-snug tracking-tight outline-none transition-colors focus-visible:bg-[var(--surface-hover)] ${
                        s === value
                          ? "bg-[var(--accent-muted)]/55 text-[var(--fg)]"
                          : "text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                      }`}
                      onClick={() => {
                        setOpen(false);
                        if (s !== value) onChange(s);
                        queueMicrotask(() => triggerRef.current?.focus());
                      }}
                    >
                      <StatusIcon status={s} size={16} className="opacity-70" />
                      {FLOW_COLUMN_LABELS[s]}
                    </button>
                  </li>
                ))}
              </ul>,
              document.body,
            )
          : null}
      </div>
    );
  }

  /** List row: fixed-width status shell ({@link STATUS_PILL_LAYOUT}) — do not use {@link KanbanStatusPill} here. */
  function ListRowStatusPill({ task }: { task: TaskRow }) {
    const stored = normalizeTaskStatus(task.status);
    const manual = manualStatusFromStored(stored);
    const menuOptions = stageControlDropdownOptions(stored);
    return (
      <StatusPillSelect
        aria-label={`Task stage: ${FLOW_COLUMN_LABELS[manual]}`}
        value={manual}
        onChange={(v) => void patchTask(task.id, { status: v })}
        options={menuOptions}
        pending={patchTaskPendingId === task.id}
      />
    );
  }

  function KanbanStatusPill({ task }: { task: TaskRow }) {
    const stored = normalizeTaskStatus(task.status);
    const manual = manualStatusFromStored(stored);
    const menuOptions = stageControlDropdownOptions(stored);
    return (
      <StatusPillSelect
        aria-label={`Task stage: ${FLOW_COLUMN_LABELS[manual]}`}
        value={manual}
        onChange={(v) => void patchTask(task.id, { status: v })}
        options={menuOptions}
        shellLayoutClassName={KANBAN_STATUS_SHELL_LAYOUT}
        pending={patchTaskPendingId === task.id}
      />
    );
  }

  function PriorityIconBtn({ task }: { task: TaskRow }) {
    const p = taskPriority(task);
    const syncing = patchTaskPendingId === task.id;
    const color =
      p === "high"
        ? "text-amber-500 dark:text-amber-400"
        : p === "low"
          ? "text-sky-500 dark:text-sky-400"
          : "text-[var(--muted)]";
    return (
      <div
        title={`Priority: ${PRIORITY_LABELS[p]}`}
        className={`relative flex size-5 shrink-0 items-center justify-center ${color} transition-opacity hover:opacity-75 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--surface-elevated)]`}
      >
        <select
          className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0 appearance-none disabled:cursor-not-allowed"
          value={p}
          disabled={syncing}
          onChange={(e) => void patchTask(task.id, { priority: e.target.value as TaskPriority })}
          aria-label={`Priority: ${PRIORITY_LABELS[p]}`}
        >
          {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => (
            <option key={k} value={k}>{PRIORITY_LABELS[k]}</option>
          ))}
        </select>
        <span className={syncing ? "pointer-events-none opacity-45" : "pointer-events-none"} aria-hidden>
          {p === "high" ? (
            <CaretDoubleUp size={16} weight="fill" aria-hidden />
          ) : p === "low" ? (
            <CaretDoubleDown size={16} weight="fill" aria-hidden />
          ) : (
            <ArrowLineUp size={16} weight="bold" aria-hidden />
          )}
        </span>
      </div>
    );
  }

  function DueIconBtn({ task }: { task: TaskRow }) {
    const isLate = taskShowsLateFooter(task);
    const hasDue = Boolean(task.dueAt);
    const dueSummary = task.dueAt ? formatDueForListPill(task.dueAt) : null;
    const tooltip = dueSummary
      ? `Due ${dueSummary}${isLate ? " — Overdue" : ""}`
      : "No due date — click to set";
    const color = isLate ? "text-red-500 dark:text-red-400" : "text-[var(--muted)]";
    return (
      <button
        type="button"
        onClick={() => openViewTask(task.id)}
        title={tooltip}
        aria-label={tooltip}
        className={`flex size-5 shrink-0 items-center justify-center transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-elevated)] ${color}`}
      >
        {isLate ? (
          <Alarm size={16} weight="fill" aria-hidden />
        ) : hasDue ? (
          <Timer size={16} weight="regular" aria-hidden />
        ) : (
          <CalendarPlus size={16} weight="regular" aria-hidden />
        )}
      </button>
    );
  }

  function AssigneeIconBtn({ task }: { task: TaskRow }) {
    const name = firstAssigneeLabel(task, members);
    const initial = name?.trim().charAt(0).toUpperCase() ?? "";
    const allNames = assigneeNamesForTask(task, members);
    const tooltip = allNames ? `Assignees: ${allNames}` : "No assignee — click to assign";
    return (
      <button
        type="button"
        onClick={() => openViewTask(task.id)}
        title={tooltip}
        aria-label={tooltip}
        className="flex size-6 shrink-0 items-center justify-center text-[var(--muted)] transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-elevated)]"
      >
        {name ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold leading-none tabular-nums text-[var(--fg)]" aria-hidden>
            {initial}
          </span>
        ) : (
          <UserPlus size={16} className="text-[var(--muted)] opacity-80" weight="regular" aria-hidden />
        )}
      </button>
    );
  }

  function CommentIconBtn({ task }: { task: TaskRow }) {
    return (
      <button
        type="button"
        onClick={() => openViewTask(task.id)}
        title="Comments"
        aria-label="Comments"
        className="flex size-5 shrink-0 items-center justify-center text-[var(--muted)] transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-elevated)]"
      >
        <ChatCircle size={16} weight="regular" aria-hidden />
      </button>
    );
  }

  function AttachIconBtn({ task }: { task: TaskRow }) {
    return (
      <button
        type="button"
        onClick={() => openViewTask(task.id)}
        title="Attachments"
        aria-label="Attachments"
        className="flex size-5 shrink-0 items-center justify-center text-[var(--muted)] transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-elevated)]"
      >
        <Paperclip size={16} weight="regular" aria-hidden />
      </button>
    );
  }

  function TaskCard({ task }: { task: TaskRow }) {
    const taskPatchSyncing = patchTaskPendingId === task.id;
    const flowCol = storedStatusToFlowColumn(normalizeTaskStatus(task.status));
    const sid = subtasksByTaskId[task.id];
    const subtasksState =
      sid !== undefined ? sid : task.subtasks !== undefined ? task.subtasks : undefined;
    const assigneeNames = assigneeNamesForTask(task, members);
    const subtasksPreview =
      Array.isArray(subtasksState) && subtasksState.length > 0
        ? subtasksState.slice(0, KANBAN_CARD_SUBTASK_PREVIEW)
        : [];
    const subtasksOverflow =
      Array.isArray(subtasksState) && subtasksState.length > KANBAN_CARD_SUBTASK_PREVIEW
        ? subtasksState.length - KANBAN_CARD_SUBTASK_PREVIEW
        : 0;
    const assigneeFirstName = firstAssigneeLabel(task, members);
    const assigneeInitial = assigneeFirstName?.trim().charAt(0).toUpperCase() ?? "";

    return (
      <li
        draggable={!taskPatchSyncing}
        onDragStart={(e) => {
          e.dataTransfer.setData("taskId", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onContextMenu={(e) => openTaskContextMenu(e, task)}
        className={`group/card relative touch-manipulation overflow-hidden rounded-xl border transition-[border-color,background-color,transform] duration-200 ${
          taskPatchSyncing
            ? "cursor-default border-[color-mix(in_srgb,var(--accent)_26%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--surface-elevated)_94%,var(--accent-muted))]"
            : "cursor-grab border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:-translate-y-px hover:border-[var(--border)] active:cursor-grabbing"
        }`}
      >
        {taskPatchSyncing ? (
          <div className="task-sync-ribbon-track" aria-hidden>
            <div className="task-sync-ribbon-thumb" />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5 px-2.5 pb-2 pt-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => openViewTask(task.id)}
              className={`line-clamp-3 min-w-0 flex-1 text-left text-[15px] font-semibold leading-snug tracking-tight underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)] ${
                flowCol === "cancelled"
                  ? "text-[var(--muted)] line-through decoration-red-500"
                  : flowCol === "done"
                    ? "text-[var(--muted)] line-through decoration-[var(--muted)] hover:decoration-[var(--accent)]"
                    : "text-[var(--fg)] decoration-[var(--muted)]/40 hover:decoration-[var(--accent)]"
              }`}
            >
              {task.title}
            </button>
            <div className="flex shrink-0 items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
              <KanbanStatusPill task={task} />
              <button
                type="button"
                onClick={() => openViewTask(task.id)}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-transparent text-[var(--muted)] opacity-50 transition-[opacity,colors] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)] focus-visible:opacity-100 group-hover/card:opacity-100"
                title="Edit task"
                aria-label={`More options — edit: ${task.title}`}
              >
                <DotsThreeVertical size={16} weight="bold" aria-hidden />
              </button>
            </div>
          </div>

          {subtasksState === "loading" && (
            <p className="border-t border-[var(--border-subtle)]/40 pt-2 text-[11px] text-[var(--muted)]">Loading subtasks…</p>
          )}

          {/* Subtasks + meta row — always visible */}
          <div className="border-t border-[var(--border-subtle)]/40 pt-2" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              {subtasksPreview.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openViewTask(task.id)}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                  title="View subtasks"
                  aria-label="View subtasks"
                >
                  <ListChecks size={16} className="opacity-70" weight="regular" aria-hidden />
                  Subtasks
                  {Array.isArray(subtasksState) ? (
                    <span className="ml-0.5 tabular-nums text-[var(--muted)]/80">({subtasksState.length})</span>
                  ) : null}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openViewTask(task.id)}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                  title="Add subtasks"
                  aria-label="Add subtasks"
                >
                  <ListChecks size={16} className="opacity-70" weight="regular" aria-hidden />
                  Subtasks
                  <svg className="size-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <div className="flex-1" />
              <AssigneeIconBtn task={task} />
              <DueIconBtn task={task} />
              <PriorityIconBtn task={task} />
              <AttachIconBtn task={task} />
            </div>
            {subtasksPreview.length > 0 && (
              <ul className="mt-1.5 space-y-1 rounded-md bg-[var(--surface-base)]/60 py-1.5 pl-1.5 pr-1 dark:bg-black/15">
                {subtasksPreview.map((s) => {
                  const subPending = patchSubtaskPendingKey === `${task.id}:${s.id}`;
                  return (
                    <li key={s.id} className="flex items-start gap-2 text-[13px] leading-snug">
                      <button
                        type="button"
                        disabled={subPending}
                        onClick={() => void patchListSubtaskDone(task.id, s.id, !s.done)}
                        aria-busy={subPending || undefined}
                        className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                          s.done
                            ? "surface-glass-primary border-solid"
                            : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--accent)]"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        aria-label={s.done ? "Mark subtask not done" : "Mark subtask done"}
                      >
                        {subPending ? (
                          <InlineSpinner className="size-3 animate-spin motion-reduce:animate-none" />
                        ) : s.done ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : null}
                      </button>
                      <span
                        className={`min-w-0 flex-1 ${s.done ? "text-[var(--muted)] line-through decoration-[var(--muted)]" : "text-[var(--fg)]"}`}
                      >
                        {s.title}
                      </span>
                    </li>
                  );
                })}
                {subtasksOverflow > 0 && (
                  <li className="pt-0.5 text-[11px] text-[var(--muted)]">
                    +{subtasksOverflow} more —{" "}
                    <button
                      type="button"
                      className="font-medium text-[var(--accent)] hover:underline"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => openViewTask(task.id)}
                    >
                      open task
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
        {task.lastLedger ? <TaskCardLastActivity entry={task.lastLedger} members={members} compact right={<CommentIconBtn task={task} />} /> : null}
      </li>
    );
  }

  function ListViewCards({ rows }: { rows: TaskRow[] }) {
    const items: Array<{ kind: "task"; task: TaskRow } | { kind: "series"; seriesId: string; tasks: TaskRow[] }> = [];
    const seriesGroups = new Map<string, TaskRow[]>();
    for (const task of rows) {
      const col = storedStatusToFlowColumn(normalizeTaskStatus(task.status));
      if (task.recurringSeriesId && (col === "done" || col === "cancelled")) {
        const g = seriesGroups.get(task.recurringSeriesId) ?? [];
        g.push(task);
        seriesGroups.set(task.recurringSeriesId, g);
      } else {
        items.push({ kind: "task", task });
      }
    }
    for (const [seriesId, tasks] of seriesGroups) {
      items.push({ kind: "series", seriesId, tasks });
    }
    return (
      <div>
        <div className="columns-1 gap-3">
          {items.map((item) =>
            item.kind === "task" ? (
              <div key={item.task.id} className="mb-3 break-inside-avoid">
                <ListTaskCard task={item.task} />
              </div>
            ) : (
              <div key={item.seriesId} className="mb-3 break-inside-avoid">
                <RecurringSeriesCard
                  tasks={item.tasks}
                  members={members}
                  onOpenTask={openViewTask}
                />
              </div>
            )
          )}
        </div>
        <div className="pt-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            onClick={() => openNewTask(listId || undefined)}
          >
            <span>+ Add task</span>
          </button>
        </div>
      </div>
    );
  }

  type ColumnItem =
    | { kind: "task"; task: TaskRow }
    | { kind: "series"; seriesId: string; tasks: TaskRow[] }
    | { kind: "load-more"; status: string; loaded: number; total: number; loading: boolean };

  function VirtualColumnList({ items, col }: { items: ColumnItem[]; col: string }) {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 90,
      overscan: 5,
      measureElement: (el) => el.getBoundingClientRect().height,
    });

    return (
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-24">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const item = items[vItem.index]!;
            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vItem.start}px)`,
                }}
                className="pb-1.5"
              >
                {item.kind === "task" && <TaskCard task={item.task} />}
                {item.kind === "series" && (
                  <RecurringSeriesCard
                    tasks={item.tasks}
                    members={members}
                    onOpenTask={openViewTask}
                  />
                )}
                {item.kind === "load-more" && (
                  <button
                    type="button"
                    onClick={() => void loadMoreColumn(item.status)}
                    disabled={item.loading}
                    className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                  >
                    {item.loading ? "Loading…" : `Load more · ${item.loaded} of ${item.total}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function KanbanBoard({ rows }: { rows: TaskRow[] }) {
    // columnMeta and loadMoreColumn are captured from the outer scope
    return (
      <div className="overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] overscroll-x-contain">
          <div
            className="flex min-h-[min(72vh,38rem)] gap-2.5 md:min-h-[min(78vh,42rem)]"
            style={{ minWidth: "min(100%, 92rem)" }}
          >
            {TASK_FLOW_ORDER.map((col) => {
              const colTasks = rows.filter(
                (t) => storedStatusToFlowColumn(normalizeTaskStatus(t.status)) === col,
              );
              const label = FLOW_COLUMN_LABELS[col];
              return (
                <div
                  key={col}
                  role="region"
                  aria-label={`${label}, ${colTasks.length} tasks`}
                  className="flex min-h-0 min-w-[16rem] flex-1 flex-col gap-2 sm:min-w-[17rem]"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("taskId");
                  if (!id) return;
                  const task = rows.find((t) => t.id === id);
                  if (!task) return;
                  const from = normalizeTaskStatus(task.status);
                  if (!kanbanTransitionAllowedFromStored(from, col)) {
                    setError("You can only move to the next stage or Cancelled (or reopen cancelled tasks to Pending).");
                    return;
                  }
                  void patchTask(id, { status: col });
                }}
                >
                  <div
                    className={`shrink-0 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 shadow-sm ${statusPillPaletteClasses(col)}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-semibold leading-none tracking-tight">{label}</span>
                      <span className="tabular-nums text-[10px] font-medium opacity-80">
                        {columnMeta[col]?.total ?? colTasks.length}
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const colItems: ColumnItem[] = [];
                    if (col === "done" || col === "cancelled") {
                      const seriesGroups = new Map<string, TaskRow[]>();
                      for (const task of colTasks) {
                        if (task.recurringSeriesId) {
                          const g = seriesGroups.get(task.recurringSeriesId) ?? [];
                          g.push(task);
                          seriesGroups.set(task.recurringSeriesId, g);
                        } else {
                          colItems.push({ kind: "task", task });
                        }
                      }
                      for (const [seriesId, tasks] of seriesGroups) {
                        colItems.push({ kind: "series", seriesId, tasks });
                      }
                    } else {
                      for (const task of colTasks) colItems.push({ kind: "task", task });
                    }
                    if (columnMeta[col]?.nextCursor) {
                      colItems.push({
                        kind: "load-more",
                        status: col,
                        loaded: colTasks.length,
                        total: columnMeta[col]!.total,
                        loading: loadingMoreColumn === col,
                      });
                    }
                    return <VirtualColumnList items={colItems} col={col} />;
                  })()}
                </div>
              );
            })}
          </div>
        </div>
    );
  }

  const drilldownActive =
    Boolean(searchParams.get("status")) ||
    searchParams.get("mine") === "1" ||
    searchParams.get("unassigned") === "1" ||
    Boolean(searchParams.get("assignee"));

  const drilldownLabel = useMemo(() => {
    const parts: string[] = [];
    const st = searchParams.get("status");
    if (st) {
      const p = parseUrlStatusFilter(st);
      if (p === "pending_work") parts.push(PENDING_WORK_URL_FILTER_LABEL);
      else if (p === "active_work") parts.push(ACTIVE_WORK_URL_FILTER_LABEL);
      else if (p) parts.push(STATUS_LABELS[p]);
      else parts.push(st);
    }
    if (searchParams.get("mine") === "1") parts.push("Assigned to me");
    if (searchParams.get("unassigned") === "1") parts.push("Unassigned");
    const aid = searchParams.get("assignee");
    if (aid) {
      const m = members.find((x) => x.userId === aid);
      parts.push(m?.name?.trim() || m?.email || "Selected assignee");
    }
    return parts.join(" · ");
  }, [searchParams, members]);

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4">
      <ConfirmDialog
        open={taskActionConfirm != null}
        options={taskActionConfirm}
        onClose={() => setTaskActionConfirm(null)}
      />
      <SimpleContextMenu
        open={taskContextMenu != null && taskContextMenuItems.length > 0}
        x={taskContextMenu?.x ?? 0}
        y={taskContextMenu?.y ?? 0}
        items={taskContextMenuItems}
        onClose={() => setTaskContextMenu(null)}
      />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {drilldownActive ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-muted)]/35 px-4 py-2.5 text-sm"
          role="status"
        >
          <p className="min-w-0 text-[var(--fg)]">
            <span className="font-medium">Dashboard filter</span>
            {drilldownLabel ? (
              <>
                <span className="text-[var(--muted)]"> · </span>
                <span className="text-[var(--muted)]">{drilldownLabel}</span>
              </>
            ) : null}
          </p>
          <button
            type="button"
            className="btn-secondary shrink-0 rounded-lg px-3 py-1.5 text-xs"
            onClick={() => {
              replaceWorkQuery((p) => {
                p.delete("status");
                p.delete("mine");
                p.delete("unassigned");
                p.delete("assignee");
              });
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
      <header className="pb-1">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,min(52rem,58vw))] lg:items-start lg:gap-x-4 xl:gap-x-5 lg:gap-y-3">
          <h1 className="flex min-w-0 flex-wrap items-center gap-x-2 lg:col-start-1 lg:row-start-1 lg:pt-0.5">
            <span className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium leading-none text-[var(--fg)]">
              {NODE_LABELS.workItem}s
            </span>
            {filterScopeSegments.map((seg, i) => (
              <span key={`${seg.kind}-${i}`} className="flex items-center gap-x-2">
                <span className="text-sm text-[var(--muted)] opacity-40" aria-hidden>›</span>
                <span
                  className={`inline-flex items-center border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium leading-none text-[var(--fg)] ${
                    i === 0 ? "rounded-xl" : "rounded-full"
                  }`}
                >
                  {seg.label}
                </span>
              </span>
            ))}
          </h1>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 max-sm:justify-between lg:col-start-1 lg:row-start-2 lg:justify-start">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <div
                className="inline-flex items-center rounded-xl bg-[var(--surface-elevated)] p-0.5"
                role="group"
                aria-label="Board layout"
              >
                <button
                  type="button"
                  className={`inline-flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
                    viewMode === "list"
                      ? "bg-[var(--accent-muted)] text-[var(--fg)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  }`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                >
                  <Rows size={18} weight="regular" aria-hidden />
                </button>
                <button
                  type="button"
                  className={`inline-flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
                    viewMode === "kanban"
                      ? "bg-[var(--accent-muted)] text-[var(--fg)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  }`}
                  onClick={() => setViewMode("kanban")}
                  aria-label="Kanban view"
                  aria-pressed={viewMode === "kanban"}
                >
                  <Columns size={18} weight="regular" aria-hidden />
                </button>
              </div>
              <span className="hidden h-8 w-px shrink-0 bg-[var(--border-subtle)] sm:inline-block" aria-hidden />
              <button
                ref={sortTriggerRef}
                type="button"
                className={tasksToolbarIconButtonClasses(sortMenuOpen)}
                title={SORT_OPTIONS.find((o) => o.value === sortMode)?.label ?? "Sort"}
                onClick={() => {
                  setSortMenuOpen((o) => !o);
                  setDateMenuOpen(false);
                }}
                aria-expanded={sortMenuOpen}
                aria-haspopup="menu"
                aria-label={`Sort tasks: ${SORT_OPTIONS.find((o) => o.value === sortMode)?.label ?? sortMode}`}
              >
                <ArrowsDownUp size={18} className="pointer-events-none" weight="regular" aria-hidden />
              </button>
              <button
                ref={dateTriggerRef}
                type="button"
                className={`relative ${tasksToolbarIconButtonClasses(dateMenuOpen)}`}
                title="Due date filter"
                onClick={() => {
                  setDateMenuOpen((o) => !o);
                  setSortMenuOpen(false);
                }}
                aria-expanded={dateMenuOpen}
                aria-haspopup="dialog"
                aria-label={
                  datePreset !== "all" || dueFrom || dueTo
                    ? "Due date filter, filters active"
                    : "Due date filter"
                }
              >
                <CalendarDots size={18} className="pointer-events-none" weight="regular" aria-hidden />
                {(datePreset !== "all" || dueFrom || dueTo) && (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-elevated)]" aria-hidden />
                )}
              </button>
            </div>
            <button
              type="button"
              className="btn-primary !h-8 inline-flex shrink-0 items-center gap-1.5 !rounded-lg !px-2.5 !py-1 !text-xs !font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
              onClick={() => openNewTask(listId || undefined)}
            >
              <span>+ New task</span>
            </button>
          </div>
          <WorkBoardStatsCard
            counts={boardStatusCounts}
            total={visibleTasks.length}
            loading={workspaceLoading}
          />
        </div>
      </header>

      {toolbarMenusMounted &&
        sortMenuOpen &&
        createPortal(
          <div
            ref={sortPanelRef}
            style={sortPanelStyle}
            className="surface-elevated flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] py-2"
            role="menu"
            aria-label="Sort options"
          >
            <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Sort by</p>
            <ul className="max-h-[min(280px,70vh)] space-y-0.5 overflow-y-auto px-1.5 pb-1">
              {SORT_OPTIONS.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`w-full rounded-lg px-2.5 py-2.5 text-left text-sm leading-snug ${
                      sortMode === opt.value
                        ? "bg-[var(--accent-muted)] font-medium text-[var(--fg)]"
                        : "text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                    }`}
                    onClick={() => {
                      setSortMode(opt.value);
                      setSortMenuOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}

      {toolbarMenusMounted &&
        dateMenuOpen &&
        createPortal(
          <div
            ref={datePanelRef}
            style={datePanelStyle}
            className="surface-elevated flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)]"
            role="dialog"
            aria-label="Due date filter"
          >
            <div className="max-h-[min(420px,85vh)] overflow-y-auto p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Preset</span>
                  <SelectPopover
                    value={datePreset}
                    onChange={(v) => {
                      const vt = v as DatePreset;
                      setDatePreset(vt);
                      replaceWorkQuery((p) => {
                        if (vt === "all") p.delete("due");
                        else p.set("due", vt);
                      });
                    }}
                    options={DATE_PRESET_OPTIONS}
                    triggerClassName="inline-flex w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                    aria-label="Date preset"
                  />
                </div>
              </div>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Due date range</p>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  className="input h-10 min-w-0 flex-1 rounded-lg text-sm"
                  value={dueFrom}
                  onChange={(e) => {
                    setDueFrom(e.target.value);
                    replaceWorkQuery((p) => p.delete("due"));
                  }}
                  aria-label="Due from"
                />
                <input
                  type="date"
                  className="input h-10 min-w-0 flex-1 rounded-lg text-sm"
                  value={dueTo}
                  onChange={(e) => {
                    setDueTo(e.target.value);
                    replaceWorkQuery((p) => p.delete("due"));
                  }}
                  aria-label="Due to"
                />
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[var(--muted)]">Optional range narrows tasks that have a due date.</p>
              {(datePreset !== "all" || dueFrom || dueTo) && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border border-[var(--border-subtle)] py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  onClick={() => {
                    setDatePreset("all");
                    setDueFrom("");
                    setDueTo("");
                    replaceWorkQuery((p) => p.delete("due"));
                  }}
                >
                  Clear date filters
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}

      <section>
        {workspaceLoading ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center text-sm text-[var(--muted)]">
            Loading tasks…
          </p>
        ) : sortedTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center text-sm text-[var(--muted)]">
            {visibleTasks.length === 0
              ? selectedListName
                ? `No tasks yet in ${selectedListName}.`
                : selectedLevelName
                  ? `No tasks yet in ${selectedLevelName}.`
                  : "No tasks yet."
              : "No tasks match the current filters."}
          </p>
        ) : viewMode === "list" ? (
          <ListViewCards rows={sortedTasks} />
        ) : (
          <KanbanBoard rows={sortedTasks} />
        )}
      </section>

      {viewTaskId &&
        toolbarMenusMounted &&
        createPortal(
          <div className="fixed bottom-0 left-0 right-0 top-14 z-[60] md:left-72">
            <div
              className="absolute inset-0 backdrop-blur-sm"
              aria-hidden
              onClick={() => setViewTaskId(null)}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Task details"
              className="surface-elevated scrollbar-hide absolute right-0 top-0 z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-[var(--border-subtle)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <TaskViewPanel
                taskId={viewTaskId}
                onClose={() => setViewTaskId(null)}
                onOpenTask={(id: string) => setViewTaskId(id)}
              />
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function WorkItemsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-[var(--muted)]">Loading tasks…</div>
      }
    >
      <WorkItemsInner />
    </Suspense>
  );
}
