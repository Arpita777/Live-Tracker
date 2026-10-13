import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

export function openDb(path = "tracker.db"): Db {
  const db = new DatabaseSync(path);

  db.exec(`
    PRAGMA journal_mode = WAL;

    -- Every note ever received. "seq" is the order the SERVER got them.
    CREATE TABLE IF NOT EXISTS mutations (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      id         TEXT NOT NULL UNIQUE,
      issue_id   TEXT NOT NULL,
      type       TEXT NOT NULL,
      hlc        TEXT NOT NULL,
      changes    TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mutations_issue ON mutations(issue_id);

    -- Current merged state of each issue, stored as JSON.
    CREATE TABLE IF NOT EXISTS issues (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);

  return db;
}
