import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ChevronRight, Repeat2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { ProductShot } from "@/components/marketing/ProductShot";
import { ScaledShot } from "@/components/marketing/ScaledShot";
import "@/components/marketing/landing.css";

const SIGNUP = "/login";
const LOGIN = "/login?next=%2Fapp%2Fworkspaces";

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

const mono = "font-mono-ledger text-footnote text-[var(--ink-2)]";

/** The five states of one task, shown on the pinned card as the story scrolls past. */
const STORY = [
  { key: "Created", dot: "var(--dept-1)", title: "Every task starts with an owner.", body: "Put it in a channel, give it a due time and a person. No more “I thought you had it.”" },
  { key: "Broken down", dot: "var(--dept-3)", title: "Big work becomes a checklist.", body: "Subtasks live inside the task, and the ring fills as each one gets done." },
  { key: "In progress", dot: "var(--status-progress)", title: "Every change is written down.", body: "Status moves, files arrive, people comment. Each one lands in the trail with a name and a time." },
  { key: "Done", dot: "var(--status-done)", title: "Finished, and you can see it was on time.", body: "Recurring work rolls over to tomorrow on its own, with the streak kept." },
  { key: "On the record", dot: "var(--dept-2)", title: "Proof, the moment someone asks.", body: "Export the whole trail for an audit, a review or a client — exactly as it happened." },
];

