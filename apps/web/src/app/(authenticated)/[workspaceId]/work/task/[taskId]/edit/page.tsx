"use client";

import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "@phosphor-icons/react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { workspaceKeys, taskKeys } from "@/lib/query-keys";
import { AssigneeSearchField } from "@/components/tasks/AssigneeSearchField";
import { DueDateTimePopover } from "@/components/tasks/DueDateTimePopover";
import { DueRepeatPopover } from "@/components/tasks/DueRepeatPopover";
import { TaskPanelAiFill } from "@/components/tasks/TaskPanelAiFill";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { taskArchiveDeleteCaps } from "@/lib/workspace-permissions";
import {
  TASK_FLOW_ORDER,
  PRIORITY_LABELS,
  type ManualTaskStatus,
  type TaskPriority,
  manualStatusFromStored,
  normalizeTaskStatus,
  taskPriority,
} from "@/lib/task-board";
import {
  parseTaskDueRepeat,
  type TaskDueRepeat,
  type TaskDetail,
  type TaskMutationResult,
} from "@/lib/ledger-types";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import type { TaskAiFillResult } from "@/lib/task-ai-fill";

const STATUS_LABELS_FORM: Record<ManualTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

function dueAtToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditTaskInner() {
  const params = useParams();
  const taskId = params.taskId as string;
  const router = useRouter();
  const { token, session } = useApiSession();
  const sessionUserId = session?.user?.id ?? null;
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const { tasks, lists, members } = useWorkspaceData();

  const taskFromList = useMemo(() => tasks.find((t) => t.id === taskId) ?? null, [tasks, taskId]);
  const placeholderCtx = useMemo(() => ({ lists, members, userId: sessionUserId }), [lists, members, sessionUserId]);
  const { detail, isLoading } = useTaskDetail(token, taskId, taskFromList, placeholderCtx);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ManualTaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [due, setDue] = useState("");
  const [dueRepeat, setDueRepeat] = useState<TaskDueRepeat | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
  const [showAssignees, setShowAssignees] = useState(false);
  const [showDuePanel, setShowDuePanel] = useState(false);
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Populate form from task detail (only once after first load)
  useEffect(() => {
    if (!detail || initialized) return;
    setTitle(detail.task.title);
    setAssigneeIds([...detail.assigneeUserIds]);
    setDue(dueAtToLocalInput(detail.task.dueAt));
    setDueRepeat(parseTaskDueRepeat(detail.task.dueRepeat));
    setStatus(manualStatusFromStored(normalizeTaskStatus(detail.task.status)));
    setPriority(taskPriority(detail.task));
    setInitialized(true);
  }, [detail, initialized]);

  useEffect(() => {
    if (!due.trim()) setDueRepeat(null);
  }, [due]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const applyAiFill = useCallback(
    (r: TaskAiFillResult) => {
      if (r.title !== null) setTitle(r.title);
      if (r.subtasks !== null) {
        if (r.subtasks.length === 0) setNewSubtasks([]);
        else {
          setNewSubtasks((prev) => {
            const next = [...prev];
            for (const line of r.subtasks!) {
              if (!next.includes(line)) next.push(line);
            }
            return next;
          });
        }
      }
      if (r.assigneeUserIds !== null) setAssigneeIds(r.assigneeUserIds);
      if (r.status !== null) setStatus(r.status);
      if (r.priority !== null) setPriority(r.priority);
      if (r.dueLocal !== null) {
        setDue(r.dueLocal);
        if (!r.dueLocal.trim()) setDueRepeat(null);
      }
      if (r.dueRepeat !== null) {
        if (r.dueRepeat === "none") {
          setDueRepeat(null);
        } else {
          const effectiveDue = r.dueLocal !== null ? r.dueLocal : due;
          if (effectiveDue.trim().length > 0) setDueRepeat(r.dueRepeat);
          else setDueRepeat(null);
        }
      }
    },
    [due],
  );

  async function handleSave() {
    if (!token || !detail || saving) return;
    const titleTrim = title.trim();
    if (!titleTrim) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const prevIso = detail.task.dueAt ? new Date(detail.task.dueAt).toISOString() : null;
      const nextIso = due.trim() ? new Date(due).toISOString() : null;
      const duePatch = prevIso !== nextIso ? { dueAt: nextIso === null ? null : nextIso } : {};
      const subtasksToCreate = newSubtasks
        .map((st) => st.trim())
        .filter(Boolean)
        .map((line) => ({ title: line }));
      const saved = await apiJson<TaskMutationResult>(`/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          title: titleTrim,
          status,
          priority,
          assigneeUserIds: assigneeIds,
          dueRepeat,
          ...duePatch,
          ...(subtasksToCreate.length > 0 ? { subtasksToCreate } : {}),
        }),
      });
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id !== taskId
              ? t
              : { ...t, ...saved.task, assigneeUserIds: saved.assigneeUserIds, subtasks: saved.subtasks },
          ),
        };
      });
      queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), (old) => {
        if (!old) return old;
        return {
          ...old,
          task: { ...old.task, ...saved.task },
          assigneeUserIds: saved.assigneeUserIds,
          subtasks: saved.subtasks,
          capabilities: saved.capabilities,
          ledger: [...saved.ledgerDelta, ...old.ledger],
        };
      });
      if (saved.spawnedRecurringTaskId) {
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      }
      router.push(`/${workspaceSlug}/work`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(taskId: string) {
    if (!token) return;
    try {
      await apiJson<TaskMutationResult>(`/tasks/${taskId}/archive`, { method: "POST", token });
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
      router.push(`/${workspaceSlug}/work`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive task");
    }
  }

  if (isLoading && !detail) {
    return (
      <div className="mx-auto w-full max-w-2xl py-16 text-center text-sm text-[var(--muted)]">
        Loading task…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-2xl py-16 text-center text-sm text-[var(--muted)]">
        Task not found.{" "}
        <button
          type="button"
          className="text-[var(--accent)] underline"
          onClick={() => router.push(`/${workspaceSlug}/work`)}
        >
          Back to board
        </button>
      </div>
    );
  }

  const caps = taskArchiveDeleteCaps(detail.task, lists, sessionUserId, members);
  const assigneeNames = assigneeIds.map((id) => {
    const m = members.find((r) => r.userId === id);
    return ((m?.name ?? "").trim() || (m?.email ?? "").trim() || "Unknown");
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-6">
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />

      {/* Back nav */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        onClick={() => router.push(`/${workspaceSlug}/work`)}
      >
        <ArrowLeft weight="bold" className="size-4" />
        Back to board
      </button>

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 space-y-5">
        <h1 className="text-lg font-semibold text-[var(--fg)]">Edit task</h1>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        {/* AI fill */}
        <TaskPanelAiFill
          members={members}
          existingDraft={{ title, dueLocal: due, dueRepeat }}
          onApply={applyAiFill}
        />

        {/* Title */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            className="input rounded-xl text-base"
            value={title}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
        </div>

        {/* Existing subtasks (read-only) */}
        {detail.subtasks.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Existing subtasks
            </label>
            <div className="rounded-xl border border-[var(--border-subtle)]">
              {detail.subtasks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0"
                >
                  <span className={`text-sm ${item.done ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]"}`}>
                    {item.done ? "✓" : "○"}
                  </span>
                  <span className={`flex-1 text-sm ${item.done ? "text-[var(--muted)] line-through" : "text-[var(--fg)]"}`}>
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new subtasks */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Add subtasks
          </label>
          <div className="rounded-xl border border-[var(--border-subtle)]">
            {newSubtasks.map((item, idx) => (
              <div
                key={`new-${idx}`}
                className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0"
              >
                <span className="text-[var(--muted)]">+</span>
                <span className="flex-1 text-sm text-[var(--fg)]">{item}</span>
                <button
                  type="button"
                  className="text-xs text-[var(--muted)] hover:text-red-500"
                  onClick={() => setNewSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-[var(--muted)]">+</span>
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                placeholder="Add new subtask…"
                onBlur={() => {
                  const v = subtaskDraft.trim();
                  if (!v) return;
                  setNewSubtasks((prev) => [...prev, v]);
                  setSubtaskDraft("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = subtaskDraft.trim();
                    if (v) {
                      setNewSubtasks((prev) => [...prev, v]);
                      setSubtaskDraft("");
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Status + Priority */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Status
            </label>
            <select
              className="input h-10 w-full rounded-xl text-sm"
              value={status}
              disabled={saving}
              onChange={(e) => setStatus(e.target.value as ManualTaskStatus)}
            >
              {TASK_FLOW_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS_FORM[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Priority
            </label>
            <select
              className="input h-10 w-full rounded-xl text-sm"
              value={priority}
              disabled={saving}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => (
                <option key={k} value={k}>
                  {PRIORITY_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Due date + repeat */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Due date
          </label>
          <div className="flex flex-wrap gap-2">
            <DueDateTimePopover
              open={showDuePanel}
              onOpenChange={(o) => {
                setShowDuePanel(o);
                if (o) setShowRepeatPanel(false);
              }}
              value={due}
              onChange={setDue}
              onClear={() => {
                setDue("");
                setDueRepeat(null);
              }}
            />
            <DueRepeatPopover
              open={showRepeatPanel}
              onOpenChange={(o) => {
                setShowRepeatPanel(o);
                if (o) setShowDuePanel(false);
              }}
              dueLocalValue={due}
              value={dueRepeat}
              onChange={setDueRepeat}
            />
          </div>
        </div>

        {/* Assignees */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Assignees
          </label>
          <button
            type="button"
            className="btn-secondary min-w-0 max-w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium"
            onClick={() => setShowAssignees((v) => !v)}
          >
            {assigneeNames.length === 0
              ? "Add assignee"
              : assigneeNames.length === 1
                ? assigneeNames[0]
                : `${assigneeNames[0]} +${assigneeNames.length - 1}`}
          </button>
          {showAssignees && (
            <div className="mt-2">
              <AssigneeSearchField
                members={members}
                assigneeIds={assigneeIds}
                onToggleAssignee={toggleAssignee}
              />
            </div>
          )}
        </div>

        {/* Danger zone: delete / archive */}
        {(caps.canDeleteTask || caps.canArchiveTask) && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
            {caps.canDeleteTask && (
              <button
                type="button"
                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:hover:bg-red-500"
                disabled={saving}
                onClick={() =>
                  setConfirm({
                    title: "Delete this task?",
                    description:
                      "It will be removed from the board. You can still rely on exports or backups outside LogBase if you need a record.",
                    confirmLabel: "Delete task",
                    variant: "danger",
                    onConfirm: () => void handleArchive(taskId),
                  })
                }
              >
                Delete task
              </button>
            )}
            {caps.canArchiveTask && (
              <button
                type="button"
                className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                disabled={saving}
                onClick={() =>
                  setConfirm({
                    title: "Archive this task?",
                    description: "It will be hidden from the board and treated as archived.",
                    confirmLabel: "Archive",
                    variant: "default",
                    onConfirm: () => void handleArchive(taskId),
                  })
                }
              >
                Archive task
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          <button
            type="button"
            className="btn-secondary rounded-xl px-5"
            disabled={saving}
            onClick={() => router.push(`/${workspaceSlug}/work`)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary inline-flex min-w-[7rem] items-center justify-center gap-2 rounded-xl px-5"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving && <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />}
            <span>{saving ? "Saving…" : "Save changes"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditTaskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <EditTaskInner />
    </Suspense>
  );
}
