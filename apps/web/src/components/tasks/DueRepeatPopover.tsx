"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/primitives/popover";
import type { TaskDueRepeat } from "@/lib/ledger-types";
import { cn } from "@/lib/utils";

const REPEAT_OPTIONS: { value: TaskDueRepeat; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const REPEAT_LABEL: Record<TaskDueRepeat, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

type DueRepeatPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Same shape as due popover (`YYYY-MM-DDTHH:mm` or ""). Repeat UI disabled until set. */
  dueLocalValue: string;
  value: TaskDueRepeat | null;
  onChange: (next: TaskDueRepeat | null) => void;
};

/** Repeat picker (daily / weekly / monthly / yearly) on the animate-ui Popover. */
export function DueRepeatPopover({ open, onOpenChange, dueLocalValue, value, onChange }: DueRepeatPopoverProps) {
  const dueSet = dueLocalValue.trim().length > 0;
  const label = dueSet && value ? REPEAT_LABEL[value] : "Repeat";

  return (
    <Popover open={open && dueSet} onOpenChange={(next) => dueSet && onOpenChange(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!dueSet}
          className={cn(
            "pressable h-8 min-w-0 max-w-[min(100%,18rem)] rounded-[9px] bg-fill px-3 text-left text-sm font-medium text-ink-2 hover:bg-fill-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45",
            open && "bg-fill-2 text-ink",
          )}
          aria-haspopup="dialog"
          aria-label={dueSet && value ? `Repeat: ${REPEAT_LABEL[value]}` : "Repeat"}
          title={dueSet ? (value ? `Repeats ${REPEAT_LABEL[value]}` : "Choose repeat") : "Set a due date first"}
        >
          <span className="block truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        role="dialog"
        aria-label="Due repeat"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="z-[100] w-[220px] rounded-2xl p-2"
      >
        <p className="mb-1.5 px-1 text-caption font-semibold text-ink-2">Repeat</p>
        <div className="grid grid-cols-2 gap-1">
          {REPEAT_OPTIONS.map(({ value: rv, label: optLabel }) => {
            const active = value === rv;
            return (
              <button
                key={rv}
                type="button"
                onClick={() => onChange(active ? null : rv)}
                aria-pressed={active}
                className={cn(
                  "pressable rounded-lg px-2 py-1.5 text-center text-xs font-medium",
                  active ? "bg-primary text-on-primary" : "bg-fill text-ink-2 hover:bg-fill-2 hover:text-ink",
                )}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-caption leading-snug text-ink-2">Tap again to clear.</p>
      </PopoverContent>
    </Popover>
  );
}
