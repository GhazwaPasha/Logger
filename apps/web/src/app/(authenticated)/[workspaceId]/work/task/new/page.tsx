"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CaretDoubleUp, CaretDoubleDown, ArrowLineUp } from "@phosphor-icons/react";
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
  statusPillPaletteClasses,
  type ManualTaskStatus,
  type TaskPriority,
} from "@/lib/task-board";
import { SelectPopover } from "@/components/ui/SelectPopover";
import type { TaskDueRepeat, TaskMutationResult, TaskRow, MemberRow } from "@/lib/ledger-types";

function memberInitials(m: MemberRow): string {
  const n = m.name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  }
  return (m.email ?? "??").slice(0, 2).toUpperCase();
}
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import type { TaskAiFillResult } from "@/lib/task-ai-fill";

const STATUS_LABELS_FORM: Record<ManualTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
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
              className="w-full resize-none overflow-hidden bg-transparent p-0 text-2xl font-semibold leading-snug text-[var(--fg)] outline-none placeholder:text-[var(--muted)] border-b border-[var(--border-subtle)] [&::-webkit-scrollbar]:hidden"
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

            {/* Status + Priority */}
            <div>
              <SectionLabel>Status &amp; Priority</SectionLabel>
              <div className="flex flex-wrap items-center gap-2">
                <SelectPopover
                  value={status}
                  onChange={(v) => setStatus(v as ManualTaskStatus)}
                  options={TASK_FLOW_ORDER.map((s) => ({ value: s, label: STATUS_LABELS_FORM[s as ManualTaskStatus] ?? s }))}
                  disabled={saving}
                  triggerClassName={`inline-flex min-w-[7.5rem] justify-center rounded-lg px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${statusPillPaletteClasses(status)}`}
                  showChevron={false}
                  aria-label="Status"
                />
                {(() => {
                  const color = priority === "high"
                    ? "text-amber-500 dark:text-amber-400"
                    : priority === "low"
                      ? "text-sky-500 dark:text-sky-400"
                      : "text-[var(--muted)]";
                  const icon = priority === "high" ? <CaretDoubleUp size={14} weight="fill" /> : priority === "low" ? <CaretDoubleDown size={14} weight="fill" /> : <ArrowLineUp size={14} weight="bold" />;
                  return (
                    <SelectPopover
                      value={priority}
                      onChange={(v) => setPriority(v as TaskPriority)}
                      options={(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => ({ value: k, label: PRIORITY_LABELS[k] }))}
                      disabled={saving}
                      triggerClassName={`inline-flex min-w-[6rem] items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 ${color}`}
                      triggerContent={
                        <>
                          <span aria-hidden>{icon}</span>
                          <span className="text-sm font-semibold">{PRIORITY_LABELS[priority]}</span>
                        </>
                      }
                      showChevron={false}
                      aria-label="Priority"
                    />
                  );
                })()}
              </div>
            </div>

            {/* List */}
            <div>
              <SectionLabel>List <span className="text-red-500">*</span></SectionLabel>
              <SelectPopover
                value={listId}
                onChange={setListId}
                options={lists.map((l) => {
                  const dept = depts.find((d) => d.id === l.departmentId);
                  return { value: l.id, label: dept ? `${dept.name} · ${l.name}` : l.name };
                })}
                disabled={saving}
                triggerClassName="inline-flex w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="List"
              />
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
              <div className="flex flex-wrap items-center gap-1.5">
                {assigneeIds.map((id) => {
                  const m = members.find((r) => r.userId === id);
                  if (!m) return null;
                  const name = (m.name ?? "").trim() || (m.email ?? "").trim() || "Unknown";
                  const initials = memberInitials(m);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] py-1 pl-1.5 pr-2 text-sm font-medium text-[var(--fg)]"
                    >
                      {m.image ? (
                        <img src={m.image} alt="" className="size-5 shrink-0 rounded-full object-cover" aria-hidden />
                      ) : (
                        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[10px] font-semibold uppercase tracking-tight text-[var(--fg)]" aria-hidden>
                          {initials}
                        </span>
                      )}
                      {name}
                      <button
                        type="button"
                        className="shrink-0 leading-none text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                        onClick={() => toggleAssignee(id)}
                        aria-label={`Remove ${name}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                  onClick={() => setShowAssignees((v) => !v)}
                >
                  {assigneeIds.length === 0 ? "Add assignee" : "+ Add"}
                </button>
              </div>
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
