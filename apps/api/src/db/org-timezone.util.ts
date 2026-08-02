import { eq } from "drizzle-orm";
import { organizations } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";

/**
 * Plain lookup, not a service method — callers already have `db` injected and this needs no
 * authorization (it's an internal read for formatting purposes, not a user-facing org fetch).
 * Falls back to UTC only if the org row is somehow missing; the column itself is NOT NULL.
 */
export async function getOrganizationTimeZone(
  db: Pick<AppDatabase, "select">,
  organizationId: string,
): Promise<string> {
  const [row] = await db
    .select({ timeZone: organizations.timeZone })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return row?.timeZone ?? "UTC";
}
