"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { HBarChart } from "@/components/dashboard/HBarChart";
import { RoadmapDashboardPanel } from "@/components/dashboard/RoadmapDashboardPanel";
import { StatusPriorityRing } from "@/components/dashboard/StatusPriorityRing";
import { DashboardKpiWave, HOME_KPI_TONES, type KpiTone } from "@/components/dashboard/kpi-primitives";
import { POP_EASE } from "@/components/ui/motion-presets";
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

const STATUS_ORDER: ManualTaskStatus[] = ["pending", "in_progress", "done", "cancelled"];
const PRIORITY_ORDER: TaskPriority[] = ["high", "medium", "low"];

/** Ring colours: the same full-strength hues as the mobile dashboard, so the meter reads at a glance. */
const STATUS_COLOR: Record<ManualTaskStatus, string> = {
  pending: "#94a3b8",
  in_progress: "#8b5cf6",
  done: "#10b981",
  cancelled: "#737373",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: "#f43f5e",
  medium: "#f59e0b",
  low: "#94a3b8",
};

/** Entrance rhythm shared with mobile: each panel lands 60ms after the last. */
const SEQUENCE_STEP_S = 0.06;
const SEQUENCE_ENTER_S = 0.36;
/** When step `index` has mostly landed — its own content animation (ring fill, bar growth) starts here. */
const sequenceSettled = (index: number) => index * SEQUENCE_STEP_S + SEQUENCE_ENTER_S * 0.7;

function workHref(base: string, query: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `${base}/work?${q}` : `${base}/work`;
}

export type DashboardStats = ReturnType<typeof useDashboardStats>;

/**
 * Workspace numbers for the dashboard. Each recurring chain counts once in the done / cancelled totals (every
 * repeat is its own task row, so a daily task would otherwise count once per day) — the same way the board
 * collapses a chain into one card.
 */
export function useDashboardStats(
  tasks: TaskRow[],
  depts: Dept[],
  lists: ListRow[],
  currentUserId: string | null,
  timeZone: string,
) {
  return useMemo(() => {
    const workflow: Record<ManualTaskStatus, number> = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };
    const priority: Record<TaskPriority, number> = { high: 0, medium: 0, low: 0 };
    const byDept = new Map<string, number>();
    const byAssignee = new Map<string, number>();
    const deptOfList = new Map(lists.map((l) => [l.id, l.departmentId]));
    const closedChains = { done: new Set<string>(), cancelled: new Set<string>() };
    let open = 0;
    let overdue = 0;
    let dueThisWeek = 0;
    let unassigned = 0;
    let mine = 0;
    let subtasksTotal = 0;
    let subtasksDone = 0;

    for (const t of tasks) {
      if (t.deletedAt) continue;
      const col = storedStatusToFlowColumn(normalizeTaskStatus(t.status));
      for (const s of t.subtasks ?? []) {
        subtasksTotal++;
        if (s.done) subtasksDone++;
      }
      if (col === "done" || col === "cancelled") {
        if (t.recurringSeriesId) {
          if (closedChains[col].has(t.recurringSeriesId)) continue;
          closedChains[col].add(t.recurringSeriesId);
        }
        workflow[col]++;
        continue;
      }
      workflow[col]++;
      open++;
      priority[taskPriority(t)]++;
      if (taskShowsLateFooter(t)) overdue++;
      if (taskMatchesDatePreset(t, "this_week", timeZone)) dueThisWeek++;
      const deptId = deptOfList.get(t.listId);
      if (deptId) byDept.set(deptId, (byDept.get(deptId) ?? 0) + 1);
      const ids = t.assigneeUserIds ?? [];
      if (ids.length === 0) unassigned++;
      if (currentUserId && ids.includes(currentUserId)) mine++;
      for (const id of ids) byAssignee.set(id, (byAssignee.get(id) ?? 0) + 1);
    }

    const topAssignees = [...byAssignee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      workflow,
      priority,
      byDept,
      topAssignees,
      open,
      overdue,
      dueThisWeek,
      unassigned,
      mine,
      subtasksTotal,
      subtasksDone,
      empty: depts.length === 0 && lists.length === 0 && tasks.length === 0,
    };
  }, [tasks, depts, lists, currentUserId, timeZone]);
}

/** One step of the page's top-to-bottom entrance: fade up 10px, 60ms after the step before it. */
export function Seq({ index, className, children }: { index: number; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SEQUENCE_ENTER_S, delay: index * SEQUENCE_STEP_S, ease: POP_EASE }}
    >
      {children}
    </motion.div>
  );
}

