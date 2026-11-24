"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/primitives/popover";
import { FLOW_COLUMN_LABELS, statusDotColor, statusPillPaletteClasses, type ManualTaskStatus } from "@/lib/task-board";
import { cn } from "@/lib/utils";
import { ClockIcon, HourglassIcon, SquareCheckIcon, SquareXIcon } from "lucide-react";

/** Same minimum box for every stage; grows to fit the label so it never truncates. */
export const STATUS_PILL_LAYOUT =
  "relative inline-flex h-8 min-w-[6.875rem] shrink-0 items-center justify-center rounded-full";

/** Kanban card meta row: status pill is icon-only, compact. */
export const KANBAN_STATUS_SHELL_LAYOUT =
  "relative inline-flex h-6 w-auto shrink-0 items-center rounded-full";

export function StatusIcon({ status, className, size }: { status: ManualTaskStatus; className?: string; size?: number }) {
  const style = size ? { width: size, height: size } : undefined;
  if (status === "done") return <SquareCheckIcon className={className} style={style} aria-hidden />;
  if (status === "in_progress") return <HourglassIcon className={className} style={style} aria-hidden />;
  if (status === "cancelled") return <SquareXIcon className={className} style={style} aria-hidden />;
  return <ClockIcon className={className} style={style} aria-hidden />;
}

/**
 * Shared status pill + picker (board cards and the task panel), on the animate-ui Popover:
 * the list grows from the pill, flips at screen edges, arrow keys move, Escape closes.
 */
export function StatusPillSelect({
  "aria-label": ariaLabel,
  value,
  onChange,
  options,
  disabled,
  pending,
  shellLayoutClassName = STATUS_PILL_LAYOUT,
}: {
  "aria-label": string;
  value: ManualTaskStatus;
  onChange: (next: ManualTaskStatus) => void;
  options: readonly ManualTaskStatus[];
  disabled?: boolean;
  /** Server sync in progress (e.g. PATCH status). */
  pending?: boolean;
  /** Outer box sizing (list row uses fixed width; kanban uses equal flex cells). */
  shellLayoutClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const blocked = disabled || pending;

  useEffect(() => {
    if (pending) setOpen(false);
  }, [pending]);

  function moveFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=option]"));
    if (!items.length) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <div className={cn(shellLayoutClassName, statusPillPaletteClasses(value), pending && "opacity-[0.88]")}>
      <Popover open={open} onOpenChange={(next) => !blocked && setOpen(next)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={blocked}
            aria-busy={pending || undefined}
            aria-haspopup="listbox"
            aria-label={ariaLabel}
            className="pressable relative z-[1] flex h-full w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[inherit] px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sheet)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="pointer-events-none text-xs font-semibold leading-none">
              {FLOW_COLUMN_LABELS[value]}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          role="listbox"
          aria-label={ariaLabel}
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-[80] w-auto min-w-[var(--radix-popover-trigger-width)] rounded-xl p-1"
          onKeyDown={moveFocus}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>("[aria-selected=true]")?.focus();
          }}
        >
          {options.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === value}
              className={cn(
                "flex w-full min-w-[9rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-footnote font-semibold leading-snug text-ink outline-none transition-colors focus-visible:bg-fill-2",
                s === value ? "bg-fill-2" : "hover:bg-fill",
              )}
              onClick={() => {
                setOpen(false);
                if (s !== value) onChange(s);
              }}
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: statusDotColor(s) }} />
              {FLOW_COLUMN_LABELS[s]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
