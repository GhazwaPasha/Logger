"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { useSafeReducedMotion } from "./useSafeReducedMotion";

type MarketingNavProps = { wordmarkClassName: string };

export function MarketingNav({ wordmarkClassName }: MarketingNavProps) {
  const prefersReducedMotion = useSafeReducedMotion();
  const { scrollY } = useScroll();
  const chromeOpacity = useTransform(scrollY, [0, 140], [0, 1]);

  return (
    <header className="sticky top-0 z-50">
      <motion.div
        style={prefersReducedMotion ? { opacity: 1 } : { opacity: chromeOpacity }}
        className="pointer-events-none absolute inset-0 border-b border-[var(--border-subtle)] bg-[var(--surface-nav)]/90 backdrop-blur-md"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:max-w-[90rem] lg:px-8 2xl:max-w-[min(100%,100rem)] 2xl:px-10">
        <Link
          href="/"
          className={`flex min-h-10 items-center gap-2.5 sm:min-h-11 sm:gap-3 ${wordmarkClassName} rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]`}
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
      </div>
    </header>
  );
}
