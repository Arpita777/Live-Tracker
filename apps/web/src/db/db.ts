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
  }
}

export const db = new TrackerDB();
