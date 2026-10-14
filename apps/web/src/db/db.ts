import Dexie, { type Table } from "dexie";
import type { FieldConflict, Issue, Mutation } from "@tracker/schema";

export type OutboxEntry = Mutation & { seq?: number };

export type MetaRow = { key: string; value: unknown };

export type ConflictRow = FieldConflict & {
  key: string; // issueId:field:winnerHlc:loserHlc
  detectedAt: number;
  status: "open" | "dismissed";
};

class TrackerDB extends Dexie {
  issues!: Table<Issue, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaRow, string>;
  conflicts!: Table<ConflictRow, string>;

  constructor() {
    super("tracker");

    this.version(1).stores({
      issues: "id, projectId, status, updatedAt",
    });

    this.version(2).stores({
      issues: "id, projectId, status, updatedAt",
      outbox: "++seq, issueId",
    });

    this.version(3)
      .stores({
        issues: "id, projectId, status, updatedAt",
        outbox: "++seq, issueId",
      })
      .upgrade((tx) =>
        tx
          .table("issues")
          .toCollection()
          .modify((issue) => {
            issue.clocks = issue.clocks ?? {};
          })
      );

    this.version(4).stores({
      issues: "id, projectId, status, updatedAt",
      outbox: "++seq, issueId",
      meta: "key",
    });

    this.version(5).stores({
      issues: "id, projectId, status, updatedAt",
      outbox: "++seq, issueId",
      meta: "key",
      conflicts: "key, issueId, detectedAt, status",
    });
  }
}

export const db = new TrackerDB();

// DEV ONLY: run `resetDb()` in the browser console to wipe everything
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { resetDb: () => Promise<void> }).resetDb =
    async () => {
      await db.delete();
      location.reload();
    };
}
