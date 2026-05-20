"use client";

import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { useRouter } from "next/navigation";
import { DependencySection } from "@/components/tasks/DependencySection";
import { AttachmentZone } from "@/components/tasks/AttachmentZone";
import { TimeTracker } from "@/components/tasks/TimeTracker";
import { CommentThread } from "@/components/tasks/CommentThread";
import { TaskPanelHistoryCard } from "@/components/tasks/TaskPanelHistoryCard";
import { statusPillPaletteClasses, STATUS_LABELS, PRIORITY_LABELS, type TaskPriority } from "@/lib/task-board";
import { CaretDoubleUp, CaretDoubleDown, ArrowLineUp } from "@phosphor-icons/react";
import { parseTaskDueRepeat } from "@/lib/ledger-types";
import { memberInitials } from "@/lib/member-utils";

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
  const { tasks, members } = useWorkspaceData();
  const { workspaceSlug } = useWorkspaceRoute();

  const taskFromList = tasks.find((t) => t.id === taskId) ?? null;
  const { detail, isLoading } = useTaskDetail(token, taskId, taskFromList);

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

  const { task, subtasks, assigneeUserIds, ledger } = detail;
  const dueRepeat = parseTaskDueRepeat(task.dueRepeat);
  const dueFormatted = formatDueDate(task.dueAt);

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
      <h3 className="text-base font-semibold leading-snug text-[var(--fg)]">{task.title}</h3>

      {/* Subtasks — always shown, right below title */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Subtasks{subtasks.length > 0 ? ` (${subtasks.filter((s) => s.done).length}/${subtasks.length})` : ""}
        </p>
        {subtasks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No subtasks</p>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)]">
            {subtasks.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0"
              >
                <span className={`text-sm ${item.done ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]"}`}>
                  {item.done ? "✓" : "○"}
                </span>
                <span
                  className={`flex-1 text-sm ${item.done ? "text-[var(--muted)] line-through" : "text-[var(--fg)]"}`}
                >
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status + Priority */}
      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${statusPillPaletteClasses(task.status as Parameters<typeof statusPillPaletteClasses>[0])}`}
        >
          {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] ?? task.status}
        </span>
        {(() => {
          const p = task.priority as TaskPriority;
          const color = p === "high"
            ? "text-amber-500 dark:text-amber-400"
            : p === "low"
              ? "text-sky-500 dark:text-sky-400"
              : "text-[var(--muted)]";
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold ${color}`}>
              {p === "high" ? <CaretDoubleUp size={12} weight="fill" /> : p === "low" ? <CaretDoubleDown size={12} weight="fill" /> : <ArrowLineUp size={12} weight="bold" />}
              {PRIORITY_LABELS[p] ?? "Medium"}
            </span>
          );
        })()}
      </div>

      {/* Assignees */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Assignees</p>
        {assigneeUserIds.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Unassigned</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assigneeUserIds.map((id) => {
              const m = members.find((r) => r.userId === id);
              const name = m ? ((m.name ?? "").trim() || (m.email ?? "").trim() || "Unknown") : "Unknown";
              const initials = m ? memberInitials(m) : "?";
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] py-1 pl-1.5 pr-3 text-sm font-medium text-[var(--fg)]"
                >
                  {m?.image ? (
                    <img src={m.image} alt="" className="size-5 shrink-0 rounded-full object-cover" aria-hidden />
                  ) : (
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[10px] font-semibold uppercase tracking-tight text-[var(--fg)]" aria-hidden>
                      {initials}
                    </span>
                  )}
                  {name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Due date */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Due date</p>
        {dueFormatted ? (
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

      {/* Time tracking — only shows when there are entries (viewOnly=true) */}
      {token && sessionUserId && (
        <TimeTracker taskId={taskId} token={token} userId={sessionUserId} viewOnly />
      )}

      {/* Attachments — only shows when there are attachments (viewOnly=true) */}
      {token && sessionUserId && (
        <AttachmentZone taskId={taskId} token={token} userId={sessionUserId} viewOnly />
      )}

      {/* Comments — only shows when there are comments (viewOnly=true) */}
      {token && sessionUserId && (
        <CommentThread taskId={taskId} token={token} userId={sessionUserId} members={members} viewOnly />
      )}

      {/* Activity history — always shown */}
      <TaskPanelHistoryCard task={task} ledger={ledger} members={members} />
    </div>
  );
}
