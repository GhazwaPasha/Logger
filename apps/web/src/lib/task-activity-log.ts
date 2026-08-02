import type { LedgerRow, MemberRow } from "@/lib/ledger-types";
import { getZonedParts } from "@/lib/date";

function format12hClock(p: ReturnType<typeof getZonedParts>): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  let h = p.hour;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad(p.minute)} ${ampm}`;
}

/** Compact timestamp (in `timeZone`) for terminal-style log lines (YY-MM-DD, 12h + AM/PM). */
export function formatLogTimestamp(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    const p = getZonedParts(d, timeZone);
    const yy = pad(p.year % 100);
    return `${yy}-${pad(p.month)}-${pad(p.day)} ${format12hClock(p)}`;
  } catch {
    return iso;
  }
}

export function formatCreatorDisplay(name: string): string {
  const t = name.trim();
  if (!t) return name;
  if (t.includes("@")) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function memberDisplayName(members: MemberRow[], userId: string): string {
  const m = members.find((row) => row.userId === userId);
  const raw = (m?.name ?? "").trim() || (m?.email ?? "").trim();
  return raw || "Unknown";
}

/** Renders `@[Name](userId)` mention markup down to plain `@Name` for previews/plain-text contexts. */
export function stripMentionMarkup(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

export function isTaskCreatedNote(entry: LedgerRow): boolean {
  if (entry.type !== "note") return false;
  const msg = entry.payload.message;
  return typeof msg === "string" && msg === "Task created.";
}
