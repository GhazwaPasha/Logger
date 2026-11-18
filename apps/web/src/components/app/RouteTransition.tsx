"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  NavigationPromisesContext,
  PathnameContext,
  PathParamsContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { useContext, useState } from "react";
import { curve } from "@/lib/motion";

/**
 * Sidebar order of workspace sections. Moving to a section lower in the sidebar flies the old page
 * up and out while the new one flies in from below; moving higher does the reverse — the motion
 * follows where the destination sits, so navigation reads as moving through one space.
 */
const SECTION_ORDER = [
  "dashboard",
  "performance",
  "roadmap",
  "trackers",
  "calendar",
  "my-tasks",
  "work",
  "levels",
  "archived",
  "people",
  "settings",
  "organization-settings",
  "webhooks",
  "add-workspace",
  "add-organization",
];

function sectionIndex(pathname: string): number {
  const parts = pathname.split("/").filter(Boolean);
  // /<workspace>/<section>/… — the section is the second segment; /app/... falls back to the first.
  const section = parts[1] ?? parts[0] ?? "";
  const i = SECTION_ORDER.indexOf(section);
  return i === -1 ? SECTION_ORDER.length : i;
}

/**
 * Keeps the outgoing page on its own route while it flies out. Next swaps the router, pathname and
 * search-param contexts the moment you navigate; without freezing them the exiting copy would flash
 * the new page's content — and worse, react to the new URL (e.g. the trackers page's "select the
 * first tracker" effect saw no `?t=` and navigated back to itself).
 */
function FrozenRouter({ children }: { children: React.ReactNode }) {
  const isPresent = useIsPresent();
  const live = {
    layout: useContext(LayoutRouterContext),
    pathname: useContext(PathnameContext),
    searchParams: useContext(SearchParamsContext),
    pathParams: useContext(PathParamsContext),
    promises: useContext(NavigationPromisesContext),
  };
  // While this page is current it follows the router live (so `?t=` changes etc. still work);
  // the snapshot keeps the last values it had, and only takes over once the page is exiting.
  const [snap, setSnap] = useState(live);
  const changed = (Object.keys(live) as (keyof typeof live)[]).some((k) => live[k] !== snap[k]);
  if (isPresent && changed) setSnap(live);
  const v = isPresent ? live : snap;
  return (
    <LayoutRouterContext.Provider value={v.layout}>
      <PathnameContext.Provider value={v.pathname}>
        <SearchParamsContext.Provider value={v.searchParams}>
          <PathParamsContext.Provider value={v.pathParams}>
            <NavigationPromisesContext.Provider value={v.promises}>{children}</NavigationPromisesContext.Provider>
          </PathParamsContext.Provider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </LayoutRouterContext.Provider>
  );
}

/** Fly distances (px): arrivals travel a little further than departures so the new page leads. */
const FLY_IN = 32;
const FLY_OUT = 24;

/**
 * Route fly-in / fly-out. Lives in the persistent workspace shell (not a template, which remounts
 * and can't run exits). Old and new pages animate at the same time ("popLayout"), so navigating
 * never waits on an exit. Reduced motion: a short cross-fade, no travel.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // Previous page + the direction toward the current one, updated during render when the path changes.
  const [nav, setNav] = useState({ pathname, direction: 1 });
  if (nav.pathname !== pathname) {
    setNav({ pathname, direction: Math.sign(sectionIndex(pathname) - sectionIndex(nav.pathname)) || 1 });
  }
  const direction = nav.pathname === pathname ? nav.direction : Math.sign(sectionIndex(pathname) - sectionIndex(nav.pathname)) || 1;

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={pathname}
        custom={direction}
        variants={{
          enter: (d: number) =>
            reduce ? { opacity: 0 } : { opacity: 0, transform: `translateY(${d * FLY_IN}px)` },
          center: { opacity: 1, transform: "translateY(0px)" },
          exit: (d: number) =>
            reduce
              ? { opacity: 0, transition: { duration: 0.12 } }
              : {
                  opacity: 0,
                  transform: `translateY(${-d * FLY_OUT}px)`,
                  transition: { duration: 0.2, ease: curve.inOut },
                },
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={reduce ? { duration: 0.15 } : { type: "spring", duration: 0.5, bounce: 0.12 }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
