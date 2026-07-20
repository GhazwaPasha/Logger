"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "@phosphor-icons/react";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { apiJson } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import type {
  Dept,
  ListRow,
  MemberRow,
  RoadmapItemRow,
  RoadmapPeriod,
  RoadmapStatus,
  TaskMutationResult,
  TaskRow,
} from "@/lib/ledger-types";
import type { useRoadmap } from "@/hooks/useRoadmap";
import { defaultRangeForPeriod, formatDate, PERIOD_LABELS, STATUS_LABELS, toDateInputValue } from "@/lib/roadmap-format";

export type RoadmapEditorMode =
  | { kind: "create"; parent: RoadmapItemRow | null; period: RoadmapPeriod; departmentId: string | null }
  | { kind: "edit"; item: RoadmapItemRow };

export function RoadmapItemEditor({
  mode,
  depts,
  lists,
  members,
  tasks,
  roadmap,
  token,
  hasChildren,
  onClose,
}: {
  mode: RoadmapEditorMode;
  depts: Dept[];
  lists: ListRow[];
  members: MemberRow[];
  tasks: TaskRow[];
  roadmap: ReturnType<typeof useRoadmap>;
  token: string | null;
  hasChildren: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { workspaceSlug } = useWorkspaceRoute();
  const editing = mode.kind === "edit" ? mode.item : null;
  const period = editing?.period ?? (mode.kind === "create" ? mode.period : "yearly");

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [departmentId, setDepartmentId] = useState<string>(
    editing?.departmentId ?? (mode.kind === "create" ? (mode.departmentId ?? "") : ""),
  );
  const [ownerId, setOwnerId] = useState<string>(editing?.ownerId ?? "");
  const [status, setStatus] = useState<RoadmapStatus>(editing?.status ?? "on_track");
  /** New goals default to the calendar period containing today (or the parent's start, for a child) — not just "today" for both ends. */
  const smartDefaultAnchor =
    mode.kind === "create" && mode.parent ? new Date(mode.parent.periodStart) : new Date();
  const [smartStart, smartEnd] = defaultRangeForPeriod(period, smartDefaultAnchor);
  const [periodStart, setPeriodStart] = useState(editing ? toDateInputValue(editing.periodStart) : smartStart);
  const [periodEnd, setPeriodEnd] = useState(editing ? toDateInputValue(editing.periodEnd) : smartEnd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);
  const [taskQuery, setTaskQuery] = useState("");
  /** Task id currently being linked/unlinked — drives the spinner on that exact button. */
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  /** Ancestor chain from root down to (but not including) this goal, for the breadcrumb. */
  const breadcrumb = useMemo(() => {
    const byId = new Map(roadmap.items.map((i) => [i.id, i] as const));
    const startParentId = mode.kind === "create" ? mode.parent?.id ?? null : editing?.parentId ?? null;
    const chain: RoadmapItemRow[] = [];
    let cursor = startParentId ? byId.get(startParentId) : undefined;
    while (cursor) {
      chain.unshift(cursor);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return chain;
  }, [roadmap.items, mode, editing]);

  const candidateLists = useMemo(() => {
    if (!editing) return [];
    return departmentId ? lists.filter((l) => l.departmentId === departmentId) : lists;
  }, [editing, lists, departmentId]);
  const [newTaskListId, setNewTaskListId] = useState<string>("");
  const effectiveNewTaskListId = newTaskListId || candidateLists[0]?.id || lists[0]?.id || "";

  const linkedTasks = useMemo(
    () => (editing ? tasks.filter((t) => editing.linkedTaskIds.includes(t.id)) : []),
    [editing, tasks],
  );

  const candidateTasks = useMemo(() => {
    if (!editing) return [];
    const q = taskQuery.trim().toLowerCase();
    return tasks
      .filter((t) => !t.deletedAt && !editing.linkedTaskIds.includes(t.id))
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [editing, tasks, taskQuery]);

  /** Ranks unlinked tasks by same-department + due-date-within-goal-range, shown before the user types anything. */
  const suggestedTasks = useMemo(() => {
    if (!editing) return [];
    const listDeptById = new Map(lists.map((l) => [l.id, l.departmentId] as const));
    const rangeStart = new Date(editing.periodStart).getTime();
    const rangeEnd = new Date(editing.periodEnd).getTime();
    const scored = tasks
      .filter((t) => !t.deletedAt && !editing.linkedTaskIds.includes(t.id))
      .map((t) => {
        let score = 0;
        const taskDept = listDeptById.get(t.listId);
        if (!editing.departmentId || taskDept === editing.departmentId) score += 2;
        if (t.dueAt) {
          const due = new Date(t.dueAt).getTime();
          if (due >= rangeStart && due <= rangeEnd) score += 3;
        }
        return { task: t, score };
      })
      .filter((s) => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 6).map((s) => s.task);
  }, [editing, tasks, lists]);

  async function handleSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const periodStartIso = new Date(`${periodStart}T00:00:00.000Z`).toISOString();
      const periodEndIso = new Date(`${periodEnd}T23:59:59.999Z`).toISOString();
      if (mode.kind === "create") {
        await roadmap.createItem({
          title: title.trim(),
          description: description.trim() || null,
          period,
          parentId: mode.parent?.id ?? null,
          departmentId: departmentId || null,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          ownerId: ownerId || null,
        });
      } else {
        await roadmap.updateItem(editing!.id, {
          title: title.trim(),
          description: description.trim() || null,
          departmentId: departmentId || null,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          ownerId: ownerId || null,
          status,
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    await roadmap.deleteItem(editing.id);
    onClose();
  }

  async function addTask(taskId: string) {
    if (!editing || linkingTaskId) return;
    setLinkingTaskId(taskId);
    try {
      await roadmap.linkTasks(editing.id, [taskId]);
    } finally {
      setLinkingTaskId(null);
    }
  }

  async function removeTask(taskId: string) {
    if (!editing || linkingTaskId) return;
    setLinkingTaskId(taskId);
    try {
      await roadmap.unlinkTask(editing.id, taskId);
    } finally {
      setLinkingTaskId(null);
    }
  }

  /** Creates a real task scoped to this goal's list/period and links it in one step. */
  async function createAndLinkTask() {
    if (!editing || !newTaskTitle.trim() || !effectiveNewTaskListId || creatingTask) return;
    setCreatingTask(true);
    setError(null);
    try {
      const created = await apiJson<TaskMutationResult>(`/organizations/${editing.organizationId}/tasks`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          listId: effectiveNewTaskListId,
          dueAt: editing.periodEnd,
        }),
      });
      await roadmap.linkTasks(editing.id, [created.task.id]);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(editing.organizationId) });
      setNewTaskTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="presentation">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-hidden
        onMouseDown={onClose}
      />
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[1] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 shadow-xl shadow-black/20"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {breadcrumb.length > 0 && (
              <p className="mb-1 truncate text-xs text-[var(--muted)]">
                {breadcrumb.map((b) => b.title).join(" › ")}
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {PERIOD_LABELS[period]}ly goal
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-[var(--fg)]">
              {mode.kind === "create" ? "New goal" : "Edit goal"}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X weight="bold" className="size-4" />
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Title
            </label>
            <input
              autoFocus
              className="input w-full rounded-lg px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                period === "yearly"
                  ? "e.g. FY2026"
                  : period === "quarterly"
                    ? "e.g. Q3 2026"
                    : period === "monthly"
                      ? "e.g. August 2026"
                      : "e.g. Ship the launch checklist"
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Description
            </label>
            <textarea
              className="input w-full resize-none rounded-lg px-3 py-2 text-sm"
              rows={2}
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Starts
              </label>
              <input
                type="date"
                className="input w-full rounded-lg px-3 py-2 text-sm"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Ends
              </label>
              <input
                type="date"
                className="input w-full rounded-lg px-3 py-2 text-sm"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Level
              </label>
              <SelectPopover
                value={departmentId || "__org__"}
                onChange={(v) => setDepartmentId(v === "__org__" ? "" : v)}
                options={[{ value: "__org__", label: "Org-wide" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]}
                triggerClassName="input flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Owner
              </label>
              <SelectPopover
                value={ownerId || "__none__"}
                onChange={(v) => setOwnerId(v === "__none__" ? "" : v)}
                options={[
                  { value: "__none__", label: "Unassigned" },
                  ...members.map((m) => ({ value: m.userId, label: m.name?.trim() || m.email })),
                ]}
                triggerClassName="input flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {editing && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Status
              </label>
              <SelectPopover
                value={status}
                onChange={(v) => setStatus(v as RoadmapStatus)}
                options={(Object.keys(STATUS_LABELS) as RoadmapStatus[]).map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                }))}
                triggerClassName="input flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {editing && period !== "weekly" && !hasChildren && (
            <button
              type="button"
              className="btn-secondary w-full rounded-lg px-3 py-2 text-sm font-medium"
              disabled={saving}
              onClick={() =>
                setConfirm({
                  title: `Split into ${period === "yearly" ? "quarters" : period === "quarterly" ? "months" : "weeks"}?`,
                  description:
                    "This creates standard child goals with calendar dates already filled in — you can edit or delete them after.",
                  confirmLabel: "Generate",
                  variant: "default",
                  onConfirm: async () => {
                    const childPeriod: RoadmapPeriod =
                      period === "yearly" ? "quarterly" : period === "quarterly" ? "monthly" : "weekly";
                    await roadmap.generateChildren(editing.id, childPeriod);
                  },
                })
              }
            >
              Split into {period === "yearly" ? "quarters" : period === "quarterly" ? "months" : "weeks"}
            </button>
          )}

          {editing && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Linked tasks · {linkedTasks.length}
                </label>
                {linkedTasks.length > 0 && (
                  <Link
                    href={`/${workspaceSlug}/work?goal=${editing.id}`}
                    className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline"
                  >
                    View on board
                  </Link>
                )}
              </div>
              <div className="space-y-1.5">
                {linkedTasks.map((t) => {
                  const busy = linkingTaskId === t.id;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">{t.title}</span>
                      <button
                        type="button"
                        className="flex size-4 shrink-0 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:opacity-50"
                        onClick={() => removeTask(t.id)}
                        disabled={busy}
                        aria-label={`Unlink ${t.title}`}
                      >
                        {busy ? <InlineSpinner className="size-3 animate-spin motion-reduce:animate-none" /> : "×"}
                      </button>
                    </div>
                  );
                })}
                {linkedTasks.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">No tasks linked yet.</p>
                )}
              </div>

              {suggestedTasks.length > 0 && !taskQuery.trim() && (
                <div className="mt-2.5">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Suggested — same level or due in range
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTasks.map((t) => {
                      const busy = linkingTaskId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
                          onClick={() => addTask(t.id)}
                          disabled={busy}
                          title={t.title}
                        >
                          <span className="min-w-0 truncate">{t.title}</span>
                          {busy ? (
                            <InlineSpinner className="size-3 shrink-0 animate-spin text-[var(--muted)] motion-reduce:animate-none" />
                          ) : (
                            <span className="shrink-0 text-[var(--muted)]">+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {candidateLists.length > 0 || lists.length > 0 ? (
                <div className="mt-2.5 flex items-center gap-1.5">
                  <input
                    className="input min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="New task title…"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void createAndLinkTask();
                    }}
                    disabled={creatingTask}
                  />
                  <SelectPopover
                    value={effectiveNewTaskListId}
                    onChange={(v) => setNewTaskListId(v)}
                    options={(candidateLists.length > 0 ? candidateLists : lists).map((l) => ({
                      value: l.id,
                      label: l.name,
                    }))}
                    triggerClassName="input shrink-0 max-w-[8rem] rounded-lg px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    className="btn-secondary shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium disabled:opacity-60"
                    onClick={() => void createAndLinkTask()}
                    disabled={!newTaskTitle.trim() || creatingTask}
                  >
                    {creatingTask ? "Adding…" : "Add"}
                  </button>
                </div>
              ) : (
                <p className="mt-2.5 text-xs text-[var(--muted)]">
                  Create a list under Work before adding tasks here.
                </p>
              )}
              <p className="mt-1 text-xs text-[var(--muted)]">
                New tasks default to due {formatDate(editing.periodEnd)} — edit the task afterward to change it.
              </p>

              <input
                className="input mt-3 w-full rounded-lg px-3 py-1.5 text-sm"
                placeholder="Or search existing tasks to link…"
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
              />
              {taskQuery.trim() && (
                <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                  {candidateTasks.map((t) => {
                    const busy = linkingTaskId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
                        onClick={() => addTask(t.id)}
                        disabled={busy}
                      >
                        <span className="min-w-0 truncate">{t.title}</span>
                        {busy ? (
                          <InlineSpinner className="size-3.5 shrink-0 animate-spin text-[var(--muted)] motion-reduce:animate-none" />
                        ) : (
                          <span className="shrink-0 text-xs text-[var(--muted)]">Add</span>
                        )}
                      </button>
                    );
                  })}
                  {candidateTasks.length === 0 && (
                    <p className="px-2 py-1 text-sm text-[var(--muted)]">No matching tasks.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {editing ? (
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
              onClick={() =>
                setConfirm({
                  title: "Delete this goal?",
                  description:
                    hasChildren
                      ? "This also deletes every child goal beneath it. Linked tasks themselves are not deleted."
                      : "Linked tasks themselves are not deleted.",
                  confirmLabel: "Delete goal",
                  variant: "danger",
                  onConfirm: handleDelete,
                })
              }
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
              disabled={!title.trim() || saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
