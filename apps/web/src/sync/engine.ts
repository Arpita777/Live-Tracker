import { PullResponseSchema, type Mutation } from "@tracker/schema";
import { db } from "../db/db";
import { receiveMutations } from "./receive";

const CURSOR_KEY = "cursor";

export type SyncResult = { pushed: number; pulled: number };

type Options = {
  baseUrl: string;
  fetchFn?: typeof fetch; // tests pass a fake server here
  pushBatch?: number;
  pullLimit?: number;
};

export async function getCursor(): Promise<number> {
  const row = await db.meta.get(CURSOR_KEY);
  return typeof row?.value === "number" ? row.value : 0;
}

export function createSyncEngine(options: Options) {
  const { baseUrl, pushBatch = 200, pullLimit = 200 } = options;
  const fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));

  async function pushOutbox(): Promise<number> {
    let pushed = 0;

    for (;;) {
      // Oldest first, so notes are sent in the order the changes happened
      const batch = await db.outbox.orderBy("seq").limit(pushBatch).toArray();
      if (batch.length === 0) return pushed;

      const mutations: Mutation[] = batch.map((n) => ({
        id: n.id,
        issueId: n.issueId,
        type: n.type,
        changes: n.changes,
        createdAt: n.createdAt,
        hlc: n.hlc,
      }));

      const res = await fetchFn(`${baseUrl}/push`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutations }),
      });
      if (!res.ok) throw new Error(`Push failed (${res.status})`);

      const body = (await res.json()) as { accepted?: string[] };
      const accepted = new Set(body.accepted ?? []);
      const seqs = batch.filter((n) => accepted.has(n.id)).map((n) => n.seq!);

      // Without this check, a server that accepts nothing would loop us forever
      if (seqs.length === 0)
        throw new Error("Server accepted none of the changes");

      await db.outbox.bulkDelete(seqs); // only now is it safe to forget them
      pushed += seqs.length;
    }
  }

  async function pullAll(): Promise<number> {
    let pulled = 0;

    for (;;) {
      const after = await getCursor();
      const res = await fetchFn(
        `${baseUrl}/pull?after=${after}&limit=${pullLimit}`
      );
      if (!res.ok) throw new Error(`Pull failed (${res.status})`);

      const page = PullResponseSchema.parse(await res.json());

      // Merge the notes AND move the cursor together, or neither
      await db.transaction("rw", db.issues, db.meta, async () => {
        await receiveMutations(page.mutations);
        await db.meta.put({ key: CURSOR_KEY, value: page.cursor });
      });

      pulled += page.mutations.length;
      if (!page.hasMore) return pulled;
    }
  }

  async function run(): Promise<SyncResult> {
    const pushed = await pushOutbox();
    const pulled = await pullAll();
    return { pushed, pulled };
  }

  // Only one sync at a time: callers during a run share its result
  let inFlight: Promise<SyncResult> | null = null;

  function syncNow(): Promise<SyncResult> {
    if (!inFlight) {
      inFlight = run().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  return { syncNow };
}
