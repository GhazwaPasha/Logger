"use client";

import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiJsonConditional, apiVoid } from "@/lib/api";
import { roadmapKeys } from "@/lib/query-keys";
import type { GoalRow, MilestoneRow, RoadmapStatus } from "@/lib/ledger-types";

type TreeResponse = { goals: GoalRow[]; milestones: MilestoneRow[] };

/** POST/PATCH on goals & milestones return the raw persisted row — no `progress`/`linkedTaskIds`, those are only computed by the tree GET. */
type RawGoalRow = Omit<GoalRow, "progress">;
type RawMilestoneRow = Omit<MilestoneRow, "linkedTaskIds" | "progress">;

const ZERO_PROGRESS = { done: 0, total: 0, pct: 0 };

/** Every sub-milestone under `rootId`, plus itself, walking the cached parent/child links. */
function collectDescendantIds(milestones: MilestoneRow[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const m of milestones) {
    if (!m.parentId) continue;
    const arr = childrenByParent.get(m.parentId);
    if (arr) arr.push(m.id);
    else childrenByParent.set(m.parentId, [m.id]);
  }
  const toRemove = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const childId of childrenByParent.get(id) ?? []) {
      if (!toRemove.has(childId)) {
        toRemove.add(childId);
        queue.push(childId);
      }
    }
  }
  return toRemove;
}

export type CreateGoalInput = {
  title: string;
  description?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  status?: RoadmapStatus;
  targetDate?: string | null;
};

export type UpdateGoalInput = Partial<{
  title: string;
  description: string | null;
  departmentId: string | null;
  ownerId: string | null;
  status: RoadmapStatus;
  targetDate: string | null;
}>;

export type CreateMilestoneInput = {
  goalId: string;
  title: string;
  description?: string | null;
  parentId?: string | null;
  departmentId?: string | null;
  periodStart: string;
  periodEnd: string;
  ownerId?: string | null;
};

