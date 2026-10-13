import Dexie, { type Table } from "dexie";
import type { Issue, Mutation } from "@tracker/schema";

export type OutboxEntry = Mutation & { seq?: number };

class TrackerDB extends Dexie {
  issues!: Table<Issue, string>;
  outbox!: Table<OutboxEntry, number>;

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
  }
}

export const db = new TrackerDB();
