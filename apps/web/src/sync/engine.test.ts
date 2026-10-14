import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { formatHlc, type Mutation } from "@tracker/schema";
import { db } from "../db/db";
import { createIssue, updateIssue } from "../db/issueRepo";
import { createSyncEngine, getCursor } from "./engine";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeFakeServer() {
  const log: Mutation[] = [];
  const calls = { push: 0, pull: 0 };
  let offline = false;

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (offline) throw new TypeError("Failed to fetch");
    const url = new URL(String(input));

    if (url.pathname === "/push") {
      calls.push++;
      const { mutations } = JSON.parse(String(init?.body)) as {
        mutations: Mutation[];
      };
      for (const m of mutations) {
        if (!log.some((x) => x.id === m.id)) log.push(m);
      }
      return jsonResponse({ accepted: mutations.map((m) => m.id) });
    }

    if (url.pathname === "/pull") {
      calls.pull++;
      const after = Number(url.searchParams.get("after"));
      const limit = Number(url.searchParams.get("limit"));
      const rows = log.slice(after, after + limit + 1);
      const page = rows.slice(0, limit);
      return jsonResponse({
        mutations: page,
        cursor: after + page.length,
        hasMore: rows.length > limit,
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  return { log, calls, fetchFn, setOffline: (v: boolean) => (offline = v) };
}

function remoteCreate(title: string, wall = Date.now() + 1000): Mutation {
  const id = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    issueId: id,
    type: "create",
    hlc: formatHlc({ wall, counter: 0, node: "remote-device" }),
    createdAt: 1,
    changes: {
      id,
      projectId: crypto.randomUUID(),
      title,
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
}

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

let server: ReturnType<typeof makeFakeServer>;
let engine: ReturnType<typeof createSyncEngine>;

describe("sync engine", () => {
  beforeEach(async () => {
    await db.issues.clear();
    await db.outbox.clear();
    await db.meta.clear();
    server = makeFakeServer();
    engine = createSyncEngine({
      baseUrl: "http://test",
      fetchFn: server.fetchFn,
      pullLimit: 2,
    });
  });

  it("sends the outbox to the server and empties it", async () => {
    const issue = await createIssue({ projectId: PROJECT_ID, title: "Mine" });
    await updateIssue(issue.id, { status: "done" });

    const result = await engine.syncNow();

    expect(result.pushed).toBe(2);
    expect(server.log).toHaveLength(2);
    expect(await db.outbox.count()).toBe(0);
  });

  it("brings in another device's issue and remembers the cursor", async () => {
    const remote = remoteCreate("From another device");
    server.log.push(remote);

    await engine.syncNow();

    expect((await db.issues.get(remote.issueId))?.title).toBe(
      "From another device"
    );
    expect(await getCursor()).toBe(1);
  });

  it("is harmless when our own notes come back", async () => {
    const issue = await createIssue({ projectId: PROJECT_ID, title: "Echo" });
    await updateIssue(issue.id, { priority: "high" });
    const before = await db.issues.get(issue.id);

    await engine.syncNow(); // pushes, then pulls our own notes back

    expect(await db.issues.get(issue.id)).toEqual(before);
  });

  it("a second sync with nothing new does nothing", async () => {
    await createIssue({ projectId: PROJECT_ID, title: "Once" });
    await engine.syncNow();

    expect(await engine.syncNow()).toEqual({ pushed: 0, pulled: 0 });
    expect(server.log).toHaveLength(1);
  });

  it("keeps the outbox when offline, then catches up", async () => {
    await createIssue({ projectId: PROJECT_ID, title: "Offline edit" });

    server.setOffline(true);
    await expect(engine.syncNow()).rejects.toThrow();
    expect(await db.outbox.count()).toBe(1); // nothing was lost
    expect(await getCursor()).toBe(0);

    server.setOffline(false);
    await engine.syncNow();
    expect(await db.outbox.count()).toBe(0);
    expect(server.log).toHaveLength(1);
  });

  it("pulls a long history in pages", async () => {
    for (let i = 1; i <= 5; i++) server.log.push(remoteCreate(`Remote ${i}`));

    const result = await engine.syncNow();

    expect(result.pulled).toBe(5);
    expect(server.calls.pull).toBe(3); // pages of 2, 2, 1
    expect(await db.issues.count()).toBe(5);
    expect(await getCursor()).toBe(5);
  });

  it("two calls at once share a single run", async () => {
    await createIssue({ projectId: PROJECT_ID, title: "Race" });

    await Promise.all([engine.syncNow(), engine.syncNow()]);

    expect(server.calls.push).toBe(1);
  });
});
