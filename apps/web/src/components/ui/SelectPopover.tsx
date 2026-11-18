"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/primitives/popover";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  disabled?: boolean;
  /** Full className for the trigger button. Defaults to the app tile-button style. */
  triggerClassName?: string;
  /** Custom content inside the trigger button (replaces the default label). */
  triggerContent?: React.ReactNode;
  /** Show a caret chevron after the label. Default true. */
  showChevron?: boolean;
  "aria-label"?: string;
};

/**
 * Single-choice picker on the animate-ui Popover: grows from its trigger, flips at screen edges,
 * closes on Escape / outside click, arrow keys move between options. Same props as before.
 */
export function SelectPopover<T extends string>({
  value,
  onChange,
  options,
  disabled,
  triggerClassName,
  triggerContent,
  showChevron = true,
  "aria-label": ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  const defaultTriggerClass =
    "inline-flex items-center gap-2 rounded-lg bg-[var(--card)] shadow-card px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50";

  function moveFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=option]"));
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : e.key === "ArrowDown" ? (at + 1) % items.length
      : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={triggerClassName ?? defaultTriggerClass}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
        >
          {triggerContent ?? <span className="truncate">{currentLabel}</span>}
          {showChevron && (
            <ChevronDown
              aria-hidden
              strokeWidth={2.4}
              className={cn(
                "ml-auto size-3.5 shrink-0 transition-transform duration-200 ease-[var(--motion-respond)]",
                open && "rotate-180",
              )}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        role="listbox"
        aria-label={ariaLabel}
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="z-[200] w-[max(var(--radix-popover-trigger-width),180px)] max-h-[min(22rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-xl p-1"
        onKeyDown={moveFocus}
        onOpenAutoFocus={(e) => {
          // Start on the current choice so Enter/arrow keys continue from it.
          e.preventDefault();
          (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>("[aria-selected=true]")?.focus();
        }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={active}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-1.5 text-left text-sm text-ink outline-none transition-colors focus-visible:bg-fill-2",
                active ? "bg-fill-2 font-semibold" : "font-medium hover:bg-fill",
              )}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
