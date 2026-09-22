import { Fragment } from 'react';

import { Text } from '@/components/text';
import { Tone } from '@/constants/theme';
import { useIsDark } from '@/hooks/use-theme';
import { formatLogTimestamp } from '@/lib/format';
import { normalizeTaskStatus, statusLabelColor, STATUS_LABELS } from '@/lib/task-board';
import type { LedgerRow } from '@/lib/types';

/**
 * Rich, colorized ledger-line description — a port of the web's `LedgerLineDescription.tsx` for the
 * activity terminal. Returns nested `Text` spans meant to sit inside a parent `<Text>` (RN nests
 * Text-in-Text natively, matching how the web nests colored `<span>`s inside a `<p>`).
 */

const ids = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);

function UserName({ children }: { children: string }) {
  const dark = useIsDark();
  return (
    <Text font="mono" size="11" lh={16} weight="medium" color={dark ? Tone.blue400 : Tone.blue600}>
      {children}
    </Text>
  );
}

/** Previous status in a transition: neutral, no status hue. */
function StatusPlainLabel({ raw }: { raw: string }) {
  const st = normalizeTaskStatus(raw);
  return (
    <Text font="mono" size="11" lh={16} weight="semibold" color="muted">
      {STATUS_LABELS[st]}
    </Text>
  );
}

/** Current / emphasized status: semantic hue (matches the board's status colors). */
function StatusInlineLabel({ raw }: { raw: string }) {
  const dark = useIsDark();
  const st = normalizeTaskStatus(raw);
  return (
    <Text font="mono" size="11" lh={16} weight="semibold" color={statusLabelColor(st, dark)}>
      {STATUS_LABELS[st]}
    </Text>
  );
}

function AssigneeNameList({ names, actorIds }: { names: Map<string, string>; actorIds: string[] }) {
  if (actorIds.length === 0) return <>Nobody</>;
  return (
    <>
      {actorIds.map((id, i) => (
        <Fragment key={id}>
          {i > 0 ? ', ' : null}
          <UserName>{names.get(id) ?? 'Someone'}</UserName>
        </Fragment>
      ))}
    </>
  );
}

function parseIso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : v;
}

/**
 * Whether a `status_change` entry should carry the "Late" badge — mirrors the web's fallback:
 * the payload's own `late` flag when present, else the event time vs. the task's current due date.
 * Only meaningful (and ever `true`) for a transition landing on "done", exactly like the web.
 */
export function ledgerEntryLate(entry: LedgerRow, taskDueAt?: string | null): boolean {
  if (entry.type !== 'status_change') return false;
  const p = entry.payload as { oldStatus?: unknown; newStatus?: unknown; late?: unknown };
  if (typeof p.oldStatus !== 'string' || typeof p.newStatus !== 'string') return false;
  if (normalizeTaskStatus(p.newStatus) !== 'done') return false;
  if (typeof p.late === 'boolean') return p.late;
  return taskDueAt != null && new Date(entry.createdAt).getTime() > new Date(taskDueAt).getTime();
}

