"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { formatInTimeZone } from "@/lib/date";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { useTaskEditorForm } from "@/hooks/useTaskEditorForm";
import { useTaskSubtasks } from "@/hooks/useTaskSubtasks";
import { useDiscordChannels } from "@/hooks/useDiscordChannels";
import { PaneButton, useAsk } from "@/components/agent/AskPanel";
import { AiIcon } from "@/components/agent/AiIcon";
import { useRouter } from "next/navigation";
import { taskEditCaps } from "@/lib/workspace-permissions";
import { DependencySection } from "@/components/tasks/DependencySection";
import { AttachmentZone } from "@/components/tasks/AttachmentZone";
import { DiscordSubmissionZone } from "@/components/tasks/DiscordSubmissionZone";
import { TimeTracker } from "@/components/tasks/TimeTracker";
import { CommentThread } from "@/components/tasks/CommentThread";
import { TaskPanelHistoryCard } from "@/components/tasks/TaskPanelHistoryCard";
import { TaskSubtaskList } from "@/components/tasks/TaskSubtaskList";
import { TaskLevelListField } from "@/components/tasks/TaskLevelListField";
import { StatusPillSelect } from "@/components/tasks/StatusPillSelect";
import { AssigneeSearchField } from "@/components/tasks/AssigneeSearchField";
import { DueDateTimePopover } from "@/components/tasks/DueDateTimePopover";
import { DueRepeatPopover } from "@/components/tasks/DueRepeatPopover";
import { SelectPopover } from "@/components/ui/SelectPopover";
import {
  FLOW_COLUMN_LABELS,
  PRIORITY_LABELS,
  dueIndicatorColorClass,
  normalizeTaskStatus,
  stageControlDropdownOptions,
  type TaskPriority,
} from "@/lib/task-board";
import type { TaskSyncStatus } from "@/hooks/useTaskAutoSync";
import { parseTaskDueRepeat } from "@/lib/ledger-types";
import { Avatar } from "@/components/ui/Avatar";
import { TASK_TITLE_PLACEHOLDER } from "@/lib/task-default-title";
import { curve, reducedDuration } from "@/lib/motion";
import { Collapse } from "@/components/ui/Collapse";
import { ArrowUpIcon, CheckIcon, ChevronsDownIcon, ChevronsUpIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react";

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

/** Quiet autosave state for the panel header: an icon plus one word, in muted text. */
function AutosaveIndicator({ status, error }: { status: TaskSyncStatus; error: string | null }) {
  const cfg =
    status === "error"
      ? { label: "Not saved", title: error ?? "Could not save", cls: "text-[var(--danger)] dark:text-[var(--danger)]", icon: <CircleAlertIcon className="size-3" aria-hidden /> }
      : status === "saving" || status === "pending"
        ? { label: "Saving…", title: "Saving your changes", cls: "text-[var(--muted)]", icon: <LoaderCircleIcon className="size-3 animate-spin motion-reduce:animate-none" aria-hidden /> }
        : { label: "Saved", title: "Changes save automatically", cls: "text-[var(--muted)]", icon: <CheckIcon className="size-3" aria-hidden /> };
  return (
    <span
      role="status"
      aria-live="polite"
      title={cfg.title}
      className={`mr-1 inline-flex shrink-0 items-center gap-1.5 text-caption font-medium ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/** Matches the Ask pane header: h-11, 13px semibold title, 32px icon buttons. */
function PanelHeader({ title, onClose, children }: { title: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-[var(--line)] pl-6 pr-2">
      <p className="min-w-0 flex-1 truncate text-footnote font-semibold text-[var(--fg)]" title={title}>
        {title}
      </p>
      {children}
      <PaneButton label="Close (Esc)" onClick={onClose}>
        <path d="M5.5 5.5l9 9m0-9l-9 9" />
      </PaneButton>
    </header>
  );
}

/**
 * Scrolling body. Children must not shrink: in a fixed-height flex column they'd otherwise collapse
 * (the auto-sized title textarea went to 0px). Text steps down to the Ask pane's scale: 14px → 13px.
 */
const PANEL_BODY =
  "scrollbar-hide flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8 pt-5 text-footnote [&>*]:shrink-0 [&_.text-sm]:text-footnote";

export function TaskViewPanel({
  taskId,
  onClose,
  onOpenTask,
}: {
  taskId: string;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const router = useRouter();
  const { token, session } = useApiSession();
  const sessionUserId = session?.user?.id ?? null;
  const { tasks, lists, members, depts } = useWorkspaceData();
  const { workspaceSlug, workspaceId, timeZone } = useWorkspaceRoute();

  const prefersReduced = useReducedMotion();
  const ask = useAsk();
  const [showAssignees, setShowAssignees] = useState(false);
  const [showDuePanel, setShowDuePanel] = useState(false);
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const taskFromList = tasks.find((t) => t.id === taskId) ?? null;
  const { detail, isLoading } = useTaskDetail(token, taskId, taskFromList, undefined, {
    formSession: true,
  });

  const form = useTaskEditorForm({ taskId, workspaceId, token, detail });
  const subtaskOps = useTaskSubtasks(taskId, token, workspaceId);
  const discordChannels = useDiscordChannels(token, workspaceId);
  const discordChannelName =
    discordChannels.data?.find((c) => c.id === form.discordChannelId)?.name ?? null;

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.title]);

  function navigateToEdit() {
    router.push(`/${workspaceSlug}/work/task/${taskId}`);
  }

  if (isLoading && !detail) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PanelHeader title="Task details" onClose={onClose} />
        <div className={PANEL_BODY}>
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PanelHeader title="Task details" onClose={onClose} />
        <div className={PANEL_BODY}>
          <p className="text-sm text-[var(--muted)]">Could not load task.</p>
        </div>
      </div>
    );
  }

  const { task, ledger } = detail;
  const caps = taskEditCaps(task, lists, sessionUserId, members);

  const stored = normalizeTaskStatus(task.status);
  const statusMenuOptions = stageControlDropdownOptions(stored, caps.canEditFields);

  const dueFormatted = formatDueDate(task.dueAt, timeZone);
  const dueRepeat = parseTaskDueRepeat(task.dueRepeat);
  const dueColorClass = dueIndicatorColorClass(task);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader title="Task details" onClose={onClose}>
        <AutosaveIndicator status={form.syncStatus} error={form.syncError ?? null} />
        {ask && (
          <button
            type="button"
            aria-label="Ask LogBase about this task"
            title="Ask LogBase about this task"
            onClick={() => ask.openAsk({ taskId })}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] active:scale-[0.94]"
          >
            <AiIcon className="size-[18px]" />
          </button>
        )}
        <PaneButton label="Open full editor" onClick={navigateToEdit}>
          <path d="M13.5 4.5l2 2L8 14l-2.75.75L6 12l7.5-7.5z" />
        </PaneButton>
      </PanelHeader>
      <div className={PANEL_BODY}>
      {/* Title */}
      {caps.canEditFields ? (
        <textarea
          ref={titleRef}
          rows={1}
          value={form.title}
          onChange={(e) => {
            form.setTitle(e.target.value);
            form.scheduleSave();
          }}
          placeholder={TASK_TITLE_PLACEHOLDER}
          aria-label="Task title"
          className="w-full resize-none overflow-hidden bg-transparent p-0 [field-sizing:content] text-xl font-semibold leading-tight tracking-[-0.02em] text-[var(--fg)] outline-none placeholder:text-[var(--muted)] [&::-webkit-scrollbar]:hidden"
        />
      ) : (
        <h3 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-[var(--fg)]">{task.title}</h3>
      )}

      {/* Subtasks — always shown, right below title */}
      <TaskSubtaskList
        subtasks={detail.subtasks}
        disabled={!token}
        toggleOnly={!caps.canEditFields}
        error={subtaskOps.error}
        onCreate={subtaskOps.createSubtask}
        onUpdate={subtaskOps.updateSubtask}
        onDelete={subtaskOps.deleteSubtask}
        getStableKey={subtaskOps.getStableKey}
        pendingSubtaskId={subtaskOps.pendingSubtaskId}
      />

      {/* Level + List */}
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

      {/* Status + Priority */}
      <div className="flex flex-wrap gap-2">
        <StatusPillSelect
          aria-label={`Task stage: ${FLOW_COLUMN_LABELS[form.status]}`}
          value={form.status}
          onChange={(v) => {
            form.setStatus(v);
            form.scheduleSave();
          }}
          options={statusMenuOptions}
        />
        {caps.canEditFields ? (
          (() => {
            const color =
              form.priority === "high"
                ? "text-[var(--status-progress)] dark:text-[var(--status-progress)]"
                : form.priority === "low"
                  ? "text-[var(--info-ink)] dark:text-[var(--info-ink)]"
                  : "text-[var(--muted)]";
            const icon =
              form.priority === "high" ? (
                <ChevronsUpIcon className="size-3" />
              ) : form.priority === "low" ? (
                <ChevronsDownIcon className="size-3" />
              ) : (
                <ArrowUpIcon className="size-3" />
              );
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
                triggerClassName={`inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[var(--fill)] px-3 text-xs font-semibold ${color}`}
                triggerContent={
                  <>
                    <span aria-hidden>{icon}</span>
                    {PRIORITY_LABELS[form.priority]}
                  </>
                }
                showChevron={false}
                aria-label="Priority"
              />
            );
          })()
        ) : (
          (() => {
            const p = task.priority as TaskPriority;
            const color = p === "high"
              ? "text-[var(--status-progress)] dark:text-[var(--status-progress)]"
              : p === "low"
                ? "text-[var(--info-ink)] dark:text-[var(--info-ink)]"
                : "text-[var(--muted)]";
            return (
              <span className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[var(--fill)] px-3 text-xs font-semibold ${color}`}>
                {p === "high" ? <ChevronsUpIcon className="size-3" /> : p === "low" ? <ChevronsDownIcon className="size-3" /> : <ArrowUpIcon className="size-3" />}
                {PRIORITY_LABELS[p] ?? "Medium"}
              </span>
            );
          })()
        )}
      </div>
      {form.syncStatus === "error" && form.syncError && (
        <p className="-mt-3 text-xs text-[var(--danger)] dark:text-[var(--danger)]" role="alert">
          {form.syncError}
        </p>
      )}

      {/* Assignees */}
      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Assignees</p>
        <div className="flex flex-wrap items-center gap-2">
          {form.assigneeIds.length === 0 && !caps.canEditFields ? (
            <p className="text-sm text-[var(--muted)]">Unassigned</p>
          ) : (
            <AnimatePresence initial={false}>
              {form.assigneeIds.map((id) => {
                const m = members.find((r) => r.userId === id);
                const name = m ? ((m.name ?? "").trim() || (m.email ?? "").trim() || "Unknown") : "Unknown";
                return (
                  <motion.span
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: reducedDuration(0.16, prefersReduced), ease: curve.respond }}
                    className="inline-flex h-8 items-center gap-2 rounded-full bg-[var(--fill)] pl-1 pr-3 text-sm font-medium text-[var(--fg)]"
                  >
                    <Avatar
                      name={m?.name}
                      email={m?.email}
                      image={m?.image}
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
                  </motion.span>
                );
              })}
            </AnimatePresence>
          )}
          {caps.canEditFields && (
            <button
              type="button"
              className="pressable inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors hover:text-[var(--fg)]"
              onClick={() => setShowAssignees((v) => !v)}
            >
              {form.assigneeIds.length === 0 ? "Add assignee" : "+ Add"}
            </button>
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

      {/* Due date */}
      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Due date</p>
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
              triggerColorClassName={dueColorClass}
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
        ) : dueFormatted ? (
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
        )}
      </div>

      {/* Dependencies — DependencySection returns null when empty with canEdit=false */}
      {token && (
        <DependencySection
          taskId={taskId}
          token={token}
          allTasks={tasks}
          canEdit={false}
          onOpenTask={onOpenTask}
        />
      )}

      {/* Time tracking — only shows when there are entries (viewOnly=true); the enable/disable toggle lives in the full editor only */}
      {token && sessionUserId && form.timeTrackingEnabled && (
        <TimeTracker taskId={taskId} token={token} userId={sessionUserId} viewOnly />
      )}

      {/* Attachments — live for everyone with access; the required toggle lives in the full editor only */}
      {token && sessionUserId && (
        <div className="space-y-2">
          {form.attachmentRequired && (
            <p className="text-xs font-medium text-[var(--muted)]">Attachment required before marking done</p>
          )}
          <AttachmentZone taskId={taskId} token={token} userId={sessionUserId} />
        </div>
      )}

      {/* Discord submission — live for everyone with access, when a channel is assigned; the required toggle lives in the full editor only */}
      {token && form.discordChannelId && (
        <DiscordSubmissionZone
          taskId={taskId}
          token={token}
          required={form.discordSubmissionRequired}
          channelName={discordChannelName}
          channelNameLoading={discordChannels.isLoading}
        />
      )}

      {/* Comments — live for everyone with access */}
      {token && sessionUserId && (
        <CommentThread taskId={taskId} token={token} userId={sessionUserId} members={members} />
      )}

      {/* Activity history — always shown */}
      <TaskPanelHistoryCard task={task} ledger={ledger} members={members} />
      </div>
    </div>
  );
}
