import { getZonedParts } from '@work-ledger/contracts';

import { priorityLabelOf, statusLabelOf } from '@/lib/labels';
import type { LedgerRow } from '@/lib/types';

/** "AB" from a name ("Ada Byron" → "AB") or an email. Same rule as the web's `nameInitials`. */
export function nameInitials(name: string | null | undefined, email: string | null | undefined): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    return parts.length >= 2 ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase() : n.slice(0, 2).toUpperCase();
  }
  return (email ?? '??').slice(0, 2).toUpperCase();
}

const safeZone = (tz?: string) => tz || undefined;

/** "Sep 22, 3:45 PM" (adds the year when it isn't the current one) — the due pill on task cards. */
export function formatDueForListPill(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    const sameYear = !timeZone || getZonedParts(d, timeZone).year === getZonedParts(new Date(), timeZone).year;
    return new Intl.DateTimeFormat(undefined, {
      timeZone: safeZone(timeZone),
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function formatDateOnly(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: safeZone(timeZone), month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  } catch {
    return d.toDateString();
  }
}

/** Compact terminal-style timestamp ("26-09-22 3:45 PM") used by activity lines. */
export function formatLogTimestamp(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    const p = getZonedParts(d, timeZone);
    const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
    return `${pad(p.year % 100)}-${pad(p.month)}-${pad(p.day)} ${h12}:${pad(p.minute)} ${p.hour >= 12 ? 'PM' : 'AM'}`;
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

const ids = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);

/** Human-readable "what happened" phrase for one ledger row (mirrors the API's `describeLedgerEntry`). */
export function describeLedger(row: LedgerRow, names: Map<string, string>, timeZone: string): string {
  const p = row.payload;
  const who = (raw: unknown) => {
    const list = ids(raw);
    return list.length ? list.map((id) => names.get(id) ?? 'someone').join(', ') : 'no one';
  };
  switch (row.type) {
    case 'status_change':
      return `changed status to ${statusLabelOf(p.newStatus)}`;
    case 'assignee_change':
      return ids(p.previousAssigneeUserIds).length === 0
        ? `assigned this to ${who(p.assigneeUserIds)}`
        : `reassigned this to ${who(p.assigneeUserIds)} (was ${who(p.previousAssigneeUserIds)})`;
    case 'reschedule': {
      const due = typeof p.newDueAt === 'string' ? formatDueForListPill(p.newDueAt, timeZone) : 'no due date';
      const reason = typeof p.reason === 'string' && p.reason.trim() ? ` — ${p.reason}` : '';
      return `moved the due date to ${due}${reason}`;
    }
    case 'archive':
      return 'archived this task';
    case 'priority_change':
      return `changed priority to ${priorityLabelOf(p.newPriority)}`;
    case 'comment_added':
      return typeof p.preview === 'string' && p.preview ? `commented: "${p.preview}"` : 'commented';
    case 'comment_edited':
      return 'edited a comment';
    case 'comment_deleted':
      return 'deleted a comment';
    case 'attachment_added':
      return `uploaded ${typeof p.fileName === 'string' ? p.fileName : 'a file'}`;
    case 'attachment_deleted':
      return `removed ${typeof p.fileName === 'string' ? p.fileName : 'a file'}`;
    case 'ack':
      return 'acknowledged this assignment';
    case 'note':
      return typeof p.message === 'string' && p.message && p.message !== 'Task created.' ? p.message : 'updated this task';
    default:
      return 'updated this task';
  }
}
