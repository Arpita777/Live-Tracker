import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import type { FieldConflict } from "@tracker/schema";
import { db } from "./db";
import {
  conflictKey,
  countOpenConflicts,
  dismissAllConflicts,
  dismissConflict,
  recordConflicts,
} from "./conflictRepo";

const issueId = crypto.randomUUID();

const conflict = (
  field: string,
  winnerHlc = "w1",
  loserHlc = "l1"
): FieldConflict => ({
  issueId,
  field,
  winner: { value: "B", hlc: winnerHlc },
  loser: { value: "A", hlc: loserHlc },
});

describe("conflictRepo", () => {
  beforeEach(async () => {
    await db.conflicts.clear();
  });

  it("saves a conflict as open", async () => {
    await recordConflicts([conflict("title")]);
    const rows = await db.conflicts.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ field: "title", status: "open" });
  });

  it("does not log the same conflict twice", async () => {
    await recordConflicts([conflict("title")]);
    await recordConflicts([conflict("title")]);
    expect(await db.conflicts.count()).toBe(1);
  });

  it("keeps a dismissed conflict dismissed if it is reported again", async () => {
    const c = conflict("title");
    await recordConflicts([c]);
    await dismissConflict(conflictKey(c));
    await recordConflicts([c]);
    expect(await countOpenConflicts()).toBe(0);
  });

  it("logs different fields separately", async () => {
    await recordConflicts([conflict("title"), conflict("status")]);
    expect(await countOpenConflicts()).toBe(2);
  });

  it("dismisses everything at once", async () => {
    await recordConflicts([conflict("title"), conflict("status")]);
    await dismissAllConflicts();
    expect(await countOpenConflicts()).toBe(0);
    expect(await db.conflicts.count()).toBe(2); // kept, just reviewed
  });
});
