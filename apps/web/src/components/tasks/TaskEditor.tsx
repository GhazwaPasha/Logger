"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CaretDoubleUp, CaretDoubleDown, ArrowLineUp } from "@phosphor-icons/react";
import { apiJson, apiVoid } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useTaskFormNavigationGuard } from "@/hooks/useTaskFormNavigationGuard";
import { useTaskEditorForm } from "@/hooks/useTaskEditorForm";
import { useDiscordChannels } from "@/hooks/useDiscordChannels";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { AssigneeSearchField } from "@/components/tasks/AssigneeSearchField";
import { DiscordChannelSearchField } from "@/components/tasks/DiscordChannelSearchField";
import { DueDateTimePopover } from "@/components/tasks/DueDateTimePopover";
import { DueRepeatPopover } from "@/components/tasks/DueRepeatPopover";
import { TaskPanelAiFill } from "@/components/tasks/TaskPanelAiFill";
import { DependencySection } from "@/components/tasks/DependencySection";
import { MilestoneLinkSection } from "@/components/tasks/MilestoneLinkSection";
import { TimeTracker } from "@/components/tasks/TimeTracker";
import { AttachmentZone } from "@/components/tasks/AttachmentZone";
import { DiscordSubmissionZone } from "@/components/tasks/DiscordSubmissionZone";
import { CommentThread } from "@/components/tasks/CommentThread";
import { TaskFormSyncIndicator } from "@/components/tasks/TaskFormSyncIndicator";
import { TaskSubtaskList } from "@/components/tasks/TaskSubtaskList";
import { useTaskSubtasks } from "@/hooks/useTaskSubtasks";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { Toggle } from "@/components/ui/Toggle";
import { isWorkspaceOwner, taskEditCaps } from "@/lib/workspace-permissions";
import { memberInitials } from "@/lib/member-utils";
import {
  TASK_FLOW_ORDER,
  PRIORITY_LABELS,
  statusPillPaletteClasses,
  type ManualTaskStatus,
  type TaskPriority,
} from "@/lib/task-board";
import { parseTaskDueRepeat, type TaskMutationResult } from "@/lib/ledger-types";
import type { TaskAiFillResult } from "@/lib/task-ai-fill";
import {
  hasMeaningfulTitle,
  isDefaultTaskTitle,
  TASK_TITLE_PLACEHOLDER,
} from "@/lib/task-default-title";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";

const STATUS_LABELS_FORM: Record<ManualTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const REPEAT_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function formatDueDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
    </label>
  );
}

export type TaskEditorProps = {
  taskId: string;
};

