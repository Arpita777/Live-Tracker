import { describe, it, expect } from "vitest";
import { createClock, compareHlc, formatHlc, parseHlc } from "./hlc";

describe("hlc", () => {
  it("formats and parses round trip", () => {
    const parts = { wall: 1760000000000, counter: 3, node: "abc-123" };
    expect(parseHlc(formatHlc(parts))).toEqual(parts);
  });

  it("sorts alphabetically in time order", () => {
    const a = formatHlc({ wall: 999, counter: 0, node: "a" });
    const b = formatHlc({ wall: 1000, counter: 0, node: "a" });
    const c = formatHlc({ wall: 1000, counter: 1, node: "a" });
    expect(compareHlc(a, b)).toBe(-1);
    expect(compareHlc(b, c)).toBe(-1);
    expect(compareHlc(c, a)).toBe(1);
  });

  it("increases the counter inside the same millisecond", () => {
    const clock = createClock("n1", () => 1000);
    const first = clock.now();
    const second = clock.now();
    expect(compareHlc(first, second)).toBe(-1);
    expect(parseHlc(second).counter).toBe(1);
  });

  it("never goes backwards when the device clock jumps back", () => {
    let time = 5000;
    const clock = createClock("n1", () => time);
    const before = clock.now();
    time = 1000; // someone changed the system clock
    const after = clock.now();
    expect(compareHlc(before, after)).toBe(-1);
  });

  it("catches up with a remote clock that is ahead", () => {
    const clock = createClock("n1", () => 1000);
    const remote = formatHlc({ wall: 9000, counter: 4, node: "n2" });
    const next = clock.receive(remote);
    expect(compareHlc(remote, next)).toBe(-1);
    // later local events stay ahead too
    expect(compareHlc(next, clock.now())).toBe(-1);
  });

  it("stays after a remote that is behind", () => {
    const clock = createClock("n1", () => 5000);
    const mine = clock.now();
    const remote = formatHlc({ wall: 100, counter: 0, node: "n2" });
    expect(compareHlc(mine, clock.receive(remote))).toBe(-1);
  });

  it("two devices never produce the same timestamp", () => {
    const a = createClock("A", () => 1000);
    const b = createClock("B", () => 1000);
    expect(a.now()).not.toBe(b.now());
  });

  it("continues from a saved value after restart", () => {
    const first = createClock("n1", () => 1000);
    const saved = first.now();
    const restarted = createClock("n1", () => 500, saved);
    expect(compareHlc(saved, restarted.now())).toBe(-1);
  });
});
