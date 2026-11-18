/**
 * The app's motion vocabulary. animate-ui supplies the primitives' own springs and eases
 * (re-exported here so every hand-built animation uses the same values), plus the three
 * curves from globals.css (`--motion-respond`, `--motion-move`, `--motion-in-out`).
 *
 * Rules (from the redesign): nothing animates on keyboard shortcuts or list navigation;
 * press feedback is instant (scale 0.97); menus grow from their trigger; panels move with
 * the drawer curve; bounce only after a gesture that carried momentum.
 */
import type { Transition } from "motion/react";

export { ease, spring, scale, transition, useShouldReduceMotion } from "@animate-ui/react/utils/motion";

/** Same curves as the CSS custom properties, for Motion `ease` arrays. */
export const curve = {
  respond: [0.23, 1, 0.32, 1],
  move: [0.32, 0.72, 0, 1],
  inOut: [0.77, 0, 0.175, 1],
} as const;

/** Critically damped by default; `settle` adds a little bounce for momentum gestures. */
export const springs = {
  move: { type: "spring", duration: 0.4, bounce: 0 },
  settle: { type: "spring", duration: 0.45, bounce: 0.15 },
  snappy: { type: "spring", duration: 0.25, bounce: 0 },
} satisfies Record<string, Transition>;

/** Collapses a duration to 0 when the user asked for reduced motion. */
export function reducedDuration(base: number, reduce: boolean | null | undefined) {
  return reduce ? 0 : base;
}

/** Shared Motion variants for hand-built surfaces that aren't animate-ui primitives yet. */
export const variants = {
  /** Scrim behind a dialog. Opacity only. */
  backdrop: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  /** Anchored panel (inline dropdowns): grows from its trigger, never from scale(0). */
  panelPop: {
    hidden: { opacity: 0, transform: "translateY(-4px) scale(0.97)" },
    visible: { opacity: 1, transform: "translateY(0px) scale(1)" },
  },
  /** Centered dialog card. */
  dialogCard: {
    hidden: { opacity: 0, transform: "scale(0.97)" },
    visible: { opacity: 1, transform: "scale(1)" },
  },
  /** Bottom sheet on phones, rises in on desktop. */
  sheetCard: {
    hidden: { opacity: 0, transform: "translateY(100%)" },
    visible: { opacity: 1, transform: "translateY(0%)" },
  },
} as const;
