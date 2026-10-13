import { applyChanges, issueFromCreate, type Mutation } from "@tracker/schema";
import { db } from "../db/db";
import { clock } from "./clock";

export async function receiveMutations(notes: Mutation[]): Promise<void> {
  // Oldest first, so creates are applied before the updates that follow them
  const ordered = [...notes].sort((a, b) =>
    a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0
  );

  await db.transaction("rw", db.issues, async () => {
    for (const note of ordered) {
      clock.receive(note.hlc); // catch up with the sender

      const existing = await db.issues.get(note.issueId);

      if (existing) {
        await db.issues.put(applyChanges(existing, note.changes, note.hlc));
      } else {
        // Unknown issue: build it (works for a create, and for an update that arrived early)
        await db.issues.put(
          issueFromCreate({ ...note.changes, id: note.issueId }, note.hlc)
        );
      }
    }
  });
}
