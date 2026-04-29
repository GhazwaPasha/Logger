"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import type { ListRow, SubtaskRow, TaskRow } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import {
  KANBAN_STATUS_ORDER,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type BoardTaskStatus,
  type DatePreset,
  type SortMode,
  type TaskPriority,
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

function IconCalendarPlus({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M12 14v6M9 17h6" />
    </svg>
  );
}

function IconFlag({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
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

function WorkItemsInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const levelPref = searchParams.get("level");
  const listPref = searchParams.get("list");
  const { token } = useApiSession();
  const { tasks, lists, members, depts, error, setError, reload } = useWorkspaceData();
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

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

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

  const patchTask = useCallback(
    async (taskId: string, patch: { status?: BoardTaskStatus; priority?: TaskPriority }) => {
      if (!token) return;
      setError(null);
      setUpdatingTaskId(taskId);
      try {
        await apiJson(`/tasks/${taskId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(patch),
        });
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update task");
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [token, reload, setError],
  );

  const toggleListRowExpand = useCallback(
    (taskId: string) => {
      setListRowExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(taskId)) {
          next.delete(taskId);
          return next;
        }
        next.add(taskId);
        return next;
      });

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
    [token, setError],
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update subtask");
      } finally {
        setSubtaskUpdatingId(null);
      }
    },
    [token, setError],
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
      await reload();
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

  function StatusSelect({ task, selectClassName }: { task: TaskRow; selectClassName?: string }) {
    const st = normalizeTaskStatus(task.status);
    const busy = updatingTaskId === task.id;
    return (
      <select
        className={selectClassName ?? "input h-8 max-w-[9.5rem] rounded-lg py-0 text-xs"}
        value={st}
        disabled={busy}
        onChange={(e) => void patchTask(task.id, { status: e.target.value as BoardTaskStatus })}
        aria-label="Task status"
      >
        {KANBAN_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    );
  }

  function PrioritySelect({ task, selectClassName }: { task: TaskRow; selectClassName?: string }) {
    const p = taskPriority(task);
    const busy = updatingTaskId === task.id;
    return (
      <select
        className={selectClassName ?? "input h-8 max-w-[7rem] rounded-lg py-0 text-xs"}
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
    );
  }

  function priorityClass(p: TaskPriority) {
    if (p === "high") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    if (p === "low") return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
    return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }

  const listTableSelect =
    "input h-8 w-full min-w-0 rounded-md border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-0 pl-2 pr-7 text-[11px] text-[var(--fg)] shadow-none";

  function ListTaskRow({ task }: { task: TaskRow }) {
    const dueText = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : null;
    const st = normalizeTaskStatus(task.status);
    const p = taskPriority(task);
    const busy = updatingTaskId === task.id;
    const canComplete = st !== "done" && st !== "cancelled";
    const expanded = listRowExpanded.has(task.id);
    const subtasksState = subtasksByTaskId[task.id];

    return (
      <>
        <tr className="border-b border-[var(--border-subtle)]/80 transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]/80">
          <td className="min-w-0 px-4 py-3 align-middle">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                disabled={busy || !canComplete}
                onClick={() => canComplete && void patchTask(task.id, { status: "done" })}
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  st === "done"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : st === "cancelled"
                      ? "border-[var(--border-subtle)] opacity-50"
                      : "border-[var(--border-subtle)] text-transparent hover:border-[var(--accent)]"
                } ${busy ? "cursor-wait opacity-60" : canComplete ? "cursor-pointer" : "cursor-default"}`}
                aria-label={st === "done" ? "Completed" : "Mark complete"}
              >
                {st === "done" ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </button>
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                aria-expanded={expanded}
                aria-label={expanded ? "Hide subtasks" : "Show subtasks"}
                onClick={() => toggleListRowExpand(task.id)}
              >
                <IconChevron open={expanded} className="opacity-80" />
              </button>
              <Link href={`/app/w/${workspaceId}/work/${task.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)] hover:underline">
                {task.title}
              </Link>
            </div>
          </td>
          <td className="hidden w-[8.5rem] px-3 py-3 align-middle sm:table-cell">
            <div className="flex items-center justify-center text-[var(--muted)]" title="Assignees (set when creating or on task page)">
              <IconUserPlus className="opacity-70" />
            </div>
          </td>
          <td className="w-[7.5rem] min-w-[7rem] px-3 py-3 align-middle text-center sm:w-[8.5rem]">
            {dueText ? (
              <span className="text-xs tabular-nums text-[var(--fg)]">{dueText}</span>
            ) : (
              <div className="flex justify-center text-[var(--muted)]">
                <IconCalendarPlus className="opacity-60" />
              </div>
            )}
          </td>
          <td className="w-[6.5rem] min-w-[6rem] px-3 py-3 align-middle">
            <div className="flex items-center gap-1.5">
              <IconFlag className={`hidden shrink-0 sm:block ${p === "high" ? "text-rose-400" : p === "low" ? "text-[var(--muted)]" : "text-amber-400/90"}`} />
              <PrioritySelect task={task} selectClassName={listTableSelect} />
            </div>
          </td>
        </tr>
        {expanded && (
          <tr className="border-b border-[var(--border-subtle)]/80 last:border-b-0">
            <td colSpan={4} className="bg-[var(--surface-base)] px-4 pb-3 pt-0">
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

  function TaskCard({ task }: { task: TaskRow }) {
    const dueText = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : null;
    const st = normalizeTaskStatus(task.status);
    const p = taskPriority(task);
    const busy = updatingTaskId === task.id;
    return (
      <li
        draggable={viewMode === "kanban"}
        onDragStart={(e) => {
          e.dataTransfer.setData("taskId", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className="surface-elevated space-y-2 rounded-xl border border-[var(--border-subtle)] px-3 py-3 shadow-sm"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/app/w/${workspaceId}/work/${task.id}`} className="text-sm font-medium hover:underline">
              {task.title}
            </Link>
            {dueText && <p className="mt-0.5 text-xs text-[var(--muted)]">Due {dueText}</p>}
          </div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityClass(p)}`}>
            {PRIORITY_LABELS[p]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect task={task} />
          <PrioritySelect task={task} />
          {st !== "done" && st !== "cancelled" && (
            <button
              type="button"
              className="btn-secondary rounded-lg px-2 py-1 text-[10px]"
              disabled={busy}
              onClick={() => void patchTask(task.id, { status: "done" })}
            >
              Mark done
            </button>
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="hidden w-[8.5rem] px-3 py-2.5 font-medium sm:table-cell">Assignee</th>
                        <th className="w-[7.5rem] px-3 py-2.5 font-medium sm:w-[8.5rem]">Due date</th>
                        <th className="w-[6.5rem] px-3 py-2.5 font-medium">Priority</th>
                      </tr>
                    </thead>
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
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_STATUS_ORDER.map((col) => {
          const colTasks = rows.filter((t) => normalizeTaskStatus(t.status) === col);
          return (
            <div
              key={col}
              className="flex w-64 min-w-[14rem] shrink-0 flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("taskId");
                if (!id) return;
                void patchTask(id, { status: col });
              }}
            >
              <div className="border-b border-[var(--border-subtle)] px-3 py-2">
                <h3 className="text-xs font-semibold text-[var(--fg)]">{STATUS_LABELS[col]}</h3>
                <p className="text-[10px] text-[var(--muted)]">{colTasks.length} tasks</p>
              </div>
              <ul className="max-h-[min(70vh,36rem)] flex-1 space-y-2 overflow-y-auto p-2">
                {colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{NODE_LABELS.workItem}s</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">List or Kanban view, priorities, statuses, and due-date filters.</p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--muted)]">View</span>
          <div className="inline-flex rounded-lg border border-[var(--border-subtle)] p-0.5">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === "list" ? "bg-[var(--accent-muted)] text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === "kanban" ? "bg-[var(--accent-muted)] text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
              onClick={() => setViewMode("kanban")}
            >
              Kanban
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Sort
            <select
              className="input h-9 rounded-lg py-0 text-xs"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="priority_desc">Priority · high first</option>
              <option value="priority_asc">Priority · low first</option>
              <option value="due_asc">Due date · soonest</option>
              <option value="due_desc">Due date · latest</option>
            </select>
          </label>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[14rem]">
          <span className="text-xs font-medium text-[var(--muted)]">Due date</span>
          <select
            className="input h-9 rounded-lg text-xs"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          >
            <option value="all">All dates</option>
            <option value="overdue">Overdue</option>
            <option value="this_week">Due this week</option>
            <option value="no_due">No due date</option>
          </select>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              className="input h-9 flex-1 min-w-[8rem] rounded-lg text-xs"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
              aria-label="Due from"
            />
            <input
              type="date"
              className="input h-9 flex-1 min-w-[8rem] rounded-lg text-xs"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
              aria-label="Due to"
            />
          </div>
          <p className="text-[10px] leading-snug text-[var(--muted)]">Optional range narrows tasks that have a due date.</p>
        </div>
        <button type="button" className="btn-primary shrink-0 rounded-xl px-5 sm:self-center" onClick={() => setCreateModalOpen(true)}>
          + New task
        </button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">{viewMode === "list" ? "List" : "Kanban"}</h2>
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
