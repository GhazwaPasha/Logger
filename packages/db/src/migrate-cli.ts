/**
 * Applies Drizzle SQL migrations with one transaction per migration file.
 *
 * Drizzle's built-in `migrate()` wraps *all* pending migrations in a single transaction.
 * PostgreSQL forbids using a new enum label in the same transaction that added it (55P04),
 * so migrations that extend enums and then update rows must commit between files.
 *
 * If the database already has the `lists` table but `drizzle.__drizzle_migrations` is empty
 * (e.g. a failed migrate rolled back the journal), we record 0000 and 0001 as applied
 * without re-running their SQL.
 *
 * Usage (repo root): npm run db:migrate
 */
import "./pg-dns-order.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(pkgRoot, "../..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env or .env.local at the repo root.");
  process.exit(1);
}

const migrationsFolder = path.join(pkgRoot, "drizzle");
const migrations = readMigrationFiles({ migrationsFolder });

const pool = new pg.Pool({ connectionString: url });
const client = await pool.connect();

try {
  console.log("Applying migrations from", migrationsFolder);

  await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: listRows } = await client.query<{ e: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lists'
    ) AS e`,
  );
  const listsExists = listRows[0]?.e === true;

  if (listsExists && migrations.length >= 2) {
    const { rows: hashRows } = await client.query<{ hash: string }>(`SELECT hash FROM drizzle.__drizzle_migrations`);
    const applied = new Set(hashRows.map((r) => r.hash));
    const toBaseline = migrations.slice(0, 2).filter((m) => !applied.has(m.hash));
    if (toBaseline.length > 0) {
      console.log(
        `Lists table exists but ${toBaseline.length} early migration(s) are missing from the Drizzle journal; recording them as applied (schema already matches).`,
      );
      await client.query("BEGIN");
      try {
        for (const m of toBaseline) {
          await client.query(`INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)`, [
            m.hash,
            m.folderMillis,
          ]);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  }

  for (const migration of migrations) {
    const { rows: existing } = await client.query(`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1 LIMIT 1`, [
      migration.hash,
    ]);
    if (existing.length > 0) {
      continue;
    }

    await client.query("BEGIN");
    try {
      for (const stmt of migration.sql) {
        const text = stmt.trim();
        if (text.length === 0) continue;
        await client.query(text);
      }
      await client.query(`INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)`, [
        migration.hash,
        migration.folderMillis,
      ]);
      await client.query("COMMIT");
      console.log("Applied migration (hash prefix)", migration.hash.slice(0, 12) + "…");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Migration failed:\n", e);
      throw e;
    }
  }

  console.log("Done.");
} finally {
  client.release();
  await pool.end();
}
