import type { FieldConflict } from "@tracker/schema";
import { db } from "./db";

export function conflictKey(c: FieldConflict): string {
  return `${c.issueId}:${c.field}:${c.winner.hlc}:${c.loser.hlc}`;
}

// Call this inside a transaction that includes db.conflicts
export async function recordConflicts(list: FieldConflict[]): Promise<void> {
  for (const conflict of list) {
    const key = conflictKey(conflict);
    if (await db.conflicts.get(key)) continue; // already logged, keep its status

    await db.conflicts.add({
      ...conflict,
      key,
      detectedAt: Date.now(),
      status: "open",
    });
  }
}

export function dismissConflict(key: string): Promise<number> {
  return db.conflicts.update(key, { status: "dismissed" });
}

export function dismissAllConflicts(): Promise<number> {
  return db.conflicts
    .where("status")
    .equals("open")
    .modify({ status: "dismissed" });
}

export function countOpenConflicts(): Promise<number> {
  return db.conflicts.where("status").equals("open").count();
}
