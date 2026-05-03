/** Animated aurora blobs + drifting grid for the marketing home (CSS-only motion). */

export function MarketingBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft base wash */}
      <div
        className="home-marketing-gradient absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -20%, var(--accent-glow), transparent 55%), radial-gradient(ellipse 55% 50% at 100% 0%, var(--accent-glow-soft), transparent 50%), radial-gradient(ellipse 45% 40% at 0% 15%, var(--accent-glow-soft), transparent 45%)",
        }}
      />

      {/* Floating blobs */}
      <div className="home-blob home-blob-a absolute -left-[12%] top-[8%] h-[min(42vw,28rem)] w-[min(42vw,28rem)] rounded-full bg-[var(--accent-muted)]" />
      <div className="home-blob home-blob-b absolute -right-[8%] top-[28%] h-[min(38vw,22rem)] w-[min(38vw,22rem)] rounded-full bg-[var(--accent-muted)]" />
      <div className="home-blob home-blob-c absolute bottom-[5%] left-[18%] h-[min(36vw,18rem)] w-[min(36vw,18rem)] rounded-full bg-[var(--accent-glow)] opacity-80" />

      {/* Drifting grid */}
      <div className="home-grid-drift absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,black_0%,transparent_88%)]" />

      {/* Orbiting dots (decorative) */}
      <div className="home-orbit home-orbit-1 absolute left-[8%] top-[42%] h-2 w-2 rounded-full bg-[var(--accent)]/25" />
      <div className="home-orbit home-orbit-2 absolute right-[12%] top-[58%] h-1.5 w-1.5 rounded-full bg-[var(--accent)]/20" />
      <div className="home-orbit home-orbit-3 absolute left-[42%] bottom-[18%] h-1 w-1 rounded-full bg-[var(--muted)]/40" />
    </div>
  );
}
