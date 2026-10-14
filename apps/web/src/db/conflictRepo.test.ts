import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import type { FieldConflict } from "@tracker/schema";
import { db } from "./db";
import { createIssue } from "./issueRepo";
import {
  conflictKey,
  countOpenConflicts,
  dismissAllConflicts,
  dismissConflict,
  recordConflicts,
  restoreConflict,
} from "./conflictRepo";

const issueId = crypto.randomUUID();
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

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
    await db.issues.clear();
    await db.outbox.clear();
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
    expect(await db.conflicts.count()).toBe(2);
  });

  it("restoring puts the overwritten value back as a new change and dismisses", async () => {
    const issue = await createIssue({ projectId: PROJECT_ID, title: "Winner" });
    const c: FieldConflict = {
      issueId: issue.id,
      field: "title",
      winner: { value: "Winner", hlc: "w" },
      loser: { value: "Loser", hlc: "l" },
    };
    await recordConflicts([c]);

    await restoreConflict(conflictKey(c));

    expect((await db.issues.get(issue.id))?.title).toBe("Loser");
    expect(await countOpenConflicts()).toBe(0);
    expect(await db.outbox.count()).toBe(2); // the create, plus the restore edit
  });

  it("ignores a restore for an unknown conflict", async () => {
    await expect(restoreConflict("nope")).resolves.toBeUndefined();
  });
});
