"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Reveal } from "./Reveal";
import { useSafeReducedMotion } from "./useSafeReducedMotion";

const steps = [
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
] as const;

type Step = (typeof steps)[number];

function TimelineStep({ progress, index, item }: { progress: MotionValue<number>; index: number; item: Step }) {
  const segment = 1 / steps.length;
  const start = Math.max(0, index * segment - 0.06);
  const end = start + 0.14;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const x = useTransform(progress, [start, end], [-18, 0]);

  return (
    <motion.li style={{ opacity, x }} className="relative pl-12 sm:pl-16">
      <span className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] font-mono-ledger text-xs font-semibold text-[var(--accent)] sm:h-10 sm:w-10">
        {item.step}
      </span>
      {/* The step list is capped at max-w-2xl inside a much wider section—fill that spare
          width with a faint numeral instead of leaving it blank. */}
      <span
        className="pointer-events-none absolute left-full top-1/2 ml-8 hidden -translate-y-1/2 select-none font-mono-ledger text-[9rem] font-bold leading-none text-[var(--fg)] opacity-[0.035] lg:block"
        aria-hidden
      >
        {item.step}
      </span>
      <h3 className="text-lg font-semibold text-[var(--fg)]">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
    </motion.li>
  );
}

function TimelineLine({ progress }: { progress: MotionValue<number> }) {
  const scaleY = useTransform(progress, [0, 1], [0, 1]);
  return (
    <div className="absolute left-[1.15rem] top-1.5 bottom-1.5 w-px bg-[var(--border-subtle)] sm:left-[1.65rem]" aria-hidden>
      <motion.div style={{ scaleY }} className="absolute inset-0 origin-top bg-[var(--accent)]" />
    </div>
  );
}

function HowItWorksScrollDraw() {
  const ref = useRef<HTMLOListElement>(null);
  // A tight, fixed (viewport-relative) window—"start end"/"end start" would span the full
  // element height plus a viewport on each side, which for a short 3-item list stretches the
  // reveal across far more scrolling than the content warrants and reads as a dead gap.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start center", "start start"] });

  return (
    <ol ref={ref} className="relative mt-8 max-w-2xl space-y-10 sm:space-y-12">
      <TimelineLine progress={scrollYProgress} />
      {steps.map((item, index) => (
        <TimelineStep key={item.step} progress={scrollYProgress} index={index} item={item} />
      ))}
    </ol>
  );
}

function HowItWorksStatic() {
  return (
    <ol className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-6 xl:gap-8 2xl:gap-10">
      {steps.map((item, index) => (
        <li key={item.step}>
          <Reveal delayMs={index * 80}>
            <div className="group relative h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 p-6 pt-8 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_22%,var(--border-subtle))] xl:p-7 xl:pt-9 2xl:p-8 2xl:pt-10">
              <span className="absolute left-6 top-0 flex h-8 -translate-y-1/2 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 font-mono-ledger text-xs font-semibold text-[var(--accent)] transition-transform duration-300 group-hover:scale-[1.03]">
                {item.step}
              </span>
              <h3 className="text-lg font-semibold text-[var(--fg)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorksTimeline() {
  const prefersReducedMotion = useSafeReducedMotion();

  return (
    <section id="how-it-works" className="mt-14 scroll-mt-24 sm:mt-16" aria-labelledby="how-heading">
      <Reveal>
        <div className="max-w-2xl text-left lg:max-w-3xl 2xl:max-w-[44rem]">
          <h2 id="how-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            How it works
          </h2>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl 2xl:text-[2.5rem] 2xl:leading-tight">
            From setup to signal in three moves
          </p>
        </div>
      </Reveal>
      {prefersReducedMotion ? <HowItWorksStatic /> : <HowItWorksScrollDraw />}
    </section>
  );
}
