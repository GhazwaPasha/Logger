"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { motionDuration } from "./motion-presets";

type ActionShorthand = { label: string; onClick: () => void };

function isActionShorthand(action: ActionShorthand | ReactNode): action is ActionShorthand {
  return typeof action === "object" && action !== null && "label" in action && "onClick" in action;
}

const SIZE = {
  default: {
    wrap: "gap-2.5 py-6",
    badge: "size-12 text-base",
    title: "text-sm font-medium",
    description: "text-xs",
  },
  compact: {
    wrap: "gap-1.5 py-3",
    badge: "size-9 text-sm",
    title: "text-xs font-medium",
    description: "text-[11px]",
  },
} as const;

/**
 * Shared visual treatment for "no data yet" spots — icon badge + title + optional
 * description/action. Use `size="compact"` inline in trees/lists, `size="default"`
 * as the sole content of a panel.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon: IconDefinition;
  title: string;
  description?: ReactNode;
  action?: ActionShorthand | ReactNode;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  const s = SIZE[size];

  return (
    <motion.div
      className={`flex flex-col items-center justify-center text-center ${s.wrap} ${className ?? ""}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionDuration(0.28, prefersReduced) }}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--accent)] ${s.badge}`}
        aria-hidden
      >
        <FontAwesomeIcon icon={icon} />
      </span>
      <p className={`${s.title} text-[var(--fg)]`}>{title}</p>
      {description ? <p className={`max-w-xs ${s.description} leading-relaxed text-[var(--muted)]`}>{description}</p> : null}
      {action ? (
        isActionShorthand(action) ? (
          <button
            type="button"
            className="btn-secondary mt-1 rounded-lg px-3 py-1.5 text-xs font-medium"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : (
          action
        )
      ) : null}
    </motion.div>
  );
}
