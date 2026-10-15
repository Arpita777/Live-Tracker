import { describe, it, expect, beforeEach } from "vitest";
import { formatHlc, type Mutation } from "@tracker/schema";
import { createApp } from "./app";
import { openDb } from "./db";

const hlc = (wall: number, node = "a") => formatHlc({ wall, counter: 0, node });

function update(
  issueId: string,
  wall: number,
  changes: Record<string, unknown>
): Mutation {
  return {
    id: crypto.randomUUID(),
    issueId,
    type: "update",
    hlc: hlc(wall),
    createdAt: 1,
    changes,
  };
}

let app: ReturnType<typeof createApp>;

const push = (mutations: Mutation[]) =>
  app.request("/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations }),
  });

const pull = async (query = "") => {
  const res = await app.request(`/pull${query}`);
  return { status: res.status, body: await res.json() };
};

const issue = crypto.randomUUID();

describe("GET /pull", () => {
  beforeEach(() => {
    app = createApp(openDb(":memory:"));
  });

  it("returns nothing and a zero cursor on an empty server", async () => {
    const { body } = await pull();
    expect(body).toMatchObject({ mutations: [], cursor: 0, hasMore: false });
  });

  it("returns pushed notes in the order the server received them", async () => {
    const a = update(issue, 100, { title: "A" });
    const b = update(issue, 200, { title: "B" });
    await push([a, b]);

    const { body } = await pull();
    expect(body.mutations.map((m: Mutation) => m.id)).toEqual([a.id, b.id]);
    expect(body.cursor).toBe(2);
    expect(body.hasMore).toBe(false);
  });

  it("only returns notes after the cursor", async () => {
    await push([
      update(issue, 100, { title: "A" }),
      update(issue, 200, { title: "B" }),
    ]);

    const { body } = await pull("?after=1");
    expect(body.mutations).toHaveLength(1);
    expect(body.mutations[0].changes).toEqual({ title: "B" });
    expect(body.cursor).toBe(2);
  });

  it("keeps the cursor in place when nothing is new", async () => {
    await push([update(issue, 100, { title: "A" })]);
    const { body } = await pull("?after=1");
    expect(body).toMatchObject({ mutations: [], cursor: 1, hasMore: false });
  });

  it("pages through a long list with limit and hasMore", async () => {
    await push(
      [1, 2, 3, 4, 5].map((n) => update(issue, n * 100, { title: `T${n}` }))
    );

    const first = (await pull("?limit=2")).body;
    expect(first.mutations).toHaveLength(2);
    expect(first.hasMore).toBe(true);

    const second = (await pull(`?after=${first.cursor}&limit=2`)).body;
    expect(second.hasMore).toBe(true);

    const third = (await pull(`?after=${second.cursor}&limit=2`)).body;
    expect(third.mutations).toHaveLength(1);
    expect(third.hasMore).toBe(false);
  });

  it("still delivers a late note that has an OLD timestamp", async () => {
    await push([update(issue, 5000, { title: "New clock" })]);
    const first = (await pull()).body;

    // A device that was offline pushes a note stamped long ago
    await push([update(issue, 10, { priority: "high" })]);

    const next = (await pull(`?after=${first.cursor}`)).body;
    expect(next.mutations).toHaveLength(1);
    expect(next.mutations[0].changes).toEqual({ priority: "high" });
  });

  it("rejects a bad cursor or limit", async () => {
    expect((await pull("?after=-1")).status).toBe(400);
    expect((await pull("?after=abc")).status).toBe(400);
    expect((await pull("?limit=0")).status).toBe(400);
    expect((await pull("?limit=9999")).status).toBe(400);
  });

  it("sends the same epoch every time for one database", async () => {
    const first = (await pull()).body.epoch;
    await push([update(issue, 100, { title: "A" })]);
    const second = (await pull()).body.epoch;

    expect(typeof first).toBe("string");
    expect(second).toBe(first);
  });

  it("gives a wiped (new) database a different epoch", async () => {
    const before = (await pull()).body.epoch;
    app = createApp(openDb(":memory:")); // a brand-new database
    const after = (await pull()).body.epoch;

    expect(after).not.toBe(before);
  });
});
