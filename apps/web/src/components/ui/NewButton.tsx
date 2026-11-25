"use client";

import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

/**
 * THE "create" button for page toolbars — New task, New tracker, New goal… One size and style
 * everywhere: a 40px primary square with a plus, sitting first (leftmost) in the toolbar, next to a
 * {@link Segmented} filter (42px). `label` is its accessible name and tooltip.
 */
export function NewButton({
  label,
  onClick,
  busy = false,
  disabled = false,
  className,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "pressable inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--primary)] text-[var(--on-primary)] shadow-card",
        "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sheet)]",
        "disabled:opacity-70",
        className,
      )}
    >
      {busy ? (
        <InlineSpinner className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <PlusIcon className="size-5" aria-hidden />
      )}
    </button>
  );
}
