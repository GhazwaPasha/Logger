"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useTaskFormNavigationGuard } from "@/hooks/useTaskFormNavigationGuard";
import { useTaskEditorForm } from "@/hooks/useTaskEditorForm";
import { useDiscordChannels } from "@/hooks/useDiscordChannels";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { formatInTimeZone } from "@/lib/date";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { AssigneeSearchField } from "@/components/tasks/AssigneeSearchField";
import { DiscordChannelSearchField } from "@/components/tasks/DiscordChannelSearchField";
import { DueDateTimePopover } from "@/components/tasks/DueDateTimePopover";
import { DueRepeatPopover } from "@/components/tasks/DueRepeatPopover";
import { useAsk, useRegisterAskTaskForm } from "@/components/agent/AskPanel";
import { AiIcon } from "@/components/agent/AiIcon";
import { DependencySection } from "@/components/tasks/DependencySection";
import { MilestoneLinkSection } from "@/components/tasks/MilestoneLinkSection";
import { TimeTracker } from "@/components/tasks/TimeTracker";
import { AttachmentZone } from "@/components/tasks/AttachmentZone";
import { DiscordSubmissionZone } from "@/components/tasks/DiscordSubmissionZone";
import { CommentThread } from "@/components/tasks/CommentThread";
import { TaskFormSyncIndicator } from "@/components/tasks/TaskFormSyncIndicator";
import { TaskPanelHistoryCard } from "@/components/tasks/TaskPanelHistoryCard";
import { TaskSubtaskList } from "@/components/tasks/TaskSubtaskList";
import { TaskLevelListField } from "@/components/tasks/TaskLevelListField";
import { NODE_LABELS } from "@/lib/nodes";
import { useTaskSubtasks } from "@/hooks/useTaskSubtasks";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { Toggle } from "@/components/ui/Toggle";
import { Avatar } from "@/components/ui/Avatar";
import { isWorkspaceOwner, taskEditCaps } from "@/lib/workspace-permissions";
import { TASK_FLOW_ORDER, PRIORITY_LABELS, dueIndicatorColorClass, statusPillPaletteClasses, type ManualTaskStatus, type TaskPriority } from "@/lib/task-board";
import { parseTaskDueRepeat, type TaskMutationResult } from "@/lib/ledger-types";
import type { AgentTaskFormFill } from "@work-ledger/contracts";
import { hasMeaningfulTitle, isDefaultTaskTitle, TASK_TITLE_PLACEHOLDER } from "@/lib/task-default-title";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";

import { Collapse } from "@/components/ui/Collapse";
import { ArrowLeftIcon, ArrowUpIcon, ChevronsDownIcon, ChevronsUpIcon } from "lucide-react";
import { DiscordIcon } from "@/components/brand/BrandIcons";

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

function formatDueDate(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  return formatInTimeZone(new Date(iso), timeZone, { dateStyle: "medium", timeStyle: "short" });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold text-[var(--muted)]">
      {children}
    </label>
  );
}

/** Sidebar card with a toggle in its header that expands/collapses its own content. */
function ToggleSection({
  label,
  checked,
  onChange,
  ariaLabel,
  icon,
  className,
  toggleActiveClassName,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  icon?: React.ReactNode;
  className?: string;
  toggleActiveClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={
        className ?? "rounded-2xl bg-[var(--card)] shadow-card p-5 space-y-3"
      }
    >
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--fg)]">
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        <Toggle
          checked={checked}
          aria-label={ariaLabel}
          onChange={onChange}
          activeClassName={toggleActiveClassName}
        />
      </div>
      <Collapse open={Boolean(checked && children)}>
            {children}
          </Collapse>
    </div>
  );
}

export type TaskEditorProps = {
  taskId: string;
};

