/**
 * Terminal / systems-log backdrop for the marketing home (CSS-only motion)—CRT-style scanlines,
 * a screen vignette, and faint decorative log lines instead of a generic SaaS aurora-glow
 * gradient, since LogBase is literally about system activity logs.
 * Mounted once, fixed to the viewport, so it never scrolls with the page—content scrolling
 * past a static backdrop is the classic (and cheapest) true-parallax technique: zero-velocity
 * background vs. full-velocity foreground, no scroll-linked JS required for this layer.
 */

const logLinesTopLeft = [
  "2024-01-15T09:41:02Z  task.assigned     owner=alicew",
  "2024-01-15T09:41:15Z  status.updated    78%",
  "2024-01-15T14:02:44Z  file.attached     audit.pdf",
] as const;

const logLinesBottomRight = [
  "2024-01-16T08:12:09Z  export.requested  format=pdf",
  "2024-01-16T08:12:11Z  export.completed  200 OK",
] as const;

export function MarketingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Screen vignette—corner falloff like a CRT/terminal display, strictly grayscale off
          --fg so it matches every other surface in the app instead of a colorful glow. */}
      <div
        className="absolute inset-0 opacity-[0.9]"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 40%, transparent 45%, color-mix(in srgb, var(--fg) 7%, transparent) 100%)",
        }}
      />

      {/* CRT scanlines */}
      <div className="home-scanlines absolute inset-0" />

      {/* Decorative system-log lines—literal "log" texture, far enough to the edges to stay
          clear of real content columns. */}
      <div className="absolute right-[6%] top-[16%] hidden font-mono-ledger text-[11px] leading-[1.8] tracking-tight text-[var(--fg)] opacity-[0.06] lg:block">
        {logLinesTopLeft.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="absolute left-[6%] bottom-[14%] hidden text-right font-mono-ledger text-[11px] leading-[1.8] tracking-tight text-[var(--fg)] opacity-[0.06] lg:block">
        {logLinesBottomRight.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {/* Blinking terminal cursor accent */}
      <span className="home-cursor-blink absolute right-[6%] top-[calc(16%+3.6em)] hidden h-3 w-[7px] bg-[var(--fg)] opacity-20 lg:block" />

      {/* Status-light dots (decorative) */}
      <div className="home-orbit home-orbit-1 absolute left-[8%] top-[42%] h-2 w-2 rounded-full bg-[var(--accent)]/25" />
      <div className="home-orbit home-orbit-2 absolute right-[12%] top-[58%] h-1.5 w-1.5 rounded-full bg-[var(--accent)]/20" />
      <div className="home-orbit home-orbit-3 absolute left-[42%] bottom-[18%] h-1 w-1 rounded-full bg-[var(--muted)]/40" />
    </div>
  );
}
