import { PullResponseSchema, type Mutation } from "@tracker/schema";
import { db } from "../db/db";
import { clock } from "./clock";
import { receiveMutations } from "./receive";

const CURSOR_KEY = "cursor";
const EPOCH_KEY = "epoch";

export type SyncResult = { pushed: number; pulled: number; conflicts: number };

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

async function getStoredEpoch(): Promise<string | null> {
  const row = await db.meta.get(EPOCH_KEY);
  return typeof row?.value === "string" ? row.value : null;
}

// The server database was replaced: start over from note 0 and
// re-send a copy of every issue that has real edit history.
async function resetForNewServer(epoch: string): Promise<void> {
  await db.transaction("rw", db.issues, db.outbox, db.meta, async () => {
    const all = await db.issues.toArray();

    for (const issue of all) {
      // Seeded dev data has no clocks, so it never syncs
      if (Object.keys(issue.clocks ?? {}).length === 0) continue;

      const changes: Record<string, unknown> = { ...issue };
      delete changes.clocks;

      await db.outbox.add({
        id: crypto.randomUUID(),
        issueId: issue.id,
        type: "create",
        changes,
        createdAt: Date.now(),
        hlc: clock.now(),
      });
    }

    await db.meta.put({ key: CURSOR_KEY, value: 0 });
    await db.meta.put({ key: EPOCH_KEY, value: epoch });
  });
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
      if (!res.ok)
        throw new Error(`Push failed (${res.status}): ${await res.text()}`);

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

  async function pullAll(): Promise<{
    pulled: number;
    conflicts: number;
    reset: boolean;
  }> {
    let pulled = 0;
    let conflicts = 0;

    for (;;) {
      const after = await getCursor();
      const res = await fetchFn(
        `${baseUrl}/pull?after=${after}&limit=${pullLimit}`
      );
      if (!res.ok)
        throw new Error(`Pull failed (${res.status}): ${await res.text()}`);

      const page = PullResponseSchema.parse(await res.json());

      // A different epoch means the server database is not the one we synced with.
      // (No stored epoch but a cursor above 0 also counts: an older client.)
      const stored = await getStoredEpoch();
      if (stored !== page.epoch && (stored !== null || after > 0)) {
        await resetForNewServer(page.epoch);
        return { pulled, conflicts, reset: true };
      }

      // Merge the notes, log conflicts, remember the epoch AND move the cursor together
      await db.transaction("rw", db.issues, db.meta, db.conflicts, async () => {
        conflicts += (await receiveMutations(page.mutations)).length;
        await db.meta.put({ key: EPOCH_KEY, value: page.epoch });
        await db.meta.put({ key: CURSOR_KEY, value: page.cursor });
      });

      pulled += page.mutations.length;
      if (!page.hasMore) return { pulled, conflicts, reset: false };
    }
  }

  async function run(): Promise<SyncResult> {
    let pushed = 0;
    let pulled = 0;
    let conflicts = 0;

    // Normally one round. After a server reset, a second round sends our copies
    // and pulls everything back.
    for (let round = 0; round < 2; round++) {
      pushed += await pushOutbox();
      const result = await pullAll();
      pulled += result.pulled;
      conflicts += result.conflicts;
      if (!result.reset) break;
    }

    return { pushed, pulled, conflicts };
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
