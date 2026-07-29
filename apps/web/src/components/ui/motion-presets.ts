import type { Variants } from "motion/react";

/** Shared easing for anchored popover/menu pops — matches the legacy CSS `ui-dropdown-pop` curve. */
export const POP_EASE = [0.22, 1, 0.36, 1] as const;

/** Backdrop scrim behind a centered dialog. Opacity only — no movement. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Anchored popover/menu panel (select dropdowns, context menus). */
export const panelPopVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

/** Centered dialog card — scale only, no translate (it isn't anchored to a trigger). */
export const dialogCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
};

/** Collapses a duration to 0 under `prefers-reduced-motion`, matching the app's existing CSS reduced-motion behavior. */
export function motionDuration(base: number, prefersReduced: boolean | null) {
  return prefersReduced ? 0 : base;
}
