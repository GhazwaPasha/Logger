"use client";

import { useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useApiSession } from "@/hooks/useApiSession";
import { useRoadmap } from "@/hooks/useRoadmap";
import { RoadmapItemEditor, type RoadmapEditorMode } from "@/components/roadmap/RoadmapItemEditor";
import { RoadmapOutlineView } from "@/components/roadmap/RoadmapOutlineView";
import { RoadmapTimelineView } from "@/components/roadmap/RoadmapTimelineView";
import { RoadmapLevelBoardView } from "@/components/roadmap/RoadmapLevelBoardView";
import { RoadmapStatsRow } from "@/components/roadmap/RoadmapStatsRow";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import { CHILD_PERIOD } from "@/lib/roadmap-format";
import type { RoadmapItemRow, RoadmapPeriod } from "@/lib/ledger-types";

type RoadmapView = "outline" | "timeline" | "level";

const VIEW_LABELS: Record<RoadmapView, string> = {
  outline: "Outline",
  timeline: "Timeline",
  level: "By level",
};

export default function RoadmapPage() {
  const { workspaceId } = useWorkspaceRoute();
  const { token } = useApiSession();
  const { depts, lists, tasks, members, isLoading: workspaceLoading } = useWorkspaceData();
  const roadmap = useRoadmap(token, workspaceId);
  const [view, setView] = useState<RoadmapView>("outline");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editorMode, setEditorMode] = useState<RoadmapEditorMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, RoadmapItemRow[]>();
    for (const item of roadmap.items) {
      if (!item.parentId) continue;
      const arr = m.get(item.parentId);
      if (arr) arr.push(item);
      else m.set(item.parentId, [item]);
    }
    return m;
  }, [roadmap.items]);

  const roots = useMemo(
    () =>
      roadmap.items
        .filter((i) => !i.parentId)
        .slice()
        .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex),
    [roadmap.items],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function openForEdit(item: RoadmapItemRow) {
    setExpanded((prev) => new Set(prev).add(item.id));
    setEditorMode({ kind: "edit", item });
  }

  /** Opens the editor without also expanding — Timeline/By-level already show breakdown via their own toggle/drilldown. */
  function editOnly(item: RoadmapItemRow) {
    setEditorMode({ kind: "edit", item });
  }

  function openForCreate(parent: RoadmapItemRow | null) {
    const period: RoadmapPeriod = parent ? (CHILD_PERIOD[parent.period] ?? "weekly") : "yearly";
    setEditorMode({ kind: "create", parent, period, departmentId: parent?.departmentId ?? null });
    if (parent) setExpanded((prev) => new Set(prev).add(parent.id));
  }

  /** Re-resolve the live row each render so linking/unlinking tasks or generating children reflects immediately. */
  const liveEditorMode: RoadmapEditorMode | null =
    editorMode?.kind === "edit"
      ? (() => {
          const live = roadmap.items.find((i) => i.id === editorMode.item.id);
          return live ? { kind: "edit", item: live } : null;
        })()
      : editorMode;

  const editingHasChildren =
    liveEditorMode?.kind === "edit" ? (childrenByParent.get(liveEditorMode.item.id)?.length ?? 0) > 0 : false;

  const loading = workspaceLoading || roadmap.isLoading;
  const displayError = error ?? roadmap.error;

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4">
      {displayError && <ErrorBanner message={displayError} onDismiss={() => setError(null)} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Roadmaps</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--muted)]">
            Break yearly goals down into quarters, months, and weeks — then link real tasks to the leaf goals.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
          onClick={() => openForCreate(null)}
        >
          <Plus weight="bold" className="size-4" />
          New goal
        </button>
      </div>

      <RoadmapStatsRow items={roadmap.items} loading={loading} />

      <div
        className="inline-flex shrink-0 items-center rounded-xl bg-[var(--surface-elevated)] p-0.5"
        role="group"
        aria-label="Roadmap view"
      >
        {(Object.keys(VIEW_LABELS) as RoadmapView[]).map((v) => (
          <button
            key={v}
            type="button"
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
              view === v
                ? "bg-[var(--accent-muted)] text-[var(--fg)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            }`}
            onClick={() => setView(v)}
            aria-pressed={view === v}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      <LoadingFrame show={loading} className="rounded-2xl p-0.5" ribbonRadius="2xl" aria-label="Loading roadmap">
        {view === "outline" && (
          <RoadmapOutlineView
            roots={roots}
            childrenByParent={childrenByParent}
            expanded={expanded}
            loading={loading}
            onToggle={toggle}
            onOpen={openForEdit}
            onAddChild={openForCreate}
            onCreateRoot={() => openForCreate(null)}
          />
        )}
        {view === "timeline" && (
          <RoadmapTimelineView
            roots={roots}
            childrenByParent={childrenByParent}
            expanded={expanded}
            loading={loading}
            onToggle={toggle}
            onEdit={editOnly}
          />
        )}
        {view === "level" && (
          <RoadmapLevelBoardView items={roadmap.items} depts={depts} loading={loading} onOpen={openForEdit} />
        )}
      </LoadingFrame>

      {liveEditorMode && (
        <RoadmapItemEditor
          key={liveEditorMode.kind === "edit" ? liveEditorMode.item.id : "create"}
          mode={liveEditorMode}
          depts={depts}
          lists={lists}
          members={members}
          tasks={tasks}
          roadmap={roadmap}
          token={token}
          hasChildren={editingHasChildren}
          onClose={() => setEditorMode(null)}
        />
      )}
    </div>
  );
}
