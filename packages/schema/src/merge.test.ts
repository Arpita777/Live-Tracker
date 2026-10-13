import { describe, it, expect } from "vitest";
import { applyChanges } from "./merge";
import { formatHlc } from "./hlc";
import type { Issue } from "./issue";

const stamp = (wall: number, node = "a") =>
  formatHlc({ wall, counter: 0, node });

const base: Issue = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  title: "Original",
  description: "",
  status: "todo",
  priority: "none",
  assigneeId: null,
  labels: [],
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  clocks: {},
};

describe("applyChanges", () => {
  it("keeps edits to different fields from both devices", () => {
    const laptop = { title: "New title" };
    const phone = { priority: "high" };

    const result = applyChanges(
      applyChanges(base, laptop, stamp(100, "laptop")),
      phone,
      stamp(200, "phone")
    );

    expect(result.title).toBe("New title");
    expect(result.priority).toBe("high");
  });

  it("newer write wins on the same field", () => {
    const result = applyChanges(
      applyChanges(base, { status: "done" }, stamp(200)),
      { status: "in_progress" },
      stamp(100) // older, arrives late
    );
    expect(result.status).toBe("done");
  });

  it("gives the same result in any order", () => {
    const a = {
      changes: { title: "A", priority: "low" },
      hlc: stamp(100, "a"),
    };
    const b = { changes: { title: "B", status: "done" }, hlc: stamp(200, "b") };

    const ab = applyChanges(
      applyChanges(base, a.changes, a.hlc),
      b.changes,
      b.hlc
    );
    const ba = applyChanges(
      applyChanges(base, b.changes, b.hlc),
      a.changes,
      a.hlc
    );

    expect(ab).toEqual(ba);
    expect(ab.title).toBe("B");
    expect(ab.priority).toBe("low");
    expect(ab.status).toBe("done");
  });

  it("applying the same note twice changes nothing", () => {
    const once = applyChanges(base, { title: "X" }, stamp(100));
    const twice = applyChanges(once, { title: "X" }, stamp(100));
    expect(twice).toEqual(once);
  });

  it("breaks ties between devices by node id", () => {
    const x = applyChanges(
      applyChanges(base, { title: "from A" }, stamp(100, "A")),
      { title: "from B" },
      stamp(100, "B")
    );
    const y = applyChanges(
      applyChanges(base, { title: "from B" }, stamp(100, "B")),
      { title: "from A" },
      stamp(100, "A")
    );
    expect(x.title).toBe(y.title);
  });

  it("ignores fields that cannot be merged", () => {
    const result = applyChanges(base, { id: "hacked" }, stamp(100));
    expect(result.id).toBe(base.id);
  });
});
