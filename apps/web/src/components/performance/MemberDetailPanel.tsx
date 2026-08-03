"use client";

import { SegmentedBar } from "@/components/dashboard/kpi-primitives";
import { MemberTaskTable } from "@/components/performance/MemberTaskTable";
import { useMemberTasks } from "@/hooks/useMemberTasks";
import { nameInitials } from "@/lib/member-utils";
import type { PerformanceScorecardRow } from "@/lib/ledger-types";

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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight text-[var(--fg)]">{value}</p>
    </div>
  );
}

export function MemberDetailPanel({
  member,
  token,
  organizationId,
  range,
  workHrefBase,
}: {
  member: PerformanceScorecardRow | null;
  token: string | null;
  organizationId: string | null;
  range: { dateFrom?: string; dateTo?: string };
  workHrefBase: string;
}) {
  const tasksQuery = useMemberTasks(token, organizationId, member?.userId ?? null, member != null, range);

  if (!member) {
    return <p className="mt-3 text-sm text-[var(--muted)]">Select a team member above to see their breakdown.</p>;
  }

  const hasWorkload = member.pending > 0 || member.inProgress > 0;
  const hasCompliance = member.submissionsRequired > 0 || member.submissionsOptional > 0 || member.attachmentsRequired > 0;

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
      <div className="flex items-center gap-2">
        {member.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.image} alt="" className="size-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-xs font-semibold text-[var(--fg)]">
            {nameInitials(member.name, member.email)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--fg)]">{member.name || member.email}</p>
          <p className="text-xs capitalize text-[var(--muted)]">{member.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <StatTile label="Completed" value={String(member.completed)} />
        <StatTile
          label="On-time"
          value={member.onTime + member.late > 0 ? `${Math.round(member.onTimeRate * 100)}%` : "—"}
        />
        <StatTile label="Workload" value={String(member.pending + member.inProgress)} />
        <StatTile label="Time logged" value={formatDuration(member.timeLoggedSeconds)} />
      </div>

      <div className="space-y-3">
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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Tasks</p>
        <div className="mt-1.5">
          <MemberTaskTable tasks={tasksQuery.data ?? []} loading={tasksQuery.isPending} workHrefBase={workHrefBase} />
        </div>
      </div>
    </div>
  );
}
