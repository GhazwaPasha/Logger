"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import type { Dept, ListRow, MemberRow, TaskRow } from "@/lib/ledger-types";
import { NODE_LABELS } from "@/lib/nodes";
import {
  FLOW_COLUMN_LABELS,
  normalizeTaskStatus,
  PRIORITY_LABELS,
  storedStatusToFlowColumn,
  taskMatchesDatePreset,
  taskPriority,
  taskShowsLateFooter,
  type ManualTaskStatus,
  type TaskPriority,
} from "@/lib/task-board";

const STATUS_BAR_ORDER: ManualTaskStatus[] = ["pending", "in_progress", "done", "cancelled"];

const STATUS_SEGMENT_BG: Record<ManualTaskStatus, string> = {
  pending: "bg-slate-500/55",
  in_progress: "bg-violet-500/55",
  done: "bg-emerald-500/55",
  cancelled: "bg-neutral-500/45",
};

const PRIORITY_ORDER: TaskPriority[] = ["high", "medium", "low"];

const PRIORITY_BAR_BG: Record<TaskPriority, string> = {
  high: "bg-rose-500/55",
  medium: "bg-amber-500/50",
  low: "bg-slate-400/45",
};

function workHref(base: string, query: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `${base}/work?${q}` : `${base}/work`;
}

const DASHBOARD_KPI_TONES = [
  {
    toneClass: "dashboard-kpi-card--tone-periwinkle",
    waveBack: "#c4d4ef",
    waveFront: "#aabfe6",
  },
  {
    toneClass: "dashboard-kpi-card--tone-lavender",
    waveBack: "#e3d0f2",
    waveFront: "#cfbae8",
  },
  {
    toneClass: "dashboard-kpi-card--tone-mint",
    waveBack: "#bae8d4",
    waveFront: "#9fdabe",
  },
  {
    toneClass: "dashboard-kpi-card--tone-amber",
    waveBack: "#ffd8b8",
    waveFront: "#ffc49a",
  },
] as const;

function DashboardKpiWave({ back, front }: { back: string; front: string }) {
  return (
    <svg
      className="dashboard-kpi-wave pointer-events-none absolute inset-x-0 bottom-0 h-[4.75rem] w-[112%] max-w-none -translate-x-[6%]"
      viewBox="0 0 400 72"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        fill={back}
        d="M0 40 C48 24 96 48 152 34 C208 20 256 44 304 32 C336 24 368 36 400 38 L400 72 L0 72 Z"
      />
      <path
        fill={front}
        d="M0 50 C64 36 128 56 196 44 C248 34 296 48 344 42 C362 39 382 44 400 46 L400 72 L0 72 Z"
      />
    </svg>
  );
}