export function TaskEditor({ taskId }: TaskEditorProps) {
  const router = useRouter();
  const { token, session } = useApiSession();
  const sessionUserId = session?.user?.id ?? null;
  const { workspaceId, workspaceSlug, timeZone } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const { tasks, lists, members, depts } = useWorkspaceData();
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

  const { requestLeave } = useTaskFormNavigationGuard({
    hasUnsavedChanges: requiresTitle ? false : hasUnsavedChanges,
    requiresTitle,
    onDeleteDraft: () => handleArchive(taskId),
    onLeave: goToWork,
    setConfirm,
  });

  const applyAiFill = useCallback(
    (r: AgentTaskFormFill) => {
      if (r.title !== undefined) {
        form.setTitle(r.title);
        queueMicrotask(() => form.flushSave());
      }
      if (r.subtasks !== undefined && detail) {
        const existing = new Set(detail.subtasks.map((s) => s.title));
        for (const line of r.subtasks) {
          if (line.trim() && !existing.has(line.trim())) {
            subtaskOps.createSubtask(line.trim());
          }
        }
      }
      if (r.assigneeUserIds !== undefined) form.setAssigneeIds(r.assigneeUserIds);
      if (r.status !== undefined) form.setStatus(r.status);
      if (r.priority !== undefined) form.setPriority(r.priority);
      if (r.dueLocal !== undefined) {
        form.setDue(r.dueLocal);
        if (!r.dueLocal.trim()) form.setDueRepeat(null);
      }
      if (r.dueRepeat !== undefined) {
        if (r.dueRepeat === "none") {
          form.setDueRepeat(null);
        } else {
          const effectiveDue = r.dueLocal !== undefined ? r.dueLocal : form.due;
          if (effectiveDue.trim().length > 0) form.setDueRepeat(r.dueRepeat);
          else form.setDueRepeat(null);
        }
      }
    },
    [form, detail, subtaskOps.createSubtask],
  );

  // The sidebar AI does the form filling: it sees this form as it stands and sends fields back to applyAiFill.
  const ask = useAsk();
  const canFill = !!detail && form.initialized && taskEditCaps(detail.task, lists, sessionUserId, members).canEditFields;
  useRegisterAskTaskForm(
    canFill
      ? {
          taskId,
          label: form.title,
          isNew: !hasMeaningfulTitle(form.title),
          getState: () => ({
            taskId,
            isNew: !hasMeaningfulTitle(form.title),
            title: form.title.slice(0, 512),
            status: form.status,
            priority: form.priority,
            dueLocal: form.due,
            dueRepeat: form.dueRepeat,
            assigneeUserIds: form.assigneeIds.slice(0, 50),
            subtasks: (detail?.subtasks ?? []).slice(0, 100).map((s) => s.title.slice(0, 512)),
          }),
          apply: applyAiFill,
        }
      : null,
  );

  if (isLoading && !detail) {
    return <div className="p-8 text-center text-sm text-[var(--muted)]">Loading task…</div>;
  }

  if (!detail && !isLoading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--muted)]">
        Task not found.{" "}
        <button type="button" className="font-medium text-[var(--fg)] underline underline-offset-2" onClick={requestLeave}>
          Back to board
        </button>
      </div>
    );
  }

  const caps = detail
    ? taskEditCaps(detail.task, lists, sessionUserId, members)
    : { canArchiveTask: false, canEditFields: false };

  const subtasksForList = detail?.subtasks ?? [];

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-6">
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--card)] shadow-card px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            onClick={requestLeave}
          >
            <ArrowLeftIcon className="size-5" />
            Back
          </button>
          <span className="rounded-lg bg-[var(--card)] shadow-card px-3 py-1.5 text-sm font-medium text-[var(--fg)]">
            Task
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ask && canFill && (
            <button
              type="button"
              onClick={() => ask.openAsk()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--card)] shadow-card px-3 py-1.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <AiIcon className="size-3.5" />
              Fill with AI
            </button>
          )}
          <TaskFormSyncIndicator status={form.syncStatus} error={form.syncError} />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="space-y-6 rounded-[20px] bg-[var(--card)] p-6 shadow-card">
            <h3 className="text-xs font-semibold text-[var(--muted)]">Task</h3>

            <div>
              {caps.canEditFields ? (
                <>
                  <label
                    htmlFor="task-title"
                    className="mb-2 block text-xs font-semibold text-[var(--muted)]"
                  >
                    Task title <span className="text-[var(--danger)]">*</span>
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
                    className="w-full resize-none overflow-hidden bg-transparent p-0 text-2xl font-semibold leading-snug tracking-[-0.02em] text-[var(--fg)] outline-none placeholder:text-[var(--muted)] border-b border-[var(--border-subtle)] [&::-webkit-scrollbar]:hidden"
                  />
                </>
              ) : (
                <p className="text-2xl font-semibold leading-snug tracking-[-0.02em] text-[var(--fg)]">
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
                pendingSubtaskId={subtaskOps.pendingSubtaskId}
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

          {detail && (
            <TaskPanelHistoryCard task={detail.task} ledger={detail.ledger} members={members} />
          )}
        </div>

        <div className="w-full space-y-4 lg:w-80 lg:shrink-0">
          <div className="space-y-5 rounded-[20px] bg-[var(--card)] p-5 shadow-card">
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
                      ? "text-[var(--warning)] dark:text-[var(--warning)]"
                      : form.priority === "low"
                        ? "text-[var(--info-ink)] dark:text-[var(--info-ink)]"
                        : "text-[var(--muted)]";
                  const icon =
                    form.priority === "high" ? (
                      <ChevronsUpIcon className="size-4" />
                    ) : form.priority === "low" ? (
                      <ChevronsDownIcon className="size-4" />
                    ) : (
                      <ArrowUpIcon className="size-4" />
                    );
                  if (!caps.canEditFields) {
                    return (
                      <span
                        className={`inline-flex min-w-[6rem] items-center gap-2 rounded-[9px] bg-[var(--fill)] px-3 py-1.5 ${color}`}
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
                      triggerClassName={`inline-flex min-w-[6rem] items-center gap-2 rounded-[9px] bg-[var(--fill)] px-3 py-1.5 ${color}`}
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
              <SectionLabel>
                {NODE_LABELS.level} &amp; {NODE_LABELS.list}
              </SectionLabel>
              <TaskLevelListField
                listId={form.listId}
                lists={lists}
                depts={depts}
                canEdit={caps.canEditFields}
                onChange={(v) => {
                  form.setListId(v);
                  form.scheduleSave();
                }}
              />
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
                    triggerColorClassName={detail ? dueIndicatorColorClass(detail.task) : undefined}
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
                  const dueFormatted = formatDueDate(detail?.task.dueAt ?? null, timeZone);
                  const dueRepeat = parseTaskDueRepeat(detail?.task.dueRepeat);
                  const dueColorClass = detail ? dueIndicatorColorClass(detail.task) : "text-[var(--muted)]";
                  return dueFormatted ? (
                    <>
                      <p className={`text-sm font-medium ${dueColorClass}`}>{dueFormatted}</p>
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
              <div className="flex flex-wrap items-center gap-2">
                {form.assigneeIds.map((id) => {
                  const m = members.find((r) => r.userId === id);
                  if (!m) return null;
                  const name = (m.name ?? "").trim() || (m.email ?? "").trim() || "Unknown";
                  return (
                    <span
                      key={id}
                      className="inline-flex h-8 items-center gap-2 rounded-full bg-[var(--fill)] pl-1 pr-2.5 text-sm font-medium text-[var(--fg)]"
                    >
                      <Avatar
                        name={m.name}
                        email={m.email}
                        image={m.image}
                        size="size-5"
                        className="bg-[var(--accent-muted)] text-2xs font-semibold text-[var(--fg)]"
                      />
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
                    className="pressable inline-flex h-8 items-center rounded-full px-3 text-xs font-medium shadow-[inset_0_0_0_1px_var(--line-strong)] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                    onClick={() => setShowAssignees((v) => !v)}
                  >
                    {form.assigneeIds.length === 0 ? "Add assignee" : "+ Add"}
                  </button>
                )}
                {!caps.canEditFields && form.assigneeIds.length === 0 && (
                  <span className="text-sm text-[var(--muted)]">Unassigned</span>
                )}
              </div>
              <Collapse open={caps.canEditFields && showAssignees} className="pt-2">
                    <AssigneeSearchField
                      members={members}
                      assigneeIds={form.assigneeIds}
                      onToggleAssignee={form.toggleAssignee}
                    />
                  </Collapse>
            </div>
          </div>

          {(discordChannelOptions.length > 0 || form.discordChannelId) && (
            <ToggleSection
              label="Send to Discord"
              checked={discordEnabled}
              ariaLabel="Enable Discord submission for this task"
              icon={<DiscordIcon className="size-6 text-[#5865F2]" />}
              className="space-y-3 rounded-[20px] bg-[#5865F2]/[0.07] p-5"
              toggleActiveClassName="data-[state=checked]:bg-[#5865F2]"
              onChange={(next) => {
                setDiscordEnabled(next);
                if (!next) form.setDiscordChannel(null);
              }}
            >
              <div className="space-y-3">
                <div>
                  <SectionLabel>Discord channel</SectionLabel>
                  <DiscordChannelSearchField
                    channels={discordChannelOptions}
                    value={form.discordChannelId}
                    onChange={(v) => form.setDiscordChannel(v)}
                  />
                </div>
                {form.discordChannelId && (
                  caps.canEditFields ? (
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--fg)]">
                      <span>Require Discord submission</span>
                      <Toggle
                        checked={form.discordSubmissionRequired}
                        aria-label="Require a Discord submission before marking done"
                        onChange={(next) => form.setDiscordSubmissionRequired(next)}
                      />
                    </div>
                  ) : (
                    form.discordSubmissionRequired && (
                      <p className="text-xs font-medium text-[var(--muted)]">
                        Discord submission required before marking done
                      </p>
                    )
                  )
                )}
                {detail && token && form.discordChannelId && (
                  <DiscordSubmissionZone taskId={taskId} token={token} embedded />
                )}
              </div>
            </ToggleSection>
          )}

          {detail && token && sessionUserId && caps.canEditFields && (
            <ToggleSection
              label="Show time tracking"
              checked={form.timeTrackingEnabled}
              ariaLabel="Show time tracking"
              onChange={(next) => form.setTimeTrackingEnabled(next)}
            >
              <TimeTracker taskId={taskId} token={token} userId={sessionUserId} members={members} embedded />
            </ToggleSection>
          )}

          {detail && token && sessionUserId && (
            <div className="space-y-3 rounded-[20px] bg-[var(--card)] p-5 shadow-card">
              {caps.canEditFields ? (
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--fg)]">
                  <span title="Attachments are disabled — this can only be turned off, not on">
                    Attach File (Required)
                  </span>
                  <span title={form.attachmentRequired ? "Turn off attachment requirement" : "Attachments are disabled"}>
                    <Toggle
                      checked={form.attachmentRequired}
                      disabled={!form.attachmentRequired}
                      aria-label={
                        form.attachmentRequired ? "Turn off attachment requirement" : "Attachments are disabled"
                      }
                      onChange={(next) => {
                        if (!next) form.setAttachmentRequired(false);
                      }}
                    />
                  </span>
                </div>
              ) : (
                form.attachmentRequired && (
                  <p className="text-xs font-medium text-[var(--muted)]">Attachment required before marking done</p>
                )
              )}
              <AttachmentZone taskId={taskId} token={token} userId={sessionUserId} />
            </div>
          )}

          {caps.canArchiveTask && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--card)] shadow-card px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                onClick={() =>
                  setConfirm({
                    title: "Archive this task?",
                    description:
                      "It will be hidden from the board. You can restore it, or permanently delete it, from the Archived page.",
                    confirmLabel: "Archive",
                    variant: "default",
                    onConfirm: () => handleArchive(taskId),
                  })
                }
              >
                Archive task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
