import type { LedgerRow, MemberRow } from "@/lib/ledger-types";

function format12hClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad(d.getMinutes())} ${ampm}`;
}

/** Compact local timestamp for terminal-style log lines (YY-MM-DD, 12h + AM/PM). */
export function formatLogTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    const yy = pad(d.getFullYear() % 100);
    return `${yy}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${format12hClock(d)}`;
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
