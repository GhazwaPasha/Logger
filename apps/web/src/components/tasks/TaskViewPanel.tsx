"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { useTaskEditorForm } from "@/hooks/useTaskEditorForm";
import { useTaskSubtasks } from "@/hooks/useTaskSubtasks";
import { useDiscordChannels } from "@/hooks/useDiscordChannels";
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAnglesUp, faAnglesDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { parseTaskDueRepeat } from "@/lib/ledger-types";
import { Avatar } from "@/components/ui/Avatar";
import { TASK_TITLE_PLACEHOLDER } from "@/lib/task-default-title";
import { POP_EASE, motionDuration } from "@/components/ui/motion-presets";

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
  const { workspaceSlug, workspaceId } = useWorkspaceRoute();

  const prefersReduced = useReducedMotion();
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
      <div className="flex flex-col gap-4">
        <div className="-mx-6 flex items-center justify-between border-b border-[var(--border-subtle)] px-6 pb-3">
          <h2 className="text-sm font-semibold text-[var(--fg)]">Task</h2>
          <button type="button" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-4">
        <div className="-mx-6 flex items-center justify-between border-b border-[var(--border-subtle)] px-6 pb-3">
          <h2 className="text-sm font-semibold text-[var(--fg)]">Task</h2>
          <button type="button" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">Could not load task.</p>
      </div>
    );
  }

  const { task, ledger } = detail;
  const caps = taskEditCaps(task, lists, sessionUserId, members);

  const stored = normalizeTaskStatus(task.status);
  const statusMenuOptions = stageControlDropdownOptions(stored);

  const dueFormatted = formatDueDate(task.dueAt);
  const dueRepeat = parseTaskDueRepeat(task.dueRepeat);
  const dueColorClass = dueIndicatorColorClass(task);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="-mx-6 flex flex-col gap-2 border-b border-[var(--border-subtle)] px-6 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--fg)]">Task details</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface-hover)]"
            onClick={navigateToEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

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
          className="w-full resize-none overflow-hidden bg-transparent p-0 text-base font-semibold leading-snug text-[var(--fg)] outline-none placeholder:text-[var(--muted)] [&::-webkit-scrollbar]:hidden"
        />
      ) : (
        <h3 className="text-base font-semibold leading-snug text-[var(--fg)]">{task.title}</h3>
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
                ? "text-amber-500 dark:text-amber-400"
                : form.priority === "low"
                  ? "text-sky-500 dark:text-sky-400"
                  : "text-[var(--muted)]";
            const icon =
              form.priority === "high" ? (
                <FontAwesomeIcon icon={faAnglesUp} className="size-3" />
              ) : form.priority === "low" ? (
                <FontAwesomeIcon icon={faAnglesDown} className="size-3" />
              ) : (
                <FontAwesomeIcon icon={faArrowUp} className="size-3" />
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
                triggerClassName={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold ${color}`}
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
              ? "text-amber-500 dark:text-amber-400"
              : p === "low"
                ? "text-sky-500 dark:text-sky-400"
                : "text-[var(--muted)]";
            return (
              <span className={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold ${color}`}>
                {p === "high" ? <FontAwesomeIcon icon={faAnglesUp} className="size-3" /> : p === "low" ? <FontAwesomeIcon icon={faAnglesDown} className="size-3" /> : <FontAwesomeIcon icon={faArrowUp} className="size-3" />}
                {PRIORITY_LABELS[p] ?? "Medium"}
              </span>
            );
          })()
        )}
      </div>
      {form.syncStatus === "error" && form.syncError && (
        <p className="-mt-3 text-xs text-red-600 dark:text-red-400" role="alert">
          {form.syncError}
        </p>
      )}

      {/* Assignees */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Assignees</p>
        <div className="flex flex-wrap items-center gap-1.5">
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
                    transition={{ duration: motionDuration(0.16, prefersReduced), ease: POP_EASE }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] py-1 pl-1.5 pr-3 text-sm font-medium text-[var(--fg)]"
                  >
                    <Avatar
                      name={m?.name}
                      email={m?.email}
                      image={m?.image}
                      size="size-5"
                      className="bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--fg)]"
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
              className="inline-flex items-center rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
              onClick={() => setShowAssignees((v) => !v)}
            >
              {form.assigneeIds.length === 0 ? "Add assignee" : "+ Add"}
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {caps.canEditFields && showAssignees && (
            <motion.div
              className="mt-2"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
              exit={{ height: 0, opacity: 0, overflow: "hidden" }}
              transition={{ duration: motionDuration(0.2, prefersReduced), ease: POP_EASE }}
              style={{ overflow: "hidden" }}
            >
              <AssigneeSearchField
                members={members}
                assigneeIds={form.assigneeIds}
                onToggleAssignee={form.toggleAssignee}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Due date */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Due date</p>
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
  );
}
