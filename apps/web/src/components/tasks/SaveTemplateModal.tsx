"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api";
import type { TaskRow } from "@/lib/ledger-types";

export function SaveTemplateModal({
  task,
  orgId,
  token,
  onClose,
}: {
  task: TaskRow;
  orgId: string;
  token: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(task.title);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includePriority, setIncludePriority] = useState(true);
  const [includeRepeat, setIncludeRepeat] = useState(!!task.dueRepeat);
  const [includeSubtasks, setIncludeSubtasks] = useState(Array.isArray(task.subtasks) && task.subtasks.length > 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (includeTitle) body.defaultTitle = task.title;
      if (includePriority && task.priority) body.defaultPriority = task.priority;
      if (includeRepeat && task.dueRepeat) body.defaultDueRepeat = task.dueRepeat;
      if (includeSubtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
        body.defaultSubtasks = task.subtasks.map((s) => ({ title: s.title }));
      }

      const res = await fetch(`${getApiBaseUrl()}/organizations/${orgId}/templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Failed to save template");
      }
      void queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold">Save as Template</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Template name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={256}
              className="input w-full rounded-xl text-sm"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">Include fields</p>
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={includeTitle} onChange={(e) => setIncludeTitle(e.target.checked)} />
                Title
              </label>
              {task.priority && (
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={includePriority} onChange={(e) => setIncludePriority(e.target.checked)} />
                  Priority ({task.priority})
                </label>
              )}
              {task.dueRepeat && (
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={includeRepeat} onChange={(e) => setIncludeRepeat(e.target.checked)} />
                  Repeat ({task.dueRepeat})
                </label>
              )}
              {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={includeSubtasks} onChange={(e) => setIncludeSubtasks(e.target.checked)} />
                  Subtasks ({task.subtasks.length})
                </label>
              )}
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-primary rounded-xl px-4 py-2 text-xs font-medium"
          >
            {saving ? "Saving…" : "Save Template"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary rounded-xl px-4 py-2 text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
