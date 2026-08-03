"use client";

import { Fragment, useMemo, useState } from "react";
import { SegmentedBar } from "@/components/dashboard/kpi-primitives";
import { MemberTaskTable } from "@/components/performance/MemberTaskTable";
import { useMemberTasks } from "@/hooks/useMemberTasks";
import { nameInitials } from "@/lib/member-utils";
import type { PerformanceScorecardRow } from "@/lib/ledger-types";

type SortKey = "completed" | "onTimeRate" | "openAssigned" | "timeLoggedSeconds";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "completed", label: "Completed" },
  { key: "onTimeRate", label: "On-time" },
  { key: "openAssigned", label: "Workload" },
  { key: "timeLoggedSeconds", label: "Time logged" },
];

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0h";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

function complianceSegments(fulfilled: number, required: number) {
  return [
    { key: "fulfilled", count: fulfilled, className: "bg-emerald-500/60", title: "Fulfilled" },
    { key: "missing", count: Math.max(0, required - fulfilled), className: "bg-rose-500/55", title: "Missing" },
  ];
}

function MemberDetail({
  member,
  token,
  organizationId,
  range,
  workHrefBase,
}: {
  member: PerformanceScorecardRow;
  token: string | null;
  organizationId: string | null;
  range: { dateFrom?: string; dateTo?: string };
  workHrefBase: string;
}) {
  const tasksQuery = useMemberTasks(token, organizationId, member.userId, true, range);

  const hasWorkload = member.pending > 0 || member.inProgress > 0;
  const hasCompliance = member.submissionsRequired > 0 || member.submissionsOptional > 0 || member.attachmentsRequired > 0;

  return (
    <div className="space-y-3 border-t border-[var(--border-subtle)] px-1 py-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Current workload</p>
          {hasWorkload ? (
            <>
              <div className="mt-1.5">
                <SegmentedBar
                  segments={[
                    { key: "pending", count: member.pending, className: "bg-slate-500/55", title: "Pending" },
                    { key: "in_progress", count: member.inProgress, className: "bg-violet-500/55", title: "In progress" },
                  ]}
                  emptyLabel="Nothing open"
                />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {member.pending} pending · {member.inProgress} in progress
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">Nothing open right now.</p>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Compliance</p>
          {hasCompliance ? (
            <div className="mt-1.5 space-y-2">
              {member.submissionsRequired > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                    <span>Required Discord submissions</span>
                    <span className="tabular-nums">
                      {member.submissionsFulfilled}/{member.submissionsRequired}
                    </span>
                  </div>
                  <SegmentedBar
                    segments={complianceSegments(member.submissionsFulfilled, member.submissionsRequired)}
                    emptyLabel="—"
                  />
                </div>
              )}
              {member.submissionsOptional > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                    <span>Optional Discord submissions</span>
                    <span className="tabular-nums">
                      {member.submissionsOptionalFulfilled}/{member.submissionsOptional}
                    </span>
                  </div>
                  <SegmentedBar
                    segments={[
                      { key: "done", count: member.submissionsOptionalFulfilled, className: "bg-sky-500/55", title: "Submitted" },
                      {
                        key: "skipped",
                        count: Math.max(0, member.submissionsOptional - member.submissionsOptionalFulfilled),
                        className: "bg-[var(--surface-hover)]",
                        title: "Not submitted (not required)",
                      },
                    ]}
                    emptyLabel="—"
                  />
                </div>
              )}
              {member.attachmentsRequired > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                    <span>Required attachments</span>
                    <span className="tabular-nums">
                      {member.attachmentsFulfilled}/{member.attachmentsRequired}
                    </span>
                  </div>
                  <SegmentedBar
                    segments={complianceSegments(member.attachmentsFulfilled, member.attachmentsRequired)}
                    emptyLabel="—"
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">No Discord or attachment requirements in this range.</p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {member.name || member.email}&rsquo;s tasks
        </p>
        <div className="mt-1.5">
          <MemberTaskTable
            tasks={tasksQuery.data ?? []}
            loading={tasksQuery.isPending}
            workHrefBase={workHrefBase}
          />
        </div>
      </div>
    </div>
  );
}

export function MemberScorecardList({
  members,
  loading,
  token,
  organizationId,
  range,
  workHrefBase,
}: {
  members: PerformanceScorecardRow[];
  loading: boolean;
  token: string | null;
  organizationId: string | null;
  range: { dateFrom?: string; dateTo?: string };
  workHrefBase: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("completed");
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const rows = [...members];
    rows.sort((a, b) => (sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return rows;
  }, [members, sortKey, sortDesc]);

  const maxCompleted = Math.max(1, ...members.map((m) => m.completed));
  const maxWorkload = Math.max(1, ...members.map((m) => m.pending + m.inProgress));

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  if (!loading && members.length === 0) {
    return <p className="mt-2 text-sm text-[var(--muted)]">No one in scope for this range yet.</p>;
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <th className="pb-1.5 pr-2 font-medium">Person</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="pb-1.5 pl-2 font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex items-center gap-1 tabular-nums text-[var(--muted)] hover:text-[var(--fg)]"
                >
                  {col.label}
                  {sortKey === col.key ? <span aria-hidden>{sortDesc ? "↓" : "↑"}</span> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {sorted.map((m) => {
            const expanded = expandedId === m.userId;
            const workload = m.pending + m.inProgress;
            return (
              <Fragment key={m.userId}>
                <tr
                  className="cursor-pointer hover:bg-[var(--surface-hover)]"
                  onClick={() => setExpandedId(expanded ? null : m.userId)}
                  aria-expanded={expanded}
                >
                  <td className="py-2 pr-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className={`shrink-0 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
                      >
                        ›
                      </span>
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image} alt="" className="size-6 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--fg)]">
                          {nameInitials(m.name, m.email)}
                        </span>
                      )}
                      <span className="min-w-0 truncate font-medium text-[var(--fg)]">{m.name || m.email}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]/50"
                        style={{ width: `${(m.completed / maxCompleted) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2 pl-2 tabular-nums font-medium text-[var(--fg)]">{m.completed}</td>
                  <td className="py-2 pl-2 tabular-nums">
                    {m.onTime + m.late > 0 ? (
                      <span
                        className={
                          m.onTimeRate >= 0.8
                            ? "text-emerald-600 dark:text-emerald-400"
                            : m.onTimeRate >= 0.5
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        {Math.round(m.onTimeRate * 100)}%
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="py-2 pl-2">
                    <div className="tabular-nums text-[var(--fg)]">{workload}</div>
                    {workload > 0 && (
                      <div className="mt-1 w-16">
                        <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full bg-slate-500/55"
                            style={{ width: `${(m.pending / maxWorkload) * 100}%` }}
                            title={`Pending: ${m.pending}`}
                          />
                          <div
                            className="h-full bg-violet-500/55"
                            style={{ width: `${(m.inProgress / maxWorkload) * 100}%` }}
                            title={`In progress: ${m.inProgress}`}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pl-2 tabular-nums text-[var(--fg)]">{formatDuration(m.timeLoggedSeconds)}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="p-0">
                      <MemberDetail
                        member={m}
                        token={token}
                        organizationId={organizationId}
                        range={range}
                        workHrefBase={workHrefBase}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