function KpiCard({
  tone,
  index,
  href,
  children,
}: {
  tone: KpiTone;
  index: number;
  href?: string;
  children: ReactNode;
}) {
  const className = `dashboard-kpi-card ${tone.toneClass} flex h-full min-h-[7.5rem] flex-col rounded-2xl p-3 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] sm:p-3.5`;
  const body = (
    <>
      <DashboardKpiWave back={tone.waveBack} front={tone.waveFront} />
      <div className="relative z-[1]">{children}</div>
    </>
  );
  return (
    <Seq index={index}>
      {href ? (
        <Link href={href} className={className}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </Seq>
  );
}

const KpiLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{children}</p>
);
const KpiNote = ({ children }: { children: ReactNode }) => (
  <p className="mt-1 truncate text-[11px] text-[var(--muted)]">{children}</p>
);
function KpiValue({ loading, className, children }: { loading: boolean; className?: string; children: ReactNode }) {
  return loading ? (
    <span className="mt-1.5 mb-0.5 block h-8 w-11 animate-pulse rounded-lg bg-[var(--surface-muted)] motion-reduce:animate-none" />
  ) : (
    <p className={`mt-0.5 text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums ${className ?? ""}`}>
      {children}
    </p>
  );
}

export function DashboardOverview({
  basePath,
  stats,
  depts,
  lists,
  members,
  loading,
  currentUserId,
}: {
  basePath: string;
  stats: DashboardStats;
  depts: Dept[];
  lists: ListRow[];
  members: MemberRow[];
  loading: boolean;
  currentUserId: string | null;
}) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  if (!loading && stats.empty) {
    return (
      <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-5 text-center">
        <p className="text-sm font-medium text-[var(--fg)]">This workspace is empty</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Add {NODE_LABELS.level}s and {NODE_LABELS.list.toLowerCase()}s under Work, then create your first{" "}
          {NODE_LABELS.workItem.toLowerCase()}.
        </p>
        <Link href={`${basePath}/work`} className="btn-primary mt-6 inline-flex rounded-xl px-5">
          Go to Work
        </Link>
      </div>
    );
  }

  const { rose, gold, periwinkle, peach } = HOME_KPI_TONES;
  const subtaskPct = stats.subtasksTotal > 0 ? Math.round((stats.subtasksDone / stats.subtasksTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiCard tone={rose} index={1} href={workHref(basePath, { status: "late" })}>
          <KpiLabel>Overdue</KpiLabel>
          <KpiValue loading={loading} className={stats.overdue > 0 ? "text-red-600 dark:text-red-400" : undefined}>
            {stats.overdue}
          </KpiValue>
          <KpiNote>Past their due date</KpiNote>
        </KpiCard>
        <KpiCard tone={gold} index={2} href={workHref(basePath, { unassigned: "1" })}>
          <KpiLabel>Unassigned</KpiLabel>
          <KpiValue loading={loading}>{stats.unassigned}</KpiValue>
          <KpiNote>Waiting for an owner</KpiNote>
        </KpiCard>
        <KpiCard tone={periwinkle} index={3} href={currentUserId ? workHref(basePath, { mine: "1" }) : undefined}>
          <KpiLabel>Assigned to me</KpiLabel>
          <KpiValue loading={loading}>{stats.mine}</KpiValue>
          <KpiNote>On your plate</KpiNote>
        </KpiCard>
        <KpiCard tone={peach} index={4}>
          <KpiLabel>Workspace</KpiLabel>
          <dl className="mt-1.5 grid grid-cols-3 gap-2">
            {[
              { label: "Members", value: members.length },
              { label: NODE_LABELS.levelPlural, value: depts.length },
              { label: NODE_LABELS.listPlural, value: lists.length },
            ].map(({ label, value }) => (
              <div key={label} className="flex min-w-0 flex-col-reverse">
                <dt className="truncate text-[11px] text-[var(--muted)]">{label}</dt>
                <dd className="text-2xl font-semibold leading-tight tabular-nums">
                  {loading ? (
                    <span className="my-0.5 block h-5 w-6 animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </KpiCard>
      </div>

      <div className="grid items-center gap-x-10 gap-y-6 py-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Seq index={5}>
          <StatusPriorityRing
            topTitle="Status"
            bottomTitle="Priority"
            topLabel="tasks"
            bottomLabel="open"
            loading={loading}
            fillDelay={sequenceSettled(5)}
            top={STATUS_ORDER.map((st) => ({
              key: st,
              label: FLOW_COLUMN_LABELS[st],
              value: stats.workflow[st],
              color: STATUS_COLOR[st],
              href: workHref(basePath, { status: st }),
            }))}
            bottom={PRIORITY_ORDER.map((p) => ({
              key: p,
              label: PRIORITY_LABELS[p],
              value: stats.priority[p],
              color: PRIORITY_COLOR[p],
            }))}
          />
        </Seq>

        <div className="space-y-5">
          <Seq index={6}>
            <HBarChart
              title={`By ${NODE_LABELS.level.toLowerCase()}`}
              total={`${stats.open} open`}
              color="#8b5cf6"
              emptyLabel={`No ${NODE_LABELS.levelPlural.toLowerCase()} yet.`}
              loading={loading}
              growDelay={sequenceSettled(6) * 1000}
              rows={depts.map((d) => ({
                key: d.id,
                label: d.name,
                value: stats.byDept.get(d.id) ?? 0,
                href: workHref(basePath, { level: d.id }),
              }))}
            />
          </Seq>
          <Seq index={7}>
            <HBarChart
              title="Assignee load"
              total="open tasks"
              color="#0ea5e9"
              emptyLabel="Nobody is assigned yet."
              loading={loading}
              growDelay={sequenceSettled(7) * 1000}
              rows={stats.topAssignees.map(([id, n]) => {
                const m = memberById.get(id);
                return {
                  key: id,
                  label: m?.name?.trim() || m?.email || "Someone",
                  value: n,
                  href: workHref(basePath, { assignee: id }),
                  avatar: { name: m?.name, email: m?.email, image: m?.image },
                };
              })}
            />
          </Seq>
        </div>
      </div>

      <Seq index={8} className="space-y-2.5">
        {stats.subtasksTotal > 0 ? (
          <div className="px-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-outfit text-base font-semibold tracking-tight">Checklist progress</h2>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                {stats.subtasksDone}/{stats.subtasksTotal} · {subtaskPct}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${subtaskPct}%` }} />
            </div>
          </div>
        ) : null}
        <RoadmapDashboardPanel basePath={basePath} />
      </Seq>
    </div>
  );
}
