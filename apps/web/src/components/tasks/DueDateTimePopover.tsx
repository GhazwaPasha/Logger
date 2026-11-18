"use client";

import { useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/primitives/popover";
import { DueDateTimePanel } from "./DueDateTimePanel";
import { cn } from "@/lib/utils";

function formatDueTriggerLabel(value: string): string {
  const t = value.trim();
  if (!t) return "Set due";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "Set due";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

type DueDateTimePopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (localValue: string) => void;
  onClear: () => void;
  /** Overrides the trigger's default muted text color (e.g. to flag an overdue or upcoming due date). */
  triggerColorClassName?: string;
};

/** Due date + time picker on the animate-ui Popover (grows from the chip, flips at screen edges). */
export function DueDateTimePopover({
  open,
  onOpenChange,
  value,
  onChange,
  onClear,
  triggerColorClassName,
}: DueDateTimePopoverProps) {
  const handleClear = useCallback(() => {
    onClear();
    onOpenChange(false);
  }, [onClear, onOpenChange]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          className={cn(
            "pressable h-8 rounded-[9px] bg-[var(--info-bg)] px-3 text-sm font-medium tabular-nums hover:brightness-[0.98]",
            triggerColorClassName ?? "text-[var(--info-ink)]",
            open && "bg-fill-2",
          )}
        >
          {formatDueTriggerLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        role="dialog"
        aria-label="Due date and time"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="due-popover-scroll z-[100] w-[236px] max-h-[min(78vh,420px)] overflow-y-auto rounded-2xl p-2"
      >
        <DueDateTimePanel
          compact
          value={value}
          onChange={onChange}
          onClear={handleClear}
          onSave={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
