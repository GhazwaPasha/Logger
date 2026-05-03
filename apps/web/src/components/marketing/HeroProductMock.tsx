/** Hero-side product preview with subtle CSS motion (shimmer, float). */

export function HeroProductMock() {
  return (
    <div
      className="relative mt-10 hidden min-h-[280px] min-w-0 xl:mt-0 xl:block 2xl:min-h-[320px]"
      aria-hidden
    >
      <div className="home-mock-float absolute inset-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/85 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
          <span className="home-window-dot h-2.5 w-2.5 rounded-full bg-[var(--muted)]/35" />
          <span className="home-window-dot home-window-dot--delayed h-2.5 w-2.5 rounded-full bg-[var(--muted)]/25" />
          <span className="home-window-dot home-window-dot--delayed2 h-2.5 w-2.5 rounded-full bg-[var(--muted)]/20" />
          <span className="ml-2 font-mono-ledger text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
            Workspace · Task Management
          </span>
          <span className="home-live-pill ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)]/80 px-2 py-0.5 font-mono-ledger text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            <span className="home-live-dot h-1.5 w-1.5 shrink-0 rounded-full" />
            Live
          </span>
        </div>
        <div className="space-y-3 p-5 pt-4">
          <div className="home-task-card flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 p-3">
            <span className="home-checkbox-glow mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--accent)]/40 bg-[var(--accent-muted)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="home-shimmer-bar h-2.5 w-4/5 max-w-[14rem] rounded bg-[var(--fg)]/15" />
              <div className="home-shimmer-bar home-shimmer-bar--delayed h-2 w-full max-w-[11rem] rounded bg-[var(--muted)]/25" />
            </div>
          </div>
          <div className="home-task-card home-task-card--secondary flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-3 opacity-90">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-elevated)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="home-shimmer-bar h-2.5 w-3/4 max-w-[12rem] rounded bg-[var(--fg)]/12" />
              <div className="home-shimmer-bar home-shimmer-bar--delayed h-2 w-full max-w-[10rem] rounded bg-[var(--muted)]/20" />
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-base)]/40 px-3 py-2.5">
            <p className="font-mono-ledger text-[11px] leading-relaxed text-[var(--muted)]">
              <span className="home-plus-pulse text-[var(--accent)]">+</span> Say it like you mean it · we keep things tidy
            </p>
          </div>
        </div>

        {/* Decorative floating chips */}
        <div className="home-chip home-chip-a absolute -right-3 top-[38%] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95 px-2.5 py-1 font-mono-ledger text-[10px] font-medium text-[var(--muted)] shadow-sm backdrop-blur-sm">
          SYNCED
        </div>
        <div className="home-chip home-chip-b absolute -left-2 bottom-[26%] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95 px-2.5 py-1 font-mono-ledger text-[10px] font-medium text-[var(--muted)] shadow-sm backdrop-blur-sm">
          EXPORT
        </div>
      </div>
    </div>
  );
}
