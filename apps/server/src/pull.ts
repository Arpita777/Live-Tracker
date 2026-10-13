import type { Mutation } from "@tracker/schema";
import type { Db } from "./db";

type Row = {
  seq: number;
  id: string;
  issue_id: string;
  type: string;
  hlc: string;
  changes: string;
  created_at: number;
};

export function pullMutations(db: Db, after: number, limit: number) {
  // Ask for one extra row, just to learn whether more exist
  const rows = db
    .prepare(
      `SELECT seq, id, issue_id, type, hlc, changes, created_at
       FROM mutations
       WHERE seq > ?
       ORDER BY seq ASC
       LIMIT ?`
    )
    .all(after, limit + 1) as unknown as Row[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const mutations: Mutation[] = page.map((r) => ({
    id: r.id,
    issueId: r.issue_id,
    type: r.type as Mutation["type"],
    hlc: r.hlc,
    changes: JSON.parse(r.changes) as Record<string, unknown>,
    createdAt: r.created_at,
  }));

  // Nothing new? The cursor stays where it was.
  const cursor = page.length > 0 ? page[page.length - 1]!.seq : after;

  return { mutations, cursor, hasMore };
}
