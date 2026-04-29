import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--surface-base)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, var(--accent-glow), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, var(--accent-glow-soft), transparent)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-16 pt-20 sm:px-10 lg:px-16 lg:pb-24 lg:pt-28">
        <header className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">WL</span>
            Work Ledger
          </span>
          <Link href="/login" className="btn-secondary rounded-xl px-4 py-2 text-sm">
            Sign in
          </Link>
        </header>
        <div className="mt-20 max-w-2xl space-y-8 lg:mt-28">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--fg)] sm:text-5xl lg:text-[3.25rem]">
            Accountability-first activity for real teams.
          </h1>
          <p className="text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
            Record who did what, when, and why—across organizations, departments, and tasks—with an append-only style
            ledger you can export when it matters.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/login" className="btn-primary inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-medium">
              Open workspace
            </Link>
            <Link href="/login?next=%2Fapp%2Fworkspaces" className="btn-ghost inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm text-[var(--muted)]">
              I have an account
            </Link>
          </div>
        </div>
        <footer className="mt-auto border-t border-[var(--border-subtle)] pt-10 text-xs text-[var(--muted)]">
          Immutable-style audit trail · JWT to your API · Mobile-friendly
        </footer>
      </div>
    </main>
  );
}
