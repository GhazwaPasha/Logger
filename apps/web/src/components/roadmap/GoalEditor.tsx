"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import type { Dept, GoalRow, MemberRow, RoadmapStatus } from "@/lib/ledger-types";
import type { useRoadmap } from "@/hooks/useRoadmap";
import { STATUS_LABELS, toDateInputValue } from "@/lib/roadmap-format";

export type GoalEditorMode = { kind: "create" } | { kind: "edit"; goal: GoalRow };

export function GoalEditor({
  mode,
  depts,
  members,
  roadmap,
  hasMilestones,
  onClose,
}: {
  mode: GoalEditorMode;
  depts: Dept[];
  members: MemberRow[];
  roadmap: ReturnType<typeof useRoadmap>;
  hasMilestones: boolean;
  onClose: () => void;
}) {
  const editing = mode.kind === "edit" ? mode.goal : null;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [departmentId, setDepartmentId] = useState<string>(editing?.departmentId ?? "");
  const [ownerId, setOwnerId] = useState<string>(editing?.ownerId ?? "");
  const [status, setStatus] = useState<RoadmapStatus>(editing?.status ?? "on_track");
  const [targetDate, setTargetDate] = useState<string>(editing?.targetDate ? toDateInputValue(editing.targetDate) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);

  async function handleSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const targetDateIso = targetDate ? new Date(`${targetDate}T23:59:59.999Z`).toISOString() : null;
      if (mode.kind === "create") {
        await roadmap.createGoal({
          title: title.trim(),
          description: description.trim() || null,
          departmentId: departmentId || null,
          ownerId: ownerId || null,
          targetDate: targetDateIso,
        });
      } else {
        await roadmap.updateGoal(editing!.id, {
          title: title.trim(),
          description: description.trim() || null,
          departmentId: departmentId || null,
          ownerId: ownerId || null,
          status,
          targetDate: targetDateIso,
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
    try {
      await roadmap.deleteGoal(editing.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete goal");
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-hidden onMouseDown={onClose} />
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[1] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 shadow-xl shadow-black/20"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Goal</p>
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
              placeholder="e.g. European Expansion"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Target date
              </label>
              <input
                type="date"
                className="input w-full rounded-lg px-3 py-2 text-sm"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Optional — a soft deadline, not a hard boundary.</p>
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
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {editing ? (
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
              onClick={() =>
                setConfirm({
                  title: "Delete this goal?",
                  description: hasMilestones
                    ? "This also deletes every milestone under this goal. Linked tasks themselves are not deleted."
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
