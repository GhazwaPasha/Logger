import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRepeat } from "@fortawesome/free-solid-svg-icons";
import { parseTaskDueRepeat } from "@/lib/ledger-types";

/** The small repeat icon a recurring task's card shows beside its status badge. */
export function RecurringTaskMark({ repeat }: { repeat: string | null | undefined }) {
  const parsed = parseTaskDueRepeat(repeat);
  if (!parsed) return null;
  const label = `Repeats ${parsed}`;
  return (
    <span title={label} aria-label={label} role="img" className="mr-0.5 inline-flex shrink-0 text-[var(--muted)]">
      <FontAwesomeIcon icon={faRepeat} className="size-3" aria-hidden />
    </span>
  );
}
