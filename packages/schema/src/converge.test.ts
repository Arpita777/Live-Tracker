import { describe, it, expect } from "vitest";
import { createClock } from "./hlc";
import { applyChanges, issueFromCreate } from "./merge";
import type { Issue } from "./issue";

type Note = {
  issueId: string;
  type: "create" | "update";
  changes: Record<string, unknown>;
  hlc: string;
};

// A "device" = its own clock + its own copy of the issues
function makeDevice(node: string, time: () => number) {
  const clock = createClock(node, time);
  const issues = new Map<string, Issue>();
  const outbox: Note[] = [];

  return {
    issues,
    outbox,
    create(id: string, title: string) {
      const hlc = clock.now();
      const changes = {
        id,
        projectId: "p1",
        title,
        description: "",
        status: "backlog",
        priority: "none",
        assigneeId: null,
        labels: [],
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      };
      issues.set(id, issueFromCreate(changes, hlc));
      outbox.push({ issueId: id, type: "create", changes, hlc });
    },
    edit(id: string, changes: Record<string, unknown>) {
      const hlc = clock.now();
      issues.set(id, applyChanges(issues.get(id)!, changes, hlc));
      outbox.push({ issueId: id, type: "update", changes, hlc });
    },
    receive(notes: Note[]) {
      for (const n of notes) {
        clock.receive(n.hlc);
        const existing = issues.get(n.issueId);
        issues.set(
          n.issueId,
          existing
            ? applyChanges(existing, n.changes, n.hlc)
            : issueFromCreate({ ...n.changes, id: n.issueId }, n.hlc)
        );
      }
    },
  };
}

describe("two devices converge", () => {
  it("merges edits to different fields made offline", () => {
    const laptop = makeDevice("laptop", () => 1000);
    const phone = makeDevice("phone", () => 1000);

    laptop.create("i1", "Shared issue");
    phone.receive(laptop.outbox); // phone gets the issue

    const sent = laptop.outbox.length; // both go offline
    laptop.edit("i1", { title: "Laptop title" });
    phone.edit("i1", { priority: "high" });

    laptop.receive(phone.outbox); // they reconnect and swap
    phone.receive(laptop.outbox.slice(sent));

    expect(laptop.issues.get("i1")).toEqual(phone.issues.get("i1"));
    expect(laptop.issues.get("i1")?.title).toBe("Laptop title");
    expect(laptop.issues.get("i1")?.priority).toBe("high");
  });

  it("picks the same winner when both edit the same field", () => {
    const laptop = makeDevice("laptop", () => 1000);
    const phone = makeDevice("phone", () => 1000);

    laptop.create("i1", "Start");
    phone.receive(laptop.outbox);
    const sent = laptop.outbox.length;

    laptop.edit("i1", { status: "done" });
    phone.edit("i1", { status: "in_progress" });

    laptop.receive(phone.outbox);
    phone.receive(laptop.outbox.slice(sent));

    expect(laptop.issues.get("i1")?.status).toBe(
      phone.issues.get("i1")?.status
    );
  });

  it("converges even if notes arrive in a different order", () => {
    const a = makeDevice("a", () => 1000);
    const b = makeDevice("b", () => 1000);
    const c = makeDevice("c", () => 1000);

    a.create("i1", "T");
    a.edit("i1", { title: "One" });
    a.edit("i1", { priority: "low" });

    b.receive(a.outbox);
    c.receive([...a.outbox].reverse()); // update before create

    expect(c.issues.get("i1")).toEqual(b.issues.get("i1"));
  });

  it("a clock set far in the future does not freeze the other device", () => {
    const fast = makeDevice("fast", () => 9_000_000);
    const normal = makeDevice("normal", () => 1000);

    fast.create("i1", "From the future");
    normal.receive(fast.outbox);
    normal.edit("i1", { title: "Reply" }); // normal's clock caught up, so this is newer

    expect(normal.issues.get("i1")?.title).toBe("Reply");
  });
});
