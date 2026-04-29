import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export * from "./schema.js";

export type AppDatabase = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string): AppDatabase {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export function createDbFromPool(pool: Pool): AppDatabase {
  return drizzle(pool, { schema });
}