export function TaskEditor({ taskId }: TaskEditorProps) {
  const router = useRouter();
  const { token, session } = useApiSession();
  const sessionUserId = session?.user?.id ?? null;
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const { tasks, lists, members } = useWorkspaceData();
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [showAssignees, setShowAssignees] = useState(false);
  const [showDuePanel, setShowDuePanel] = useState(false);
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);
  const [discordEnabled, setDiscordEnabled] = useState(false);

  const goToWork = useCallback(() => router.push(`/${workspaceSlug}/work`), [router, workspaceSlug]);

  const taskFromList = tasks.find((t) => t.id === taskId) ?? null;
  const { detail, isLoading } = useTaskDetail(token, taskId, taskFromList, { lists, members, userId: sessionUserId }, {
    formSession: true,
  });
  const subtaskOps = useTaskSubtasks(taskId, token, workspaceId);

  const form = useTaskEditorForm({ taskId, workspaceId, token, detail });
  const isOwner = isWorkspaceOwner(members, sessionUserId);
  const discordChannels = useDiscordChannels(isOwner ? token : null, workspaceId);
  const discordChannelOptions = discordChannels.data ?? [];

  useEffect(() => {
    if (form.initialized) setDiscordEnabled(Boolean(form.discordChannelId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.initialized]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.title]);

  const focusTitleOnOpen = detail ? isDefaultTaskTitle(detail.task.title) : false;
  useEffect(() => {
    if (focusTitleOnOpen && form.initialized) {
      titleRef.current?.focus();
    }
  }, [focusTitleOnOpen, form.initialized]);

  const hasUnsavedChanges = form.hasUnsavedChanges || subtaskOps.isPending;
  const requiresTitle = !hasMeaningfulTitle(form.title);

  const handleArchive = useCallback(
    async (id: string) => {
      if (!token) return;
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.filter((t) => t.id !== id) };
      });
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });
      goToWork();
      try {
        await apiJson<TaskMutationResult>(`/tasks/${id}/archive`, { method: "POST", token });
      } finally {
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      }
    },
    [token, queryClient, workspaceId, goToWork],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return;
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return { ...old, tasks: old.tasks.filter((t) => t.id !== id) };
      });
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });
      goToWork();
      try {
        await apiVoid(`/tasks/${id}`, { method: "DELETE", token });
      } finally {
        void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      }
    },
    [token, queryClient, workspaceId, goToWork],
  );

  const { requestLeave } = useTaskFormNavigationGuard({
    hasUnsavedChanges: requiresTitle ? false : hasUnsavedChanges,
    requiresTitle,
    onDeleteDraft: () => handleArchive(taskId),
    onLeave: goToWork,
    setConfirm,
  });

  const applyAiFill = useCallback(
    (r: TaskAiFillResult) => {
      if (r.title !== null) {
        form.setTitle(r.title);
        queueMicrotask(() => form.flushSave());
      }
      if (r.subtasks !== null && detail) {
        const existing = new Set(detail.subtasks.map((s) => s.title));
        for (const line of r.subtasks) {
          if (line.trim() && !existing.has(line.trim())) {
            subtaskOps.createSubtask(line.trim());
          }
        }
      }
      if (r.assigneeUserIds !== null) form.setAssigneeIds(r.assigneeUserIds);
      if (r.status !== null) form.setStatus(r.status);
      if (r.priority !== null) form.setPriority(r.priority);
      if (r.dueLocal !== null) {
        form.setDue(r.dueLocal);
        if (!r.dueLocal.trim()) form.setDueRepeat(null);
      }
      if (r.dueRepeat !== null) {
        if (r.dueRepeat === "none") {
          form.setDueRepeat(null);
        } else {
          const effectiveDue = r.dueLocal !== null ? r.dueLocal : form.due;
          if (effectiveDue.trim().length > 0) form.setDueRepeat(r.dueRepeat);
          else form.setDueRepeat(null);
        }
      }
    },
    [form, detail, subtaskOps.createSubtask],
  );

  if (isLoading && !detail) {
    return <div className="p-8 text-center text-sm text-[var(--muted)]">Loading task…</div>;
  }

  if (!detail && !isLoading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--muted)]">
        Task not found.{" "}
        <button type="button" className="text-[var(--accent)] underline" onClick={requestLeave}>
          Back to board
        </button>
      </div>
    );
  }

  const caps = detail
    ? taskEditCaps(detail.task, lists, sessionUserId, members)
    : { canArchiveTask: false, canDeleteTask: false, canEditFields: false };

  const subtasksForList = detail?.subtasks ?? [];

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-5">
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            onClick={requestLeave}
          >
            <ArrowLeft weight="bold" className="size-4" />
            Back
          </button>
          <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--fg)]">
            Task
          </span>
        </div>
        <TaskFormSyncIndicator status={form.syncStatus} error={form.syncError} />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <TaskPanelAiFill
            members={members}
            existingDraft={{ title: form.title, dueLocal: form.due, dueRepeat: form.dueRepeat }}
            onApply={applyAiFill}
          />

          <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Task</h3>

            <div>
              {caps.canEditFields ? (
                <>
                  <label
                    htmlFor="task-title"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
                  >
                    Task title <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="task-title"
                    ref={titleRef}
                    rows={1}
                    value={form.title}
                    onChange={(e) => {
                      form.setTitle(e.target.value);
                      form.scheduleSave();
                    }}
                    placeholder={TASK_TITLE_PLACEHOLDER}
                    aria-required
                    className="w-full resize-none overflow-hidden bg-transparent p-0 text-2xl font-semibold leading-snug text-[var(--fg)] outline-none placeholder:text-[var(--muted)] border-b border-[var(--border-subtle)] [&::-webkit-scrollbar]:hidden"
                  />
                </>
              ) : (
                <p className="border-b border-[var(--border-subtle)] pb-1.5 text-2xl font-semibold leading-snug text-[var(--fg)]">
                  {form.title}
                </p>
              )}
            </div>

            {detail ? (
              <TaskSubtaskList
                subtasks={subtasksForList}
                disabled={!token}
                toggleOnly={!caps.canEditFields}
                error={subtaskOps.error}
                onCreate={subtaskOps.createSubtask}
                onUpdate={subtaskOps.updateSubtask}
                onDelete={subtaskOps.deleteSubtask}
                getStableKey={subtaskOps.getStableKey}
              />
            ) : null}
          </div>

          {detail && token && <MilestoneLinkSection taskId={taskId} token={token} />}

          {detail && token && (
            <DependencySection
              taskId={taskId}
              token={token}
              allTasks={tasks}
              canEdit
              onOpenTask={(id) => router.push(`/${workspaceSlug}/work?task=${id}`)}
            />
          )}

          {detail && token && sessionUserId && (
            <CommentThread
              taskId={taskId}
              token={token}
              userId={sessionUserId}
              members={members}
            />
          )}
        </div>

        <div className="w-full space-y-4 lg:w-72 lg:shrink-0">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Properties</h2>

            <div>
              <SectionLabel>Status &amp; Priority</SectionLabel>
              <div className="flex flex-wrap items-center gap-2">
                <SelectPopover
                  value={form.status}
                  onChange={(v) => {
                    form.setStatus(v as ManualTaskStatus);
                    form.scheduleSave();
                  }}
                  options={TASK_FLOW_ORDER.map((s) => ({
                    value: s,
                    label: STATUS_LABELS_FORM[s as ManualTaskStatus] ?? s,
                  }))}
                  triggerClassName={`inline-flex min-w-[7.5rem] justify-center rounded-lg px-3 py-1.5 text-sm font-semibold ${statusPillPaletteClasses(form.status)}`}
                  showChevron={false}
                  aria-label="Status"
                />
                {(() => {
                  const color =
                    form.priority === "high"
                      ? "text-amber-500 dark:text-amber-400"
                      : form.priority === "low"
                        ? "text-sky-500 dark:text-sky-400"
                        : "text-[var(--muted)]";
                  const icon =
                    form.priority === "high" ? (
                      <CaretDoubleUp size={14} weight="fill" />
                    ) : form.priority === "low" ? (
                      <CaretDoubleDown size={14} weight="fill" />
                    ) : (
                      <ArrowLineUp size={14} weight="bold" />
                    );
                  if (!caps.canEditFields) {
                    return (
                      <span
                        className={`inline-flex min-w-[6rem] items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 ${color}`}
                      >
                        <span aria-hidden>{icon}</span>
                        <span className="text-sm font-semibold">{PRIORITY_LABELS[form.priority]}</span>
                      </span>
                    );
                  }
                  return (
                    <SelectPopover
                      value={form.priority}
                      onChange={(v) => {
                        form.setPriority(v as TaskPriority);
                        form.scheduleSave();
                      }}
                      options={(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => ({
                        value: k,
                        label: PRIORITY_LABELS[k],
                      }))}
                      triggerClassName={`inline-flex min-w-[6rem] items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 ${color}`}
                      triggerContent={
                        <>
                          <span aria-hidden>{icon}</span>
                          <span className="text-sm font-semibold">{PRIORITY_LABELS[form.priority]}</span>
                        </>
                      }
                      showChevron={false}
                      aria-label="Priority"
                    />
                  );
                })()}
              </div>
            </div>

            <div>
              <SectionLabel>Due date</SectionLabel>
              {caps.canEditFields ? (
                <div className="flex flex-wrap gap-2">
                  <DueDateTimePopover
                    open={showDuePanel}
                    onOpenChange={(o) => {
                      setShowDuePanel(o);
                      if (o) setShowRepeatPanel(false);
                    }}
                    value={form.due}
                    onChange={(v) => {
                      form.setDue(v);
                      form.scheduleSave();
                    }}
                    onClear={() => {
                      form.setDue("");
                      form.setDueRepeat(null);
                      form.scheduleSave();
                    }}
                  />
                  <DueRepeatPopover
                    open={showRepeatPanel}
                    onOpenChange={(o) => {
                      setShowRepeatPanel(o);
                      if (o) setShowDuePanel(false);
                    }}
                    dueLocalValue={form.due}
                    value={form.dueRepeat}
                    onChange={(v) => {
                      form.setDueRepeat(v);
                      form.scheduleSave();
                    }}
                  />
                </div>
              ) : (
                (() => {
                  const dueFormatted = formatDueDate(detail?.task.dueAt ?? null);
                  const dueRepeat = parseTaskDueRepeat(detail?.task.dueRepeat);
                  return dueFormatted ? (
                    <>
                      <p className="text-sm text-[var(--fg)]">{dueFormatted}</p>
                      {dueRepeat && (
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          Repeats {REPEAT_LABELS[dueRepeat] ?? dueRepeat}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No due date</p>
                  );
                })()
              )}
            </div>

            <div>
              <SectionLabel>Assignees</SectionLabel>
              <div className="flex flex-wrap items-center gap-1.5">
                {form.assigneeIds.map((id) => {
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
                        // eslint-disable-next-line @next/next/no-img-element -- external/user-supplied URL, no next/image remote-pattern config in this app yet
                        <img
                          src={m.image}
                          alt=""
                          className="size-5 shrink-0 rounded-full object-cover"
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[10px] font-semibold uppercase tracking-tight text-[var(--fg)]"
                          aria-hidden
                        >
                          {initials}
                        </span>
                      )}
                      {name}
                      {caps.canEditFields && (
                        <button
                          type="button"
                          className="shrink-0 leading-none text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                          onClick={() => form.toggleAssignee(id)}
                          aria-label={`Remove ${name}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
                {caps.canEditFields && (
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                    onClick={() => setShowAssignees((v) => !v)}
                  >
                    {form.assigneeIds.length === 0 ? "Add assignee" : "+ Add"}
                  </button>
                )}
                {!caps.canEditFields && form.assigneeIds.length === 0 && (
                  <span className="text-sm text-[var(--muted)]">Unassigned</span>
                )}
              </div>
              {caps.canEditFields && showAssignees && (
                <div className="mt-2">
                  <AssigneeSearchField
                    members={members}
                    assigneeIds={form.assigneeIds}
                    onToggleAssignee={form.toggleAssignee}
                  />
                </div>
              )}
            </div>

            {discordChannelOptions.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-2 text-sm text-[var(--fg)]">
                  <span>Enable Discord submission for this task</span>
                  <Toggle
                    checked={discordEnabled}
                    aria-label="Enable Discord submission for this task"
                    onChange={(next) => {
                      setDiscordEnabled(next);
                      if (!next) form.setDiscordChannel(null);
                    }}
                  />
                </div>
                {discordEnabled && (
                  <div className="mt-2">
                    <SectionLabel>Discord channel</SectionLabel>
                    <DiscordChannelSearchField
                      channels={discordChannelOptions}
                      value={form.discordChannelId}
                      onChange={(v) => form.setDiscordChannel(v)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {detail && token && sessionUserId && caps.canEditFields && (
            <div className="flex items-center justify-between gap-2 text-sm text-[var(--muted)]">
              <span>Show time tracking</span>
              <Toggle
                checked={form.timeTrackingEnabled}
                aria-label="Show time tracking"
                onChange={(next) => form.setTimeTrackingEnabled(next)}
              />
            </div>
          )}
          {detail && token && sessionUserId && form.timeTrackingEnabled && (
            <TimeTracker taskId={taskId} token={token} userId={sessionUserId} />
          )}

          {detail && token && sessionUserId && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 space-y-2">
              {caps.canEditFields ? (
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--muted)]">
                  <span>Require at least one attachment before marking done</span>
                  <Toggle
                    checked={form.attachmentRequired}
                    aria-label="Require at least one attachment before marking done"
                    onChange={(next) => form.setAttachmentRequired(next)}
                  />
                </div>
              ) : (
                form.attachmentRequired && (
                  <p className="text-xs font-medium text-[var(--muted)]">Attachment required before marking done</p>
                )
              )}
              <AttachmentZone taskId={taskId} token={token} userId={sessionUserId} />
            </div>
          )}

          {detail && token && form.discordChannelId && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5">
              <DiscordSubmissionZone taskId={taskId} token={token} />
            </div>
          )}

          {(caps.canDeleteTask || caps.canArchiveTask) && (
            <div className="flex flex-wrap gap-2">
              {caps.canArchiveTask && (
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                  onClick={() =>
                    setConfirm({
                      title: "Archive this task?",
                      description: "It will be hidden from the board and treated as archived.",
                      confirmLabel: "Archive",
                      variant: "default",
                      onConfirm: () => handleArchive(taskId),
                    })
                  }
                >
                  Archive task
                </button>
              )}
              {caps.canDeleteTask && (
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
                  onClick={() =>
                    setConfirm({
                      title: "Delete this task?",
                      description: "This will permanently remove the task and all its data. This cannot be undone.",
                      confirmLabel: "Delete task",
                      variant: "danger",
                      onConfirm: () => handleDelete(taskId),
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
