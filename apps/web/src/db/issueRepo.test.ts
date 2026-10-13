import "fake-indexeddb/auto"; // must be the first import: it installs the fake database
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import {
  createIssue,
  updateIssue,
  deleteIssue,
  restoreIssue,
  listIssues,
} from "./issueRepo";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("issueRepo", () => {
  // Empty the table before every test so tests don't affect each other
  beforeEach(async () => {
    await db.issues.clear();
    await db.outbox.clear();
  });

  it("creates an issue with sensible defaults", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Write tests",
    });

    expect(issue.status).toBe("backlog");
    expect(issue.deletedAt).toBeNull();

    const saved = await db.issues.get(issue.id);
    expect(saved?.title).toBe("Write tests");
  });

  it("rejects an empty title", async () => {
    await expect(
      createIssue({ projectId: PROJECT_ID, title: "" })
    ).rejects.toThrow();
  });

  it("updates fields and refreshes updatedAt", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Edit me",
    });
    await wait(5);

    await updateIssue(issue.id, { status: "done" });

    const saved = await db.issues.get(issue.id);
    expect(saved?.status).toBe("done");
    expect(saved!.updatedAt).toBeGreaterThan(issue.updatedAt);
  });

  it("soft deletes: hidden from the list but the row still exists", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Delete me",
    });

    await deleteIssue(issue.id);

    expect(await listIssues(PROJECT_ID)).toHaveLength(0);

    const row = await db.issues.get(issue.id);
    expect(row).toBeDefined();
    expect(row?.deletedAt).not.toBeNull();
  });

  it("restores a deleted issue", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Come back",
    });
    await deleteIssue(issue.id);

    await restoreIssue(issue.id);

    expect(await listIssues(PROJECT_ID)).toHaveLength(1);
  });

  it("queues a 'create' note when an issue is created", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Queue me",
    });

    const notes = await db.outbox.toArray();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.type).toBe("create");
    expect(notes[0]?.issueId).toBe(issue.id);
  });

  it("queues an 'update' note with only the changed fields", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Change me",
    });

    await updateIssue(issue.id, { status: "done" });

    const notes = await db.outbox.toArray();
    expect(notes).toHaveLength(2);
    expect(notes[1]?.type).toBe("update");
    expect(notes[1]?.changes).toMatchObject({ status: "done" });
    expect(notes[1]?.changes).not.toHaveProperty("title");
  });

  it("queues delete as an update that sets deletedAt", async () => {
    const issue = await createIssue({ projectId: PROJECT_ID, title: "Bye" });

    await deleteIssue(issue.id);

    const last = (await db.outbox.toArray()).at(-1);
    expect(last?.type).toBe("update");
    expect(last?.changes.deletedAt).toEqual(expect.any(Number));
  });

  it("keeps notes in the order the changes happened", async () => {
    const issue = await createIssue({ projectId: PROJECT_ID, title: "Order" });
    await updateIssue(issue.id, { priority: "high" });
    await updateIssue(issue.id, { priority: "low" });

    const notes = await db.outbox.orderBy("seq").toArray();
    expect(notes.map((n) => n.type)).toEqual(["create", "update", "update"]);
    expect(notes[2]?.changes).toMatchObject({ priority: "low" });
  });

  it("queues nothing when updating an issue that does not exist", async () => {
    await updateIssue(crypto.randomUUID(), { status: "done" });
    expect(await db.outbox.count()).toBe(0);
  });

  it("queues nothing when creation fails validation", async () => {
    await expect(
      createIssue({ projectId: PROJECT_ID, title: "" })
    ).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
  });

  it("stamps notes with increasing HLC values", async () => {
    const issue = await createIssue({ projectId: PROJECT_ID, title: "Stamp" });
    await updateIssue(issue.id, { priority: "high" });

    const [first, second] = await db.outbox.orderBy("seq").toArray();
    expect(first!.hlc < second!.hlc).toBe(true);
  });

  it("records which note last wrote each field", async () => {
    const issue = await createIssue({ projectId: PROJECT_ID, title: "Clocks" });
    await updateIssue(issue.id, { status: "done" });

    const notes = await db.outbox.orderBy("seq").toArray();
    const saved = await db.issues.get(issue.id);

    expect(saved?.clocks.status).toBe(notes[1]!.hlc); // changed field
    expect(saved?.clocks.title).toBe(notes[0]!.hlc); // untouched field keeps the creation stamp
  });
});