function SegmentedBar({
  segments,
  emptyLabel,
}: {
  segments: { key: string; count: number; className: string; title: string }[];
  emptyLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) {
    return (
      <div className="rounded-full bg-[var(--surface-muted)] py-1 text-center text-xs text-[var(--muted)]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
      {segments.map(({ key, count, className, title }) => {
        if (count <= 0) return null;
        return (
          <div
            key={key}
            title={`${title}: ${count}`}
            className={`min-w-px shrink-0 ${className}`}
            style={{ flexGrow: count }}
          />
        );
      })}
    </div>
  );
}

export function DashboardOverview({
  basePath,
  depts,
  lists,
  tasks,
  members,
  workspaceLoading,
  currentUserId,
}: {
  basePath: string;
  depts: Dept[];
  lists: ListRow[];
  tasks: TaskRow[];
  members: MemberRow[];
  workspaceLoading: boolean;
  currentUserId: string | null;
}) {
  const activeTasks = useMemo(() => tasks.filter((t) => !t.deletedAt), [tasks]);

  const stats = useMemo(() => {
    let pipeline = 0;
    let done = 0;
    let cancelled = 0;
    let lateStatus = 0;
    let dueThisWeek = 0;
    let unassignedPipeline = 0;
    let minePipeline = 0;

    const workflowCounts: Record<ManualTaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
    };
    const priorityCounts: Record<TaskPriority, number> = { high: 0, medium: 0, low: 0 };
    let unsetPriority = 0;

    const levelPipeline: Record<string, number> = {};
    for (const d of depts) levelPipeline[d.id] = 0;

    const assigneePipeline: Record<string, number> = {};

    for (const t of activeTasks) {
      const st = normalizeTaskStatus(t.status);
      const col = storedStatusToFlowColumn(st);
      workflowCounts[col]++;

      const pri = taskPriority(t);
      if (t.priority) priorityCounts[pri]++;
      else unsetPriority++;

      if (col === "done") done++;
      else if (col === "cancelled") cancelled++;
      else {
        pipeline++;
        if (taskShowsLateFooter(t)) lateStatus++;
        if (taskMatchesDatePreset(t, "this_week")) dueThisWeek++;

        const ids = t.assigneeUserIds ?? [];
        if (ids.length === 0) unassignedPipeline++;
        if (currentUserId && ids.includes(currentUserId)) minePipeline++;

        const list = lists.find((l) => l.id === t.listId);
        const deptId = list?.departmentId;
        if (deptId && deptId in levelPipeline) levelPipeline[deptId]++;

        for (const uid of ids) {
          assigneePipeline[uid] = (assigneePipeline[uid] ?? 0) + 1;
        }
      }
    }

    const topAssignees = Object.entries(assigneePipeline)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const levelRows = depts
      .map((d) => ({ dept: d, count: levelPipeline[d.id] ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    let subtasksTotal = 0;
    let subtasksDone = 0;
    for (const t of activeTasks) {
      const subs = t.subtasks;
      if (!subs?.length) continue;
      for (const s of subs) {
        subtasksTotal++;
        if (s.done) subtasksDone++;
      }
    }

    return {
      pipeline,
      done,
      cancelled,
      lateStatus,
      dueThisWeek,
      unassignedPipeline,
      minePipeline,
      workflowCounts,
      priorityCounts,
      unsetPriority,
      levelRows,
      topAssignees,
      subtasksTotal,
      subtasksDone,
    };
  }, [activeTasks, depts, lists, currentUserId]);

  const loading = workspaceLoading;

  const statusSegments = STATUS_BAR_ORDER.map((st) => ({
    key: st,
    count: stats.workflowCounts[st],
    className: STATUS_SEGMENT_BG[st],
    title: FLOW_COLUMN_LABELS[st],
  }));

  const prioritySegments = [
    ...PRIORITY_ORDER.map((p) => ({
      key: p,
      count: stats.priorityCounts[p],
      className: PRIORITY_BAR_BG[p],
      title: PRIORITY_LABELS[p],
    })),
    ...(stats.unsetPriority > 0
      ? [
          {
            key: "unset",
            count: stats.unsetPriority,
            className: "bg-[var(--border-subtle)]",
            title: "No priority",
          },
        ]
      : []),
  ];

  const subtaskPct =
    stats.subtasksTotal > 0 ? Math.round((stats.subtasksDone / stats.subtasksTotal) * 100) : 0;

  const emptyWorkspace =
    !loading && depts.length === 0 && lists.length === 0 && activeTasks.length === 0;

  if (emptyWorkspace) {
    return (
      <div className="space-y-4">
        <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-5 text-center">
          <p className="text-sm font-medium text-[var(--fg)]">This workspace is empty</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add {NODE_LABELS.level}s and lists under Work, then create your first {NODE_LABELS.workItem.toLowerCase()}.
          </p>
          <Link href={`${basePath}/work`} className="btn-primary mt-6 inline-flex rounded-xl px-5">
            Go to Work
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LoadingFrame show={loading} className="rounded-2xl p-0.5" ribbonRadius="2xl" aria-label="Loading dashboard">
      <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(14.5rem,19rem)] lg:grid-rows-[auto_auto]">
        <Link
          href={workHref(basePath, { status: "pending_work" })}
          className={`dashboard-kpi-card flex min-h-0 flex-col ${DASHBOARD_KPI_TONES[0].toneClass} rounded-2xl p-3 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] sm:p-3.5 lg:col-start-1 lg:row-start-1 lg:h-full`}
        >
          <DashboardKpiWave back={DASHBOARD_KPI_TONES[0].waveBack} front={DASHBOARD_KPI_TONES[0].waveFront} />
          <div className="relative z-[1]">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Pending work</p>
            <p className="mt-0.5 text-4xl font-semibold tabular-nums leading-none tracking-tight">
              {loading ? "…" : stats.workflowCounts.pending}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{FLOW_COLUMN_LABELS.pending} queue</p>
          </div>
        </Link>
        <Link
          href={workHref(basePath, { status: "active_work" })}
          className={`dashboard-kpi-card flex min-h-0 flex-col ${DASHBOARD_KPI_TONES[1].toneClass} rounded-2xl p-3 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] sm:p-3.5 lg:col-start-2 lg:row-start-1 lg:h-full`}
        >
          <DashboardKpiWave back={DASHBOARD_KPI_TONES[1].waveBack} front={DASHBOARD_KPI_TONES[1].waveFront} />
          <div className="relative z-[1]">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Active work</p>
            <p className="mt-0.5 text-4xl font-semibold tabular-nums leading-none tracking-tight">
              {loading ? "…" : stats.workflowCounts.in_progress}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{FLOW_COLUMN_LABELS.in_progress}</p>
          </div>
        </Link>
        <div
          className={`dashboard-kpi-card flex min-h-0 flex-col ${DASHBOARD_KPI_TONES[2].toneClass} rounded-2xl p-3 sm:p-3.5 lg:col-start-1 lg:row-start-2 lg:h-full`}
        >
          <DashboardKpiWave back={DASHBOARD_KPI_TONES[2].waveBack} front={DASHBOARD_KPI_TONES[2].waveFront} />
          <div className="relative z-[1]">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Completed</p>
            <p className="mt-0.5 text-4xl font-semibold tabular-nums leading-none tracking-tight text-emerald-600 dark:text-emerald-400">
              {loading ? "…" : stats.done}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">Tasks marked done</p>
          </div>
        </div>
        <div
          className={`dashboard-kpi-card flex min-h-0 flex-col ${DASHBOARD_KPI_TONES[3].toneClass} rounded-2xl p-3 sm:p-3.5 lg:col-start-2 lg:row-start-2 lg:h-full`}
        >
          <DashboardKpiWave back={DASHBOARD_KPI_TONES[3].waveBack} front={DASHBOARD_KPI_TONES[3].waveFront} />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">Workspace</p>
            <dl className="mt-2 flex flex-1 flex-col justify-center gap-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-[var(--muted)]">Members</dt>
                <dd className="text-xl font-semibold tabular-nums leading-none tracking-tight">{loading ? "…" : members.length}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-[var(--muted)]">{NODE_LABELS.level}s</dt>
                <dd className="text-xl font-semibold tabular-nums leading-none tracking-tight">{loading ? "…" : depts.length}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-[var(--muted)]">Lists</dt>
                <dd className="text-xl font-semibold tabular-nums leading-none tracking-tight">{loading ? "…" : lists.length}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="surface-elevated ui-elevated-panel flex min-h-0 flex-col rounded-2xl border border-[var(--border-subtle)] p-3.5 sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:h-full">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Needs attention</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Jump to Work with filters applied.</p>
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1.5 lg:mt-3 lg:flex-1 lg:flex-col lg:gap-2 lg:pt-1">
            <Link
              href={workHref(basePath, { status: "late" })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-2 text-center text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] lg:w-full lg:justify-start lg:text-left"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden />
              Late ({loading ? "…" : stats.lateStatus})
            </Link>
            <Link
              href={workHref(basePath, { due: "this_week" })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-2 text-center text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] lg:w-full lg:justify-start lg:text-left"
            >
              Due this week ({loading ? "…" : stats.dueThisWeek})
            </Link>
            <Link
              href={workHref(basePath, { unassigned: "1" })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-2 text-center text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] lg:w-full lg:justify-start lg:text-left"
            >
              Unassigned ({loading ? "…" : stats.unassignedPipeline})
            </Link>
            {currentUserId ? (
              <Link
                href={workHref(basePath, { mine: "1" })}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-muted)] px-2.5 py-2 text-center text-sm font-medium transition-colors hover:opacity-90 lg:w-full lg:justify-start lg:text-left"
              >
                My tasks ({loading ? "…" : stats.minePipeline})
              </Link>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="grid gap-x-4 gap-y-3 lg:grid-cols-2">
        <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Status mix</h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">All active tasks (not deleted)</p>
            </div>
            <Link href={`${basePath}/work`} className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline">
              Open Work
            </Link>
          </div>
          <div className="mt-2">
            <SegmentedBar segments={statusSegments} emptyLabel="No tasks yet" />
          </div>
          <ul className="mt-2 grid gap-x-2 gap-y-1 sm:grid-cols-2">
            {STATUS_BAR_ORDER.map((st) => (
              <li key={st} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_SEGMENT_BG[st]}`} aria-hidden />
                  <span className="truncate">{FLOW_COLUMN_LABELS[st]}</span>
                </span>
                <Link
                  href={workHref(basePath, { status: st })}
                  className="tabular-nums font-medium text-[var(--fg)] hover:text-[var(--accent)]"
                >
                  {loading ? "…" : stats.workflowCounts[st]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Priority</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Where urgency is set on tasks</p>
          <div className="mt-2">
            <SegmentedBar
              segments={prioritySegments}
              emptyLabel="No tasks or priorities recorded"
            />
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {PRIORITY_ORDER.map((p) => (
              <li key={p} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[var(--muted)]">
                  <span className={`h-2 w-2 rounded-full ${PRIORITY_BAR_BG[p]}`} aria-hidden />
                  {PRIORITY_LABELS[p]}
                </span>
                <span className="tabular-nums font-medium text-[var(--fg)]">{loading ? "…" : stats.priorityCounts[p]}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2">
              <span className="text-[var(--muted)]">No priority set</span>
              <span className="tabular-nums font-medium text-[var(--fg)]">{loading ? "…" : stats.unsetPriority}</span>
            </li>
          </ul>
        </div>
      </div>

      {stats.subtasksTotal > 0 ? (
        <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Checklist progress</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Subtasks across tasks · {stats.subtasksDone} of {stats.subtasksTotal} done ({subtaskPct}%)
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-[width]"
              style={{ width: `${subtaskPct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-x-4 gap-y-3 lg:grid-cols-2">
        <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Active work by {NODE_LABELS.level.toLowerCase()}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Pipeline tasks grouped by list&apos;s level</p>
          {stats.levelRows.length === 0 && !loading ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No pipeline tasks to show.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {stats.levelRows.map(({ dept, count }) => {
                const max = stats.levelRows[0]?.count ?? 1;
                const w = max > 0 ? (count / max) * 100 : 0;
                return (
                  <li key={dept.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-[var(--fg)]">{dept.name}</span>
                      <Link
                        href={workHref(basePath, { level: dept.id })}
                        className="shrink-0 tabular-nums text-[var(--muted)] hover:text-[var(--accent)]"
                      >
                        {loading ? "…" : count}
                      </Link>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]/50"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Assignee load</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Pipeline tasks with someone assigned</p>
          {stats.topAssignees.length === 0 && !loading ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No assigned pipeline work.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {stats.topAssignees.map(([userId, count]) => {
                const m = members.find((x) => x.userId === userId);
                const label = m?.name?.trim() || m?.email || userId.slice(0, 8);
                const max = stats.topAssignees[0]?.[1] ?? 1;
                const w = max > 0 ? (count / max) * 100 : 0;
                return (
                  <li key={userId}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-[var(--fg)]">{label}</span>
                      <Link
                        href={workHref(basePath, { assignee: userId })}
                        className="shrink-0 tabular-nums text-[var(--muted)] hover:text-[var(--accent)]"
                      >
                        {loading ? "…" : count}
                      </Link>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div className="h-full rounded-full bg-violet-500/45" style={{ width: `${w}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      </div>
    </LoadingFrame>
  );
}
