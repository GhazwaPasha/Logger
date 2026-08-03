"use client";

import { Fragment } from "react";
import type { LedgerRow, MemberRow } from "@/lib/ledger-types";
import { formatLogTimestamp, memberDisplayName, stripMentionMarkup } from "@/lib/task-activity-log";
import { normalizeTaskStatus, statusLabelTextClasses, taskStatusDisplayLabel } from "@/lib/task-board";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

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

type Props = {
  entry: LedgerRow;
  members: MemberRow[];
  /** Task's current due date — used only as a fallback for entries recorded before `late` was captured in the payload. */
  taskDueAt?: string | null;
};

function LateBadge() {
  return (
    <span className="ml-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
      Late
    </span>
  );
}

/** Human-readable status transitions (ledger stores raw API enum strings). */
function StatusChangeLine({
  actor,
  oldRaw,
  newRaw,
  late,
}: {
  actor: string;
  oldRaw: string;
  newRaw: string;
  late?: boolean;
}) {
  const oldS = normalizeTaskStatus(oldRaw);
  const newS = normalizeTaskStatus(newRaw);

  if (oldS === newS) {
    return (
      <>
        <UserName>{actor}</UserName> updated the status
      </>
    );
  }

  if (newS === "cancelled") {
    return (
      <>
        <UserName>{actor}</UserName> cancelled this task
      </>
    );
  }

  if (oldS === "cancelled" && newS === "pending") {
    return (
      <>
        <UserName>{actor}</UserName> reopened this task
      </>
    );
  }

  if (newS === "done") {
    return (
      <>
        <UserName>{actor}</UserName> marked this task complete
        {late ? <LateBadge /> : null}
      </>
    );
  }

  if (oldS === "done") {
    return (
      <>
        <UserName>{actor}</UserName> moved this task back to <StatusInlineLabel raw={newRaw} />
      </>
    );
  }

  if (newS === "late") {
    return (
      <>
        <UserName>{actor}</UserName> marked this task as <StatusInlineLabel raw="late" />
      </>
    );
  }

  if (newS === "in_progress") {
    if (oldS === "late") {
      return (
        <>
          <UserName>{actor}</UserName> resumed work on this task
        </>
      );
    }
    if (oldS === "assigned") {
      return (
        <>
          <UserName>{actor}</UserName> acknowledged and started work
        </>
      );
    }
    if (oldS === "pending") {
      return (
        <>
          <UserName>{actor}</UserName> started work on this task
        </>
      );
    }
    return (
      <>
        <UserName>{actor}</UserName> set status to <StatusInlineLabel raw={newRaw} />
      </>
    );
  }

  if (newS === "assigned") {
    return (
      <>
        <UserName>{actor}</UserName> moved this task to <StatusInlineLabel raw={newRaw} />
      </>
    );
  }

  if (newS === "pending") {
    if (oldS === "in_progress" || oldS === "assigned" || oldS === "late") {
      return (
        <>
          <UserName>{actor}</UserName> moved this task back to <StatusInlineLabel raw={newRaw} />
        </>
      );
    }
    return (
      <>
        <UserName>{actor}</UserName> set status to <StatusInlineLabel raw={newRaw} />
      </>
    );
  }

  return (
    <>
      <UserName>{actor}</UserName> changed status from <StatusPlainLabel raw={oldRaw} /> to{" "}
      <StatusInlineLabel raw={newRaw} />
    </>
  );
}

