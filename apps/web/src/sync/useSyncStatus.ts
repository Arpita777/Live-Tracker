import { useSyncExternalStore } from "react";
import { getSyncStatus, subscribeSyncStatus } from "./syncStatus";

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}
