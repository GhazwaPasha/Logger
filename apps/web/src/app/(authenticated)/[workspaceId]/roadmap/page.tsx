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
import { RoadmapGrandView } from "@/components/roadmap/RoadmapGrandView";
import { RoadmapLevelBoardView } from "@/components/roadmap/RoadmapLevelBoardView";
import { RoadmapPipelineBar } from "@/components/roadmap/RoadmapPipelineBar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import type { GoalRow, MilestoneRow } from "@/lib/ledger-types";

type RoadmapView = "outline" | "timeline" | "grand" | "level";

const VIEW_LABELS: Record<RoadmapView, string> = {
  outline: "Outline",
  timeline: "Timeline",
  grand: "Grand Roadmap",
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

  /** Opens the goal editor without touching Outline's expand state — Timeline/Grand Roadmap manage their own master toggle. */
  function editGoalOnly(goal: GoalRow) {
    setEditorMode({ entity: "goal", mode: { kind: "edit", goal } });
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="shrink-0 text-3xl font-semibold tracking-tight">Roadmap</h1>
        <RoadmapPipelineBar goals={roadmap.goals} loading={loading} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="btn-primary inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium shadow-sm transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
          onClick={openGoalForCreate}
        >
          <Plus weight="bold" className="size-3.5" />
          New goal
        </button>
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
            members={members}
          />
        )}
        {view === "timeline" && (
          <RoadmapTimelineView
            goals={goals}
            rootMilestonesByGoal={rootMilestonesByGoal}
            childrenByParent={childrenByParent}
            loading={loading}
            onEditGoal={editGoalOnly}
            onEditMilestone={editMilestoneOnly}
          />
        )}
        {view === "grand" && (
          <RoadmapGrandView
            goals={goals}
            rootMilestonesByGoal={rootMilestonesByGoal}
            childrenByParent={childrenByParent}
            loading={loading}
            onEditGoal={editGoalOnly}
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
