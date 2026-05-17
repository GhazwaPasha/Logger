"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import type { TaskRow } from "@/lib/ledger-types";
import { normalizeTaskStatus, storedStatusToFlowColumn } from "@/lib/task-board";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
  in_progress: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  done: "bg-green-500/20 text-green-700 dark:text-green-300",
  cancelled: "bg-neutral-500/20 text-neutral-600 dark:text-neutral-400",
};

function isoDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function taskDueDate(task: TaskRow): string | null {
  if (!task.dueAt) return null;
  return new Date(task.dueAt).toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const router = useRouter();
  const { workspaceSlug } = useWorkspaceRoute();
  const { tasks } = useWorkspaceData();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

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

  const activeTasks = useMemo(() => tasks.filter((t) => !t.deletedAt && t.dueAt), [tasks]);
  const noDateTasks = useMemo(() => tasks.filter((t) => !t.deletedAt && !t.dueAt), [tasks]);

  const tasksByDate = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of activeTasks) {
      const d = taskDueDate(t);
      if (!d) continue;
      const prev = m.get(d) ?? [];
      prev.push(t);
      m.set(d, prev);
    }
    return m;
  }, [activeTasks]);

  const todayStr = isoDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Tasks by due date. Click any task to open its detail panel.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium">
            ←
          </button>
          <span className="min-w-[9rem] text-center text-sm font-semibold">
            {MONTH_NAMES[month]} {year}
          </span>
          <button type="button" onClick={nextMonth} className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium">
            →
          </button>
          <button
            type="button"
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
            {DAY_NAMES.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {d}
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
                    className={`min-h-[7rem] border-b border-r border-[var(--border-subtle)] p-1.5 last:border-r-0 ${!day ? "bg-[var(--surface-muted)]/30" : ""} ${wi === weeks.length - 1 ? "border-b-0" : ""}`}
                  >
                    {day && (
                      <>
                        <div className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayTasks.slice(0, 3).map((t) => {
                            const col = storedStatusToFlowColumn(normalizeTaskStatus(t.status));
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => openTask(t.id)}
                                className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors hover:opacity-80 ${STATUS_CHIP[col] ?? ""}`}
                              >
                                <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority ?? "medium"] ?? "bg-slate-400"}`} aria-hidden />
                                <span className="min-w-0 truncate">{t.title}</span>
                              </button>
                            );
                          })}
                          {dayTasks.length > 3 && (
                            <p className="px-1 text-[10px] text-[var(--muted)]">+{dayTasks.length - 3} more</p>
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

        {/* No-date sidebar */}
        {noDateTasks.length > 0 && (
          <div className="w-52 shrink-0">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                No due date ({noDateTasks.length})
              </h3>
              <ul className="space-y-1">
                {noDateTasks.slice(0, 30).map((t) => {
                  const col = storedStatusToFlowColumn(normalizeTaskStatus(t.status));
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => openTask(t.id)}
                        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs leading-snug transition-colors hover:opacity-80 ${STATUS_CHIP[col] ?? ""}`}
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
