"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "@phosphor-icons/react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { workspaceKeys } from "@/lib/query-keys";
import { AssigneeSearchField } from "@/components/tasks/AssigneeSearchField";
import { DueDateTimePopover } from "@/components/tasks/DueDateTimePopover";
import { DueRepeatPopover } from "@/components/tasks/DueRepeatPopover";
import { TaskPanelAiFill } from "@/components/tasks/TaskPanelAiFill";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import {
  TASK_FLOW_ORDER,
  PRIORITY_LABELS,
  type ManualTaskStatus,
  type TaskPriority,
} from "@/lib/task-board";
import type { TaskDueRepeat, TaskMutationResult, TaskRow } from "@/lib/ledger-types";
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

function NewTaskInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useApiSession();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const { lists, members, depts } = useWorkspaceData();
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const initialListId = searchParams.get("listId") ?? "";

  const [listId, setListId] = useState(initialListId);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ManualTaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [due, setDue] = useState("");
  const [dueRepeat, setDueRepeat] = useState<TaskDueRepeat | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskItems, setSubtaskItems] = useState<string[]>([]);
  const [editingSubtaskIdx, setEditingSubtaskIdx] = useState<number | null>(null);
  const [editingSubtaskVal, setEditingSubtaskVal] = useState("");
  const [showAssignees, setShowAssignees] = useState(false);
  const [showDuePanel, setShowDuePanel] = useState(false);
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    if (!due.trim()) setDueRepeat(null);
  }, [due]);

  useEffect(() => {
    if (lists.length === 0) return;
    if (listId && lists.some((l) => l.id === listId)) return;
    setListId(lists[0]!.id);
  }, [lists, listId]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const applyAiFill = useCallback(
    (r: TaskAiFillResult) => {
      if (r.title !== null) setTitle(r.title);
      if (r.subtasks !== null) setSubtaskItems(r.subtasks);
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

  async function handleCreate() {
    if (!token || !workspaceId || !title.trim() || !listId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const dueIso = due.trim() ? new Date(due).toISOString() : undefined;
      const initialSubtasks = subtaskItems
        .map((t) => ({ title: t.trim() }))
        .filter((x) => x.title.length > 0);
      const created = await apiJson<TaskMutationResult>(`/organizations/${workspaceId}/tasks`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          listId,
          assigneeUserIds: assigneeIds,
          status,
          priority,
          ...(dueIso ? { dueAt: dueIso, dueRepeat: dueRepeat ?? null } : {}),
          ...(initialSubtasks.length > 0 ? { initialSubtasks } : {}),
        }),
      });
      const row: TaskRow = {
        ...created.task,
        assigneeUserIds: created.assigneeUserIds,
        subtasks: created.subtasks,
      };
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return { ...old, tasks: [row, ...old.tasks] };
      });
      router.push(`/${workspaceSlug}/work`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  }

  const assigneeNames = assigneeIds.map((id) => {
    const m = members.find((r) => r.userId === id);
    return (m?.name ?? "").trim() || (m?.email ?? "").trim() || "Unknown";
  });

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-5">
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
            Create Task
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
            disabled={saving || !title.trim() || !listId}
            onClick={() => void handleCreate()}
          >
            {saving && <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />}
            <span>{saving ? "Creating…" : "Create task"}</span>
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
              placeholder="What needs to be done?"
              autoFocus
              className="w-full resize-none bg-transparent p-0 text-2xl font-semibold leading-snug text-[var(--fg)] outline-none placeholder:text-[var(--muted)] border-b border-[var(--border-subtle)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />

            {/* Subtasks — flat checklist */}
            <div>
              <SectionLabel>
                Subtasks{subtaskItems.length > 0 ? ` (${subtaskItems.length})` : ""}
              </SectionLabel>
              <div className="space-y-0.5">
                {subtaskItems.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className="group flex items-center gap-2.5 py-1.5"
                >
                  <span className="text-sm text-[var(--muted)]">○</span>
                  {editingSubtaskIdx === idx ? (
                    <input
                      autoFocus
                      className="flex-1 bg-transparent text-sm text-[var(--fg)] outline-none"
                      value={editingSubtaskVal}
                      onChange={(e) => setEditingSubtaskVal(e.target.value)}
                      onBlur={() => {
                        const v = editingSubtaskVal.trim();
                        if (v) setSubtaskItems((prev) => prev.map((s, i) => i === idx ? v : s));
                        else setSubtaskItems((prev) => prev.filter((_, i) => i !== idx));
                        setEditingSubtaskIdx(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = editingSubtaskVal.trim();
                          if (v) setSubtaskItems((prev) => prev.map((s, i) => i === idx ? v : s));
                          else setSubtaskItems((prev) => prev.filter((_, i) => i !== idx));
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
                    onClick={() => setSubtaskItems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
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
                    setSubtaskItems((prev) => [...prev, v]);
                    setSubtaskDraft("");
                  }}
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
          </div>

        </div>

        {/* Right: properties */}
        <div className="w-full space-y-4 lg:w-72 lg:shrink-0">
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

            {/* List */}
            <div>
              <SectionLabel>List <span className="text-red-500">*</span></SectionLabel>
              <select
                className="input h-10 w-full rounded-xl text-sm"
                value={listId}
                disabled={saving}
                onChange={(e) => setListId(e.target.value)}
              >
                {lists.map((l) => {
                  const dept = depts.find((d) => d.id === l.departmentId);
                  return (
                    <option key={l.id} value={l.id}>
                      {dept ? `${dept.name} · ` : ""}{l.name}
                    </option>
                  );
                })}
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
        </div>
      </div>
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <NewTaskInner />
    </Suspense>
  );
}
