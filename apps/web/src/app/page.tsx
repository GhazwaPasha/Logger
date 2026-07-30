import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Outfit } from "next/font/google";
import { auth } from "@/lib/auth";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { Reveal } from "@/components/marketing/Reveal";
import { MarketingBackground } from "@/components/marketing/MarketingBackground";
import { HideScrollbar } from "@/components/marketing/HideScrollbar";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroParallax } from "@/components/marketing/HeroParallax";
import { ProblemStatement } from "@/components/marketing/ProblemStatement";
import { FeatureStory } from "@/components/marketing/FeatureStory";
import { HowItWorksTimeline } from "@/components/marketing/HowItWorksTimeline";

const wordmark = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/app");

  const year = new Date().getFullYear();

  return (
    <main className="relative min-h-screen text-[var(--fg)]">
      <HideScrollbar />
      <MarketingBackground />
      <MarketingNav wordmarkClassName={wordmark.className} />
      <HeroParallax wordmarkClassName={wordmark.className} />
      <ProblemStatement />
      <FeatureStory />

      <div className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:max-w-[90rem] lg:px-8 lg:pb-20 2xl:max-w-[min(100%,100rem)] 2xl:px-10">
        <HowItWorksTimeline />

        {/* Trust strip */}
        <Reveal className="mt-14 sm:mt-16">
          <div className="home-trust-strip rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-6 py-4 text-left xl:px-8 xl:py-5">
            <p className="relative text-sm font-medium leading-relaxed text-[var(--muted)] sm:text-base">
              Built for teams that answer to stakeholders—not to reconstructed spreadsheets.
            </p>
          </div>
        </Reveal>

        {/* Closing CTA */}
        <Reveal>
          <section className="mt-14 sm:mt-16" aria-labelledby="cta-heading">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-8 py-10 text-left sm:px-12 sm:py-12 lg:px-14 lg:py-14 2xl:px-16 2xl:py-16">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_0%_-20%,var(--accent-glow-soft),transparent)] opacity-90 home-cta-glow"
                aria-hidden
              />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 2xl:gap-16">
                <div className="min-w-0 max-w-2xl lg:max-w-[min(100%,36rem)] 2xl:max-w-[42rem]">
                  <h2 id="cta-heading" className="text-2xl font-semibold tracking-tight text-[var(--fg)] sm:text-3xl 2xl:text-4xl 2xl:leading-tight">
                    Ready to put your work on the record?
                  </h2>
                  <p className="mt-4 text-[var(--muted)] sm:text-lg 2xl:mt-5 2xl:text-xl 2xl:leading-relaxed">
                    Start in minutes. Bring structure to assignments and keep a trail that still makes sense six months from now.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4 lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
                  <Link href="/login" className="btn-primary inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-xl px-8 text-sm font-medium">
                    Start logging free
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
        </Reveal>

        {/* Footer */}
        <Reveal>
          <footer className="mt-14 border-t border-[var(--border-subtle)] pt-8 sm:mt-16 2xl:mt-20 2xl:pt-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between xl:gap-12">
              <div>
                <div className={`flex items-center gap-2 ${wordmark.className}`}>
                  <LogBaseMark variant="footer" decorative className="shrink-0" />
                  <p className="text-lg font-bold leading-tight tracking-[-0.03em] text-[var(--fg)]">LogBase</p>
                </div>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted)]">
                  Accountability-first activity logging for teams that ship under scrutiny.
                </p>
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
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Legal</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li>
                      <Link href="/privacy" className="text-[var(--fg)] underline-offset-4 hover:underline">
                        Privacy Policy
                      </Link>
                    </li>
                    <li>
                      <Link href="/terms" className="text-[var(--fg)] underline-offset-4 hover:underline">
                        Terms of Service
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
        </Reveal>
      </div>
    </main>
  );
}
