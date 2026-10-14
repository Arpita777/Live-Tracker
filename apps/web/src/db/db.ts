import Dexie, { type Table } from "dexie";
import type { Issue, Mutation } from "@tracker/schema";

export type OutboxEntry = Mutation & { seq?: number };

export type MetaRow = { key: string; value: unknown };

class TrackerDB extends Dexie {
  issues!: Table<Issue, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaRow, string>;

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
      meta: "key", // small key/value store, for the sync cursor
    });
  }
}

export const db = new TrackerDB();
