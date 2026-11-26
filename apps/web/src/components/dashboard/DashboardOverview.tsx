"use client";

import Link from "next/link";
import { DASHBOARD_WINDOW_DAYS } from "@work-ledger/contracts";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { AssigneeBubbles } from "@/components/dashboard/AssigneeBubbles";
import { CompletionsChart } from "@/components/dashboard/CompletionsChart";
import { DepartmentTreemap } from "@/components/dashboard/DepartmentTreemap";
import { Building2, CircleUserRound, Clock4, UserRoundX, type LucideIcon } from "lucide-react";
import { RoadmapDashboardPanel } from "@/components/dashboard/RoadmapDashboardPanel";
import { StatusPriorityRing } from "@/components/dashboard/StatusPriorityRing";
import { DashboardKpiWave, HOME_KPI_TONES, type KpiTone } from "@/components/dashboard/kpi-primitives";
import { SpringNumber } from "@/components/trackers/SpringNumber";
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

/** Ring colours come from the theme tokens, so light and dark each get their own validated steps. */
const STATUS_COLOR: Record<ManualTaskStatus, string> = {
  pending: "var(--status-pending)",
  in_progress: "var(--status-progress)",
  done: "var(--status-done)",
  cancelled: "var(--status-cancelled)",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
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
 * Workspace numbers for the dashboard. Done / cancelled come from `closed` (see `useClosedTaskCounts`), not from
 * `tasks`, whose closed rows only reach as far as the board has been scrolled.
 */
export function useDashboardStats(
  tasks: TaskRow[],
  depts: Dept[],
  lists: ListRow[],
  currentUserId: string | null,
  timeZone: string,
  closed: { done: number; cancelled: number } | null,
) {
  return useMemo(() => {
    const workflow: Record<ManualTaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      done: closed?.done ?? 0,
      cancelled: closed?.cancelled ?? 0,
    };
    const priority: Record<TaskPriority, number> = { high: 0, medium: 0, low: 0 };
    const byDept = new Map<string, number>();
    const byAssignee = new Map<string, number>();
    const deptOfList = new Map(lists.map((l) => [l.id, l.departmentId]));
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
      if (col === "done" || col === "cancelled") continue;
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
  }, [tasks, depts, lists, currentUserId, timeZone, closed]);
}

