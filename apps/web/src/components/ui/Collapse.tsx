"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Children, isValidElement, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one expand/collapse motion for the whole app (disclosures, subtasks, list rows coming and going).
 *
 * Why it's smooth where ad-hoc height animations weren't:
 * - Height springs (no fixed-duration ease), and opacity is quicker than height so content never
 *   shows through a half-open gap.
 * - The moving box carries NO padding, margin, border or flex/space-y gap from its parent — those
 *   can't shrink with it, so they made the box snap at the start or end. Spacing goes on the inner
 *   element (`className`): a row in a list gets `pb-*` instead of the list's `space-y-*`.
 * - The inner element is a flow-root, so a child's margin can't collapse through the box the moment
 *   its overflow opens up (that was a late 8–12px jump).
 * - Overflow is clipped while it moves and only opens up once it has settled open, so dropdowns and
 *   focus rings inside still work, and closing never spills content out.
 * - No scale-based `layout` on the moving box (it distorts while the height changes). Rows that can
 *   reorder pass `reorder`, which only animates their position.
 */
const HEIGHT_SPRING = { type: "spring", duration: 0.4, bounce: 0 } as const;
const FADE_IN = { duration: 0.22, ease: [0.23, 1, 0.32, 1] } as const;
const FADE_OUT = { duration: 0.14, ease: [0.4, 0, 1, 1] } as const;

type Tag = "div" | "li" | "ul" | "section";

type CollapseProps = {
  as?: Tag;
  /** Spacing + styling — applied inside the moving box (on the box itself for `as="ul"`). */
  className?: string;
  /** Rare: classes for the moving box itself (e.g. a constant negative margin that cancels a parent gap). */
  boxClassName?: string;
  /** Row can change position in its list: animate the move too (position only). */
  reorder?: boolean;
  children: ReactNode;
  id?: string;
  role?: string;
  "aria-labelledby"?: string;
};

/**
 * A collapsible box that must sit inside an <AnimatePresence initial={false}> (use for list rows).
 * For a single toggled block, use {@link Collapse}.
 */
export function CollapseItem({
  as = "div",
  className,
  boxClassName,
  reorder,
  children,
  id,
  role,
  "aria-labelledby": labelledBy,
}: CollapseProps) {
  const reduce = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Already open on first render (AnimatePresence initial={false}): no opening animation runs, so
  // onAnimationComplete never fires — without this the box stayed clipped forever (it hid the
  // sidebar's selected-channel markers, and would clip dropdowns). An opening box starts at 0px.
  useLayoutEffect(() => {
    if (boxRef.current && boxRef.current.style.height !== "0px") setSettled(true);
  }, []);
  const M = motion[as] as typeof motion.div;
  return (
    <M
      ref={boxRef}
      id={id}
      role={role}
      aria-labelledby={labelledBy}
      layout={reorder && !reduce ? "position" : undefined}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1, transition: reduce ? { duration: 0.12 } : { height: HEIGHT_SPRING, opacity: FADE_IN } }}
      exit={{ height: 0, opacity: 0, transition: reduce ? { duration: 0.1 } : { height: HEIGHT_SPRING, opacity: FADE_OUT } }}
      onAnimationStart={() => setSettled(false)}
      onAnimationComplete={(def) => {
        if (typeof def === "object" && def !== null && "height" in def && def.height === "auto") setSettled(true);
      }}
      style={{ overflow: settled ? "visible" : "hidden" }}
      // A <ul> must hold <li>s directly, so it takes the class itself — gaps between its children
      // (space-y) are fine there; just no padding/margin on it.
      className={cn(as === "ul" ? className : undefined, boxClassName)}
    >
      {as === "ul" ? children : <div className={cn("flow-root", className)}>{children}</div>}
    </M>
  );
}

/**
 * A list whose rows come and go (expanding a branch, "show all", rows added/removed): each keyed
 * child is wrapped in a {@link CollapseItem}, so rows grow in and shrink out instead of popping.
 * Space rows with `rowClassName` (e.g. "pb-1.5"), never `space-y-*` on the parent.
 */
export function CollapseRows({
  children,
  rowClassName,
  reorder = true,
}: {
  children: ReactNode;
  rowClassName?: string;
  reorder?: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {Children.toArray(children).map((child) =>
        isValidElement(child) ? (
          <CollapseItem key={child.key} className={rowClassName} reorder={reorder}>
            {child}
          </CollapseItem>
        ) : null,
      )}
    </AnimatePresence>
  );
}

/** A toggled block: animates open/closed and unmounts when closed. */
export function Collapse({ open, ...props }: CollapseProps & { open: boolean }) {
  return (
    <AnimatePresence initial={false}>{open ? <CollapseItem key="collapse" {...props} /> : null}</AnimatePresence>
  );
}
