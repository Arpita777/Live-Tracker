export type HlcParts = { wall: number; counter: number; node: string };

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 5;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;

// "000001760000000-00000-node1" sorts alphabetically in time order
export function formatHlc({ wall, counter, node }: HlcParts): string {
  return `${String(wall).padStart(WALL_DIGITS, "0")}-${String(counter).padStart(
    COUNTER_DIGITS,
    "0"
  )}-${node}`;
}

export function parseHlc(value: string): HlcParts {
  const first = value.indexOf("-");
  const second = value.indexOf("-", first + 1);
  if (first === -1 || second === -1) throw new Error(`Invalid HLC: ${value}`);
  return {
    wall: Number(value.slice(0, first)),
    counter: Number(value.slice(first + 1, second)),
    node: value.slice(second + 1),
  };
}

export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type Clock = {
  /** Timestamp for an event that happens on this device */
  now(): string;
  /** Call when a timestamp arrives from another device */
  receive(remote: string): string;
};

export function createClock(
  node: string,
  getTime: () => number = Date.now,
  initial?: string
): Clock {
  let wall = 0;
  let counter = 0;

  if (initial) {
    const parts = parseHlc(initial);
    wall = parts.wall;
    counter = parts.counter;
  }

  function tick(physical: number, remoteWall = 0, remoteCounter = 0): string {
    const newWall = Math.max(wall, physical, remoteWall);

    if (newWall === wall && newWall === remoteWall) {
      counter = Math.max(counter, remoteCounter) + 1;
    } else if (newWall === wall) {
      counter += 1;
    } else if (newWall === remoteWall) {
      counter = remoteCounter + 1;
    } else {
      counter = 0;
    }

    if (counter > MAX_COUNTER) throw new Error("HLC counter overflow");
    wall = newWall;
    return formatHlc({ wall, counter, node });
  }

  return {
    now: () => tick(getTime()),
    receive: (remote) => {
      const r = parseHlc(remote);
      return tick(getTime(), r.wall, r.counter);
    },
  };
}
