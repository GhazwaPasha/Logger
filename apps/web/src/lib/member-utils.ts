import type { MemberRow } from "@/lib/ledger-types";

export function memberInitials(m: MemberRow): string {
  const n = m.name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  }
  return (m.email ?? "??").slice(0, 2).toUpperCase();
}
