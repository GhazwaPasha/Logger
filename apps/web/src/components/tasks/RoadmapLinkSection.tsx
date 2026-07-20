"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "@phosphor-icons/react";
import { useRoadmap } from "@/hooks/useRoadmap";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

export function RoadmapLinkSection({ taskId, token }: { taskId: string; token: string | null }) {
  const router = useRouter();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);
  const [linking, setLinking] = useState(false);

  const linkedGoals = useMemo(
    () => roadmap.items.filter((i) => i.linkedTaskIds.includes(taskId)),
    [roadmap.items, taskId],
  );

  const linkableGoals = useMemo(
    () => roadmap.items.filter((i) => i.period !== "yearly" && !i.linkedTaskIds.includes(taskId)),
    [roadmap.items, taskId],
  );

  if (roadmap.items.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Roadmap goals</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {linkedGoals.map((g) => (
          <button
            key={g.id}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
            onClick={() => router.push(`/${workspaceSlug}/roadmap`)}
            title="Open Roadmap"
          >
            <Target size={12} weight="bold" />
            {g.title}
            <span
              role="button"
              tabIndex={-1}
              className="ml-0.5 leading-none text-[var(--muted)] hover:text-[var(--fg)]"
              onClick={(e) => {
                e.stopPropagation();
                if (!linking) {
                  setLinking(true);
                  roadmap.unlinkTask(g.id, taskId).finally(() => setLinking(false));
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
        {linkedGoals.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Not part of any goal yet.</p>
        )}
      </div>
      {linkableGoals.length > 0 && (
        <SelectPopover
          value="__placeholder__"
          onChange={(v) => {
            if (v === "__placeholder__" || linking) return;
            setLinking(true);
            roadmap.linkTasks(v, [taskId]).finally(() => setLinking(false));
          }}
          options={[
            { value: "__placeholder__", label: "Link to a goal…" },
            ...linkableGoals.map((g) => ({ value: g.id, label: g.title })),
          ]}
          triggerClassName="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        />
      )}
    </div>
  );
}
