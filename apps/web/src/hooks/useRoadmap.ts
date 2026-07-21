"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiVoid } from "@/lib/api";
import { roadmapKeys } from "@/lib/query-keys";
import type { GoalRow, MilestoneRow, RoadmapStatus } from "@/lib/ledger-types";

type TreeResponse = { goals: GoalRow[]; milestones: MilestoneRow[] };

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

  const createGoal = useCallback(
    async (input: CreateGoalInput) => {
      const row = await apiJson<GoalRow>(`/organizations/${orgId}/goals`, {
        method: "POST",
        token,
        body: JSON.stringify(input),
      });
      invalidate();
      return row;
    },
    [orgId, token, invalidate],
  );

  const updateGoal = useCallback(
    async (goalId: string, input: UpdateGoalInput) => {
      const row = await apiJson<GoalRow>(`/organizations/${orgId}/goals/${goalId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      });
      invalidate();
      return row;
    },
    [orgId, token, invalidate],
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      await apiVoid(`/organizations/${orgId}/goals/${goalId}`, { method: "DELETE", token });
      invalidate();
    },
    [orgId, token, invalidate],
  );

  const createMilestone = useCallback(
    async (input: CreateMilestoneInput) => {
      const row = await apiJson<MilestoneRow>(`/organizations/${orgId}/milestones`, {
        method: "POST",
        token,
        body: JSON.stringify(input),
      });
      invalidate();
      return row;
    },
    [orgId, token, invalidate],
  );

  const updateMilestone = useCallback(
    async (milestoneId: string, input: UpdateMilestoneInput) => {
      const row = await apiJson<MilestoneRow>(`/organizations/${orgId}/milestones/${milestoneId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      });
      invalidate();
      return row;
    },
    [orgId, token, invalidate],
  );

  const deleteMilestone = useCallback(
    async (milestoneId: string) => {
      await apiVoid(`/organizations/${orgId}/milestones/${milestoneId}`, { method: "DELETE", token });
      invalidate();
    },
    [orgId, token, invalidate],
  );

  /** Patches a milestone's `linkedTaskIds` in the cached tree immediately — progress/rollup catches up via the background invalidate. */
  const patchLinkedTaskIds = useCallback(
    (milestoneId: string, updater: (ids: string[]) => string[]) => {
      if (!orgId) return;
      queryClient.setQueryData<TreeResponse>(roadmapKeys.tree(orgId), (old) => {
        if (!old) return old;
        return {
          ...old,
          milestones: old.milestones.map((m) =>
            m.id === milestoneId ? { ...m, linkedTaskIds: updater(m.linkedTaskIds) } : m,
          ),
        };
      });
    },
    [orgId, queryClient],
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
