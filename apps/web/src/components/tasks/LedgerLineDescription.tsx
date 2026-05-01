"use client";

import { Fragment } from "react";
import type { LedgerRow, MemberRow } from "@/lib/ledger-types";
import { formatLogTimestamp, memberDisplayName } from "@/lib/task-activity-log";
import { normalizeTaskStatus, statusLabelTextClasses, taskStatusDisplayLabel } from "@/lib/task-board";

const USER_LOG_CLASS = "font-medium text-blue-600 dark:text-blue-400";

function UserName({ children }: { children: string }) {
  return <span className={USER_LOG_CLASS}>{children}</span>;
}

/** Previous status in a transition: neutral/muted, no status hue. */
function StatusPlainLabel({ raw }: { raw: string }) {
  const st = normalizeTaskStatus(raw);
  const label = taskStatusDisplayLabel(st);
  return <span className="mx-0.5 inline font-semibold text-[var(--muted)]">{label}</span>;
}

/** Current / emphasized status: semantic text color. */
function StatusInlineLabel({ raw }: { raw: string }) {
  const st = normalizeTaskStatus(raw);
  const label = taskStatusDisplayLabel(st);
  return (
    <span className={`mx-0.5 inline font-semibold ${statusLabelTextClasses(st)}`}>{label}</span>
  );
}

function AssigneeNameList({ members, ids }: { members: MemberRow[]; ids: string[] }) {
  if (ids.length === 0) return <>Nobody</>;
  return ids.map((id, i) => (
    <Fragment key={id}>
      {i > 0 ? ", " : null}
      <UserName>{memberDisplayName(members, id)}</UserName>
    </Fragment>
  ));
}

function parseIso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : v;
}

type Props = { entry: LedgerRow; members: MemberRow[] };

/** Rich ledger line: blue person names, status labels use board pill colors. */
export function LedgerLineDescription({ entry, members }: Props) {
  const actor = memberDisplayName(members, entry.actorId);

  switch (entry.type) {
    case "status_change": {
      const oldS = entry.payload.oldStatus;
      const newS = entry.payload.newStatus;
      if (typeof oldS !== "string" || typeof newS !== "string") {
        return (
          <>
            <UserName>{actor}</UserName> updated status
          </>
        );
      }
      return (
        <>
          <UserName>{actor}</UserName> changed status from <StatusPlainLabel raw={oldS} /> to{" "}
          <StatusInlineLabel raw={newS} />
        </>
      );
    }
    case "assignee_change": {
      const prev = entry.payload.previousAssigneeUserIds;
      const next = entry.payload.assigneeUserIds;
      const prevIds = Array.isArray(prev) ? prev.filter((x): x is string => typeof x === "string") : [];
      const nextIds = Array.isArray(next) ? next.filter((x): x is string => typeof x === "string") : [];
      if (prevIds.length === 0 && nextIds.length > 0) {
        return (
          <>
            <UserName>{actor}</UserName> assigned <AssigneeNameList members={members} ids={nextIds} />
          </>
        );
      }
      return (
        <>
          <UserName>{actor}</UserName> changed assignees to <AssigneeNameList members={members} ids={nextIds} />{" "}
          <span className="text-[var(--muted)]">(was </span>
          <AssigneeNameList members={members} ids={prevIds} />
          <span className="text-[var(--muted)]">)</span>
        </>
      );
    }
    case "reschedule": {
      const oldDue = parseIso(entry.payload.oldDueAt);
      const newDue = parseIso(entry.payload.newDueAt);
      const oldLabel = oldDue ? formatLogTimestamp(oldDue) : "none";
      const newLabel = newDue ? formatLogTimestamp(newDue) : "none";
      return (
        <>
          <UserName>{actor}</UserName> changed due date ({oldLabel} → {newLabel})
        </>
      );
    }
    case "archive":
      return (
        <>
          <UserName>{actor}</UserName> archived this task
        </>
      );
    case "ack":
      return (
        <>
          <UserName>{actor}</UserName> acknowledged
        </>
      );
    case "note": {
      const msg = entry.payload.message;
      if (typeof msg === "string") {
        return (
          <>
            <UserName>{actor}</UserName>: {msg}
          </>
        );
      }
      return (
        <>
          <UserName>{actor}</UserName> added a note
        </>
      );
    }
    default:
      return (
        <>
          <UserName>{actor}</UserName>
          <span className="text-[var(--muted)]"> · </span>
          {entry.type}
        </>
      );
  }
}

export const ledgerLogUserClassName = USER_LOG_CLASS;
