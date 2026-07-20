"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiVoid } from "@/lib/api";
import { roadmapKeys } from "@/lib/query-keys";
import type { RoadmapItemRow, RoadmapPeriod, RoadmapStatus } from "@/lib/ledger-types";

type TreeResponse = { items: RoadmapItemRow[] };

export type CreateRoadmapItemInput = {
  title: string;
  description?: string | null;
  period: RoadmapPeriod;
  parentId?: string | null;
  departmentId?: string | null;
  periodStart: string;
  periodEnd: string;
  ownerId?: string | null;
};

export type UpdateRoadmapItemInput = Partial<{
  title: string;
  description: string | null;
  parentId: string | null;
  departmentId: string | null;
  periodStart: string;
  periodEnd: string;
  ownerId: string | null;
  status: RoadmapStatus;
  orderIndex: number;
}>;

export function useRoadmap(token: string | null, orgId: string | null) {
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: roadmapKeys.tree(orgId ?? ""),
    queryFn: () => apiJson<TreeResponse>(`/organizations/${orgId}/roadmap`, { token }),
    enabled: Boolean(token && orgId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = useCallback(() => {
    if (!orgId) return;
    void queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(orgId) });
  }, [queryClient, orgId]);

  const createItem = useCallback(
    async (input: CreateRoadmapItemInput) => {
      const row = await apiJson<RoadmapItemRow>(`/organizations/${orgId}/roadmap`, {
        method: "POST",
        token,
        body: JSON.stringify(input),
      });
      invalidate();
      return row;
    },
    [orgId, token, invalidate],
  );

  const updateItem = useCallback(
    async (itemId: string, input: UpdateRoadmapItemInput) => {
      const row = await apiJson<RoadmapItemRow>(`/organizations/${orgId}/roadmap/${itemId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      });
      invalidate();
      return row;
    },
    [orgId, token, invalidate],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      await apiVoid(`/organizations/${orgId}/roadmap/${itemId}`, { method: "DELETE", token });
      invalidate();
    },
    [orgId, token, invalidate],
  );

  const generateChildren = useCallback(
    async (itemId: string, childPeriod: RoadmapPeriod) => {
      const rows = await apiJson<RoadmapItemRow[]>(
        `/organizations/${orgId}/roadmap/${itemId}/generate-children`,
        { method: "POST", token, body: JSON.stringify({ childPeriod }) },
      );
      invalidate();
      return rows;
    },
    [orgId, token, invalidate],
  );

  /** Patches `linkedTaskIds` in the cached tree immediately — progress/rollup catches up via the background invalidate. */
  const patchLinkedTaskIds = useCallback(
    (itemId: string, updater: (ids: string[]) => string[]) => {
      if (!orgId) return;
      queryClient.setQueryData<TreeResponse>(roadmapKeys.tree(orgId), (old) => {
        if (!old) return old;
        return {
          items: old.items.map((it) => (it.id === itemId ? { ...it, linkedTaskIds: updater(it.linkedTaskIds) } : it)),
        };
      });
    },
    [orgId, queryClient],
  );

  const linkTasks = useCallback(
    async (itemId: string, taskIds: string[]) => {
      patchLinkedTaskIds(itemId, (ids) => [...ids, ...taskIds.filter((id) => !ids.includes(id))]);
      try {
        await apiJson(`/organizations/${orgId}/roadmap/${itemId}/tasks`, {
          method: "POST",
          token,
          body: JSON.stringify({ taskIds }),
        });
      } catch (e) {
        invalidate();
        throw e;
      }
      invalidate();
    },
    [orgId, token, invalidate, patchLinkedTaskIds],
  );

  const unlinkTask = useCallback(
    async (itemId: string, taskId: string) => {
      patchLinkedTaskIds(itemId, (ids) => ids.filter((id) => id !== taskId));
      try {
        await apiVoid(`/organizations/${orgId}/roadmap/${itemId}/tasks/${taskId}`, {
          method: "DELETE",
          token,
        });
      } catch (e) {
        invalidate();
        throw e;
      }
      invalidate();
    },
    [orgId, token, invalidate, patchLinkedTaskIds],
  );

  return {
    items: q.data?.items ?? [],
    isLoading: q.isPending && Boolean(token && orgId),
    error: q.error ? (q.error as Error).message : null,
    reload: invalidate,
    createItem,
    updateItem,
    deleteItem,
    generateChildren,
    linkTasks,
    unlinkTask,
  };
}
