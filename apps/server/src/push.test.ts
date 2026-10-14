import { describe, it, expect, beforeEach } from "vitest";
import { formatHlc, type Mutation } from "@tracker/schema";
import { createApp } from "./app";
import { openDb, type Db } from "./db";

const issueId = crypto.randomUUID();
const hlc = (wall: number, node = "a") => formatHlc({ wall, counter: 0, node });

function note(
  partial: Partial<Mutation> & Pick<Mutation, "type" | "changes" | "hlc">
): Mutation {
  return { id: crypto.randomUUID(), issueId, createdAt: 1, ...partial };
}

const create = note({
  type: "create",
  hlc: hlc(100),
  changes: {
    id: issueId,
    projectId: crypto.randomUUID(),
    title: "First",
    description: "",
    status: "backlog",
    priority: "none",
    assigneeId: null,
    labels: [],
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
  },
});

let db: Db;
let app: ReturnType<typeof createApp>;

const push = (mutations: unknown) =>
  app.request("/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations }),
  });

const savedIssue = () => {
  const row = db
    .prepare("SELECT data FROM issues WHERE id = ?")
    .get(issueId) as unknown as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
};

const mutationCount = () =>
  (
    db.prepare("SELECT COUNT(*) AS n FROM mutations").get() as unknown as {
      n: number;
    }
  ).n;

describe("POST /push", () => {
  beforeEach(() => {
    db = openDb(":memory:");
    app = createApp(db);
  });

  it("stores a create note and builds the issue", async () => {
    const res = await push([create]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      accepted: [create.id],
      applied: 1,
      duplicates: 0,
    });
    expect(savedIssue().title).toBe("First");
  });

  it("is safe to send the same batch twice", async () => {
    await push([create]);
    const second = await push([create]);

    expect(await second.json()).toMatchObject({
      accepted: [create.id],
      applied: 0,
      duplicates: 1,
    });
    expect(mutationCount()).toBe(1);
  });

  it("merges edits to different fields from two devices", async () => {
    const title = note({
      type: "update",
      hlc: hlc(200, "laptop"),
      changes: { title: "Laptop" },
    });
    const priority = note({
      type: "update",
      hlc: hlc(300, "phone"),
      changes: { priority: "high" },
    });

    await push([create, title]);
    await push([priority]);

    expect(savedIssue()).toMatchObject({ title: "Laptop", priority: "high" });
  });

  it("gives the same result whatever order the notes arrive in", async () => {
    const a = note({
      type: "update",
      hlc: hlc(200, "a"),
      changes: { status: "done" },
    });
    const b = note({
      type: "update",
      hlc: hlc(300, "b"),
      changes: { status: "todo" },
    });

    await push([create, a, b]);
    const forward = savedIssue();

    db = openDb(":memory:");
    app = createApp(db);
    await push([b, a, create]);

    expect(savedIssue()).toEqual(forward);
  });

  it("rejects a malformed request and stores nothing", async () => {
    const res = await push([{ id: "not-a-uuid" }]);
    expect(res.status).toBe(400);
    expect(mutationCount()).toBe(0);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await app.request("/push", { method: "POST", body: "nope" });
    expect(res.status).toBe(400);
  });

  it("keeps a deleted issue as a tombstone and still delivers the delete", async () => {
    const del = note({
      type: "update",
      hlc: hlc(200),
      changes: { deletedAt: 5000 },
    });
    await push([create, del]);

    expect(savedIssue().deletedAt).toBe(5000); // the row is still there

    const pulled = await (await app.request("/pull")).json();
    expect(pulled.mutations).toHaveLength(2); // other devices will receive the delete
  });

  it("an edit that arrives after a delete does not bring the issue back", async () => {
    const del = note({
      type: "update",
      hlc: hlc(200, "laptop"),
      changes: { deletedAt: 5000 },
    });
    const edit = note({
      type: "update",
      hlc: hlc(300, "phone"),
      changes: { title: "Late edit" },
    });

    await push([create, del]);
    await push([edit]);

    expect(savedIssue()).toMatchObject({ deletedAt: 5000, title: "Late edit" });
  });
});
