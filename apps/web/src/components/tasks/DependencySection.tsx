"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { faLink } from "@fortawesome/free-solid-svg-icons";
import { apiFetch } from "@/lib/api";
import type { TaskRow } from "@/lib/ledger-types";
import { EmptyState } from "@/components/ui/EmptyState";
import { curve, reducedDuration, variants } from "@/lib/motion";
import { CollapseItem } from "@/components/ui/Collapse";

type DependencyTask = { id: string; title: string; status: string };

async function fetchBlockers(token: string, taskId: string): Promise<DependencyTask[]> {
  const res = await apiFetch(`/tasks/${taskId}/dependencies/blockers`, {
    token,
  });
  if (!res.ok) throw new Error("Failed to load blockers");
  return res.json() as Promise<DependencyTask[]>;
}

async function fetchBlocking(token: string, taskId: string): Promise<DependencyTask[]> {
  const res = await apiFetch(`/tasks/${taskId}/dependencies/blocking`, {
    token,
  });
  if (!res.ok) throw new Error("Failed to load blocking");
  return res.json() as Promise<DependencyTask[]>;
}

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-[color-mix(in_srgb,var(--ink-2)_15%,transparent)] text-[var(--ink-2)] dark:text-[var(--ink-2)]",
  in_progress: "bg-[color-mix(in_srgb,var(--info-ink)_15%,transparent)] text-[var(--info-ink)] dark:text-[var(--info-ink)]",
  done: "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)] dark:text-[var(--success)]",
  cancelled: "bg-[color-mix(in_srgb,var(--ink-2)_15%,transparent)] text-[var(--ink-2)] dark:text-[var(--ink-2)]",
};

function StatusChip({ status }: { status: string }) {
  const label = status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CHIP[status] ?? "bg-[color-mix(in_srgb,var(--ink-2)_15%,transparent)] text-[var(--ink-2)]"}`}>
      {label}
    </span>
  );
}

function DependencyPicker({
  taskId,
  tasks,
  existingIds,
  onAdd,
  onClose,
}: {
  taskId: string;
  tasks: TaskRow[];
  existingIds: Set<string>;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const options = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.id !== taskId &&
          !t.deletedAt &&
          !existingIds.has(t.id) &&
          (filter === "" || t.title.toLowerCase().includes(filter.toLowerCase())),
      ),
    [tasks, taskId, existingIds, filter],
  );

  return (
    <motion.div
      className="absolute left-0 top-full z-50 mt-1 w-full min-w-[240px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl"
      style={{ transformOrigin: "top" }}
      variants={variants.panelPop}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: reducedDuration(0.16, prefersReduced), ease: curve.respond }}
    >
      <div className="border-b border-[var(--border-subtle)] p-2">
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search tasks..."
          className="w-full rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-sm outline-none placeholder:text-[var(--muted)]"
        />
      </div>
      <ul className="max-h-52 overflow-y-auto py-1">
        {options.length === 0 && (
          <li className="px-3 py-2 text-sm text-[var(--muted)]">No matching tasks</li>
        )}
        {options.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => { onAdd(t.id); onClose(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-muted)]"
            >
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <StatusChip status={t.status} />
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function DependencySection({
  taskId,
  token,
  allTasks,
  canEdit,
  onOpenTask,
}: {
  taskId: string;
  token: string;
  allTasks: TaskRow[];
  canEdit: boolean;
  onOpenTask?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [showBlockerPicker, setShowBlockerPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const blockersKey = ["dependencies", "blockers", taskId];
  const blockingKey = ["dependencies", "blocking", taskId];

  const { data: blockers = [] } = useQuery({
    queryKey: blockersKey,
    queryFn: () => fetchBlockers(token, taskId),
    staleTime: 30_000,
  });

  const { data: blocking = [] } = useQuery({
    queryKey: blockingKey,
    queryFn: () => fetchBlocking(token, taskId),
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      const res = await apiFetch(`/tasks/${taskId}/dependencies`, {
        method: "POST",
        token,
        body: JSON.stringify({ dependsOnTaskId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Failed to add dependency");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blockersKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      const res = await apiFetch(`/tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
        method: "DELETE",
        token,
      });
      if (!res.ok) throw new Error("Failed to remove dependency");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blockersKey });
    },
  });

  // Close picker on outside click
  useEffect(() => {
    if (!showBlockerPicker) return;
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowBlockerPicker(false);
      }
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showBlockerPicker]);

  const existingBlockerIds = useMemo(() => new Set(blockers.map((b) => b.id)), [blockers]);

  if (blockers.length === 0 && blocking.length === 0 && !canEdit) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <h3 className="text-xs font-semibold text-[var(--muted)]">Dependencies</h3>

      {/* Blocked by */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted)]">Blocked by</span>
          {canEdit && (
            <div ref={pickerRef} className="relative">
              <button
                type="button"
                onClick={() => setShowBlockerPicker((v) => !v)}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--surface-muted)]"
              >
                + Add
              </button>
              <AnimatePresence>
                {showBlockerPicker && (
                  <DependencyPicker
                    taskId={taskId}
                    tasks={allTasks}
                    existingIds={existingBlockerIds}
                    onAdd={(id) => addMutation.mutate(id)}
                    onClose={() => setShowBlockerPicker(false)}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        {blockers.length === 0 ? (
          <EmptyState icon={faLink} title="No blockers" size="compact" />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {blockers.map((b) => (
                <CollapseItem as="li" key={b.id} reorder className="pb-1"><div className="flex items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenTask?.(b.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  >
                    {b.title}
                  </button>
                  <StatusChip status={b.status} />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(b.id)}
                      className="ml-1 text-[var(--muted)] hover:text-[var(--danger)]"
                      aria-label="Remove blocker"
                    >
                      ×
                    </button>
                  )}
                </div></CollapseItem>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Blocking */}
      {blocking.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">Blocking</p>
          <ul>
            <AnimatePresence initial={false}>
              {blocking.map((b) => (
                <CollapseItem as="li" key={b.id} reorder className="pb-1"><div className="flex items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenTask?.(b.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  >
                    {b.title}
                  </button>
                  <StatusChip status={b.status} />
                </div></CollapseItem>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {addMutation.isError && (
        <p className="text-xs text-[var(--danger)]">{(addMutation.error as Error).message}</p>
      )}
    </div>
  );
}
