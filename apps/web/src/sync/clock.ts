import { createClock } from "@tracker/schema";

const NODE_KEY = "tracker:nodeId";
const HLC_KEY = "tracker:lastHlc";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc: the clock still works for this session */
  }
}

function getNodeId(): string {
  let id = read(NODE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(NODE_KEY, id);
  }
  return id;
}

export const nodeId = getNodeId();

const base = createClock(nodeId, Date.now, read(HLC_KEY) ?? undefined);

export const clock = {
  now(): string {
    const stamp = base.now();
    write(HLC_KEY, stamp);
    return stamp;
  },
  receive(remote: string): string {
    const stamp = base.receive(remote);
    write(HLC_KEY, stamp);
    return stamp;
  },
};
