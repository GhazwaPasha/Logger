import type { LedgerRow, MemberRow } from "@/lib/ledger-types";

/** Compact local timestamp for terminal-style log lines. */
export function formatLogTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export function isTaskCreatedNote(entry: LedgerRow): boolean {
  if (entry.type !== "note") return false;
  const msg = entry.payload.message;
  return typeof msg === "string" && msg === "Task created.";
}
