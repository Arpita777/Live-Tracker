import { describe, it, expect } from "vitest";
import { applyChanges, applyChangesDetailed } from "./merge";
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

  it("fills in createdAt when the create note arrives after an update", () => {
    const partial = { ...base, createdAt: 0, clocks: {} };
    const result = applyChanges(partial, { createdAt: 500 }, stamp(100));
    expect(result.createdAt).toBe(500);
  });

  it("never replaces a real createdAt with a later one", () => {
    const result = applyChanges(
      { ...base, createdAt: 500 },
      { createdAt: 900 },
      stamp(100)
    );
    expect(result.createdAt).toBe(500);
  });
});

describe("deletes", () => {
  it("a delete is just a change to deletedAt", () => {
    const result = applyChanges(base, { deletedAt: 5000 }, stamp(100));
    expect(result.deletedAt).toBe(5000);
  });

  it("an edit to another field after a delete keeps the issue deleted", () => {
    const deleted = applyChanges(
      base,
      { deletedAt: 5000 },
      stamp(100, "laptop")
    );
    const edited = applyChanges(
      deleted,
      { title: "Edited late" },
      stamp(200, "phone")
    );

    expect(edited.deletedAt).toBe(5000);
    expect(edited.title).toBe("Edited late");
  });

  it("delete and restore: the newer one wins, in any order", () => {
    const del = { changes: { deletedAt: 5000 }, hlc: stamp(100, "a") };
    const restore = { changes: { deletedAt: null }, hlc: stamp(200, "b") };

    const x = applyChanges(
      applyChanges(base, del.changes, del.hlc),
      restore.changes,
      restore.hlc
    );
    const y = applyChanges(
      applyChanges(base, restore.changes, restore.hlc),
      del.changes,
      del.hlc
    );

    expect(x).toEqual(y);
    expect(x.deletedAt).toBeNull();
  });

  it("a delete newer than a restore stays deleted, in any order", () => {
    const restore = { changes: { deletedAt: null }, hlc: stamp(100, "a") };
    const del = { changes: { deletedAt: 5000 }, hlc: stamp(200, "b") };

    const x = applyChanges(
      applyChanges(base, restore.changes, restore.hlc),
      del.changes,
      del.hlc
    );
    const y = applyChanges(
      applyChanges(base, del.changes, del.hlc),
      restore.changes,
      restore.hlc
    );

    expect(x).toEqual(y);
    expect(x.deletedAt).toBe(5000);
  });
});
describe("conflict detection", () => {
  const start = applyChanges(base, { title: "Start" }, stamp(50, "a"));
  const seen = stamp(50, "a");

  const fromA = {
    changes: { title: "A", _base: { title: seen } },
    hlc: stamp(100, "A"),
  };
  const fromB = {
    changes: { title: "B", _base: { title: seen } },
    hlc: stamp(200, "B"),
  };

  it("reports two edits made without seeing each other", () => {
    const afterA = applyChangesDetailed(start, fromA.changes, fromA.hlc);
    expect(afterA.conflicts).toHaveLength(0); // A was first, nothing to clash with

    const afterB = applyChangesDetailed(afterA.issue, fromB.changes, fromB.hlc);
    expect(afterB.conflicts).toHaveLength(1);
    expect(afterB.conflicts[0]).toMatchObject({
      field: "title",
      winner: { value: "B" },
      loser: { value: "A" },
    });
  });

  it("reports the same conflict whatever order the notes arrive in", () => {
    const ab = applyChangesDetailed(
      applyChangesDetailed(start, fromA.changes, fromA.hlc).issue,
      fromB.changes,
      fromB.hlc
    );
    const ba = applyChangesDetailed(
      applyChangesDetailed(start, fromB.changes, fromB.hlc).issue,
      fromA.changes,
      fromA.hlc
    );

    expect(ab.conflicts).toEqual(ba.conflicts);
    expect(ab.issue).toEqual(ba.issue);
  });

  it("is not a conflict when the author had seen the current value", () => {
    const afterA = applyChanges(start, fromA.changes, fromA.hlc);
    const followUp = {
      title: "B after reading A",
      _base: { title: fromA.hlc },
    };
    const result = applyChangesDetailed(afterA, followUp, stamp(300, "B"));
    expect(result.conflicts).toHaveLength(0);
    expect(result.issue.title).toBe("B after reading A");
  });

  it("is not a conflict when different fields were edited", () => {
    const afterA = applyChanges(start, fromA.changes, fromA.hlc);
    const result = applyChangesDetailed(
      afterA,
      { priority: "high", _base: {} },
      stamp(200, "B")
    );
    expect(result.conflicts).toHaveLength(0);
  });

  it("is not a conflict when both devices chose the same value", () => {
    const afterA = applyChanges(start, fromA.changes, fromA.hlc);
    const result = applyChangesDetailed(
      afterA,
      { title: "A", _base: { title: seen } },
      stamp(200, "B")
    );
    expect(result.conflicts).toHaveLength(0);
  });

  it("never reports a device against itself", () => {
    const first = applyChanges(
      start,
      { title: "One", _base: { title: seen } },
      stamp(100, "A")
    );
    const second = applyChanges(
      first,
      { title: "Two", _base: { title: stamp(100, "A") } },
      stamp(150, "A")
    );
    // the first note echoes back after the second was applied
    const echo = applyChangesDetailed(
      second,
      { title: "One", _base: { title: seen } },
      stamp(100, "A")
    );
    expect(echo.conflicts).toHaveLength(0);
  });

  it("cannot judge notes without _base, so reports nothing", () => {
    const afterA = applyChanges(start, fromA.changes, fromA.hlc);
    const result = applyChangesDetailed(
      afterA,
      { title: "No base" },
      stamp(200, "B")
    );
    expect(result.conflicts).toHaveLength(0);
  });
});
