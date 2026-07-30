"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { ScrollPin } from "./ScrollPin";
import { Reveal } from "./Reveal";
import { IconTasks, IconTrail, IconExport, IconShield } from "./FeatureIcons";
import { useSafeReducedMotion } from "./useSafeReducedMotion";

const steps = [
  {
    icon: IconTasks,
    numeral: "01",
    eyebrow: "01 · Structure",
    title: "Ownership, not ambiguity",
    body: "Tasks, owners, and departments live in one place—so responsibility is never buried three threads deep.",
  },
  {
    icon: IconTrail,
    numeral: "02",
    eyebrow: "02 · Activity",
    title: "A record that doesn't move",
    body: "Append-only logging keeps every update visible and tamper-resistant, exactly as it happened.",
  },
  {
    icon: IconExport,
    numeral: "03",
    eyebrow: "03 · Evidence",
    title: "Proof, whenever it's asked for",
    body: "Pull a clean export for audits, retros, or leadership reviews—without reconstructing a timeline from memory.",
  },
  {
    icon: IconShield,
    numeral: "04",
    eyebrow: "04 · Delivery",
    title: "Built on modern foundations",
    body: "API-first architecture with current auth patterns, ready to sit inside the stack you already run.",
  },
] as const;

type Step = (typeof steps)[number];

function StepPanel({ progress, index, item }: { progress: MotionValue<number>; index: number; item: Step }) {
  const segment = 1 / steps.length;
  const start = index * segment;
  const mid = start + segment * 0.5;
  const end = start + segment;
  // A wider crossfade window (vs. a narrow one) means more of each step's scroll distance is
  // actively animating rather than sitting static—less of the pin reads as a "dead" pause.
  const pad = segment * 0.3;
  const isLast = index === steps.length - 1;

  // The last panel holds at full opacity through the end of the pin instead of fading out—
  // otherwise the sticky viewport goes blank (rail visible, no panel) just before it releases.
  const opacity = useTransform(
    progress,
    isLast ? [start, start + pad, end] : [start, start + pad, end - pad, end],
    isLast ? [0, 1, 1] : [0, 1, 1, 0],
  );
  const y = useTransform(progress, [start, mid, end], [24, 0, -24]);
  const Icon = item.icon;

  return (
    // `absolute inset-0` sizes to the parent's padding box, not inside its padding—so the left/
    // right clearance for the rail and the ghost numeral has to live here, not on the shared
    // container (a class there would have no effect on this element's actual position).
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col items-start justify-center px-6 sm:px-10 lg:pl-24 lg:pr-8"
    >
      {/* Large background numeral fills the otherwise-empty right half of the pinned stage on
          wide viewports; it crossfades with the rest of the panel via the shared opacity. */}
      <span
        className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 select-none font-mono-ledger text-[16rem] font-bold leading-none text-[var(--fg)] opacity-[0.04] lg:block 2xl:text-[19rem]"
        aria-hidden
      >
        {item.numeral}
      </span>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-6 font-mono-ledger text-xs font-medium uppercase tracking-[0.14em] text-[var(--accent)]">{item.eyebrow}</p>
      <h3 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl 2xl:text-[2.5rem]">{item.title}</h3>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--muted)]">{item.body}</p>
    </motion.div>
  );
}

