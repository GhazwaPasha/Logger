"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import type { TaskRow } from "@/lib/ledger-types";
import { normalizeTaskStatus, storedStatusToFlowColumn } from "@/lib/task-board";
import { formatZonedDateKey, getZonedParts } from "@/lib/date";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { CalendarRoadmapStrip } from "@/components/roadmap/CalendarRoadmapStrip";
import { NODE_LABELS } from "@/lib/nodes";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-slate-500/15 dark:bg-slate-500/25",
  in_progress: "bg-blue-500/15 dark:bg-blue-500/25",
  done: "bg-green-500/15 dark:bg-green-500/25",
  cancelled: "bg-neutral-400/15 dark:bg-neutral-500/25",
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

type SortMode = "due_asc" | "due_desc" | "priority_desc" | "priority_asc" | "title_asc";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "due_asc", label: "Due · earliest first" },
  { value: "due_desc", label: "Due · latest first" },
  { value: "priority_desc", label: "Priority · high first" },
  { value: "priority_asc", label: "Priority · low first" },
  { value: "title_asc", label: "Title · A–Z" },
];

function isoDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function taskDueDate(task: TaskRow, timeZone: string): string | null {
  if (!task.dueAt) return null;
  return formatZonedDateKey(new Date(task.dueAt), timeZone);
}

function sortDayTasks(tasks: TaskRow[], mode: SortMode): TaskRow[] {
  const sorted = [...tasks];
  switch (mode) {
    case "priority_desc":
      return sorted.sort((a, b) => (PRIORITY_ORDER[a.priority ?? "medium"] ?? 1) - (PRIORITY_ORDER[b.priority ?? "medium"] ?? 1));
    case "priority_asc":
      return sorted.sort((a, b) => (PRIORITY_ORDER[b.priority ?? "medium"] ?? 1) - (PRIORITY_ORDER[a.priority ?? "medium"] ?? 1));
    case "title_asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "due_asc":
      return sorted.sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
    case "due_desc":
      return sorted.sort((a, b) => new Date(b.dueAt!).getTime() - new Date(a.dueAt!).getTime());
    default:
      return sorted;
  }
}