/** One step of the page's top-to-bottom entrance: flies up 24px on a spring, 60ms after the step before it. */
export function Seq({ index, className, children }: { index: number; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, transform: "translateY(24px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ type: "spring", duration: 0.55, bounce: 0.1, delay: index * SEQUENCE_STEP_S }}
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
  const className = `dashboard-kpi-card pressable ${tone.toneClass} flex h-full min-h-[8.25rem] flex-col rounded-[18px] p-4 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sheet)]`;
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

const KpiLabel = ({ icon: Icon, tint, children }: { icon: LucideIcon; tint: string; children: ReactNode }) => (
  <p className="flex items-center gap-1.5 text-footnote font-semibold text-[var(--muted)]">
    <Icon aria-hidden className="size-3.5" strokeWidth={2.4} style={{ color: tint }} />
    {children}
  </p>
);
const KpiNote = ({ children }: { children: ReactNode }) => (
  <p className="mt-auto truncate pt-2 text-xs text-[var(--muted)]">{children}</p>
);
const wholeNumber = (v: number | null) => String(Math.round(v ?? 0));

/** KPI number: counts up from 0 with a spring when the data lands (same as the tracker numbers). */
function KpiValue({ loading, className, value }: { loading: boolean; className?: string; value: number }) {
  return loading ? (
    <span className="mt-2.5 mb-0.5 block h-9 w-12 animate-pulse rounded-lg bg-[var(--fill-2)] motion-reduce:animate-none" />
  ) : (
    <p className={`mt-2.5 font-outfit text-figure font-semibold leading-none tracking-[-0.03em] tabular-nums ${className ?? ""}`}>
      <SpringNumber value={value} format={wholeNumber} />
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
      <div className="rounded-[18px] bg-[var(--card)] p-6 text-center shadow-card">
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
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard tone={rose} index={1} href={workHref(basePath, { status: "late" })}>
          <KpiLabel icon={Clock4} tint="var(--danger)">Overdue</KpiLabel>
          <KpiValue loading={loading} className={stats.overdue > 0 ? "text-[var(--danger)]" : undefined} value={stats.overdue} />
          <KpiNote>Past their due date</KpiNote>
        </KpiCard>
        <KpiCard tone={gold} index={2} href={workHref(basePath, { unassigned: "1" })}>
          <KpiLabel icon={UserRoundX} tint="var(--warning)">Unassigned</KpiLabel>
          <KpiValue loading={loading} value={stats.unassigned} />
          <KpiNote>Waiting for an owner</KpiNote>
        </KpiCard>
        <KpiCard tone={periwinkle} index={3} href={currentUserId ? workHref(basePath, { mine: "1" }) : undefined}>
          <KpiLabel icon={CircleUserRound} tint="var(--dept-1)">Assigned to me</KpiLabel>
          <KpiValue loading={loading} value={stats.mine} />
          <KpiNote>On your plate</KpiNote>
        </KpiCard>
        <KpiCard tone={peach} index={4}>
          <KpiLabel icon={Building2} tint="var(--dept-2)">Workspace</KpiLabel>
          <dl className="mt-2.5 grid grid-cols-3 gap-2">
            {[
              { label: "Members", value: members.length },
              { label: NODE_LABELS.levelPlural, value: depts.length },
              { label: NODE_LABELS.listPlural, value: lists.length },
            ].map(({ label, value }) => (
              <div key={label} className="flex min-w-0 flex-col-reverse">
                <dt className="truncate text-caption text-[var(--muted)]">{label}</dt>
                <dd className="font-outfit text-3xl font-semibold leading-tight tracking-[-0.02em] tabular-nums">
                  {loading ? (
                    <span className="my-0.5 block h-5 w-6 animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
                  ) : (
                    <SpringNumber value={value} format={wholeNumber} />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </KpiCard>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Seq index={5} className="min-w-0">
          <CompletionsChart />
        </Seq>
        <Seq index={6} className="min-w-0">
          <section className="flex h-full flex-col rounded-[18px] bg-[var(--card)] p-5 shadow-card">
            <StatusPriorityRing
              // Done / cancelled only count the last N days; said once in the heading so row labels stay short.
            topTitle={`Status · closed ${DASHBOARD_WINDOW_DAYS}d`}
              bottomTitle="Priority"
              topLabel="tasks"
              bottomLabel="open"
              loading={loading}
              fillDelay={sequenceSettled(6)}
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
          </section>
        </Seq>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Seq index={7} className="min-w-0">
          <DepartmentTreemap
            title={`Open by ${NODE_LABELS.level.toLowerCase()}`}
            total={`${stats.open} open`}
            emptyLabel={`No ${NODE_LABELS.levelPlural.toLowerCase()} yet.`}
            loading={loading}
            items={depts.map((d, i) => ({
              key: d.id,
              label: d.name,
              value: stats.byDept.get(d.id) ?? 0,
              href: workHref(basePath, { level: d.id }),
              colorIndex: i,
            }))}
          />
        </Seq>
        <Seq index={8} className="min-w-0">
          <AssigneeBubbles
            title="Assignee load"
            total="open tasks"
            emptyLabel="Nobody is assigned yet."
            loading={loading}
            items={stats.topAssignees.map(([id, n]) => {
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

      <Seq index={9} className="space-y-2.5">
        {stats.subtasksTotal > 0 ? (
          <div className="rounded-[18px] bg-[var(--card)] p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-outfit text-base font-semibold">Checklist progress</h2>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                {stats.subtasksDone} of {stats.subtasksTotal} subtasks · {subtaskPct}%
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--fill)]">
              <motion.div
                className="h-full rounded-r-[4px] bg-[var(--status-done)]"
                initial={{ width: 0 }}
                animate={{ width: `${subtaskPct}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.7, delay: sequenceSettled(9) }}
              />
            </div>
          </div>
        ) : null}
        <RoadmapDashboardPanel basePath={basePath} />
      </Seq>
    </div>
  );
}
