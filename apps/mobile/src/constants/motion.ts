/**
 * Motion tokens. These mirror the web app's motion system (`components/ui/motion-presets.ts` and the
 * durations used across `motion/react` and the CSS transitions) so both apps move the same way:
 * one shared easing, short durations, and animation that stays out of the way.
 */
import { Easing, FadeIn, FadeOut, Keyframe, LinearTransition } from 'react-native-reanimated';

/** The web's shared easing (`POP_EASE`): a quick start that settles softly. */
export const POP_EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** Durations in ms, from the web's presets. */
export const Duration = {
  /** Press-down scale. */
  press: 90,
  /** Chevron rotation, fades on mount, small state changes. */
  micro: 150,
  /** Collapsibles, colour transitions, list reflow. */
  base: 200,
  /** Route enter / exit. */
  page: 220,
  /** Popovers and menus. */
  pop: 240,
  /** Sliding nav pill. */
  pill: 280,
  /** Drawer. */
  slide: 300,
  /** Side panels. */
  panel: 320,
} as const;

export const Spring = {
  /** Releasing a pressed control back to rest. */
  press: { damping: 16, stiffness: 420, mass: 0.5 },
  /** Bottom sheets: quick and settled, never overshooting the screen edge. */
  sheet: { damping: 28, stiffness: 300, mass: 0.9, overshootClamping: true },
} as const;

/** Colour / opacity transitions on state changes (CSS-style transitions on Reanimated views). */
export const stateTransition = {
  transitionProperty: ['backgroundColor', 'borderColor', 'opacity'] as string[],
  transitionDuration: Duration.base,
  transitionTimingFunction: 'ease-out' as const,
};

// ---------------------------------------------------------------------------------------------
// Entering / exiting / layout presets
// ---------------------------------------------------------------------------------------------

/** A page mounting: fade in with a 6px rise (web route template). */
export const pageEnter = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 6 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: POP_EASE },
}).duration(Duration.page);

/** Popover / menu appearing: fade, 0.96 → 1 scale, 4px drop (web `panelPopVariants`). */
export const popIn = new Keyframe({
  from: { opacity: 0, transform: [{ scale: 0.96 }, { translateY: -4 }] },
  to: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }], easing: POP_EASE },
}).duration(Duration.pop);

/** Empty states rise in (web `EmptyState`). */
export const emptyEnter = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 4 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: POP_EASE },
}).duration(280);

/** Content revealed by a collapsible (tree channels, subtasks). */
export const revealIn = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: -4 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: POP_EASE },
}).duration(Duration.base);

export const revealOut = FadeOut.duration(Duration.micro);
export const fadeOut = FadeOut.duration(Duration.micro);

/** Siblings gliding into place when something above them changes height or leaves. */
export const listLayout = LinearTransition.duration(Duration.base).easing(POP_EASE);

const STAGGER_MS = 35;
const STAGGER_CAP = 8;

/** A card / row appearing: a short fade, staggered for the first few items (web list `initial={{ opacity: 0 }}`). */
export function itemEnter(index: number) {
  return FadeIn.duration(Duration.micro).delay(Math.min(index, STAGGER_CAP) * STAGGER_MS);
}

/** A task card sliding in from the left with a fade, staggered for the first few cards. */
export function cardEnter(index: number) {
  return new Keyframe({
    from: { opacity: 0, transform: [{ translateX: -28 }] },
    to: { opacity: 1, transform: [{ translateX: 0 }], easing: POP_EASE },
  })
    .duration(Duration.slide)
    .delay(Math.min(index, STAGGER_CAP) * 45);
}

const SEQUENCE_STEP_MS = 60;
const SEQUENCE_ENTER_MS = 360;

/** A larger element entering in sequence (sign-in, dashboard panels). */
export function sequenceEnter(index: number, offset = 10) {
  return new Keyframe({
    from: { opacity: 0, transform: [{ translateY: offset }] },
    to: { opacity: 1, transform: [{ translateY: 0 }], easing: POP_EASE },
  })
    .duration(SEQUENCE_ENTER_MS)
    .delay(index * SEQUENCE_STEP_MS);
}

/**
 * Ms after mount at which step `index` of a sequence has mostly landed — when its own content animation (a ring
 * filling, bars growing) should begin, so that plays after the entrance instead of racing it.
 */
export const sequenceSettled = (index: number) => index * SEQUENCE_STEP_MS + SEQUENCE_ENTER_MS * 0.7;

/** Activity-log lines revealing one after another (web `term-line-reveal`). */
export function lineReveal(index: number) {
  return new Keyframe({
    from: { opacity: 0, transform: [{ translateY: 4 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }], easing: POP_EASE },
  })
    .duration(Duration.base)
    .delay(Math.min(index, 20) * 25);
}

/** The floating live-island toast dropping in. */
export const islandIn = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: -14 }, { scale: 0.94 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: POP_EASE },
}).duration(Duration.panel);
