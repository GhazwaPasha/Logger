export type DateRangePreset = 0 | 7 | 30 | 90;

export function presetToRange(days: DateRangePreset): { dateFrom: string; dateTo: string } {
  const dateTo = new Date();
  if (days === 0) {
    const dateFrom = new Date(dateTo);
    dateFrom.setHours(0, 0, 0, 0);
    return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
  }
  const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

export function DateRangePresets({
  value,
  onChange,
}: {
  value: DateRangePreset;
  onChange: (days: DateRangePreset) => void;
}) {
  const options: { days: DateRangePreset; label: string }[] = [
    { days: 0, label: "Today" },
    { days: 7, label: "7 days" },
    { days: 30, label: "30 days" },
    { days: 90, label: "90 days" },
  ];
  return (
    <div
      className="inline-flex shrink-0 items-center rounded-xl bg-[var(--surface-elevated)] p-0.5"
      role="group"
      aria-label="Date range"
    >
      {options.map((opt) => (
        <button
          key={opt.days}
          type="button"
          className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
            value === opt.days
              ? "bg-[var(--accent-muted)] text-[var(--fg)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          }`}
          onClick={() => onChange(opt.days)}
          aria-pressed={value === opt.days}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
