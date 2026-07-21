"use client";

import { useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useApiSession } from "@/hooks/useApiSession";
import { useRoadmap } from "@/hooks/useRoadmap";
import { GoalEditor, type GoalEditorMode } from "@/components/roadmap/GoalEditor";
import { MilestoneEditor, type MilestoneEditorMode } from "@/components/roadmap/MilestoneEditor";
import { RoadmapOutlineView } from "@/components/roadmap/RoadmapOutlineView";
import { RoadmapTimelineView } from "@/components/roadmap/RoadmapTimelineView";
import { RoadmapLevelBoardView } from "@/components/roadmap/RoadmapLevelBoardView";
import { RoadmapStatsRow } from "@/components/roadmap/RoadmapStatsRow";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import type { GoalRow, MilestoneRow } from "@/lib/ledger-types";

type RoadmapView = "outline" | "timeline" | "level";

const VIEW_LABELS: Record<RoadmapView, string> = {
  outline: "Outline",
  timeline: "Timeline",
  level: "By level",
};

type EditorMode =
  | { entity: "goal"; mode: GoalEditorMode }
  | { entity: "milestone"; mode: MilestoneEditorMode };

export default function RoadmapPage() {
  const { workspaceId } = useWorkspaceRoute();
  const { token } = useApiSession();
  const { depts, lists, tasks, members, isLoading: workspaceLoading } = useWorkspaceData();
  const roadmap = useRoadmap(token, workspaceId);
  const [view, setView] = useState<RoadmapView>("outline");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, MilestoneRow[]>();
    for (const milestone of roadmap.milestones) {
      if (!milestone.parentId) continue;
      const arr = m.get(milestone.parentId);
      if (arr) arr.push(milestone);
      else m.set(milestone.parentId, [milestone]);
    }
    return m;
  }, [roadmap.milestones]);

  const rootMilestonesByGoal = useMemo(() => {
    const m = new Map<string, MilestoneRow[]>();
    for (const milestone of roadmap.milestones) {
      if (milestone.parentId) continue;
      const arr = m.get(milestone.goalId);
      if (arr) arr.push(milestone);
      else m.set(milestone.goalId, [milestone]);
    }
    return m;
  }, [roadmap.milestones]);

  const goals = useMemo(
    () => roadmap.goals.slice().sort((a, b) => a.title.localeCompare(b.title)),
    [roadmap.goals],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function openGoalForCreate() {
    setEditorMode({ entity: "goal", mode: { kind: "create" } });
  }

  function openGoalForEdit(goal: GoalRow) {
    setExpanded((prev) => new Set(prev).add(goal.id));
    setEditorMode({ entity: "goal", mode: { kind: "edit", goal } });
  }

  function openMilestoneForCreate(goalId: string, parent: MilestoneRow | null, departmentId: string | null) {
    setEditorMode({ entity: "milestone", mode: { kind: "create", goalId, parent, departmentId } });
    setExpanded((prev) => new Set(prev).add(parent ? parent.id : goalId));
  }

  function openMilestoneForEdit(milestone: MilestoneRow) {
    setExpanded((prev) => new Set(prev).add(milestone.id));
    setEditorMode({ entity: "milestone", mode: { kind: "edit", milestone } });
  }

  /** Opens the editor without also expanding — Timeline/By-level already show breakdown via their own toggle/drilldown. */
  function editMilestoneOnly(milestone: MilestoneRow) {
    setEditorMode({ entity: "milestone", mode: { kind: "edit", milestone } });
  }

  /** Re-resolve the live row each render so linking/unlinking tasks reflects immediately. */
  const liveEditorMode: EditorMode | null = useMemo(() => {
    if (!editorMode) return null;
    if (editorMode.entity === "goal" && editorMode.mode.kind === "edit") {
      const wantedId = editorMode.mode.goal.id;
      const live = roadmap.goals.find((g) => g.id === wantedId);
      return live ? { entity: "goal" as const, mode: { kind: "edit" as const, goal: live } } : null;
    }
    if (editorMode.entity === "milestone" && editorMode.mode.kind === "edit") {
      const wantedId = editorMode.mode.milestone.id;
      const live = roadmap.milestones.find((m) => m.id === wantedId);
      return live ? { entity: "milestone" as const, mode: { kind: "edit" as const, milestone: live } } : null;
    }
    return editorMode;
  }, [editorMode, roadmap.goals, roadmap.milestones]);

  const editingHasChildren =
    liveEditorMode?.entity === "goal" && liveEditorMode.mode.kind === "edit"
      ? (rootMilestonesByGoal.get(liveEditorMode.mode.goal.id)?.length ?? 0) > 0
      : liveEditorMode?.entity === "milestone" && liveEditorMode.mode.kind === "edit"
        ? (childrenByParent.get(liveEditorMode.mode.milestone.id)?.length ?? 0) > 0
        : false;

  const loading = workspaceLoading || roadmap.isLoading;
  const displayError = error ?? roadmap.error;

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4">
      {displayError && <ErrorBanner message={displayError} onDismiss={() => setError(null)} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Roadmaps</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--muted)]">
            Set goals for what you&apos;re pursuing, then break each into milestones dated however the work actually needs.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
          onClick={openGoalForCreate}
        >
          <Plus weight="bold" className="size-4" />
          New goal
        </button>
      </div>

      <RoadmapStatsRow goals={roadmap.goals} milestones={roadmap.milestones} loading={loading} />

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
            goals={goals}
            rootMilestonesByGoal={rootMilestonesByGoal}
            childrenByParent={childrenByParent}
            expanded={expanded}
            loading={loading}
            onToggle={toggle}
            onOpenGoal={openGoalForEdit}
            onOpenMilestone={openMilestoneForEdit}
            onAddMilestone={(goal) => openMilestoneForCreate(goal.id, null, goal.departmentId)}
            onAddSubMilestone={(parent) => openMilestoneForCreate(parent.goalId, parent, parent.departmentId)}
            onCreateGoal={openGoalForCreate}
          />
        )}
        {view === "timeline" && (
          <RoadmapTimelineView
            goals={goals}
            rootMilestonesByGoal={rootMilestonesByGoal}
            childrenByParent={childrenByParent}
            expanded={expanded}
            loading={loading}
            onToggle={toggle}
            onEditMilestone={editMilestoneOnly}
          />
        )}
        {view === "level" && (
          <RoadmapLevelBoardView
            milestones={roadmap.milestones}
            goals={roadmap.goals}
            depts={depts}
            loading={loading}
            onOpen={editMilestoneOnly}
          />
        )}
      </LoadingFrame>

      {liveEditorMode?.entity === "goal" && (
        <GoalEditor
          key={liveEditorMode.mode.kind === "edit" ? liveEditorMode.mode.goal.id : "create-goal"}
          mode={liveEditorMode.mode}
          depts={depts}
          members={members}
          roadmap={roadmap}
          hasMilestones={editingHasChildren}
          onClose={() => setEditorMode(null)}
        />
      )}
      {liveEditorMode?.entity === "milestone" && (
        <MilestoneEditor
          key={liveEditorMode.mode.kind === "edit" ? liveEditorMode.mode.milestone.id : "create-milestone"}
          mode={liveEditorMode.mode}
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
