"use client";

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { DependencySection } from "@/components/tasks/DependencySection";
import { TimeTracker } from "@/components/tasks/TimeTracker";
import { AttachmentZone } from "@/components/tasks/AttachmentZone";
import { CommentThread } from "@/components/tasks/CommentThread";
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
    </label>
  );
}

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
  const titleRef = useRef<HTMLTextAreaElement>(null);

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
  const [editingSubtaskIdx, setEditingSubtaskIdx] = useState<number | null>(null);
  const [editingSubtaskVal, setEditingSubtaskVal] = useState("");
  const [editingExistingId, setEditingExistingId] = useState<string | null>(null);
  const [editingExistingVal, setEditingExistingVal] = useState("");
  const [editedSubtasks, setEditedSubtasks] = useState<Record<string, string>>({});
  const [deletedSubtaskIds, setDeletedSubtaskIds] = useState<Set<string>>(new Set());
  const [showAssignees, setShowAssignees] = useState(false);
  const [showDuePanel, setShowDuePanel] = useState(false);
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

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
    if (!titleTrim) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const prevIso = detail.task.dueAt ? new Date(detail.task.dueAt).toISOString() : null;
      const nextIso = due.trim() ? new Date(due).toISOString() : null;
      const duePatch = prevIso !== nextIso ? { dueAt: nextIso === null ? null : nextIso } : {};
      const subtasksToCreate = newSubtasks.map((st) => st.trim()).filter(Boolean).map((line) => ({ title: line }));
      const subtasksToUpdate = Object.entries(editedSubtasks)
        .map(([id, t]) => ({ id, title: t.trim() }))
        .filter((x) => x.title.length > 0);
      const subtasksToDelete = [...deletedSubtaskIds];
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
          ...(subtasksToUpdate.length > 0 ? { subtasksToUpdate } : {}),
          ...(subtasksToDelete.length > 0 ? { subtasksToDelete } : {}),
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

  async function handleArchive(id: string) {
    if (!token) return;
    try {
      await apiJson<TaskMutationResult>(`/tasks/${id}/archive`, { method: "POST", token });
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });
      router.push(`/${workspaceSlug}/work`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive task");
    }
  }

  if (isLoading && !detail) {
    return <div className="p-8 text-center text-sm text-[var(--muted)]">Loading task…</div>;
  }

  if (!detail) {
    return (
      <div className="p-8 text-center text-sm text-[var(--muted)]">
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
    return (m?.name ?? "").trim() || (m?.email ?? "").trim() || "Unknown";
  });

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-5">
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            onClick={() => router.push(`/${workspaceSlug}/work`)}
          >
            <ArrowLeft weight="bold" className="size-4" />
            Back
          </button>
          <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--fg)]">
            Edit Task
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            disabled={saving}
            onClick={() => router.push(`/${workspaceSlug}/work`)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving && <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />}
            <span>{saving ? "Saving…" : "Save changes"}</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Left: main content */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* AI fill — no card wrapper */}
          <TaskPanelAiFill
            members={members}
            existingDraft={{ title, dueLocal: due, dueRepeat }}
            onApply={applyAiFill}
          />

          {/* Title + subtasks — bordered section */}
          <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Task</h3>

            {/* Title — inline editing */}
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              disabled={saving}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full resize-none bg-transparent p-0 text-2xl font-semibold leading-snug text-[var(--fg)] outline-none placeholder:text-[var(--muted)] border-b border-[var(--border-subtle)]"
            />

            {/* Subtasks — flat checklist */}
            <div>
              <SectionLabel>
                {detail.subtasks.length > 0
                  ? `Subtasks — ${detail.subtasks.filter((s) => s.done).length}/${detail.subtasks.length} done`
                  : `Subtasks${newSubtasks.length > 0 ? ` (${newSubtasks.length})` : ""}`}
              </SectionLabel>
              <div className="space-y-0.5">
              {/* Existing subtasks */}
              {detail.subtasks.filter((item) => !deletedSubtaskIds.has(item.id)).map((item) => (
                <div key={item.id} className="group flex items-center gap-2.5 py-1.5">
                  <span className={`text-sm ${item.done ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]"}`}>
                    {item.done ? "✓" : "○"}
                  </span>
                  {editingExistingId === item.id ? (
                    <input
                      autoFocus
                      className="flex-1 bg-transparent text-sm text-[var(--fg)] outline-none"
                      value={editingExistingVal}
                      onChange={(e) => setEditingExistingVal(e.target.value)}
                      onBlur={() => {
                        const v = editingExistingVal.trim();
                        if (v && v !== item.title) setEditedSubtasks((prev) => ({ ...prev, [item.id]: v }));
                        setEditingExistingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = editingExistingVal.trim();
                          if (v && v !== item.title) setEditedSubtasks((prev) => ({ ...prev, [item.id]: v }));
                          setEditingExistingId(null);
                        }
                        if (e.key === "Escape") setEditingExistingId(null);
                      }}
                    />
                  ) : (
                    <span
                      className={`flex-1 cursor-text text-sm ${item.done ? "text-[var(--muted)] line-through" : "text-[var(--fg)]"}`}
                      onClick={() => {
                        setEditingExistingId(item.id);
                        setEditingExistingVal(editedSubtasks[item.id] ?? item.title);
                      }}
                    >
                      {editedSubtasks[item.id] ?? item.title}
                    </span>
                  )}
                  <button
                    type="button"
                    className="shrink-0 text-xs text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                    onClick={() => setDeletedSubtaskIds((prev) => new Set([...prev, item.id]))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {/* New subtasks being added */}
              {newSubtasks.map((item, idx) => (
                <div
                  key={`new-${idx}`}
                  className="group flex items-center gap-2.5 py-1.5"
                >
                  <span className="text-sm text-[var(--muted)]">+</span>
                  {editingSubtaskIdx === idx ? (
                    <input
                      autoFocus
                      className="flex-1 bg-transparent text-sm text-[var(--fg)] outline-none"
                      value={editingSubtaskVal}
                      onChange={(e) => setEditingSubtaskVal(e.target.value)}
                      onBlur={() => {
                        const v = editingSubtaskVal.trim();
                        if (v) setNewSubtasks((prev) => prev.map((s, i) => i === idx ? v : s));
                        else setNewSubtasks((prev) => prev.filter((_, i) => i !== idx));
                        setEditingSubtaskIdx(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = editingSubtaskVal.trim();
                          if (v) setNewSubtasks((prev) => prev.map((s, i) => i === idx ? v : s));
                          else setNewSubtasks((prev) => prev.filter((_, i) => i !== idx));
                          setEditingSubtaskIdx(null);
                        }
                        if (e.key === "Escape") setEditingSubtaskIdx(null);
                      }}
                    />
                  ) : (
                    <span
                      className="flex-1 cursor-text text-sm text-[var(--fg)]"
                      onClick={() => { setEditingSubtaskIdx(idx); setEditingSubtaskVal(item); }}
                    >
                      {item}
                    </span>
                  )}
                  <button
                    type="button"
                    className="shrink-0 text-xs text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                    onClick={() => setNewSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {/* Add subtask input */}
              <div className="flex items-center gap-2.5 py-1.5">
                <span className="text-sm text-[var(--muted)]">+</span>
                <input
                  className="flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder="Add a subtask…"
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
          </div>


          {/* Dependencies — no card wrapper */}
          {token && (
            <DependencySection
              taskId={taskId}
              token={token}
              allTasks={tasks}
              canEdit
              onOpenTask={(id) => router.push(`/${workspaceSlug}/work?task=${id}`)}
            />
          )}

          {/* Comments */}
          {token && sessionUserId && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5">
              <CommentThread
                taskId={taskId}
                token={token}
                userId={sessionUserId}
                members={members}
              />
            </div>
          )}
        </div>

        {/* Right: properties */}
        <div className="w-full space-y-4 lg:w-72 lg:shrink-0">
          {/* Core properties */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Properties</h2>

            {/* Status */}
            <div>
              <SectionLabel>Status</SectionLabel>
              <select
                className="input h-10 w-full rounded-xl text-sm"
                value={status}
                disabled={saving}
                onChange={(e) => setStatus(e.target.value as ManualTaskStatus)}
              >
                {TASK_FLOW_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS_FORM[s as ManualTaskStatus] ?? s}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <SectionLabel>Priority</SectionLabel>
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

            {/* Due date */}
            <div>
              <SectionLabel>Due date</SectionLabel>
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
              <SectionLabel>Assignees</SectionLabel>
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
          </div>

          {/* Time tracking */}
          {token && sessionUserId && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5">
              <TimeTracker taskId={taskId} token={token} userId={sessionUserId} />
            </div>
          )}

          {/* Attachments */}
          {token && sessionUserId && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5">
              <AttachmentZone taskId={taskId} token={token} userId={sessionUserId} />
            </div>
          )}

          {/* Danger zone */}
          {(caps.canDeleteTask || caps.canArchiveTask) && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 space-y-2">
              <h2 className="text-sm font-semibold text-[var(--fg)]">Danger zone</h2>
              {caps.canArchiveTask && (
                <button
                  type="button"
                  disabled={saving}
                  className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-left text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-hover)]"
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
              {caps.canDeleteTask && (
                <button
                  type="button"
                  disabled={saving}
                  className="w-full rounded-xl bg-red-600 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-red-700 dark:hover:bg-red-500"
                  onClick={() =>
                    setConfirm({
                      title: "Delete this task?",
                      description: "It will be permanently removed from the board.",
                      confirmLabel: "Delete task",
                      variant: "danger",
                      onConfirm: () => void handleArchive(taskId),
                    })
                  }
                >
                  Delete task
                </button>
              )}
            </div>
          )}
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
