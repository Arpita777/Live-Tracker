import { liveQuery } from "dexie";
import { db } from "../db/db";
import type { SyncResult } from "./engine";
import { setSyncStatus } from "./syncStatus";

const POLL_MS = 15_000;
const EDIT_DELAY_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

type Engine = { syncNow(): Promise<SyncResult> };

let currentRun: (() => void) | null = null;

// Used by the manual "Sync now" button
export function triggerSync(): void {
  currentRun?.();
}

export function startAutoSync(engine: Engine): () => void {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let editTimer: ReturnType<typeof setTimeout> | undefined;

  function schedule(ms: number) {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(run, ms);
  }

  async function run() {
    if (stopped) return;

    if (!navigator.onLine) {
      setSyncStatus({ phase: "offline" });
      schedule(POLL_MS);
      return;
    }

    setSyncStatus({ phase: "syncing" });
    try {
      const result = await engine.syncNow(); // shares an in-flight run, so overlaps are safe
      failures = 0;
      setSyncStatus({
        phase: "idle",
        lastSyncedAt: Date.now(),
        message: "",
        conflicts: result.conflicts,
      });
      schedule(POLL_MS);
    } catch (error) {
      failures++;
      setSyncStatus({
        phase: "error",
        message: error instanceof Error ? error.message : "Sync failed",
      });
      schedule(Math.min(MAX_BACKOFF_MS, 2_000 * 2 ** failures));
    }
  }

  function syncSoon() {
    clearTimeout(editTimer);
    editTimer = setTimeout(run, EDIT_DELAY_MS);
  }

  // Any change waiting in the outbox (including at page load) triggers a sync
  const subscription = liveQuery(() => db.outbox.count()).subscribe({
    next: (count) => {
      if (count > 0) syncSoon();
    },
    error: () => {},
  });

  const onOnline = () => void run();
  const onOffline = () => setSyncStatus({ phase: "offline" });
  const onVisible = () => {
    if (document.visibilityState === "visible") void run();
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);

  currentRun = () => void run();
  void run(); // first sync right away

  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(editTimer);
    subscription.unsubscribe();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    currentRun = null;
  };
}
