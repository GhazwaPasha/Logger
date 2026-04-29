import * as SQLite from "expo-sqlite";

export type OutboxRow = {
  id: number;
  client_mutation_id: string;
  endpoint: string;
  body: string;
  created_at: number;
};

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("work-ledger.db");
    db.execSync(`
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_mutation_id TEXT NOT NULL UNIQUE,
        endpoint TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }
  return db;
}

export function enqueueOutbox(clientMutationId: string, endpoint: string, body: object) {
  const d = getDb();
  d.runSync(
    `INSERT OR REPLACE INTO outbox (client_mutation_id, endpoint, body, created_at) VALUES (?, ?, ?, ?)`,
    [clientMutationId, endpoint, JSON.stringify(body), Date.now()],
  );
}

export function listOutbox(): OutboxRow[] {
  return getDb().getAllSync<OutboxRow>(`SELECT * FROM outbox ORDER BY id ASC`);
}

export function removeOutbox(id: number) {
  getDb().runSync(`DELETE FROM outbox WHERE id = ?`, [id]);
}
