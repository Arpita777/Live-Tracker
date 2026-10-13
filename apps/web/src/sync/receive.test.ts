import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { formatHlc, type Mutation } from "@tracker/schema";
import { db } from "../db/db";
import { receiveMutations } from "./receive";

const id = crypto.randomUUID();
const hlc = (wall: number) => formatHlc({ wall, counter: 0, node: "remote" });

const create: Mutation = {
  id: crypto.randomUUID(),
  issueId: id,
  type: "create",
  hlc: hlc(Date.now() + 1000),
  createdAt: 1,
  changes: {
    id,
    projectId: crypto.randomUUID(),
    title: "Remote",
    description: "",
    status: "todo",
    priority: "none",
    assigneeId: null,
    labels: [],
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
  },
};

describe("receiveMutations", () => {
  beforeEach(async () => {
    await db.issues.clear();
    await db.outbox.clear();
  });

  it("creates an issue from a remote create note", async () => {
    await receiveMutations([create]);
    expect((await db.issues.get(id))?.title).toBe("Remote");
  });

  it("does not add received notes to our own outbox", async () => {
    await receiveMutations([create]);
    expect(await db.outbox.count()).toBe(0);
  });

  it("applying the same notes twice changes nothing", async () => {
    await receiveMutations([create]);
    const once = await db.issues.get(id);
    await receiveMutations([create]);
    expect(await db.issues.get(id)).toEqual(once);
  });

  it("applies a newer remote update to an existing issue", async () => {
    await receiveMutations([create]);
    await receiveMutations([
      {
        ...create,
        id: crypto.randomUUID(),
        type: "update",
        hlc: hlc(Date.now() + 2000),
        changes: { status: "done" },
      },
    ]);
    expect((await db.issues.get(id))?.status).toBe("done");
  });
});
