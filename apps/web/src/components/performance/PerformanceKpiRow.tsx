import { DASHBOARD_KPI_TONES, DashboardKpiWave } from "@/components/dashboard/kpi-primitives";
import type { PerformanceScorecardsResponse } from "@/lib/ledger-types";

function formatHours(seconds: number): string {
  const hrs = seconds / 3600;
  return hrs >= 100 ? Math.round(hrs).toString() : hrs.toFixed(1);
}

export function PerformanceKpiRow({
  totals,
  loading,
}: {
  totals: PerformanceScorecardsResponse["totals"] | undefined;
  loading: boolean;
}) {
  const t = totals;
  const complianceRate = t
    ? (() => {
        const required = t.submissionsRequired + t.attachmentsRequired;
        const fulfilled = t.submissionsFulfilled + t.attachmentsFulfilled;
        return required > 0 ? fulfilled / required : null;
      })()
    : null;

  const cards = [
    {
      label: "Completed",
      value: loading ? "…" : (t?.completed ?? 0).toString(),
      hint: "Tasks completed in this range",
    },
    {
      label: "Pending",
      value: loading ? "…" : (t?.pending ?? 0).toString(),
      hint: "Not yet started, right now",
    },
    {
      label: "In progress",
      value: loading ? "…" : (t?.inProgress ?? 0).toString(),
      hint: "Currently being worked, right now",
    },
    {
      label: "On-time rate",
      value: loading ? "…" : t ? `${Math.round(t.onTimeRate * 100)}%` : "—",
      hint: loading ? "" : `${t?.onTime ?? 0} on time · ${t?.late ?? 0} late`,
    },
    {
      label: "Compliance",
      value: loading ? "…" : complianceRate == null ? "—" : `${Math.round(complianceRate * 100)}%`,
      hint: "Required Discord submissions + attachments met",
    },
    {
      label: "Time logged",
      value: loading ? "…" : t ? `${formatHours(t.timeLoggedSeconds)}h` : "—",
      hint: "Hours logged in this range",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, i) => {
        const tone = DASHBOARD_KPI_TONES[i % DASHBOARD_KPI_TONES.length];
        return (
          <div
            key={card.label}
            className={`dashboard-kpi-card relative flex min-h-0 flex-col ${tone.toneClass} rounded-2xl p-2 sm:p-2.5`}
          >
            <DashboardKpiWave back={tone.waveBack} front={tone.waveFront} />
            <div className="relative z-[1]">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{card.label}</p>
              <p className="mt-0.5 text-4xl font-semibold tabular-nums leading-none tracking-tight">{card.value}</p>
              <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{card.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
