import {
  MERGEABLE_FIELDS,
  type FieldConflict,
  type Issue,
} from "@tracker/schema";
import { db } from "./db";
import { updateIssue } from "./issueRepo";

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

// Put the overwritten value back as a NEW edit (new clock, so it wins and syncs)
export async function restoreConflict(key: string): Promise<void> {
  const row = await db.conflicts.get(key);
  if (!row) return;

  const mergeable = (MERGEABLE_FIELDS as readonly string[]).includes(row.field);
  if (mergeable) {
    await updateIssue(row.issueId, {
      [row.field]: row.loser.value,
    } as Partial<Issue>);
  }
  await dismissConflict(key);
}
