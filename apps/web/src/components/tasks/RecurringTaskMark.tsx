import { parseTaskDueRepeat } from "@/lib/ledger-types";
import { RepeatIcon } from "lucide-react";

/** The small repeat icon a recurring task's card shows beside its status badge. */
export function RecurringTaskMark({ repeat }: { repeat: string | null | undefined }) {
  const parsed = parseTaskDueRepeat(repeat);
  if (!parsed) return null;
  const label = `Repeats ${parsed}`;
  return (
    <span title={label} aria-label={label} role="img" className="mr-0.5 inline-flex shrink-0 text-[var(--muted)]">
      <RepeatIcon className="size-3.5" aria-hidden />
    </span>
  );
}
