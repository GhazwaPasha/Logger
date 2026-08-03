"use client";

import { useMemo, useState } from "react";
import { OrgActivityTerminal } from "@/components/dashboard/OrgActivityTerminal";
import { memberDisplayName } from "@/lib/task-activity-log";
import type { MemberRow, OrgActivityFeedResponse } from "@/lib/ledger-types";

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
      .map((id) => ({ id, label: memberDisplayName(members, id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [entries, members]);

  const filteredEntries = useMemo(
    () => (actorFilter === "all" ? entries : entries.filter((e) => e.actorId === actorFilter)),
    [entries, actorFilter],
  );

  return (
    <div>
      {actorOptions.length > 0 && (
        <div className="mb-2 flex items-center justify-end">
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="input h-8 rounded-lg px-2 text-xs"
            aria-label="Filter activity by person"
          >
            <option value="all">Everyone</option>
            {actorOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
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