export default function CalendarPage() {
  const router = useRouter();
  const { workspaceSlug, timeZone } = useWorkspaceRoute();
  const { tasks, lists, depts, members } = useWorkspaceData();

  const today = getZonedParts(new Date(), timeZone);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month - 1);

  // Filters
  const [filterDept, setFilterDept] = useState("");
  const [filterList, setFilterList] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("due_asc");

  const prevMonth = useCallback(() => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }, [month]);

  const openTask = useCallback((id: string) => {
    router.push(`/${workspaceSlug}/work?task=${encodeURIComponent(id)}`);
  }, [router, workspaceSlug]);

  const handleDeptChange = useCallback((deptId: string) => {
    setFilterDept(deptId);
    if (deptId && filterList) {
      const listStillValid = lists.some((l) => l.id === filterList && l.departmentId === deptId);
      if (!listStillValid) setFilterList("");
    }
  }, [lists, filterList]);

  const clearFilters = useCallback(() => {
    setFilterDept("");
    setFilterList("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterAssignee("");
  }, []);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  // Dropdown options
  const deptOptions = useMemo(() => [
    { value: "", label: "All Departments" },
    ...depts.map((d) => ({ value: d.id, label: d.name })),
  ], [depts]);

  const visibleLists = useMemo(() =>
    filterDept ? lists.filter((l) => l.departmentId === filterDept) : lists,
    [lists, filterDept]
  );

  const listOptions = useMemo(() => [
    { value: "", label: `All ${NODE_LABELS.list}s` },
    ...visibleLists.map((l) => ({ value: l.id, label: l.name })),
  ], [visibleLists]);

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "To Do" },
    { value: "in_progress", label: "In Progress" },
    { value: "done", label: "Done" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const priorityOptions = [
    { value: "", label: "All Priorities" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const assigneeOptions = useMemo(() => [
    { value: "", label: "All Assignees" },
    ...members.map((m) => ({ value: m.userId, label: m.name })),
  ], [members]);

  const activeFilterCount = [filterDept, filterList, filterStatus, filterPriority, filterAssignee].filter(Boolean).length;

  // Filter tasks
  const filteredBaseTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt) return false;
      if (filterList) {
        if (t.listId !== filterList) return false;
      } else if (filterDept) {
        if (!visibleLists.some((l) => l.id === t.listId)) return false;
      }
      if (filterStatus) {
        const col = storedStatusToFlowColumn(normalizeTaskStatus(t.status));
        if (col !== filterStatus) return false;
      }
      if (filterPriority && (t.priority ?? "medium") !== filterPriority) return false;
      if (filterAssignee && !(t.assigneeUserIds ?? []).includes(filterAssignee)) return false;
      return true;
    });
  }, [tasks, filterList, filterDept, visibleLists, filterStatus, filterPriority, filterAssignee]);

  const activeTasks = useMemo(() => filteredBaseTasks.filter((t) => t.dueAt), [filteredBaseTasks]);
  const noDateTasks = useMemo(() => filteredBaseTasks.filter((t) => !t.dueAt), [filteredBaseTasks]);

  const tasksByDate = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of activeTasks) {
      const d = taskDueDate(t, timeZone);
      if (!d) continue;
      const prev = m.get(d) ?? [];
      prev.push(t);
      m.set(d, prev);
    }
    for (const [key, dayTasks] of m.entries()) {
      m.set(key, sortDayTasks(dayTasks, sortMode));
    }
    return m;
  }, [activeTasks, sortMode, timeZone]);

  const todayStr = isoDateStr(today.year, today.month - 1, today.day);

  const dropdownClass = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]";

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Calendar</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Tasks by due date. Click any task to open its detail panel.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium">←</button>
          <span className="min-w-[8rem] text-center text-sm font-semibold sm:min-w-[9rem]">
            {MONTH_NAMES[month]} {year}
          </span>
          <button type="button" onClick={nextMonth} className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium">→</button>
          <button
            type="button"
            onClick={() => { setYear(today.year); setMonth(today.month - 1); }}
            className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            Today
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {depts.length > 0 && (
          <SelectPopover
            value={filterDept}
            onChange={handleDeptChange}
            options={deptOptions}
            triggerClassName={`${dropdownClass}${filterDept ? " border-[var(--accent)] text-[var(--fg)]" : ""}`}
            aria-label="Filter by department"
          />
        )}
        {lists.length > 0 && (
          <SelectPopover
            value={filterList}
            onChange={setFilterList}
            options={listOptions}
            triggerClassName={`${dropdownClass}${filterList ? " border-[var(--accent)] text-[var(--fg)]" : ""}`}
            aria-label="Filter by list"
          />
        )}
        <SelectPopover
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusOptions}
          triggerClassName={`${dropdownClass}${filterStatus ? " border-[var(--accent)] text-[var(--fg)]" : ""}`}
          aria-label="Filter by status"
        />
        <SelectPopover
          value={filterPriority}
          onChange={setFilterPriority}
          options={priorityOptions}
          triggerClassName={`${dropdownClass}${filterPriority ? " border-[var(--accent)] text-[var(--fg)]" : ""}`}
          aria-label="Filter by priority"
        />
        {members.length > 0 && (
          <SelectPopover
            value={filterAssignee}
            onChange={setFilterAssignee}
            options={assigneeOptions}
            triggerClassName={`${dropdownClass}${filterAssignee ? " border-[var(--accent)] text-[var(--fg)]" : ""}`}
            aria-label="Filter by assignee"
          />
        )}

        {/* Divider */}
        <div className="h-5 w-px bg-[var(--border-subtle)]" aria-hidden />

        <SelectPopover
          value={sortMode}
          onChange={setSortMode}
          options={SORT_OPTIONS}
          triggerClassName={dropdownClass}
          aria-label="Sort tasks"
        />

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
          >
            Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      <CalendarRoadmapStrip year={year} month={month} />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Calendar grid */}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <div className="min-w-[280px]">
            <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
              {DAY_NAMES.map((d, i) => (
                <div key={d} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:px-2">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{DAY_NAMES_SHORT[i]}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {weeks.flatMap((week, wi) =>
                week.map((day, di) => {
                  const dateStr = day ? isoDateStr(year, month, day) : null;
                  const dayTasks = dateStr ? (tasksByDate.get(dateStr) ?? []) : [];
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={`${wi}-${di}`}
                      className={`min-h-[4.5rem] border-b border-r border-[var(--border-subtle)] p-1 last:border-r-0 sm:min-h-[7rem] sm:p-1.5 ${!day ? "bg-[var(--surface-muted)]/30" : ""} ${wi === weeks.length - 1 ? "border-b-0" : ""}`}
                    >
                      {day && (
                        <>
                          <div className={`mb-1 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold sm:size-6 sm:text-xs ${isToday ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)]"}`}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {dayTasks.slice(0, 3).map((t, idx) => {
                              const col = storedStatusToFlowColumn(normalizeTaskStatus(t.status));
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => openTask(t.id)}
                                  className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight text-[var(--fg)] transition-colors hover:opacity-80 ${STATUS_CHIP[col] ?? ""} ${idx >= 1 ? "hidden sm:flex" : ""}`}
                                >
                                  <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority ?? "medium"] ?? "bg-slate-400"}`} aria-hidden />
                                  <span className="min-w-0 truncate">{t.title}</span>
                                </button>
                              );
                            })}
                            {dayTasks.length > 3 && (
                              <p className="hidden px-1 text-[10px] text-[var(--muted)] sm:block">+{dayTasks.length - 3} more</p>
                            )}
                            {dayTasks.length > 1 && (
                              <p className="px-1 text-[10px] text-[var(--muted)] sm:hidden">+{dayTasks.length - 1}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* No-date sidebar */}
        {noDateTasks.length > 0 && (
          <div className="w-full lg:w-52 lg:shrink-0">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                No due date ({noDateTasks.length})
              </h3>
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
                {noDateTasks.slice(0, 30).map((t) => {
                  const col = storedStatusToFlowColumn(normalizeTaskStatus(t.status));
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => openTask(t.id)}
                        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs leading-snug text-[var(--fg)] transition-colors hover:opacity-80 ${STATUS_CHIP[col] ?? ""}`}
                      >
                        <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority ?? "medium"] ?? "bg-slate-400"}`} aria-hidden />
                        <span className="min-w-0 truncate">{t.title}</span>
                      </button>
                    </li>
                  );
                })}
                {noDateTasks.length > 30 && (
                  <li className="px-2 text-[10px] text-[var(--muted)]">+{noDateTasks.length - 30} more</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
