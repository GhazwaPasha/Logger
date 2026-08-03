"use client";

import { useMemo, useState } from "react";
import { OrgActivityTerminal } from "@/components/dashboard/OrgActivityTerminal";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { memberDisplayName } from "@/lib/task-activity-log";
import type { MemberRow, OrgActivityFeedResponse } from "@/lib/ledger-types";

const ACTOR_FILTER_TRIGGER_CLASS =
  "flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]";

/** Team activity, filterable down to one person at a time. */
export function PerformanceActivityFeed({
  activity,
  members,
  workHrefBase,
  isLoading,
  errorMessage,
}: {
  activity: OrgActivityFeedResponse | undefined;
  members: MemberRow[];
  workHrefBase: string;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  const [actorFilter, setActorFilter] = useState<string>("all");

  const entries = activity?.entries ?? [];
  const tasksById = activity?.tasksById ?? {};

  const actorOptions = useMemo(() => {
    const ids = new Set(entries.map((e) => e.actorId));
    return [...ids]
      .map((id) => ({ value: id, label: memberDisplayName(members, id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [entries, members]);

  const selectOptions = useMemo(() => [{ value: "all", label: "Everyone" }, ...actorOptions], [actorOptions]);

  const filteredEntries = useMemo(
    () => (actorFilter === "all" ? entries : entries.filter((e) => e.actorId === actorFilter)),
    [entries, actorFilter],
  );

  return (
    <div>
      {actorOptions.length > 0 && (
        <div className="mb-2">
          <SelectPopover
            value={actorFilter}
            onChange={setActorFilter}
            options={selectOptions}
            triggerClassName={ACTOR_FILTER_TRIGGER_CLASS}
            aria-label="Filter activity by person"
          />
        </div>
      )}
      <OrgActivityTerminal
        entries={filteredEntries}
        tasksById={tasksById}
        members={members}
        workHrefBase={workHrefBase}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    </div>
  );
}
