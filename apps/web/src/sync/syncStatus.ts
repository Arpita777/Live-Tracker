export type SyncPhase = "idle" | "syncing" | "offline" | "error";

export type SyncStatus = {
  phase: SyncPhase;
  lastSyncedAt: number | null;
  message: string;
  conflicts: number;
};

let status: SyncStatus = {
  phase: "idle",
  lastSyncedAt: null,
  message: "",
  conflicts: 0,
};

const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch }; // a new object, so React sees the change
  listeners.forEach((listener) => listener());
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
