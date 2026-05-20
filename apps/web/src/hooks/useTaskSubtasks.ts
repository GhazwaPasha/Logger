"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import {
  nextSubtaskCreatedAt,
  patchTaskSubtasksInCache,
} from "@/lib/task-subtask-cache";
import { taskKeys } from "@/lib/query-keys";
import type { SubtaskRow, TaskDetail } from "@/lib/ledger-types";

export function useTaskSubtasks(taskId: string, token: string | null, workspaceId: string) {
  const enabled = Boolean(taskId && token);
  const queryClient = useQueryClient();
  /** Stable React keys when optimistic id is replaced by server id. */
  const stableKeyByIdRef = useRef(new Map<string, string>());

  const getStableKey = useCallback((subtaskId: string) => {
    return stableKeyByIdRef.current.get(subtaskId) ?? subtaskId;
  }, []);

  const readSubtasks = useCallback((): SubtaskRow[] => {
    return queryClient.getQueryData<TaskDetail>(taskKeys.detail(taskId))?.subtasks ?? [];
  }, [queryClient, taskId]);

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      apiJson<SubtaskRow>(`/tasks/${taskId}/subtasks`, {
        method: "POST",
        token: token!,
        body: JSON.stringify({ title }),
      }),
    onMutate: async (title) => {
      const prev = readSubtasks();
      const stableKey = crypto.randomUUID();
      const optimisticId = `optimistic-${stableKey}`;
      stableKeyByIdRef.current.set(optimisticId, stableKey);
      const optimistic: SubtaskRow = {
        id: optimisticId,
        taskId,
        title,
        done: false,
        createdAt: nextSubtaskCreatedAt(prev),
        updatedAt: new Date().toISOString(),
      };
      patchTaskSubtasksInCache(
        queryClient,
        workspaceId,
        taskId,
        () => [...prev, optimistic],
        { preserveOrder: true },
      );
      return { optimisticId, stableKey };
    },
    onSuccess: (row, _title, ctx) => {
      if (ctx?.stableKey) {
        stableKeyByIdRef.current.set(row.id, ctx.stableKey);
        stableKeyByIdRef.current.delete(ctx.optimisticId);
      }
      patchTaskSubtasksInCache(
        queryClient,
        workspaceId,
        taskId,
        (prev) => prev.map((s) => (s.id === ctx?.optimisticId ? row : s)),
        { preserveOrder: true },
      );
    },
    onError: (_err, _title, ctx) => {
      if (!ctx) return;
      stableKeyByIdRef.current.delete(ctx.optimisticId);
      patchTaskSubtasksInCache(
        queryClient,
        workspaceId,
        taskId,
        (prev) => prev.filter((s) => s.id !== ctx.optimisticId),
        { preserveOrder: true },
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { subtaskId: string; title?: string; done?: boolean }) =>
      apiJson<SubtaskRow>(`/tasks/${taskId}/subtasks/${vars.subtaskId}`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({
          ...(vars.title !== undefined ? { title: vars.title } : {}),
          ...(vars.done !== undefined ? { done: vars.done } : {}),
        }),
      }),
    onMutate: async (vars) => {
      patchTaskSubtasksInCache(
        queryClient,
        workspaceId,
        taskId,
        (prev) =>
          prev.map((s) =>
            s.id !== vars.subtaskId
              ? s
              : {
                  ...s,
                  ...(vars.title !== undefined ? { title: vars.title } : {}),
                  ...(vars.done !== undefined ? { done: vars.done } : {}),
                },
          ),
        { preserveOrder: true },
      );
    },
    onSuccess: (row) => {
      patchTaskSubtasksInCache(
        queryClient,
        workspaceId,
        taskId,
        (prev) => prev.map((s) => (s.id === row.id ? row : s)),
        { preserveOrder: true },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (subtaskId: string) =>
      apiJson<SubtaskRow>(`/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
        token: token!,
      }),
    onMutate: async (subtaskId) => {
      const previous = readSubtasks();
      stableKeyByIdRef.current.delete(subtaskId);
      patchTaskSubtasksInCache(
        queryClient,
        workspaceId,
        taskId,
        (prev) => prev.filter((s) => s.id !== subtaskId),
        { preserveOrder: true },
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (!ctx?.previous) return;
      patchTaskSubtasksInCache(
        queryClient,
        workspaceId,
        taskId,
        () => ctx.previous,
        { preserveOrder: true },
      );
    },
  });

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const createSubtask = useCallback(
    (title: string) => {
      if (!enabled) return;
      createMutation.mutate(title.trim());
    },
    [createMutation, enabled],
  );
  const updateSubtask = useCallback(
    (vars: { subtaskId: string; title?: string; done?: boolean }) => {
      if (!enabled) return;
      updateMutation.mutate(vars);
    },
    [updateMutation, enabled],
  );
  const deleteSubtask = useCallback(
    (subtaskId: string) => {
      if (!enabled) return;
      deleteMutation.mutate(subtaskId);
    },
    [deleteMutation, enabled],
  );

  const err = createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  return {
    createSubtask,
    updateSubtask,
    deleteSubtask,
    isPending,
    error: err instanceof Error ? err.message : null,
    getStableKey,
  };
}
