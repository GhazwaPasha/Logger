/** Hero-side product preview with subtle CSS motion (shimmer, float). */

export function HeroProductMock() {
  return (
    <div
      className="relative mt-10 hidden min-h-[400px] min-w-0 xl:mt-0 xl:block xl:min-h-[420px] 2xl:min-h-[500px]"
      aria-hidden
    >
      <div className="home-mock-float absolute inset-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/85 shadow-[0_28px_96px_-28px_rgba(0,0,0,0.14)] backdrop-blur-md dark:shadow-[0_28px_96px_-28px_rgba(0,0,0,0.48)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-6 py-3.5">
          <span className="home-window-dot h-3 w-3 rounded-full bg-[var(--muted)]/35" />
          <span className="home-window-dot home-window-dot--delayed h-3 w-3 rounded-full bg-[var(--muted)]/25" />
          <span className="home-window-dot home-window-dot--delayed2 h-3 w-3 rounded-full bg-[var(--muted)]/20" />
          <span className="ml-2 font-mono-ledger text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
            Workspace · Task Management
          </span>
        </div>
        <div className="space-y-4 p-6 pt-5">
          <div className="home-task-card flex items-start gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 p-3.5">
            <span className="home-checkbox-glow mt-0.5 h-[18px] w-[18px] shrink-0 rounded border border-[var(--accent)]/40 bg-[var(--accent-muted)]" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="home-shimmer-bar h-3 w-[92%] max-w-none rounded bg-[var(--fg)]/15" />
              <div className="home-shimmer-bar home-shimmer-bar--delayed h-2.5 w-[72%] max-w-none rounded bg-[var(--muted)]/25" />
            </div>
          </div>
          <div className="home-task-card home-task-card--secondary flex items-start gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-3.5 opacity-90">
            <span className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-elevated)]" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="home-shimmer-bar h-3 w-[78%] max-w-none rounded bg-[var(--fg)]/12" />
              <div className="home-shimmer-bar home-shimmer-bar--delayed h-2.5 w-[62%] max-w-none rounded bg-[var(--muted)]/20" />
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-base)]/40 px-4 py-3">
            <p className="font-mono-ledger text-[12px] leading-relaxed text-[var(--muted)]">
              <span className="home-plus-pulse text-[var(--accent)]">+</span> Say it like you mean it · we keep things tidy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
