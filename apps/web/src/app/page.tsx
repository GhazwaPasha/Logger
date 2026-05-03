import Link from "next/link";
import { Outfit } from "next/font/google";
import { LogBaseMark } from "@/components/brand/LogBaseMark";

const wordmark = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

function IconTasks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function IconTrail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function IconExport({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--surface-base)] text-[var(--fg)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          background:
            "radial-gradient(ellipse 85% 55% at 50% -15%, var(--accent-glow), transparent), radial-gradient(ellipse 50% 45% at 100% 5%, var(--accent-glow-soft), transparent)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 pt-6 sm:px-8 lg:max-w-7xl lg:px-12 lg:pb-20 lg:pt-8 2xl:max-w-[88rem] 2xl:px-16">
        {/* Nav */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className={`flex min-h-10 items-center gap-2.5 sm:min-h-11 sm:gap-3 ${wordmark.className} rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]`}
          >
            <LogBaseMark variant="marketing" decorative className="shrink-0" />
            <span className="text-xl font-bold tracking-[-0.04em] text-[var(--fg)] sm:text-2xl">LogBase</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2" aria-label="Primary">
            <a
              href="#capabilities"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] sm:inline-block"
            >
              Capabilities
            </a>
            <a
              href="#how-it-works"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] md:inline-block"
            >
              How it works
            </a>
            <Link
              href="/login?next=%2Fapp%2Fworkspaces"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            >
              Log in
            </Link>
            <Link href="/login" className="btn-primary inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-medium">
              Get started
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section
          className="grid pt-4 text-left sm:pt-6 xl:grid-cols-[minmax(0,42rem)_1fr] xl:items-center xl:gap-12 xl:pt-8 2xl:grid-cols-[minmax(0,46rem)_1fr] 2xl:gap-16 2xl:pt-10"
          aria-labelledby="hero-heading"
        >
          <div className="min-w-0 max-w-3xl xl:max-w-none">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Accountability &amp; Audit
            </p>
            <h1
              id="hero-heading"
              className={`${wordmark.className} mt-6 flex flex-col gap-0 text-balance text-4xl font-bold tracking-[-0.04em] text-[var(--fg)] sm:text-5xl lg:text-[3.35rem] 2xl:text-[3.65rem]`}
            >
              <span className="block leading-[1.05]">Organize</span>
              <span className="block leading-[1.05]">Track</span>
              <span className="block leading-[1.05]">Execute.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-justify text-lg leading-relaxed text-[var(--muted)] sm:text-xl xl:max-w-[36rem] 2xl:max-w-[40rem] 2xl:text-[1.125rem] 2xl:leading-relaxed">
              A fast, intuitive task management app built for people who are tired of bloated, overcomplicated tools available across the internet. Instead of overwhelming you with features you&apos;ll never use, Logbase focuses on what actually matters: capturing tasks quickly, staying organized, and getting things done. With natural language task creation, you can simply type what you need (&ldquo;Call Ahmed tomorrow at 3pm&rdquo;) and it handles the rest.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link href="/login" className="btn-primary inline-flex h-12 min-w-[11rem] items-center justify-center rounded-xl px-8 text-sm font-medium">
                Get started free
              </Link>
              <Link href="/login?next=%2Fapp%2Fworkspaces" className="btn-secondary inline-flex h-12 min-w-[11rem] items-center justify-center rounded-xl px-8 text-sm font-medium">
                Log in to your base
              </Link>
            </div>
          </div>

          <div
            className="relative mt-10 hidden min-h-[280px] min-w-0 xl:mt-0 xl:block 2xl:min-h-[320px]"
            aria-hidden
          >
            <div className="absolute inset-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/80 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]/35" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]/20" />
                <span className="ml-2 font-mono-ledger text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Workspace · Audit trail</span>
              </div>
              <div className="space-y-3 p-5 pt-4">
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 p-3">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--accent)]/40 bg-[var(--accent-muted)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-2.5 w-4/5 max-w-[14rem] rounded bg-[var(--fg)]/15" />
                    <div className="h-2 w-full max-w-[11rem] rounded bg-[var(--muted)]/25" />
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-3 opacity-90">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-elevated)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-2.5 w-3/4 max-w-[12rem] rounded bg-[var(--fg)]/12" />
                    <div className="h-2 w-full max-w-[10rem] rounded bg-[var(--muted)]/20" />
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-base)]/40 px-3 py-2.5">
                  <p className="font-mono-ledger text-[11px] leading-relaxed text-[var(--muted)]">
                    <span className="text-[var(--accent)]">+</span> append-only log · export-ready
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <div className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-6 py-4 text-left sm:mt-12 xl:px-8 xl:py-5">
          <p className="text-sm font-medium leading-relaxed text-[var(--muted)] sm:text-base">
            Built for teams that report to stakeholders—not to reconstructed spreadsheets.
          </p>
        </div>

        {/* Capabilities */}
        <section id="capabilities" className="mt-14 scroll-mt-24 sm:mt-16" aria-labelledby="capabilities-heading">
          <div className="max-w-2xl text-left lg:max-w-3xl 2xl:max-w-[44rem]">
            <h2 id="capabilities-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Capabilities
            </h2>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl 2xl:text-[2.5rem] 2xl:leading-tight">
              Everything you need to run accountable operations
            </p>
            <p className="mt-4 text-lg text-[var(--muted)] 2xl:text-xl 2xl:leading-relaxed">
              Structure work, capture activity, and ship evidence—without losing nuance in chat threads.
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 xl:gap-6 2xl:gap-7">
            <li className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 transition-colors hover:border-[var(--border)] xl:p-7 2xl:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] transition-colors group-hover:text-[var(--fg)]">
                <IconTasks className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--fg)]">Structured work</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Tasks, owners, and departments live together so responsibility is obvious—not buried in message history.
              </p>
            </li>
            <li className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 transition-colors hover:border-[var(--border)] xl:p-7 2xl:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] transition-colors group-hover:text-[var(--fg)]">
                <IconTrail className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--fg)]">Durable activity</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Append-style logging keeps updates visible and tamper-resistant—ideal when timelines matter.
              </p>
            </li>
            <li className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 transition-colors hover:border-[var(--border)] xl:p-7 2xl:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] transition-colors group-hover:text-[var(--fg)]">
                <IconExport className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--fg)]">Evidence on demand</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Export the trail for audits, retros, leadership readouts, or customer diligence—without manual reconstruction.
              </p>
            </li>
            <li className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 transition-colors hover:border-[var(--border)] xl:p-7 2xl:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] transition-colors group-hover:text-[var(--fg)]">
                <IconShield className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--fg)]">Secure delivery</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                API-first architecture with modern auth patterns—ready for the way your stack already works.
              </p>
            </li>
          </ul>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-14 scroll-mt-24 sm:mt-16" aria-labelledby="how-heading">
          <div className="max-w-2xl text-left lg:max-w-3xl 2xl:max-w-[44rem]">
            <h2 id="how-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              How it works
            </h2>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl 2xl:text-[2.5rem] 2xl:leading-tight">
              From setup to signal in three moves
            </p>
          </div>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-6 xl:gap-8 2xl:gap-10">
            {[
              {
                step: "01",
                title: "Shape your workspace",
                body: "Define organizations, departments, and lists so ownership maps to how you actually run the business.",
              },
              {
                step: "02",
                title: "Assign and execute",
                body: "Create tasks, attach people, and record updates as work moves—without losing context in side channels.",
              },
              {
                step: "03",
                title: "Review and export",
                body: "Open the activity trail anytime you need alignment—or pull a clean record for compliance and reporting.",
              },
            ].map((item) => (
              <li key={item.step} className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 p-6 pt-8 xl:p-7 xl:pt-9 2xl:p-8 2xl:pt-10">
                <span className="absolute left-6 top-0 flex h-8 -translate-y-1/2 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 font-mono-ledger text-xs font-semibold text-[var(--accent)]">
                  {item.step}
                </span>
                <h3 className="text-lg font-semibold text-[var(--fg)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing CTA */}
        <section className="mt-14 sm:mt-16" aria-labelledby="cta-heading">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-8 py-10 text-left sm:px-12 sm:py-12 lg:px-14 lg:py-14 2xl:px-16 2xl:py-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_0%_-20%,var(--accent-glow-soft),transparent)] opacity-90" aria-hidden />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 2xl:gap-16">
              <div className="min-w-0 max-w-2xl lg:max-w-[min(100%,36rem)] 2xl:max-w-[42rem]">
                <h2 id="cta-heading" className="text-2xl font-semibold tracking-tight text-[var(--fg)] sm:text-3xl 2xl:text-4xl 2xl:leading-tight">
                  Ready for operations your team can defend?
                </h2>
                <p className="mt-4 text-[var(--muted)] sm:text-lg 2xl:mt-5 2xl:text-xl 2xl:leading-relaxed">
                  Start in minutes. Bring structure to assignments and keep a record that still makes sense six months from now.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4 lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
                <Link href="/login" className="btn-primary inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-xl px-8 text-sm font-medium">
                  Get started free
                </Link>
                <Link
                  href="/login?next=%2Fapp%2Fworkspaces"
                  className="btn-secondary inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-xl px-8 text-sm font-medium bg-[var(--surface-elevated)]"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-14 border-t border-[var(--border-subtle)] pt-8 sm:mt-16 2xl:mt-20 2xl:pt-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between xl:gap-12">
            <div>
              <div className={`flex items-center gap-2 ${wordmark.className}`}>
                <LogBaseMark variant="footer" decorative className="shrink-0" />
                <p className="text-lg font-bold leading-tight tracking-[-0.03em] text-[var(--fg)]">LogBase</p>
              </div>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted)]">Accountability-first activity logging for teams that ship under scrutiny.</p>
            </div>
            <div className="flex flex-wrap gap-10 sm:gap-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Product</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <a href="#capabilities" className="text-[var(--fg)] underline-offset-4 hover:underline">
                      Capabilities
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="text-[var(--fg)] underline-offset-4 hover:underline">
                      How it works
                    </a>
                  </li>
                  <li>
                    <Link href="/login" className="text-[var(--fg)] underline-offset-4 hover:underline">
                      Get started
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Account</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link href="/login?next=%2Fapp%2Fworkspaces" className="text-[var(--fg)] underline-offset-4 hover:underline">
                      Log in
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-8 text-xs text-[var(--muted)]">
            © {year} LogBase · Append-only activity log · API-ready · Mobile-friendly
          </p>
        </footer>
      </div>
    </main>
  );
}