function StoryCard({ step }: { step: number }) {
  const title = <span className="flex-1 text-lg font-semibold">Report sale summary in Discord</span>;
  const open = <span className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--ink-3)]" />;
  return (
    <div className="flex flex-col gap-3.5 rounded-[22px] bg-[var(--card)] p-[22px] shadow-raised">
      {step === 1 && (
        <>
          <div className="flex items-center gap-3">{open}{title}</div>
          <div className="flex items-center gap-2.5 pl-8 text-footnote text-[var(--ink-2)]">
            #daily-updates<span className="flex-1" />
            <span className="grid size-7 place-items-center rounded-full bg-[var(--dept-1)] text-caption font-semibold text-white">SC</span>
            <span className="rounded-full bg-[var(--info-bg)] px-2.5 py-1 font-medium text-[var(--info-ink)]">Today, 7:00 PM</span>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="flex items-center gap-3">{open}{title}</div>
          <div className="flex items-center gap-2 pl-8 text-footnote text-[var(--ink-2)]">
            <svg width="18" height="18" viewBox="0 0 18 18" className="-rotate-90" aria-hidden>
              <circle cx="9" cy="9" r="7" fill="none" strokeWidth="2.4" style={{ stroke: "var(--fill-2)" }} />
              <circle cx="9" cy="9" r="7" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="14.7 44" style={{ stroke: "var(--dept-3)" }} />
            </svg>
            1 of 3
          </div>
          <ul className="flex flex-col gap-2 pl-8 text-subhead">
            <li className="flex items-center gap-2.5 text-[var(--ink-2)] line-through">
              <span className="grid size-4 place-items-center rounded-[5px] bg-[var(--dept-3)] text-white"><Check className="size-2.5" /></span>
              Report sales in Chiniot
            </li>
            <li className="flex items-center gap-2.5"><span className="size-4 rounded-[5px] shadow-[inset_0_0_0_1.4px_var(--ink-3)]" />Report sales in Sargodha</li>
            <li className="flex items-center gap-2.5"><span className="size-4 rounded-[5px] shadow-[inset_0_0_0_1.4px_var(--ink-3)]" />Post the summary</li>
          </ul>
        </>
      )}
      {step === 3 && (
        <>
          <div className="flex items-center gap-3">
            {open}
            {title}
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--status-progress-bg)] px-2.5 py-1 text-footnote font-medium text-[var(--status-progress-ink)]">
              <span className="size-1.5 rounded-full bg-[var(--status-progress)]" />
              In progress
            </span>
          </div>
          <div className="flex flex-col gap-2 border-t border-[var(--line)] pl-8 pt-3">
            <span className={mono}>09:41 · <b className="font-medium text-[var(--ink)]">Jordan</b> assigned this to <b className="font-medium text-[var(--ink)]">Sam</b></span>
            <span className={mono}>11:15 · <b className="font-medium text-[var(--ink)]">Sam</b> moved it to In progress</span>
            <span className={mono}>14:02 · <b className="font-medium text-[var(--ink)]">Sam</b> attached sargodha-sales.pdf</span>
            <span className={mono}>14:05 · <b className="font-medium text-[var(--ink)]">Ava</b> commented</span>
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <div className="flex items-center gap-3">
            <span className="grid size-5 place-items-center rounded-full bg-[var(--status-done)] text-white"><Check className="size-3" /></span>
            <span className="flex-1 text-lg font-semibold text-[var(--ink-2)]">Report sale summary in Discord</span>
          </div>
          <span className={`${mono} pl-8`}>18:52 · <b className="font-medium text-[var(--ink)]">Sam</b> completed it <span className="text-[var(--status-done)]">in time</span></span>
          <div className="ml-8 flex items-center gap-2.5 rounded-xl bg-[var(--fill)] px-3 py-2.5 text-footnote text-[var(--ink-2)]">
            <Repeat2 className="size-4" aria-hidden />
            Next one: tomorrow, 7:00 PM · 108 in a row
          </div>
        </>
      )}
      {step === 5 && (
        <>
          <div className="flex items-center gap-3.5">
            <span className="grid h-[54px] w-11 place-items-center rounded-[10px] bg-[var(--dept-2)] text-caption font-semibold text-white">CSV</span>
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">daily-updates · November</span>
              <span className="text-footnote text-[var(--ink-2)]">1,284 entries · every one with a name and a time</span>
            </span>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-[var(--line)] pt-3">
            <span className={mono}>2026-11-18 18:52 · completed · Sam Carter</span>
            <span className={mono}>2026-11-18 14:05 · comment · Ava Malik</span>
            <span className={mono}>2026-11-18 14:02 · attachment · Sam Carter</span>
          </div>
        </>
      )}
    </div>
  );
}

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/app");
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[var(--sheet)] text-[var(--ink)]">
      <div className="landing-hero scheme-dark">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-7 px-6 sm:px-8">
            <Link href="/" className="flex items-center gap-2">
              <LogBaseMark variant="chrome" decorative />
              <span className="font-outfit text-lg font-semibold">LogBase</span>
            </Link>
            <nav className="hidden gap-6 text-sm text-white/70 sm:flex" aria-label="Sections">
              <a href="#story" className="transition-colors hover:text-white">How it works</a>
              <a href="#features" className="transition-colors hover:text-white">Features</a>
            </nav>
            <span className="flex-1" />
            <Link href={LOGIN} className="text-sm text-white/70 transition-colors hover:text-white">Log in</Link>
            <Link href={SIGNUP} className="pressable rounded-full bg-[#f5f5f7] px-4 py-1.5 text-sm font-semibold text-black hover:opacity-90">
              Get started
            </Link>
          </div>
        </header>

        <section className="mx-auto flex max-w-[1180px] flex-col items-center gap-6 px-6 pb-16 pt-24 text-center sm:px-8 sm:pt-28">
          <h1
            className="landing-rise font-outfit max-w-[1080px] text-[clamp(46px,7.2vw,104px)] font-semibold leading-[0.98] tracking-[-0.045em]"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            Every task tracked.
            <br />
            <span className="text-[#6e6e73]">Every update on the record.</span>
          </h1>
          <p className="landing-rise max-w-[620px] text-[clamp(17px,1.6vw,21px)] leading-relaxed text-[#a1a1a6]" style={{ "--i": 1 } as React.CSSProperties}>
            One accountable system for your team — an owner on every task, a timestamped trail of every change, and an
            export you can hand to anyone.
          </p>
          <div className="landing-rise mt-2 flex flex-wrap items-center justify-center gap-4" style={{ "--i": 2 } as React.CSSProperties}>
            <Link href={SIGNUP} className="pressable inline-flex h-12 items-center rounded-full bg-[#f5f5f7] px-6 text-base font-semibold text-black hover:opacity-90">
              Start logging free
            </Link>
            <Link href={LOGIN} className="pressable inline-flex h-12 items-center gap-1.5 px-2 text-base font-semibold text-[#f5f5f7]">
              Log in <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>

        <div className="landing-stage relative z-[1] flex justify-center px-4 sm:px-8">
          <div className="landing-shot relative aspect-[1440/1000] w-full max-w-[1120px] overflow-hidden rounded-[22px] shadow-[0_0_0_0.5px_rgba(255,255,255,0.14),0_50px_120px_rgba(0,0,0,0.55),0_20px_40px_rgba(0,0,0,0.35)]">
            <ScaledShot width={1440}>
              <ProductShot />
            </ScaledShot>
          </div>
        </div>
      </div>
      {/* Dark band under the product shot's lower half, so it straddles the seam into the light page. */}
      <div className="relative -mt-[22vw] h-[22vw] max-h-[300px] bg-[var(--sheet)]" aria-hidden />

      <section className="landing-reveal mx-auto max-w-[1180px] px-6 pt-20 text-center sm:px-8 sm:pt-28">
        <h2 className="font-outfit mx-auto max-w-[920px] text-[clamp(32px,4.4vw,60px)] font-semibold leading-[1.04] tracking-[-0.035em]">
          Work happens in six different places.
          <br />
          <span className="text-[var(--ink-3)]">Proof happens in none of them.</span>
        </h2>
      </section>

      <section id="story" className="mx-auto max-w-[1180px] px-6 pt-16 sm:px-8">
        <div className="landing-story grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-16">
          <div className="flex flex-col">
            {STORY.map((s) => (
              <div key={s.key} className="landing-step flex min-h-[78vh] flex-col justify-center gap-3.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-2)]">
                  <span className="size-2 rounded-full" style={{ background: s.dot }} />
                  {s.key}
                </span>
                <h3 className="font-outfit max-w-[460px] text-[clamp(28px,3vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em]">{s.title}</h3>
                <p className="max-w-[440px] text-xl leading-relaxed text-[var(--ink-2)]">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="landing-pin sticky top-[12vh] grid h-[76vh] place-items-center" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="landing-layer w-full max-w-[460px]" data-step={n}>
                <StoryCard step={n} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="landing-reveal mx-auto max-w-[1180px] px-6 pt-28 sm:px-8">
        <h2 className="font-outfit mb-10 max-w-[760px] text-[clamp(32px,4.4vw,60px)] font-semibold leading-[1.04] tracking-[-0.035em]">
          Built for teams that answer to someone.
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="flex min-h-[380px] flex-col gap-3 overflow-hidden rounded-[28px] bg-[var(--dept-4-tint)] p-8">
            <h3 className="font-outfit text-2xl font-semibold tracking-tight">Targets you can see move.</h3>
            <p className="text-base leading-relaxed text-[var(--ink-2)]">Trackers give one person a number to hit, logged daily or weekly.</p>
            <div className="mt-auto flex flex-col gap-2.5 rounded-2xl bg-[var(--card)] p-4 shadow-card">
              <div className="flex items-baseline justify-between text-footnote"><b className="font-semibold">Chiniot sales · November</b><span className="text-[var(--ink-2)]">daily</span></div>
              <div className="flex items-baseline gap-1.5"><span className="font-outfit text-3xl font-semibold tracking-tight">2,140</span><span className="text-footnote text-[var(--ink-2)]">of 3,000</span></div>
              <svg viewBox="0 0 300 44" preserveAspectRatio="none" className="h-11 w-full" aria-hidden>
                <path d="M0 38 C30 36 50 30 80 31 S130 24 160 22 S220 14 250 12 S285 8 300 6 L300 44 L0 44 Z" style={{ fill: "var(--dept-4-tint)" }} />
                <path d="M0 38 C30 36 50 30 80 31 S130 24 160 22 S220 14 250 12 S285 8 300 6" fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--dept-4)" }} />
              </svg>
            </div>
          </div>
          <div className="flex min-h-[380px] flex-col gap-3 overflow-hidden rounded-[28px] bg-[var(--dept-1-tint)] p-8">
            <h3 className="font-outfit text-2xl font-semibold tracking-tight">A dashboard that answers “how are we doing?”</h3>
            <p className="text-base leading-relaxed text-[var(--ink-2)]">Overdue work, load per person and progress by department, at a glance.</p>
            <div className="mt-auto flex h-[120px] gap-1.5 rounded-2xl bg-[var(--card)] p-2.5 shadow-card">
              <div className="flex-[30] rounded-[10px] bg-[var(--dept-3-tint)] p-2.5 text-xs font-semibold">Operations<br /><span className="font-outfit text-2xl font-semibold">30</span></div>
              <div className="flex flex-[26] flex-col gap-1.5">
                <div className="flex-[15] rounded-[10px] bg-[var(--dept-1-tint)] px-2.5 py-2 text-xs font-semibold">Finance 15</div>
                <div className="flex-[11] rounded-[10px] bg-[var(--dept-4-tint)] px-2.5 py-2 text-xs font-semibold">Supply 11</div>
              </div>
            </div>
          </div>
          <div className="flex min-h-[380px] flex-col gap-3 overflow-hidden rounded-[28px] bg-[var(--warning-bg)] p-8">
            <h3 className="font-outfit text-2xl font-semibold tracking-tight">Works with the tools you have.</h3>
            <p className="text-base leading-relaxed text-[var(--ink-2)]">Discord submissions, webhooks, an API, and a connection for your AI assistant.</p>
            <div className={`mt-auto rounded-2xl bg-[var(--card)] p-4 leading-relaxed shadow-card ${mono}`}>
              <span className="text-[var(--ink)]">GET</span> /tasks?status=in_progress
              <br />
              <span className="text-[var(--status-done)]">200</span> · 13 tasks · 42 ms
            </div>
          </div>
        </div>
      </section>

      <section className="landing-reveal mx-auto max-w-[1180px] px-6 pb-28 pt-28 sm:px-8">
        <div className="landing-hero scheme-dark flex flex-col items-center gap-5 rounded-[32px] px-8 py-[clamp(48px,7vw,104px)] text-center">
          <h2 className="font-outfit max-w-[760px] text-[clamp(32px,4.4vw,60px)] font-semibold leading-[1.04] tracking-[-0.035em]">Put your work on the record.</h2>
          <p className="max-w-[540px] text-[clamp(17px,1.6vw,21px)] leading-relaxed text-[#a1a1a6]">
            Start in minutes. Keep a trail that still makes sense six months from now.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
            <Link href={SIGNUP} className="pressable inline-flex h-12 items-center rounded-full bg-[#f5f5f7] px-6 text-base font-semibold text-black hover:opacity-90">
              Start logging free
            </Link>
            <Link href={LOGIN} className="pressable inline-flex h-12 items-center gap-1.5 px-2 text-base font-semibold text-[#f5f5f7]">
              Log in <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-10 px-6 py-10 sm:px-8">
          <div className="flex max-w-[300px] flex-col gap-2">
            <span className="flex items-center gap-2">
              <LogBaseMark variant="footer" decorative />
              <span className="font-outfit text-base font-semibold">LogBase</span>
            </span>
            <span className="text-sm leading-relaxed text-[var(--ink-2)]">Accountability-first activity logging for teams that answer to stakeholders.</span>
          </div>
          <div className="flex flex-wrap gap-14 text-sm text-[var(--ink-2)]">
            <div className="flex flex-col gap-2.5">
              <span className="font-semibold text-[var(--ink)]">Product</span>
              <a href="#story" className="hover:text-[var(--ink)]">How it works</a>
              <a href="#features" className="hover:text-[var(--ink)]">Features</a>
              <Link href={SIGNUP} className="hover:text-[var(--ink)]">Get started</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-semibold text-[var(--ink)]">Account</span>
              <Link href={LOGIN} className="hover:text-[var(--ink)]">Log in</Link>
              <Link href="/delete-account" className="hover:text-[var(--ink)]">Delete your account</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-semibold text-[var(--ink)]">Legal</span>
              <Link href="/privacy" className="hover:text-[var(--ink)]">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[var(--ink)]">Terms of Service</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1180px] px-6 pb-10 text-footnote text-[var(--ink-2)] sm:px-8">© {year} LogBase</div>
      </footer>
    </main>
  );
}