/** Rich ledger line: blue person names, status labels use board pill colors. */
export function LedgerLineDescription({ entry, members, taskDueAt }: Props) {
  const { timeZone } = useWorkspaceRoute();
  const actor = memberDisplayName(members, entry.actorId);

  switch (entry.type) {
    case "status_change": {
      const oldS = entry.payload.oldStatus;
      const newS = entry.payload.newStatus;
      if (typeof oldS !== "string" || typeof newS !== "string") {
        return (
          <>
            <UserName>{actor}</UserName> updated the status
          </>
        );
      }
      // Entries recorded before `late` was captured in the payload fall back to comparing this
      // event's own timestamp against the task's current due date (best-effort for old data).
      const late =
        typeof entry.payload.late === "boolean"
          ? entry.payload.late
          : taskDueAt != null && new Date(entry.createdAt).getTime() > new Date(taskDueAt).getTime();
      return <StatusChangeLine actor={actor} oldRaw={oldS} newRaw={newS} late={late} />;
    }
    case "assignee_change": {
      const prev = entry.payload.previousAssigneeUserIds;
      const next = entry.payload.assigneeUserIds;
      const prevIds = Array.isArray(prev) ? prev.filter((x): x is string => typeof x === "string") : [];
      const nextIds = Array.isArray(next) ? next.filter((x): x is string => typeof x === "string") : [];
      if (prevIds.length === 0 && nextIds.length > 0) {
        return (
          <>
            <UserName>{actor}</UserName> assigned this task to <AssigneeNameList members={members} ids={nextIds} />
          </>
        );
      }
      return (
        <>
          <UserName>{actor}</UserName> reassigned this task to <AssigneeNameList members={members} ids={nextIds} />{" "}
          <span className="text-[var(--muted)]">(was </span>
          <AssigneeNameList members={members} ids={prevIds} />
          <span className="text-[var(--muted)]">)</span>
        </>
      );
    }
    case "reschedule": {
      const oldDue = parseIso(entry.payload.oldDueAt);
      const newDue = parseIso(entry.payload.newDueAt);
      const oldLabel = oldDue ? formatLogTimestamp(oldDue, timeZone) : "none";
      const newLabel = newDue ? formatLogTimestamp(newDue, timeZone) : "none";
      return (
        <>
          <UserName>{actor}</UserName> changed the due date ({oldLabel} → {newLabel})
        </>
      );
    }
    case "archive":
      return (
        <>
          <UserName>{actor}</UserName> archived this task
        </>
      );
    case "unarchive":
      return (
        <>
          <UserName>{actor}</UserName> restored this task
        </>
      );
    case "ack":
      return (
        <>
          <UserName>{actor}</UserName> acknowledged this assignment
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
    case "comment_added": {
      const preview = entry.payload.preview;
      return (
        <>
          <UserName>{actor}</UserName> commented
          {typeof preview === "string" && preview.length > 0 && (
            <span className="text-[var(--muted)]">: "{stripMentionMarkup(preview)}"</span>
          )}
        </>
      );
    }
    case "comment_edited":
      return (
        <>
          <UserName>{actor}</UserName> edited a comment
        </>
      );
    case "comment_deleted":
      return (
        <>
          <UserName>{actor}</UserName> deleted a comment
        </>
      );
    case "comment_restored":
      return (
        <>
          <UserName>{actor}</UserName> restored a comment
        </>
      );
    case "attachment_added": {
      const fileName = entry.payload.fileName;
      return (
        <>
          <UserName>{actor}</UserName> uploaded{" "}
          {typeof fileName === "string" ? (
            <span className="font-medium">{fileName}</span>
          ) : (
            "a file"
          )}
        </>
      );
    }
    case "attachment_deleted": {
      const fileName = entry.payload.fileName;
      return (
        <>
          <UserName>{actor}</UserName> removed{" "}
          {typeof fileName === "string" ? (
            <span className="font-medium">{fileName}</span>
          ) : (
            "a file"
          )}
        </>
      );
    }
    case "dependency_added": {
      const title = entry.payload.dependsOnTaskTitle;
      return (
        <>
          <UserName>{actor}</UserName> added blocker{" "}
          {typeof title === "string" ? (
            <span className="font-medium">{title}</span>
          ) : (
            "a task"
          )}
        </>
      );
    }
    case "dependency_removed": {
      const title = entry.payload.dependsOnTaskTitle;
      return (
        <>
          <UserName>{actor}</UserName> removed blocker{" "}
          {typeof title === "string" ? (
            <span className="font-medium">{title}</span>
          ) : (
            "a task"
          )}
        </>
      );
    }
    case "priority_change": {
      const oldP = entry.payload.oldPriority;
      const newP = entry.payload.newPriority;
      if (typeof oldP !== "string" || typeof newP !== "string") {
        return <><UserName>{actor}</UserName> changed the priority</>;
      }
      return (
        <>
          <UserName>{actor}</UserName> changed priority from{" "}
          <span className="mx-0.5 font-semibold text-[var(--muted)]">{oldP}</span> to{" "}
          <span className="mx-0.5 font-semibold">{newP}</span>
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
