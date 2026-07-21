"use client";

import { useRouter } from "next/navigation";
import { Flag } from "@phosphor-icons/react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useRoadmap } from "@/hooks/useRoadmap";

/** Small icon button shown on task cards when the task is linked to one or more roadmap milestones. */
export function TaskMilestoneIconBtn({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { token } = useApiSession();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);

  const milestones = roadmap.milestones.filter((m) => m.linkedTaskIds.includes(taskId));
  if (milestones.length === 0) return null;

  const label = milestones.length === 1 ? milestones[0]!.title : `${milestones.length} roadmap milestones`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/${workspaceSlug}/roadmap`);
      }}
      title={`Linked to: ${milestones.map((m) => m.title).join(", ")}`}
      aria-label={`Linked to roadmap milestone: ${label}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-[var(--muted)] opacity-70 transition-[opacity,colors] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] hover:opacity-100"
    >
      <Flag size={15} weight="bold" aria-hidden />
    </button>
  );
}