export type UpdateMilestoneInput = Partial<{
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
  /** Last-seen ETag for the tree, per org — repeat loads skip re-sending the full tree when unchanged. */
  const etagRef = useRef<Map<string, string>>(new Map());

  const q = useQuery({
    queryKey: roadmapKeys.tree(orgId ?? ""),
    queryFn: async () => {
      const cacheKey = orgId!;
      const result = await apiJsonConditional<TreeResponse>(`/organizations/${orgId}/roadmap`, {
        token,
        etag: etagRef.current.get(cacheKey) ?? null,
      });
      if (result.notModified) {
        const existing = queryClient.getQueryData<TreeResponse>(roadmapKeys.tree(cacheKey));
        if (existing) return existing;
        etagRef.current.delete(cacheKey);
        return apiJson<TreeResponse>(`/organizations/${orgId}/roadmap`, { token });
      }
      if (result.etag) etagRef.current.set(cacheKey, result.etag);
      else etagRef.current.delete(cacheKey);
      return result.data!;
    },
    enabled: Boolean(token && orgId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = useCallback(() => {
    if (!orgId) return;
    void queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(orgId) });
  }, [queryClient, orgId]);

  const patchTree = useCallback(
    (updater: (old: TreeResponse) => TreeResponse) => {
      if (!orgId) return;
      queryClient.setQueryData<TreeResponse>(roadmapKeys.tree(orgId), (old) => (old ? updater(old) : old));
    },
    [orgId, queryClient],
  );

  const createGoal = useCallback(
    async (input: CreateGoalInput) => {
      const row = await apiJson<RawGoalRow>(`/organizations/${orgId}/goals`, {
        method: "POST",
        token,
        body: JSON.stringify(input),
      });
      const goal: GoalRow = { ...row, progress: ZERO_PROGRESS };
      // Patch the real row into the cache immediately — don't make the user wait on a background refetch to see it appear.
      patchTree((old) => ({ ...old, goals: [...old.goals, goal] }));
      invalidate();
      return goal;
    },
    [orgId, token, invalidate, patchTree],
  );

  const updateGoal = useCallback(
    async (goalId: string, input: UpdateGoalInput) => {
      const row = await apiJson<RawGoalRow>(`/organizations/${orgId}/goals/${goalId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      });
      patchTree((old) => ({
        ...old,
        goals: old.goals.map((g) => (g.id === goalId ? { ...g, ...row } : g)),
      }));
      invalidate();
      return row;
    },
    [orgId, token, invalidate, patchTree],
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      await apiVoid(`/organizations/${orgId}/goals/${goalId}`, { method: "DELETE", token });
      // Cascade reflected client-side too — every milestone under this goal disappears with it.
      patchTree((old) => ({
        goals: old.goals.filter((g) => g.id !== goalId),
        milestones: old.milestones.filter((m) => m.goalId !== goalId),
      }));
      invalidate();
    },
    [orgId, token, invalidate, patchTree],
  );

  const createMilestone = useCallback(
    async (input: CreateMilestoneInput) => {
      const row = await apiJson<RawMilestoneRow>(`/organizations/${orgId}/milestones`, {
        method: "POST",
        token,
        body: JSON.stringify(input),
      });
      const milestone: MilestoneRow = { ...row, linkedTaskIds: [], progress: ZERO_PROGRESS };
      patchTree((old) => ({ ...old, milestones: [...old.milestones, milestone] }));
      invalidate();
      return milestone;
    },
    [orgId, token, invalidate, patchTree],
  );

  const updateMilestone = useCallback(
    async (milestoneId: string, input: UpdateMilestoneInput) => {
      const row = await apiJson<RawMilestoneRow>(`/organizations/${orgId}/milestones/${milestoneId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      });
      patchTree((old) => ({
        ...old,
        milestones: old.milestones.map((m) => (m.id === milestoneId ? { ...m, ...row } : m)),
      }));
      invalidate();
      return row;
    },
    [orgId, token, invalidate, patchTree],
  );

  const deleteMilestone = useCallback(
    async (milestoneId: string) => {
      await apiVoid(`/organizations/${orgId}/milestones/${milestoneId}`, { method: "DELETE", token });
      patchTree((old) => {
        const toRemove = collectDescendantIds(old.milestones, milestoneId);
        return { ...old, milestones: old.milestones.filter((m) => !toRemove.has(m.id)) };
      });
      invalidate();
    },
    [orgId, token, invalidate, patchTree],
  );

  /** Patches a milestone's `linkedTaskIds` in the cached tree immediately — progress/rollup catches up via the background invalidate. */
  const patchLinkedTaskIds = useCallback(
    (milestoneId: string, updater: (ids: string[]) => string[]) => {
      patchTree((old) => ({
        ...old,
        milestones: old.milestones.map((m) =>
          m.id === milestoneId ? { ...m, linkedTaskIds: updater(m.linkedTaskIds) } : m,
        ),
      }));
    },
    [patchTree],
  );

  const linkTasks = useCallback(
    async (milestoneId: string, taskIds: string[]) => {
      patchLinkedTaskIds(milestoneId, (ids) => [...ids, ...taskIds.filter((id) => !ids.includes(id))]);
      try {
        await apiJson(`/organizations/${orgId}/milestones/${milestoneId}/tasks`, {
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
    async (milestoneId: string, taskId: string) => {
      patchLinkedTaskIds(milestoneId, (ids) => ids.filter((id) => id !== taskId));
      try {
        await apiVoid(`/organizations/${orgId}/milestones/${milestoneId}/tasks/${taskId}`, {
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
    goals: q.data?.goals ?? [],
    milestones: q.data?.milestones ?? [],
    isLoading: q.isPending && Boolean(token && orgId),
    error: q.error ? (q.error as Error).message : null,
    reload: invalidate,
    createGoal,
    updateGoal,
    deleteGoal,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    linkTasks,
    unlinkTask,
  };
}
