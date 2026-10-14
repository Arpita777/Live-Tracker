import { createSyncEngine } from "./engine";

const baseUrl =
  (import.meta.env.VITE_SYNC_URL as string | undefined) ??
  "http://localhost:3001";

export const sync = createSyncEngine({ baseUrl });
