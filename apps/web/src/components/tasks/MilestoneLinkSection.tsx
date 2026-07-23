"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFlag } from "@fortawesome/free-solid-svg-icons";
import { useRoadmap } from "@/hooks/useRoadmap";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

export function MilestoneLinkSection({ taskId, token }: { taskId: string; token: string | null }) {
  const router = useRouter();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);
  const [linking, setLinking] = useState(false);

  const linkedMilestones = useMemo(
    () => roadmap.milestones.filter((m) => m.linkedTaskIds.includes(taskId)),
    [roadmap.milestones, taskId],
  );

  const linkableMilestones = useMemo(
    () => roadmap.milestones.filter((m) => !m.linkedTaskIds.includes(taskId)),
    [roadmap.milestones, taskId],
  );

  if (roadmap.milestones.length === 0) {
    return (
      <div className="space-y-1.5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Milestones</h3>
        <p className="text-sm text-[var(--muted)]">
          No milestones yet.{" "}
          <Link href={`/${workspaceSlug}/roadmap`} className="font-medium text-[var(--accent)] hover:underline">
            Create one from the Roadmap page
          </Link>{" "}
          to link this task to it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Milestones</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {linkedMilestones.map((m) => (
          <button
            key={m.id}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
            onClick={() => router.push(`/${workspaceSlug}/roadmap`)}
            title="Open Roadmap"
          >
            <FontAwesomeIcon icon={faFlag} className="size-3" />
            {m.title}
            <span
              role="button"
              tabIndex={-1}
              className="ml-0.5 leading-none text-[var(--muted)] hover:text-[var(--fg)]"
              onClick={(e) => {
                e.stopPropagation();
                if (!linking) {
                  setLinking(true);
                  roadmap.unlinkTask(m.id, taskId).finally(() => setLinking(false));
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
        {linkedMilestones.length === 0 && <p className="text-sm text-[var(--muted)]">Not part of any milestone yet.</p>}
      </div>
      {linkableMilestones.length > 0 && (
        <SelectPopover
          value="__placeholder__"
          onChange={(v) => {
            if (v === "__placeholder__" || linking) return;
            setLinking(true);
            roadmap.linkTasks(v, [taskId]).finally(() => setLinking(false));
          }}
          options={[
            { value: "__placeholder__", label: "Link to a milestone…" },
            ...linkableMilestones.map((m) => ({ value: m.id, label: m.title })),
          ]}
          triggerClassName="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        />
      )}
    </div>
  );
}
