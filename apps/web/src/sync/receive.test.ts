import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { formatHlc, type Mutation } from "@tracker/schema";
import { db } from "../db/db";
import { receiveMutations } from "./receive";
import { listIssues } from "../db/issueRepo";
import { updateIssue } from "../db/issueRepo";

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

  it("a remote delete hides the issue from the list but keeps the row", async () => {
    await receiveMutations([create]);
    await receiveMutations([
      {
        ...create,
        id: crypto.randomUUID(),
        type: "update",
        hlc: hlc(Date.now() + 2000),
        changes: { deletedAt: 5000 },
      },
    ]);

    const projectId = (create.changes as { projectId: string }).projectId;
    expect(await listIssues(projectId)).toHaveLength(0);
    expect(await db.issues.get(id)).toBeDefined(); // tombstone kept
  });
  it("returns a conflict when a remote edit never saw our local edit", async () => {
    await receiveMutations([create]);
    await updateIssue(id, { title: "Local" });

    const conflicts = await receiveMutations([
      {
        ...create,
        id: crypto.randomUUID(),
        type: "update",
        hlc: hlc(Date.now() + 5000),
        changes: { title: "Remote", _base: { title: create.hlc } },
      },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      field: "title",
      winner: { value: "Remote" },
      loser: { value: "Local" },
    });
  });

  it("returns no conflict for a normal follow-up edit", async () => {
    await receiveMutations([create]);

    const conflicts = await receiveMutations([
      {
        ...create,
        id: crypto.randomUUID(),
        type: "update",
        hlc: hlc(Date.now() + 5000),
        changes: { title: "Follow-up", _base: { title: create.hlc } },
      },
    ]);

    expect(conflicts).toHaveLength(0);
  });
});
