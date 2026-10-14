import {
  applyChangesDetailed,
  issueFromCreate,
  type FieldConflict,
  type Mutation,
} from "@tracker/schema";
import { db } from "../db/db";
import { recordConflicts } from "../db/conflictRepo";
import { clock } from "./clock";

export async function receiveMutations(
  notes: Mutation[]
): Promise<FieldConflict[]> {
  // Oldest first, so creates are applied before the updates that follow them
  const ordered = [...notes].sort((a, b) =>
    a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0
  );

  return db.transaction("rw", db.issues, db.conflicts, async () => {
    const found: FieldConflict[] = [];

    for (const note of ordered) {
      clock.receive(note.hlc); // catch up with the sender

      const existing = await db.issues.get(note.issueId);

      if (existing) {
        const result = applyChangesDetailed(existing, note.changes, note.hlc);
        await db.issues.put(result.issue);
        found.push(...result.conflicts);
      } else {
        // Unknown issue: build it (a create, or an update that arrived early)
        await db.issues.put(
          issueFromCreate({ ...note.changes, id: note.issueId }, note.hlc)
        );
      }
    }

    await recordConflicts(found);
    return found;
  });
}
