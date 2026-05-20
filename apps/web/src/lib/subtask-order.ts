import type { SubtaskRow } from "@/lib/ledger-types";

/** Oldest first — matches add-input-at-bottom checklist UX. */
export function sortSubtasksChronological(subtasks: SubtaskRow[]): SubtaskRow[] {
  return [...subtasks].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
