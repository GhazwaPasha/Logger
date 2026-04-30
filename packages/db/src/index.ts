import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export * from "./schema.js";

export type AppDatabase = NodePgDatabase<typeof schema>;

/**
 * pg/pg-connection-string warns that legacy sslmode values (require/prefer/verify-ca)
 * will change semantics in the next major. We normalize to verify-full to keep strict TLS.
 */
export function normalizeDatabaseUrl(connectionString: string): string {
  const raw = connectionString.trim();
  if (!raw) return connectionString;

  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode");
    const useLibpqCompat = url.searchParams.get("uselibpqcompat") === "true";
    if (!useLibpqCompat && (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca")) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
    return raw;
  } catch {
    return connectionString;
  }
}

export function createDb(connectionString: string): AppDatabase {
  const pool = new Pool({ connectionString: normalizeDatabaseUrl(connectionString) });
  return drizzle(pool, { schema });
}

export function createDbFromPool(pool: Pool): AppDatabase {
  return drizzle(pool, { schema });
}
