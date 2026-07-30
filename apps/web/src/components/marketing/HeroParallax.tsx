"use client";

import Link from "next/link";
import { motion, useTransform, type MotionValue } from "motion/react";
import { ScrollPin } from "./ScrollPin";
import { LedgerPanel } from "./LedgerPanel";
import { useSafeReducedMotion } from "./useSafeReducedMotion";

type HeroParallaxProps = { wordmarkClassName: string };

const headlineLines = [
  { lead: "Every task", sub: "tracked" },
  { lead: "Every update", sub: "logged" },
  { lead: "On the record", sub: "for good" },
] as const;

function HeroCopy({ wordmarkClassName }: { wordmarkClassName: string }) {
  return (
    <div className="min-w-0 max-w-3xl xl:max-w-none">
      <p className="home-fade-item home-fade-item--1 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)] shadow-[0_1px_0_color-mix(in_srgb,var(--fg)_6%,transparent)]">
        Task management, fully accountable
      </p>
      <h1
        className={`${wordmarkClassName} mt-6 flex flex-col gap-1 text-balance text-4xl font-bold tracking-[-0.04em] text-[var(--fg)] sm:gap-1.5 sm:text-5xl lg:gap-2 lg:text-[3.35rem] 2xl:text-[3.65rem]`}
        style={{ perspective: "880px" }}
      >
        {headlineLines.map((line) => (
          <span key={line.lead} className="home-hero-word flex flex-wrap items-baseline gap-x-[0.35em] gap-y-1 leading-[1.06]">
            <span className="text-[var(--fg)]">{line.lead}</span>
            <span className="home-hero-sub">{line.sub}</span>
          </span>
        ))}
      </h1>
      <p className="home-fade-item home-fade-item--2 mt-6 max-w-2xl text-pretty text-justify text-lg leading-relaxed text-[var(--muted)] sm:text-xl xl:max-w-[36rem] 2xl:max-w-[40rem] 2xl:text-[1.125rem] 2xl:leading-relaxed">
        LogBase turns scattered to-dos and side-channel threads into one accountable system—owners on every task, a
        timestamped activity trail, and an export-ready record for the moments that matter.
      </p>
      <div className="home-fade-item home-fade-item--3 mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/login" className="btn-primary inline-flex h-12 min-w-[11rem] items-center justify-center rounded-xl px-8 text-sm font-medium">
          Start logging free
        </Link>
        <Link
          href="/login?next=%2Fapp%2Fworkspaces"
          className="btn-secondary inline-flex h-12 min-w-[11rem] items-center justify-center rounded-xl px-8 text-sm font-medium"
        >
          Log in
        </Link>
      </div>
      {/* Below `xl:` the two-column layout collapses and the ledger panel never renders anywhere
          on the page—show a compact version here so mobile/tablet isn't a text-only experience. */}
      <LedgerPanel className="home-fade-item home-fade-item--3 mt-10 xl:hidden" />
    </div>
  );
}

function ScrollCue({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.08], [1, 0]);
  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[var(--muted)] sm:flex"
      aria-hidden
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.2em]">Scroll to explore</span>
      <svg className="home-scroll-cue-bounce h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </motion.div>
  );
}

function HeroPinnedScene({ progress, wordmarkClassName }: { progress: MotionValue<number>; wordmarkClassName: string }) {
  // Headline only drifts/scales (never fades to 0) so the pinned viewport is never left blank on
  // breakpoints where the ledger panel is hidden (`xl:` and up only).
  const headlineY = useTransform(progress, [0, 1], [0, -70]);
  const headlineScale = useTransform(progress, [0, 1], [1, 0.92]);
  // Panel is fully visible from the first frame (no fade-in from 0)—otherwise half the hero is
  // blank on first paint, before the user has scrolled at all. Only its settle-into-place drift
  // is scroll-linked.
  const panelY = useTransform(progress, [0, 0.45], [36, -24]);
  const panelRotate = useTransform(progress, [0, 0.45], [3, 0]);

  return (
    // Top-anchored (not vertically centered)—centering a modest amount of copy inside a full
    // h-screen pinned panel left a large, empty band above it on first paint.
    <div className="relative flex h-full w-full items-start pt-20 sm:pt-24 lg:pt-20 2xl:pt-24">
      <div className="relative mx-auto grid w-full max-w-7xl px-4 text-left sm:px-6 lg:max-w-[90rem] lg:px-8 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] xl:items-center xl:gap-10 2xl:max-w-[min(100%,100rem)] 2xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] 2xl:gap-14 2xl:px-10">
        <motion.div style={{ y: headlineY, scale: headlineScale }}>
          <HeroCopy wordmarkClassName={wordmarkClassName} />
        </motion.div>
        <motion.div
          style={{ y: panelY, rotate: panelRotate }}
          className="relative mt-10 hidden min-h-[400px] min-w-0 xl:mt-0 xl:block xl:min-h-[420px] 2xl:min-h-[500px]"
          aria-hidden
        >
          <LedgerPanel className="absolute inset-0" />
        </motion.div>
      </div>
      <ScrollCue progress={progress} />
    </div>
  );
}

function HeroStatic({ wordmarkClassName }: { wordmarkClassName: string }) {
  return (
    <section className="relative min-h-screen">
      <div className="relative mx-auto grid w-full max-w-7xl px-4 pt-10 text-left sm:px-6 lg:max-w-[90rem] lg:px-8 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] xl:items-center xl:gap-10 2xl:max-w-[min(100%,100rem)] 2xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] 2xl:gap-14 2xl:px-10">
        <HeroCopy wordmarkClassName={wordmarkClassName} />
        <div className="relative mt-10 hidden min-h-[400px] min-w-0 xl:mt-0 xl:block xl:min-h-[420px] 2xl:min-h-[500px]" aria-hidden>
          <LedgerPanel className="absolute inset-0" />
        </div>
      </div>
    </section>
  );
}

export function HeroParallax({ wordmarkClassName }: HeroParallaxProps) {
  const prefersReducedMotion = useSafeReducedMotion();

  if (prefersReducedMotion) {
    return <HeroStatic wordmarkClassName={wordmarkClassName} />;
  }

  return <ScrollPin steps={2}>{(progress) => <HeroPinnedScene progress={progress} wordmarkClassName={wordmarkClassName} />}</ScrollPin>;
}
