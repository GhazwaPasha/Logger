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
