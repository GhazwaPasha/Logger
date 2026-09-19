export const DASHBOARD_KPI_TONES = [
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

export function DashboardKpiWave({ back, front }: { back: string; front: string }) {
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

const DONUT_RADIUS = 15.9155; // circumference ≈ 100, so dash lengths read as percentages

export function DonutChart({
  segments,
  centerLabel,
  emptyLabel,
}: {
  segments: { key: string; count: number; strokeClassName: string; title: string }[];
  centerLabel: string;
  emptyLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  const visible = segments.filter((s) => s.count > 0);
  const gap = visible.length > 1 ? 0.8 : 0;
  let offset = 0;
  return (
    <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`${centerLabel}: ${total}`}>
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
        <circle
          cx="21"
          cy="21"
          r={DONUT_RADIUS}
          fill="none"
          strokeWidth="5"
          className="stroke-[color:var(--surface-muted)]"
        />
        {visible.map(({ key, count, strokeClassName, title }) => {
          const pct = (count / total) * 100;
          const dash = Math.max(pct - gap, 0.01);
          const circle = (
            <circle
              key={key}
              cx="21"
              cy="21"
              r={DONUT_RADIUS}
              fill="none"
              strokeWidth="5"
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={-offset}
              className={strokeClassName}
            >
              <title>{`${title}: ${count}`}</title>
            </circle>
          );
          offset += pct;
          return circle;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {total === 0 ? (
          <span className="px-3 text-[10px] leading-tight text-[var(--muted)]">{emptyLabel}</span>
        ) : (
          <>
            <span className="text-xl font-semibold tabular-nums leading-none text-[var(--fg)]">{total}</span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">{centerLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function SegmentedBar({
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
