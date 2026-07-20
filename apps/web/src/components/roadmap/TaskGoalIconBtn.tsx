"use client";

import { useRouter } from "next/navigation";
import { Target } from "@phosphor-icons/react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useRoadmap } from "@/hooks/useRoadmap";

/** Small icon button shown on task cards when the task is linked to one or more roadmap goals. */
export function TaskGoalIconBtn({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { token } = useApiSession();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);

  const goals = roadmap.items.filter((i) => i.linkedTaskIds.includes(taskId));
  if (goals.length === 0) return null;

  const label = goals.length === 1 ? goals[0]!.title : `${goals.length} roadmap goals`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/${workspaceSlug}/roadmap`);
      }}
      title={`Linked to: ${goals.map((g) => g.title).join(", ")}`}
      aria-label={`Linked to roadmap goal: ${label}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-[var(--muted)] opacity-70 transition-[opacity,colors] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] hover:opacity-100"
    >
      <Target size={15} weight="bold" aria-hidden />
    </button>
  );
}
