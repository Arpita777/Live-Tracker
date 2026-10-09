import Dexie, { type Table } from "dexie";
import type { Issue } from "@tracker/schema";

class TrackerDB extends Dexie {
  issues!: Table<Issue, string>;

  constructor() {
    super("tracker");
    this.version(1).stores({
      issues: "id, projectId, status, updatedAt",
    });
  }
}

export const db = new TrackerDB();
