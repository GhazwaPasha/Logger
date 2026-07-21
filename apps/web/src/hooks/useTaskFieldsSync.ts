"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { applyTaskMutationToCache } from "@/lib/task-mutation-cache";
import { useTaskAutoSync } from "@/hooks/useTaskAutoSync";
import { getPendingCreation } from "@/lib/create-draft-task";
import type { TaskMutationResult } from "@/lib/ledger-types";

export type TaskFieldPatchBody = {
  title: string;
  status: string;
  priority: string;
  assigneeUserIds: string[];
  dueRepeat: unknown;
  discordChannelId: string | null;
  attachmentRequired: boolean;
  timeTrackingEnabled: boolean;
  dueAt?: string | null;
};

/** Debounced PATCH-only sync for task fields. Subtasks use their own API calls. */
export function useTaskFieldsSync(options: {
  workspaceId: string;
  token: string | null;
  taskId: string;
  ready: boolean;
  fingerprint: string;
  buildPatchPayload: () => TaskFieldPatchBody | null;
  debounceMs?: number;
}) {
  const { workspaceId, token, taskId, ready, fingerprint, buildPatchPayload, debounceMs = 400 } =
    options;

  const queryClient = useQueryClient();
  const lastSavedDueAtRef = useRef<string | null | undefined>(undefined);

  const persistPatch = useCallback(
    async (body: TaskFieldPatchBody) => {
      if (!token || !body) return;
      const pending = getPendingCreation(taskId);
      if (pending) await pending;
      const saved = await apiJson<TaskMutationResult>(`/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      applyTaskMutationToCache(queryClient, workspaceId, taskId, saved);
      if ("dueAt" in body) {
        lastSavedDueAtRef.current = body.dueAt ?? null;
      }
    },
    [token, queryClient, workspaceId, taskId],
  );

  const autoSync = useTaskAutoSync({
    ready: ready && !!token,
    fingerprint,
    buildPayload: buildPatchPayload,
    save: persistPatch as (payload: unknown) => Promise<void>,
    debounceMs,
  });

  const dueFieldPatch = useCallback((dueLocal: string): { dueAt?: string | null } => {
    const nextIso = dueLocal.trim() ? new Date(dueLocal).toISOString() : null;
    const prevIso =
      lastSavedDueAtRef.current === undefined
        ? null
        : lastSavedDueAtRef.current
          ? new Date(lastSavedDueAtRef.current).toISOString()
          : null;
    if (prevIso === nextIso) return {};
    return { dueAt: nextIso };
  }, []);

  const seedSavedDueAt = useCallback((iso: string | null | undefined) => {
    lastSavedDueAtRef.current = iso ?? null;
  }, []);

  return {
    ...autoSync,
    dueFieldPatch,
    seedSavedDueAt,
  };
}
