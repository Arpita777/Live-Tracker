import {
  applyChanges,
  issueFromCreate,
  type Issue,
  type Mutation,
} from "@tracker/schema";
import type { Db } from "./db";

export function pushMutations(db: Db, notes: Mutation[]) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO mutations (id, issue_id, type, hlc, changes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
  );
  const getIssue = db.prepare("SELECT data FROM issues WHERE id = ?");
  const putIssue = db.prepare(
    "INSERT OR REPLACE INTO issues (id, data) VALUES (?, ?)"
  );

  let applied = 0;

  db.exec("BEGIN");
  try {
    for (const note of notes) {
      const result = insert.run(
        note.id,
        note.issueId,
        note.type,
        note.hlc,
        JSON.stringify(note.changes),
        note.createdAt
      );

      // 0 rows changed means this note id was already stored: skip the merge
      if (Number(result.changes) === 0) continue;

      const row = getIssue.get(note.issueId) as unknown as
        | { data: string }
        | undefined;

      const next = row
        ? applyChanges(JSON.parse(row.data) as Issue, note.changes, note.hlc)
        : issueFromCreate({ ...note.changes, id: note.issueId }, note.hlc);

      putIssue.run(note.issueId, JSON.stringify(next));
      applied++;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const last = db
    .prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM mutations")
    .get() as unknown as { seq: number };

  return {
    accepted: notes.map((n) => n.id), // includes duplicates, see above
    applied,
    duplicates: notes.length - applied,
    serverSeq: last.seq,
  };
}
