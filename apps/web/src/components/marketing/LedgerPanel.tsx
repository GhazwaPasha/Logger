/** Hero product visual: a CSS-drawn timestamped activity ledger (replaces the old task-checklist mock). */

const entries = [
  { time: "09:41", label: "Task assigned", detail: "92%" },
  { time: "11:15", label: "Status updated", detail: "78%" },
  { time: "14:02", label: "File attached", detail: "64%" },
  { time: "Yesterday", label: "Marked complete", detail: "88%" },
] as const;

export function LedgerPanel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/85 shadow-[0_28px_96px_-28px_rgba(0,0,0,0.14)] backdrop-blur-md dark:shadow-[0_28px_96px_-28px_rgba(0,0,0,0.48)] ${className}`}
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-6 py-3.5">
        <span className="home-window-dot h-3 w-3 rounded-full bg-[var(--muted)]/35" />
        <span className="home-window-dot home-window-dot--delayed h-3 w-3 rounded-full bg-[var(--muted)]/25" />
        <span className="home-window-dot home-window-dot--delayed2 h-3 w-3 rounded-full bg-[var(--muted)]/20" />
        <span className="ml-2 font-mono-ledger text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          Activity · Ledger
        </span>
      </div>

      <div className="p-6 pt-5">
        <ol className="relative space-y-5 border-l border-[var(--border-subtle)] pl-5">
          {entries.map((entry, index) => (
            <li key={entry.time} className="relative">
              <span
                className="home-checkbox-glow absolute -left-[1.65rem] top-1 h-2.5 w-2.5 rounded-full border border-[var(--accent)]/50 bg-[var(--accent-muted)]"
                style={{ animationDelay: `${index * 0.4}s` }}
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono-ledger text-[11px] uppercase tracking-wide text-[var(--muted)]">{entry.time}</span>
                <span className="font-mono-ledger text-[11px] text-[var(--muted)]/70">{entry.detail}</span>
              </div>
              <div className="mt-2 space-y-2">
                <div
                  className="home-shimmer-bar h-3 rounded bg-[var(--fg)]/15"
                  style={{ width: index === 0 ? "88%" : index === 1 ? "70%" : index === 2 ? "80%" : "60%" }}
                />
              </div>
              <p className="mt-1.5 text-[13px] text-[var(--muted)]">{entry.label}</p>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-base)]/40 px-4 py-3">
          <p className="font-mono-ledger text-[12px] leading-relaxed text-[var(--muted)]">
            <span className="home-plus-pulse text-[var(--accent)]">+</span> Export-ready · every entry timestamped
          </p>
        </div>
      </div>
    </div>
  );
}
