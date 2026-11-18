"use client";

import { Switch } from "@/components/primitives/switch";
import { cn } from "@/lib/utils";

/**
 * App toggle, now an animate-ui Switch (thumb springs across and stretches while pressed).
 * Same props as before, so every caller keeps working.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  activeClassName,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  /**
   * Checked-state track classes for a brand color, written out literally so Tailwind generates them:
   * `"data-[state=checked]:bg-[#5865F2]"`. Defaults to the primary graphite.
   */
  activeClassName?: string;
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(activeClassName, activeClassName && "[&_[data-slot=switch-thumb]]:bg-white!")}
    />
  );
}
