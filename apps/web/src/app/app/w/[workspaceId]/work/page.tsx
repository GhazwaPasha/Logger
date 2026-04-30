"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import type { ListRow, MemberRow, SubtaskRow, TaskDetail, TaskRow } from "@/lib/ledger-types";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import { workspaceKeys } from "@/lib/query-keys";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import {
  KANBAN_STATUS_ORDER,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type BoardTaskStatus,
  type DatePreset,
  type SortMode,
  type TaskPriority,
  kanbanAllowedTransitions,
  kanbanTransitionAllowed,
  normalizeTaskStatus,
  sortTasks,
  taskMatchesDatePreset,
  taskMatchesDueRange,
  taskPriority,
} from "@/lib/task-board";

type ViewMode = "list" | "kanban";

function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function IconChevron({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      className={`${className ?? ""} shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconLayoutList({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function IconLayoutKanban({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="4" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="10" rx="1" />
    </svg>
  );
}

function IconArrowUpDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
    </svg>
  );
}

function IconCalendarDays({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );
}

function IconChevronMiniDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "priority_desc", label: "Priority · high first" },
  { value: "priority_asc", label: "Priority · low first" },
  { value: "due_asc", label: "Due date · soonest" },
  { value: "due_desc", label: "Due date · latest" },
];

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "overdue", label: "Overdue" },
  { value: "this_week", label: "Due this week" },
  { value: "no_due", label: "No due date" },
];

const SORT_PANEL_MIN_W = 224;
const DATE_PANEL_MIN_W = 288;
const MENU_VIEWPORT_GUTTER = 12;

/** Max subtasks shown on kanban cards before “+ more”. */
const KANBAN_CARD_SUBTASK_PREVIEW = 8;

/** List row assignee / due / priority — identical footprint every badge (fixed box); subtle corners */
const LIST_ROW_BADGE_TILE =
  "box-border inline-flex h-8 w-[5rem] min-h-[2rem] max-h-[2rem] min-w-[5rem] max-w-[5rem] shrink-0 items-center justify-center overflow-hidden rounded-sm border px-1 py-0.5";
const LIST_ROW_BADGE_LABEL =
  "pointer-events-none w-full min-w-0 truncate text-center text-[11px] font-semibold leading-none tracking-wide tabular-nums";

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

function WorkItemsInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const levelPref = searchParams.get("level");
  const listPref = searchParams.get("list");
  const { token } = useApiSession();
  const queryClient = useQueryClient();
  const { tasks, lists, members, depts, error, setError } = useWorkspaceData();
  const [title, setTitle] = useState("");
  const [listId, setListId] = useState("");
  const [due, setDue] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [newTaskStatus, setNewTaskStatus] = useState<BoardTaskStatus>("pending");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("medium");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskItems, setSubtaskItems] = useState<string[]>([]);
  const [showAssignees, setShowAssignees] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">("none");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [listSectionsOpen, setListSectionsOpen] = useState<Record<BoardTaskStatus, boolean>>(() =>
    Object.fromEntries(KANBAN_STATUS_ORDER.map((k) => [k, true])) as Record<BoardTaskStatus, boolean>,
  );
  const [listRowExpanded, setListRowExpanded] = useState<Set<string>>(() => new Set());
  const [subtasksByTaskId, setSubtasksByTaskId] = useState<Record<string, SubtaskRow[] | "loading">>({});
  const [subtaskUpdatingId, setSubtaskUpdatingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
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
        zIndex: 45,
      };
    }
    return {
      position: "fixed",
      left,
      width: panelWidth,
      bottom: window.innerHeight - r.top + gap,
      maxHeight: Math.max(120, maxH),
      zIndex: 45,
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

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const patchTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      patch,
    }: {
      taskId: string;
      patch: { status?: BoardTaskStatus; priority?: TaskPriority };
    }) =>
      apiJson<TaskDetail>(`/tasks/${taskId}`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ taskId, patch }) => {
      if (!token) return;
      setError(null);
      setUpdatingTaskId(taskId);
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
              assigneeUserIds: t.assigneeUserIds,
              subtasks: detail.subtasks.length ? detail.subtasks : t.subtasks,
            };
          }),
        };
      });
    },
    onSettled: () => setUpdatingTaskId(null),
  });

  const patchTask = useCallback(
    (taskId: string, patch: { status?: BoardTaskStatus; priority?: TaskPriority }) => {
      if (!token) return;
      patchTaskMutation.mutate({ taskId, patch });
    },
    [token, patchTaskMutation],
  );

  const toggleListRowExpand = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const embedded = task?.subtasks;

      setListRowExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(taskId)) {
          next.delete(taskId);
          return next;
        }
        next.add(taskId);
        return next;
      });

      if (embedded !== undefined) {
        setSubtasksByTaskId((c) => ({ ...c, [taskId]: embedded }));
        return;
      }

      setSubtasksByTaskId((c) => {
        if (c[taskId] !== undefined) return c;
        if (!token) return c;
        void (async () => {
          try {
            const rows = await apiJson<SubtaskRow[]>(`/tasks/${taskId}/subtasks`, { token });
            setSubtasksByTaskId((x) => ({ ...x, [taskId]: rows }));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load subtasks");
            setListRowExpanded((p) => {
              const n = new Set(p);
              n.delete(taskId);
              return n;
            });
            setSubtasksByTaskId((x) => {
              const { [taskId]: _, ...rest } = x;
              return rest;
            });
          }
        })();
        return { ...c, [taskId]: "loading" };
      });
    },
    [token, setError, tasks],
  );

  const patchListSubtaskDone = useCallback(
    async (taskId: string, subtaskId: string, done: boolean) => {
      if (!token) return;
      setError(null);
      setSubtaskUpdatingId(subtaskId);
      try {
        await apiJson(`/tasks/${taskId}/subtasks/${subtaskId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ done }),
        });
        setSubtasksByTaskId((c) => {
          const cur = c[taskId];
          if (!Array.isArray(cur)) return c;
          return {
            ...c,
            [taskId]: cur.map((s) => (s.id === subtaskId ? { ...s, done } : s)),
          };
        });
        queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) => {
              if (t.id !== taskId || t.subtasks === undefined) return t;
              return {
                ...t,
                subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)),
              };
            }),
          };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update subtask");
      } finally {
        setSubtaskUpdatingId(null);
      }
    },
    [token, setError, queryClient, workspaceId],
  );

  async function createTask() {
    if (!token || !workspaceId || !title.trim() || !listId) return;
    setError(null);
    try {
      const dueIso = due.trim() ? new Date(due).toISOString() : undefined;
      const created = await apiJson<{ task: { id: string } }>(`/organizations/${workspaceId}/tasks`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          listId,
          assigneeUserIds: assigneeIds,
          status: newTaskStatus,
          priority: newTaskPriority,
          ...(dueIso ? { dueAt: dueIso } : {}),
        }),
      });
      const createdTaskId = created.task.id;
      for (const subtaskTitle of subtaskItems) {
        await apiJson(`/tasks/${createdTaskId}/subtasks`, {
          method: "POST",
          token,
          body: JSON.stringify({ title: subtaskTitle }),
        });
      }
      setTitle("");
      setDue("");
      setAssigneeIds([]);
      setNewTaskStatus("pending");
      setNewTaskPriority("medium");
      setSubtaskDraft("");
      setSubtaskItems([]);
      setShowAssignees(false);
      setShowDeadline(false);
      setRepeat("none");
      setCreateModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create task");
    }
  }

  const activeTasks = tasks.filter((t) => !t.deletedAt);
  const selectedLevel = levelPref && depts.some((d) => d.id === levelPref) ? levelPref : null;
  const selectedLevelName = selectedLevel ? depts.find((d) => d.id === selectedLevel)?.name ?? null : null;
  const levelLists = selectedLevel ? lists.filter((l) => l.departmentId === selectedLevel) : lists;
  const selectedList = listPref && levelLists.some((l) => l.id === listPref) ? listPref : null;
  const selectedListName = selectedList ? levelLists.find((l) => l.id === selectedList)?.name ?? null : null;
  const visibleTasks = selectedList
    ? activeTasks.filter((t) => t.listId === selectedList)
    : selectedLevel
      ? activeTasks.filter((t) => levelLists.some((l) => l.id === t.listId))
      : activeTasks;

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      if (!taskMatchesDatePreset(t, datePreset)) return false;
      if (dueFrom || dueTo) {
        if (!t.dueAt) return false;
        if (!taskMatchesDueRange(t, dueFrom, dueTo)) return false;
      }
      return true;
    });
  }, [visibleTasks, datePreset, dueFrom, dueTo]);

  const sortedTasks = useMemo(() => sortTasks(filteredTasks, sortMode), [filteredTasks, sortMode]);

  const tasksByList = sortedTasks.reduce<Map<string, TaskRow[]>>((map, task) => {
    const arr = map.get(task.listId) ?? [];
    arr.push(task);
    map.set(task.listId, arr);
    return map;
  }, new Map());

  const kanbanSubtaskPrefetchKey = useMemo(
    () => filteredTasks.map((t) => t.id).sort().join(","),
    [filteredTasks],
  );

  useEffect(() => {
    setSubtasksByTaskId((c) => {
      let changed = false;
      const next = { ...c };
      for (const t of filteredTasks) {
        if (t.subtasks !== undefined && next[t.id] === undefined) {
          next[t.id] = t.subtasks;
          changed = true;
        }
      }
      return changed ? next : c;
    });
  }, [filteredTasks]);

  useEffect(() => {
    if (viewMode !== "kanban" || !token) return;
    const ids = kanbanSubtaskPrefetchKey.split(",").filter(Boolean);
    const toFetch: string[] = [];
    setSubtasksByTaskId((c) => {
      const next = { ...c };
      for (const taskId of ids) {
        const task = filteredTasks.find((t) => t.id === taskId);
        if (task?.subtasks !== undefined) continue;
        if (next[taskId] === undefined) {
          next[taskId] = "loading";
          toFetch.push(taskId);
        }
      }
      return toFetch.length ? next : c;
    });
    for (const taskId of toFetch) {
      void (async () => {
        try {
          const rows = await apiJson<SubtaskRow[]>(`/tasks/${taskId}/subtasks`, { token });
          setSubtasksByTaskId((x) => ({ ...x, [taskId]: rows }));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load subtasks");
          setSubtasksByTaskId((x) => {
            const { [taskId]: _, ...rest } = x;
            return rest;
          });
        }
      })();
    }
  }, [viewMode, token, kanbanSubtaskPrefetchKey, setError, filteredTasks]);

  function formatKanbanAssignees(task: TaskRow, memberRows: MemberRow[]): string {
    const ids = task.assigneeUserIds ?? [];
    if (ids.length === 0) return "Unassigned";
    const names = ids
      .map((id) => memberRows.find((m) => m.userId === id)?.name)
      .filter((n): n is string => Boolean(n));
    return names.length > 0 ? names.join(", ") : "Unknown";
  }

  function priorityClass(p: TaskPriority) {
    if (p === "high") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    if (p === "low") return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
    return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }

  function statusPillClass(st: BoardTaskStatus) {
    if (st === "pending") return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    if (st === "assigned") return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    if (st === "in_progress") return "bg-violet-500/15 text-violet-800 dark:text-violet-200";
    if (st === "late") return "bg-orange-500/15 text-orange-800 dark:text-orange-200";
    if (st === "done") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    return "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400";
  }

  function dueDatePillClass(hasDue: boolean) {
    if (hasDue) {
      return "border border-[var(--accent)]/25 bg-[var(--accent-muted)] text-[var(--accent-hover)] shadow-sm dark:text-[var(--accent)]";
    }
    return "border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--muted)]";
  }

  function formatDueForListPill(dueAt: string) {
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return "—";
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(d);
  }

  function ListTaskRow({ task }: { task: TaskRow }) {
    const dueText = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : null;
    const st = normalizeTaskStatus(task.status);
    const p = taskPriority(task);
    const busy = updatingTaskId === task.id;
    const canComplete = st !== "done" && st !== "cancelled";
    const expanded = listRowExpanded.has(task.id);
    const sid = subtasksByTaskId[task.id];
    const subtasksState =
      sid !== undefined ? sid : task.subtasks !== undefined ? task.subtasks : undefined;
    const taskDetailHref = `/app/w/${workspaceId}/work/${task.id}`;

    return (
      <>
        <tr className="group border-b border-[var(--border-subtle)]/80 transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]/80">
          <td className="bg-[var(--surface-base)] px-4 py-3 align-middle group-hover:bg-[var(--surface-hover)]/80">
            <div className="flex min-w-0 items-center gap-1 sm:gap-3">
              <button
                type="button"
                disabled={busy || !canComplete}
                onClick={() => canComplete && void patchTask(task.id, { status: "done" })}
                className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
                  busy ? "cursor-wait opacity-60" : canComplete ? "cursor-pointer" : "cursor-default"
                }`}
                aria-label={st === "done" ? "Completed" : "Mark complete"}
              >
                <span
                  className={`flex size-[18px] items-center justify-center rounded-full border-2 transition-colors ${
                    st === "done"
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : st === "cancelled"
                        ? "border-[var(--border-subtle)] opacity-50"
                        : "border-[var(--border-subtle)] text-transparent hover:border-[var(--accent)]"
                  }`}
                >
                  {st === "done" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
                aria-expanded={expanded}
                aria-label={expanded ? "Hide subtasks" : "Show subtasks"}
                onClick={() => toggleListRowExpand(task.id)}
              >
                <IconChevron open={expanded} className="opacity-80" />
              </button>
              <Link
                href={taskDetailHref}
                className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
              >
                {task.title}
              </Link>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <Link
                  href={taskDetailHref}
                  className={`${LIST_ROW_BADGE_TILE} transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${dueDatePillClass(false)}`}
                  title="Assignees — set on task page"
                  aria-label="Assignees — open task"
                >
                  <IconUserPlus className="size-[18px] shrink-0 text-[var(--muted)] opacity-90" aria-hidden />
                </Link>
                <Link
                  href={taskDetailHref}
                  className={`${LIST_ROW_BADGE_TILE} transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${dueDatePillClass(Boolean(task.dueAt))}`}
                  title={dueText ? `Due ${dueText}` : "Due date — set on task page"}
                  aria-label={dueText ? `Due date ${formatDueForListPill(task.dueAt!)}` : "Due date — open task"}
                >
                  <span className={`${LIST_ROW_BADGE_LABEL} ${task.dueAt ? "" : "uppercase"}`}>
                    {task.dueAt ? formatDueForListPill(task.dueAt) : "No due"}
                  </span>
                </Link>
                <div
                  className={`relative ${LIST_ROW_BADGE_TILE} border-0 bg-[var(--surface-muted)] text-[var(--fg)] hover:opacity-95 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface-base)]`}
                >
                  <select
                    className="absolute inset-0 z-[1] h-full w-full min-w-full cursor-pointer opacity-0 appearance-none"
                    value={p}
                    disabled={busy}
                    onChange={(e) => void patchTask(task.id, { priority: e.target.value as TaskPriority })}
                    aria-label={`Priority: ${PRIORITY_LABELS[p]}`}
                  >
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => (
                      <option key={k} value={k}>
                        {PRIORITY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <span className={`${LIST_ROW_BADGE_LABEL} uppercase`}>{priorityLabelShort(p)}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
        {expanded && (
          <tr className="border-b border-[var(--border-subtle)]/80 last:border-b-0">
            <td className="bg-[var(--surface-base)] px-4 pb-3 pt-0">
              <div className="ml-[calc(1.125rem+0.875rem+0.5rem)] border-l border-[var(--border-subtle)] pl-4 sm:ml-[calc(1.125rem+1.75rem+0.75rem)]">
                {subtasksState === "loading" && <p className="py-2 text-xs text-[var(--muted)]">Loading subtasks…</p>}
                {Array.isArray(subtasksState) && subtasksState.length === 0 && (
                  <p className="py-2 text-xs text-[var(--muted)]">
                    No subtasks.{" "}
                    <Link href={`/app/w/${workspaceId}/work/${task.id}`} className="text-[var(--accent)] hover:underline">
                      Add on task page
                    </Link>
                  </p>
                )}
                {Array.isArray(subtasksState) && subtasksState.length > 0 && (
                  <ul className="space-y-1 py-1">
                    {subtasksState.map((s) => {
                      const stBusy = subtaskUpdatingId === s.id;
                      return (
                        <li key={s.id} className="flex items-start gap-2 text-sm">
                          <button
                            type="button"
                            disabled={stBusy}
                            onClick={() => void patchListSubtaskDone(task.id, s.id, !s.done)}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              s.done
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-[var(--border-subtle)] hover:border-[var(--accent)]"
                            } ${stBusy ? "cursor-wait opacity-50" : ""}`}
                            aria-label={s.done ? "Mark subtask not done" : "Mark subtask done"}
                          >
                            {s.done ? (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            ) : null}
                          </button>
                          <span className={`min-w-0 flex-1 leading-snug ${s.done ? "text-[var(--muted)] line-through" : "text-[var(--fg)]"}`}>{s.title}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  function KanbanStatusPill({ task }: { task: TaskRow }) {
    const st = normalizeTaskStatus(task.status);
    const busy = updatingTaskId === task.id;
    const allowed = kanbanAllowedTransitions(st);
    return (
      <div
        className={`relative inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-1 shadow-sm ${statusPillClass(st)}`}
      >
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={st}
          disabled={busy}
          onChange={(e) => void patchTask(task.id, { status: e.target.value as BoardTaskStatus })}
          aria-label="Task stage (one step on the pipeline)"
        >
          {allowed.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none truncate text-[11px] font-semibold tracking-tight">{STATUS_LABELS[st]}</span>
        <IconChevronMiniDown className="pointer-events-none shrink-0 opacity-45" />
      </div>
    );
  }

  function KanbanPriorityPill({ task }: { task: TaskRow }) {
    const p = taskPriority(task);
    const busy = updatingTaskId === task.id;
    return (
      <div
        className={`relative inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-1 shadow-sm ${priorityClass(p)}`}
      >
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={p}
          disabled={busy}
          onChange={(e) => void patchTask(task.id, { priority: e.target.value as TaskPriority })}
          aria-label="Task priority"
        >
          {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => (
            <option key={k} value={k}>
              {PRIORITY_LABELS[k]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none text-[11px] font-semibold uppercase tracking-wide">{PRIORITY_LABELS[p]}</span>
        <IconChevronMiniDown className="pointer-events-none shrink-0 opacity-45" />
      </div>
    );
  }

  function TaskCard({ task }: { task: TaskRow }) {
    const sid = subtasksByTaskId[task.id];
    const subtasksState =
      sid !== undefined ? sid : task.subtasks !== undefined ? task.subtasks : undefined;
    const assigneeLine = formatKanbanAssignees(task, members);
    const taskHref = `/app/w/${workspaceId}/work/${task.id}`;
    const subtasksPreview =
      Array.isArray(subtasksState) && subtasksState.length > 0
        ? subtasksState.slice(0, KANBAN_CARD_SUBTASK_PREVIEW)
        : [];
    const subtasksOverflow =
      Array.isArray(subtasksState) && subtasksState.length > KANBAN_CARD_SUBTASK_PREVIEW
        ? subtasksState.length - KANBAN_CARD_SUBTASK_PREVIEW
        : 0;

    return (
      <li
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("taskId", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className="surface-elevated cursor-grab touch-manipulation rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-sm transition-[box-shadow,border-color] hover:border-[var(--border)] hover:shadow-md active:cursor-grabbing dark:hover:shadow-lg dark:hover:shadow-black/20"
      >
        <div className="flex flex-col gap-0">
          <div className="flex gap-3 border-b border-[var(--border-subtle)]/70 px-4 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <Link
                href={taskHref}
                className="line-clamp-3 text-[15px] font-semibold leading-snug tracking-tight text-[var(--fg)] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)]"
              >
                {task.title}
              </Link>
            </div>
            <div
              className="flex shrink-0 flex-col items-end gap-1.5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <KanbanStatusPill task={task} />
              <KanbanPriorityPill task={task} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2.5 px-4 pb-3 pt-3 text-xs leading-snug">
            <div
              className={`inline-flex min-h-[1.75rem] max-w-full items-center gap-1.5 rounded-lg px-2 py-1 ${dueDatePillClass(Boolean(task.dueAt))}`}
              title={task.dueAt ? `Due ${new Date(task.dueAt).toISOString().slice(0, 10)}` : "No due date"}
            >
              <IconCalendarDays className="size-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="min-w-0 font-medium tabular-nums text-[var(--fg)]">
                {task.dueAt ? formatDueForListPill(task.dueAt) : "No due"}
              </span>
            </div>
            <div className="flex min-w-0 max-w-full items-start gap-1.5 py-0.5">
              <IconUserPlus className="mt-0.5 size-3.5 shrink-0 opacity-65" aria-hidden />
              <span className="min-w-0 break-words text-[13px] text-[var(--fg)]">{assigneeLine}</span>
            </div>
          </div>

          {subtasksState === "loading" && (
            <p className="border-t border-[var(--border-subtle)]/60 px-4 py-2.5 text-xs text-[var(--muted)]">Loading subtasks…</p>
          )}
          {subtasksPreview.length > 0 && (
            <div className="border-t border-[var(--border-subtle)]/60 px-4 pb-4 pt-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Checklist</p>
              <ul className="space-y-2 rounded-xl bg-[var(--surface-muted)]/80 px-2.5 py-2.5 dark:bg-[var(--surface-muted)]/50">
                {subtasksPreview.map((s) => {
                  const stBusy = subtaskUpdatingId === s.id;
                  return (
                    <li key={s.id} className="flex items-start gap-2.5 text-[13px] leading-snug">
                      <button
                        type="button"
                        disabled={stBusy}
                        onClick={() => void patchListSubtaskDone(task.id, s.id, !s.done)}
                        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
                          s.done
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--accent)]"
                        } ${stBusy ? "cursor-wait opacity-50" : ""}`}
                        aria-label={s.done ? "Mark subtask not done" : "Mark subtask done"}
                      >
                        {s.done ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : null}
                      </button>
                      <span className={`min-w-0 flex-1 ${s.done ? "text-[var(--muted)] line-through decoration-[var(--muted)]/80" : "text-[var(--fg)]"}`}>
                        {s.title}
                      </span>
                    </li>
                  );
                })}
                {subtasksOverflow > 0 && (
                  <li className="pt-0.5 text-[11px] text-[var(--muted)]">
                    +{subtasksOverflow} more on{" "}
                    <Link href={taskHref} className="font-medium text-[var(--accent)] hover:underline">
                      task page
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </li>
    );
  }

  function StatusSections({ rows }: { rows: TaskRow[] }) {
    return (
      <div className="space-y-6">
        {KANBAN_STATUS_ORDER.map((statusKey) => {
          const sectionRows = rows.filter((t) => normalizeTaskStatus(t.status) === statusKey);
          if (sectionRows.length === 0) return null;
          const open = listSectionsOpen[statusKey] !== false;
          return (
            <div
              key={statusKey}
              className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-sm"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-[var(--border-subtle)]/90 bg-[var(--surface-elevated)]/40 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]/50"
                onClick={() => setListSectionsOpen((prev) => ({ ...prev, [statusKey]: !open }))}
                aria-expanded={open}
              >
                <IconChevron open={open} className="text-[var(--muted)]" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fg)]">{STATUS_LABELS[statusKey]}</span>
                <span className="rounded-md bg-[var(--accent-muted)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--fg)]">
                  {sectionRows.length}
                </span>
              </button>
              {open && (
                <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full border-collapse text-left">
                    <tbody>{sectionRows.map((task) => (
                      <ListTaskRow key={task.id} task={task} />
                    ))}</tbody>
                  </table>
                </div>
              )}
              {open && (
                <div className="border-t border-[var(--border-subtle)]/80 px-4 py-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                    onClick={() => {
                      setNewTaskStatus(statusKey);
                      setCreateModalOpen(true);
                    }}
                  >
                    + Add task
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function KanbanBoard({ rows }: { rows: TaskRow[] }) {
    return (
      <div>
        <p className="mb-3 max-w-2xl text-[11px] leading-relaxed text-[var(--muted)]">
          Stages follow the workflow left to right. Drag a card to the next column, or change stage from the card — moves are limited to{" "}
          <span className="text-[var(--fg)]/90">one step at a time</span> (no skipping ahead).
        </p>
        <div className="overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] overscroll-x-contain">
          <div
            className="flex min-h-[min(72vh,38rem)] gap-4 md:min-h-[min(78vh,42rem)]"
            style={{ minWidth: "min(100%, 92rem)" }}
          >
            {KANBAN_STATUS_ORDER.map((col) => {
              const colTasks = rows.filter((t) => normalizeTaskStatus(t.status) === col);
              const label = STATUS_LABELS[col];
              return (
                <div
                  key={col}
                  role="region"
                  aria-label={`${label}, ${colTasks.length} tasks`}
                  className="flex min-h-0 min-w-[17rem] flex-1 flex-col gap-3 sm:min-w-[18rem]"
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
                  if (!kanbanTransitionAllowed(from, col)) {
                    setError("Move tasks one stage at a time along the pipeline.");
                    return;
                  }
                  void patchTask(id, { status: col });
                }}
                >
                  <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto">
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <header className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{NODE_LABELS.workItem}s</h1>
          <p className="mt-1 hidden text-sm text-[var(--muted)] sm:block">Switch layout, sort, and filter by due date.</p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:w-auto sm:justify-end">
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <div
              className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-0.5 shadow-sm"
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
                <IconLayoutList className="block" />
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
                <IconLayoutKanban className="block" />
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
              <IconArrowUpDown className="pointer-events-none block" />
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
              <IconCalendarDays className="pointer-events-none block" />
              {(datePreset !== "all" || dueFrom || dueTo) && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-elevated)]" aria-hidden />
              )}
            </button>
          </div>
          <button
            type="button"
            className="btn-primary min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
            onClick={() => setCreateModalOpen(true)}
          >
            + New task
          </button>
        </div>
      </header>

      {toolbarMenusMounted &&
        sortMenuOpen &&
        createPortal(
          <div
            ref={sortPanelRef}
            style={sortPanelStyle}
            className="surface-elevated flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] py-2 shadow-lg"
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
            className="surface-elevated flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] shadow-lg"
            role="dialog"
            aria-label="Due date filter"
          >
            <div className="max-h-[min(420px,85vh)] overflow-y-auto p-3">
              <div className="flex items-start justify-between gap-2">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Preset</span>
                  <select
                    className="input h-10 w-full rounded-lg text-sm"
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                  >
                    {DATE_PRESET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Due date range</p>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  className="input h-10 min-w-0 flex-1 rounded-lg text-sm"
                  value={dueFrom}
                  onChange={(e) => setDueFrom(e.target.value)}
                  aria-label="Due from"
                />
                <input
                  type="date"
                  className="input h-10 min-w-0 flex-1 rounded-lg text-sm"
                  value={dueTo}
                  onChange={(e) => setDueTo(e.target.value)}
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
        {selectedLevelName && (
          <p className="mb-3 text-xs text-[var(--muted)]">
            Showing tasks for {NODE_LABELS.level}: <span className="font-medium text-[var(--fg)]">{selectedLevelName}</span>
          </p>
        )}
        {selectedListName && (
          <p className="mb-3 text-xs text-[var(--muted)]">
            Showing list: <span className="font-medium text-[var(--fg)]">{selectedListName}</span>
          </p>
        )}
        {sortedTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center text-sm text-[var(--muted)]">
            {visibleTasks.length === 0
              ? selectedListName
                ? `No tasks yet in ${selectedListName}.`
                : selectedLevelName
                  ? `No tasks yet in ${selectedLevelName}.`
                  : "No tasks yet."
              : "No tasks match the current filters."}
          </p>
        ) : selectedList ? (
          viewMode === "list" ? (
            <StatusSections rows={sortedTasks} />
          ) : (
            <KanbanBoard rows={sortedTasks} />
          )
        ) : (
          <div className="space-y-8">
            {levelLists.map((list: ListRow) => {
              const rows = tasksByList.get(list.id) ?? [];
              if (rows.length === 0) return null;
              return (
                <section key={list.id} className="space-y-3">
                  <h3 className="text-sm font-semibold">{list.name}</h3>
                  {viewMode === "list" ? <StatusSections rows={rows} /> : <KanbanBoard rows={rows} />}
                </section>
              );
            })}
          </div>
        )}
      </section>

      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create task"
          onClick={() => setCreateModalOpen(false)}
        >
          <section
            className="surface-elevated w-full max-w-xl space-y-4 rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">New task</h2>
              <button type="button" className="btn-secondary rounded-lg px-3 py-1 text-xs" onClick={() => setCreateModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <input
                className="input rounded-xl text-base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a task"
              />
              <div className="rounded-xl border border-[var(--border-subtle)]">
                {subtaskItems.map((item, idx) => (
                  <div key={`${item}-${idx}`} className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0">
                    <span className="text-[var(--muted)]">○</span>
                    <span className="flex-1 text-sm">{item}</span>
                    <button
                      type="button"
                      className="text-xs text-[var(--muted)] hover:text-[var(--fg)]"
                      onClick={() => setSubtaskItems((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[var(--muted)]">+</span>
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    placeholder="Add subtask"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = subtaskDraft.trim();
                        if (v) {
                          setSubtaskItems((prev) => [...prev, v]);
                          setSubtaskDraft("");
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs"
                onClick={() => setShowAssignees((v) => !v)}
              >
                {showAssignees ? "Hide assignee" : "Add assignee"}
              </button>
              <button
                type="button"
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs"
                onClick={() => setShowDeadline((v) => !v)}
              >
                {showDeadline ? "Hide deadline" : "Add deadline"}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[var(--muted)]">Status</label>
                <select
                  className="input rounded-xl text-sm"
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value as BoardTaskStatus)}
                >
                  {KANBAN_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--muted)]">Priority</label>
                <select
                  className="input rounded-xl text-sm"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                >
                  {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => (
                    <option key={k} value={k}>
                      {PRIORITY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-[var(--muted)]">List</label>
                <select className="input rounded-xl" value={listId} onChange={(e) => setListId(e.target.value)}>
                  {levelLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {depts.find((d) => d.id === l.departmentId)?.name ?? "Unknown"} · {l.name}
                    </option>
                  ))}
                </select>
              </div>
              {showDeadline && (
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-[var(--muted)]">Deadline (optional)</label>
                    <input className="input rounded-xl" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[var(--muted)]">Repeat</label>
                    <select className="input rounded-xl" value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
              )}
              {showDeadline && repeat !== "none" && (
                <div className="sm:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--muted)]">
                  Repeat preference is set to {repeat}.
                </div>
              )}
              {showAssignees && members.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-medium text-[var(--muted)]">Assignees</p>
                  <div className="flex flex-wrap gap-3">
                    {members.map((m) => (
                      <label key={m.userId} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={assigneeIds.includes(m.userId)} onChange={() => toggleAssignee(m.userId)} />
                        <span>{m.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary rounded-xl px-4" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary rounded-xl px-4" onClick={() => void createTask()}>
                Create
              </button>
            </div>
          </section>
        </div>
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
