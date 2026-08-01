"use client";

import { useEffect, useState } from "react";
import { faBoxArchive, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useArchivedTasks } from "@/hooks/useArchivedTasks";
import { useDeletionLog } from "@/hooks/useDeletionLog";
import { useRestoreTask } from "@/hooks/useRestoreTask";
import { usePurgeTask } from "@/hooks/usePurgeTask";
import { isWorkspaceOwner, archivedTaskCaps } from "@/lib/workspace-permissions";
import { formatLogTimestamp, memberDisplayName } from "@/lib/task-activity-log";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { NODE_LABELS } from "@/lib/nodes";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import type { DeletionLogEntry, TaskRow } from "@/lib/ledger-types";

const ENTITY_LABEL: Record<DeletionLogEntry["entityType"], string> = {
  task: NODE_LABELS.workItem,
  list: NODE_LABELS.list,
  department: NODE_LABELS.level,
  organization: NODE_LABELS.workspace,
  goal: "Goal",
  milestone: "Milestone",
  discord_integration: "Discord integration",
};

function deletionLogName(entry: DeletionLogEntry): string {
  const snapshot = entry.snapshot as { title?: string; name?: string; guildId?: string };
  return snapshot.title ?? snapshot.name ?? snapshot.guildId ?? entry.entityId;
}

function ArchivedTaskRow({
  task,
  caps,
  onRestore,
  onPurge,
}: {
  task: TaskRow;
  caps: { canRestore: boolean; canPurge: boolean };
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--fg)]">{task.title}</p>
        {task.lastLedger && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Archived {formatLogTimestamp(task.lastLedger.createdAt)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {caps.canRestore && (
          <button type="button" className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium" onClick={onRestore}>
            Restore
          </button>
        )}
        {caps.canPurge && (
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"
            onClick={onPurge}
          >
            Delete permanently
          </button>
        )}
      </div>
    </div>
  );
}

export default function ArchivedPage() {
  const { workspaceId } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { lists, members } = useWorkspaceData();
  const sessionUserId = session?.user?.id ?? null;
  const amOwner = isWorkspaceOwner(members, sessionUserId);

  const [tab, setTab] = useState<"tasks" | "log">("tasks");
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);

  const { data: archivedData, isLoading: tasksLoading } = useArchivedTasks(token, workspaceId);
  const { data: logEntries = [], isLoading: logLoading } = useDeletionLog(token, workspaceId, amOwner && tab === "log");
  const { restoreTask } = useRestoreTask();
  const { purgeTask } = usePurgeTask();

  const archivedTasks = archivedData?.tasks ?? [];

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-6">
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archived</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {NODE_LABELS.workItem}s that have been archived. Restore them, or permanently delete them if you have
          rights to.
        </p>
      </div>

      {amOwner && (
        <div className="flex gap-1 border-b border-[var(--border-subtle)]">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === "tasks"
                ? "border-b-2 border-[var(--accent)] text-[var(--fg)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]"
            }`}
            onClick={() => setTab("tasks")}
          >
            Archived {NODE_LABELS.workItem.toLowerCase()}s
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === "log"
                ? "border-b-2 border-[var(--accent)] text-[var(--fg)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]"
            }`}
            onClick={() => setTab("log")}
          >
            Deletion log
          </button>
        </div>
      )}

      {tab === "tasks" && (
        <section className="space-y-2">
          {tasksLoading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
          {!tasksLoading && archivedTasks.length === 0 && (
            <EmptyState icon={faBoxArchive} title={`No archived ${NODE_LABELS.workItem.toLowerCase()}s`} size="compact" />
          )}
          {archivedTasks.map((task) => {
            const caps = archivedTaskCaps(task, lists, sessionUserId, members);
            return (
              <ArchivedTaskRow
                key={task.id}
                task={task}
                caps={caps}
                onRestore={() =>
                  setConfirm({
                    title: `Restore this ${NODE_LABELS.workItem.toLowerCase()}?`,
                    description: "It will reappear on the board.",
                    confirmLabel: "Restore",
                    variant: "default",
                    onConfirm: async () => {
                      const result = await restoreTask(task.id);
                      if (!result.ok) throw new Error(result.error);
                    },
                  })
                }
                onPurge={() =>
                  setConfirm({
                    title: `Permanently delete this ${NODE_LABELS.workItem.toLowerCase()}?`,
                    description:
                      "This removes it and all its data for good. A record of the deletion stays in the Deletion log.",
                    confirmLabel: "Delete permanently",
                    variant: "danger",
                    onConfirm: async () => {
                      const result = await purgeTask(task.id);
                      if (!result.ok) throw new Error(result.error);
                    },
                  })
                }
              />
            );
          })}
        </section>
      )}

      {tab === "log" && amOwner && (
        <section className="space-y-2">
          {logLoading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
          {!logLoading && logEntries.length === 0 && (
            <EmptyState icon={faClockRotateLeft} title="Nothing permanently deleted yet" size="compact" />
          )}
          {logEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--fg)]">
                  <span className="text-[var(--muted)]">{ENTITY_LABEL[entry.entityType]}:</span>{" "}
                  {deletionLogName(entry)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Deleted by {memberDisplayName(members, entry.actorId)} · {formatLogTimestamp(entry.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