function StatusChangeBody({ actor, oldRaw, newRaw }: { actor: string; oldRaw: string; newRaw: string }) {
  const oldS = normalizeTaskStatus(oldRaw);
  const newS = normalizeTaskStatus(newRaw);

  if (oldS === newS) {
    return (
      <>
        <UserName>{actor}</UserName> updated the status
      </>
    );
  }
  if (newS === 'cancelled') {
    return (
      <>
        <UserName>{actor}</UserName> cancelled this task
      </>
    );
  }
  if (oldS === 'cancelled' && newS === 'pending') {
    return (
      <>
        <UserName>{actor}</UserName> reopened this task
      </>
    );
  }
  if (newS === 'done') {
    return (
      <>
        <UserName>{actor}</UserName> marked this task complete
      </>
    );
  }
  if (oldS === 'done') {
    return (
      <>
        <UserName>{actor}</UserName> moved this task back to <StatusInlineLabel raw={newRaw} />
      </>
    );
  }
  if (newS === 'late') {
    return (
      <>
        <UserName>{actor}</UserName> marked this task as <StatusInlineLabel raw="late" />
      </>
    );
  }
  if (newS === 'in_progress') {
    if (oldS === 'late') {
      return (
        <>
          <UserName>{actor}</UserName> resumed work on this task
        </>
      );
    }
    if (oldS === 'assigned') {
      return (
        <>
          <UserName>{actor}</UserName> acknowledged and started work
        </>
      );
    }
    if (oldS === 'pending') {
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
  if (newS === 'assigned') {
    return (
      <>
        <UserName>{actor}</UserName> moved this task to <StatusInlineLabel raw={newRaw} />
      </>
    );
  }
  if (newS === 'pending') {
    if (oldS === 'in_progress' || oldS === 'assigned' || oldS === 'late') {
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
      <UserName>{actor}</UserName> changed status from <StatusPlainLabel raw={oldRaw} /> to <StatusInlineLabel raw={newRaw} />
    </>
  );
}

export function LedgerLineBody({
  entry,
  names,
  timeZone,
}: {
  entry: LedgerRow;
  names: Map<string, string>;
  timeZone: string;
}) {
  const actor = names.get(entry.actorId) ?? 'Someone';
  const p = entry.payload;

  switch (entry.type) {
    case 'status_change': {
      const oldS = p.oldStatus;
      const newS = p.newStatus;
      if (typeof oldS !== 'string' || typeof newS !== 'string') {
        return (
          <>
            <UserName>{actor}</UserName> updated the status
          </>
        );
      }
      return <StatusChangeBody actor={actor} oldRaw={oldS} newRaw={newS} />;
    }
    case 'assignee_change': {
      const prevIds = ids(p.previousAssigneeUserIds);
      const nextIds = ids(p.assigneeUserIds);
      if (prevIds.length === 0 && nextIds.length > 0) {
        return (
          <>
            <UserName>{actor}</UserName> assigned this task to <AssigneeNameList names={names} actorIds={nextIds} />
          </>
        );
      }
      return (
        <>
          <UserName>{actor}</UserName> reassigned this task to <AssigneeNameList names={names} actorIds={nextIds} />{' '}
          <Text font="mono" size="11" lh={16} color="muted">
            (was{' '}
          </Text>
          <AssigneeNameList names={names} actorIds={prevIds} />
          <Text font="mono" size="11" lh={16} color="muted">
            )
          </Text>
        </>
      );
    }
    case 'reschedule': {
      const oldDue = parseIso(p.oldDueAt);
      const newDue = parseIso(p.newDueAt);
      const oldLabel = oldDue ? formatLogTimestamp(oldDue, timeZone) : 'none';
      const newLabel = newDue ? formatLogTimestamp(newDue, timeZone) : 'none';
      return (
        <>
          <UserName>{actor}</UserName> changed the due date ({oldLabel} → {newLabel})
        </>
      );
    }
    case 'archive':
      return (
        <>
          <UserName>{actor}</UserName> archived this task
        </>
      );
    case 'unarchive':
    case 'restore':
      return (
        <>
          <UserName>{actor}</UserName> restored this task
        </>
      );
    case 'ack':
      return (
        <>
          <UserName>{actor}</UserName> acknowledged this assignment
        </>
      );
    case 'note': {
      const msg = p.message;
      if (typeof msg === 'string' && msg && msg !== 'Task created.') {
        return (
          <>
            <UserName>{actor}</UserName>: {msg}
          </>
        );
      }
      return (
        <>
          <UserName>{actor}</UserName> updated this task
        </>
      );
    }
    case 'comment_added': {
      const preview = p.preview;
      return (
        <>
          <UserName>{actor}</UserName> commented
          {typeof preview === 'string' && preview.length > 0 ? (
            <Text font="mono" size="11" lh={16} color="muted">
              : &quot;{preview}&quot;
            </Text>
          ) : null}
        </>
      );
    }
    case 'comment_edited':
      return (
        <>
          <UserName>{actor}</UserName> edited a comment
        </>
      );
    case 'comment_deleted':
      return (
        <>
          <UserName>{actor}</UserName> deleted a comment
        </>
      );
    case 'attachment_added': {
      const fileName = p.fileName;
      return (
        <>
          <UserName>{actor}</UserName> uploaded {typeof fileName === 'string' ? fileName : 'a file'}
        </>
      );
    }
    case 'attachment_deleted': {
      const fileName = p.fileName;
      return (
        <>
          <UserName>{actor}</UserName> removed {typeof fileName === 'string' ? fileName : 'a file'}
        </>
      );
    }
    case 'priority_change': {
      const oldP = p.oldPriority;
      const newP = p.newPriority;
      if (typeof oldP !== 'string' || typeof newP !== 'string') {
        return (
          <>
            <UserName>{actor}</UserName> changed the priority
          </>
        );
      }
      return (
        <>
          <UserName>{actor}</UserName> changed priority from{' '}
          <Text font="mono" size="11" lh={16} weight="semibold" color="muted">
            {oldP}
          </Text>{' '}
          to{' '}
          <Text font="mono" size="11" lh={16} weight="semibold">
            {newP}
          </Text>
        </>
      );
    }
    default:
      return (
        <>
          <UserName>{actor}</UserName>
          <Text font="mono" size="11" lh={16} color="muted">
            {' '}
            · {entry.type}
          </Text>
        </>
      );
  }
}