function RailDot({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const segment = 1 / steps.length;
  const start = index * segment;
  const end = start + segment;
  const pad = segment * 0.3;

  // Skip the lead-in/lead-out keyframe at the very ends of the pin (0 / 1)—adding a padded
  // point that clamps to the same value as its neighbor produces a duplicate x-position.
  const points = [...(start > 0 ? [start - pad] : []), start, end, ...(end < 1 ? [end + pad] : [])];
  const values = [...(start > 0 ? [0.75] : []), 1.2, 1.2, ...(end < 1 ? [0.75] : [])];
  const opacityValues = [...(start > 0 ? [0.35] : []), 1, 1, ...(end < 1 ? [0.35] : [])];
  const scale = useTransform(progress, points, values);
  const opacity = useTransform(progress, points, opacityValues);
  return <motion.span style={{ scale, opacity }} className="-ml-[3px] block h-2 w-2 rounded-full bg-[var(--accent)]" />;
}

function StoryRail({ progress }: { progress: MotionValue<number> }) {
  const fillScale = useTransform(progress, [0, 1], [0, 1]);
  return (
    <div className="absolute left-6 top-1/2 hidden h-56 w-px -translate-y-1/2 lg:block" aria-hidden>
      <div className="absolute inset-0 bg-[var(--border-subtle)]" />
      <motion.div style={{ scaleY: fillScale }} className="absolute inset-0 origin-top bg-[var(--accent)]" />
      <div className="absolute inset-0 flex flex-col justify-between">
        {steps.map((_, index) => (
          <RailDot key={steps[index].eyebrow} progress={progress} index={index} />
        ))}
      </div>
    </div>
  );
}

function FeatureStoryPinned({ progress }: { progress: MotionValue<number> }) {
  return (
    // Top-anchored (not vertically centered)—same reasoning as the hero: dead-centering a
    // ~250px content box inside a full h-screen panel left a huge empty band above it.
    <div className="relative flex h-full w-full items-start justify-center pt-24 sm:pt-28 lg:pt-20 2xl:pt-24">
      <div className="relative h-72 w-full max-w-5xl lg:h-64 2xl:h-72">
        <StoryRail progress={progress} />
        {steps.map((item, index) => (
          <StepPanel key={item.eyebrow} progress={progress} index={index} item={item} />
        ))}
      </div>
    </div>
  );
}

function FeatureStoryStatic() {
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 xl:gap-6 2xl:gap-7">
      {steps.map((item, index) => {
        const Icon = item.icon;
        return (
          <li key={item.eyebrow}>
            <Reveal delayMs={index * 70}>
              <div className="group flex h-full flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-[var(--border)] xl:p-7 2xl:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] transition-colors duration-300 group-hover:scale-105 group-hover:text-[var(--fg)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[var(--fg)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
              </div>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}

export function FeatureStory() {
  const prefersReducedMotion = useSafeReducedMotion();

  const header = (
    <Reveal>
      <div className="max-w-2xl text-left lg:max-w-3xl 2xl:max-w-[44rem]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Capabilities</h2>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl 2xl:text-[2.5rem] 2xl:leading-tight">
          Everything accountable work actually needs
        </p>
        <p className="mt-4 text-lg text-[var(--muted)] 2xl:text-xl 2xl:leading-relaxed">
          Structure work, capture activity, and ship evidence—without losing nuance in chat threads.
        </p>
      </div>
    </Reveal>
  );

  if (prefersReducedMotion) {
    return (
      <section id="capabilities" className="mt-14 scroll-mt-24 sm:mt-16" aria-labelledby="capabilities-heading">
        {header}
        <FeatureStoryStatic />
      </section>
    );
  }

  return (
    <section id="capabilities" className="scroll-mt-24" aria-labelledby="capabilities-heading">
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 sm:pt-12 lg:max-w-[90rem] lg:px-8 2xl:max-w-[min(100%,100rem)] 2xl:px-10">
        {header}
        {/* Below `lg` the rail and ghost numeral (both `lg:` gated for space reasons) disappear,
            leaving the pinned stage more than half blank for the entire scroll—there isn't
            enough width for a cinematic pin to earn its keep, so use the compact card grid
            instead. Pure CSS visibility (no JS branch) so this can't hydration-mismatch. */}
        <div className="lg:hidden">
          <FeatureStoryStatic />
        </div>
      </div>
      <div className="hidden lg:block">
        <ScrollPin steps={3}>{(progress) => <FeatureStoryPinned progress={progress} />}</ScrollPin>
      </div>
    </section>
  );
}
