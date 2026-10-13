"use client";

import { useMemo, useState } from "react";
import { OrgActivityTerminal } from "@/components/dashboard/OrgActivityTerminal";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { useActivityFeedPages } from "@/hooks/useOrgActivityFeed";
import { memberDisplayName } from "@/lib/task-activity-log";
import type { MemberRow } from "@/lib/ledger-types";

const ACTOR_FILTER_TRIGGER_CLASS =
  "flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]";

/** Team activity, filterable down to one person at a time (filtered server-side, paginated). */
export function PerformanceActivityFeed({
  token,
  organizationId,
  enabled,
  members,
  workHrefBase,
}: {
  token: string | null;
  organizationId: string;
  enabled: boolean;
  members: MemberRow[];
  workHrefBase: string;
}) {
  const [actorFilter, setActorFilter] = useState<string>("all");
  const feed = useActivityFeedPages(token, organizationId, enabled, actorFilter === "all" ? undefined : actorFilter);

  const selectOptions = useMemo(
    () => [
      { value: "all", label: "Everyone" },
      ...members
        .map((m) => ({ value: m.userId, label: memberDisplayName(members, m.userId) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [members],
  );

  return (
    <div>
      {members.length > 0 && (
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
        entries={feed.data?.entries ?? []}
        tasksById={feed.data?.tasksById ?? {}}
        members={members}
        workHrefBase={workHrefBase}
        isLoading={feed.isPending}
        errorMessage={feed.error ? (feed.error as Error).message : null}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        onLoadMore={feed.loadMore}
      />
    </div>
  );
}
