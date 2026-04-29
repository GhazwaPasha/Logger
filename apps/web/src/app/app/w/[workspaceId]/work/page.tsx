"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import type { ListRow, TaskRow } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

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
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskItems, setSubtaskItems] = useState<string[]>([]);
  const [showAssignees, setShowAssignees] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">("none");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

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
    if (!listId || !levelLists.some((l) => l.id === listId)) {
      setListId(levelLists[0]!.id);
    }
  }, [lists, levelPref, listPref, listId]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addSubtaskDraft() {
    const value = subtaskDraft.trim();
    if (!value) return;
    setSubtaskItems((prev) => [...prev, value]);
    setSubtaskDraft("");
  }

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

  async function updateTaskStatus(taskId: string, status: "open" | "in_progress" | "done") {
    if (!token) return;
    setError(null);
    setUpdatingTaskId(taskId);
    try {
      await apiJson(`/tasks/${taskId}/status`, {
        method: "POST",
        token,
        body: JSON.stringify({ status }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update task status");
    } finally {
      setUpdatingTaskId(null);
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

  const tasksByList = visibleTasks.reduce<Map<string, TaskRow[]>>((map, task) => {
    const arr = map.get(task.listId) ?? [];
    arr.push(task);
    map.set(task.listId, arr);
    return map;
  }, new Map());

  function StatusGroup({ rows }: { rows: TaskRow[] }) {
    const openTasks = rows.filter((t) => t.status === "open");
    const inProgressTasks = rows.filter((t) => t.status === "in_progress");
    const doneTasks = rows.filter((t) => t.status === "done");
    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Open ({openTasks.length})</h3>
          {openTasks.length === 0 ? <p className="text-xs text-[var(--muted)]">Nothing open.</p> : <ul className="space-y-2">{openTasks.map((task) => <TaskChecklistRow key={task.id} task={task} />)}</ul>}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">In progress ({inProgressTasks.length})</h3>
          {inProgressTasks.length === 0 ? <p className="text-xs text-[var(--muted)]">Nothing in progress.</p> : <ul className="space-y-2">{inProgressTasks.map((task) => <TaskChecklistRow key={task.id} task={task} />)}</ul>}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Done ({doneTasks.length})</h3>
          {doneTasks.length === 0 ? <p className="text-xs text-[var(--muted)]">No completed tasks yet.</p> : <ul className="space-y-2">{doneTasks.map((task) => <TaskChecklistRow key={task.id} task={task} />)}</ul>}
        </div>
      </div>
    );
  }

  function TaskChecklistRow({ task }: { task: TaskRow }) {
    const dueText = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : null;
    const isBusy = updatingTaskId === task.id;
    return (
      <li className="surface-elevated flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-4 py-3 shadow-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={task.status === "done"}
          disabled={isBusy}
          onChange={(e) => void updateTaskStatus(task.id, e.target.checked ? "done" : "open")}
          aria-label={`Mark ${task.title} as done`}
        />
        <div className="min-w-0 flex-1">
          <Link href={`/app/w/${workspaceId}/work/${task.id}`} className="font-medium hover:underline">
            {task.title}
          </Link>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {task.status === "in_progress" ? "In progress" : task.status === "done" ? "Done" : "Open"}
            {dueText ? ` · due ${dueText}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {task.status !== "in_progress" && (
            <button
              type="button"
              className="btn-secondary rounded-lg px-3 py-1.5 text-xs"
              disabled={isBusy}
              onClick={() => void updateTaskStatus(task.id, "in_progress")}
            >
              Start
            </button>
          )}
          {task.status === "done" ? (
            <button
              type="button"
              className="btn-secondary rounded-lg px-3 py-1.5 text-xs"
              disabled={isBusy}
              onClick={() => void updateTaskStatus(task.id, "open")}
            >
              Reopen
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary rounded-lg px-3 py-1.5 text-xs"
              disabled={isBusy}
              onClick={() => void updateTaskStatus(task.id, "done")}
            >
              Done
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-10">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{NODE_LABELS.workItem}s</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Node 3 checklist: add tasks, tick them off, or move them to in-progress.
        </p>
      </div>
      <div className="flex justify-end">
        <button type="button" className="btn-primary rounded-xl px-5" onClick={() => setCreateModalOpen(true)}>
          + New task
        </button>
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Checklist</h2>
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
        {visibleTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center text-sm text-[var(--muted)]">
            {selectedListName ? `No tasks yet in ${selectedListName}.` : selectedLevelName ? `No tasks yet in ${selectedLevelName}.` : "No tasks yet."}
          </p>
        ) : (
          selectedList ? (
            <StatusGroup rows={visibleTasks} />
          ) : (
            <div className="space-y-6">
              {levelLists.map((list: ListRow) => {
                const rows = tasksByList.get(list.id) ?? [];
                if (rows.length === 0) return null;
                return (
                  <section key={list.id} className="space-y-3">
                    <h3 className="text-sm font-semibold">{list.name}</h3>
                    <StatusGroup rows={rows} />
                  </section>
                );
              })}
            </div>
          )
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
                        addSubtaskDraft();
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
