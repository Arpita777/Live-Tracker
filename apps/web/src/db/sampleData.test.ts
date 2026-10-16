import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { createIssue, listIssues } from "./issueRepo";
import { SAMPLE_ISSUES, loadSampleIssues } from "./sampleData";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("loadSampleIssues", () => {
  beforeEach(async () => {
    await db.issues.clear();
    await db.outbox.clear();
  });

  it("adds every sample issue to an empty project", async () => {
    const added = await loadSampleIssues(PROJECT_ID);

    expect(added).toBe(SAMPLE_ISSUES.length);
    expect(await listIssues(PROJECT_ID)).toHaveLength(SAMPLE_ISSUES.length);
  });

  it("queues the samples for sync", async () => {
    await loadSampleIssues(PROJECT_ID);
    expect(await db.outbox.count()).toBe(SAMPLE_ISSUES.length);
  });

  it("does nothing when the project already has issues", async () => {
    await createIssue({ projectId: PROJECT_ID, title: "Mine" });

    expect(await loadSampleIssues(PROJECT_ID)).toBe(0);
    expect(await listIssues(PROJECT_ID)).toHaveLength(1);
  });

  it("spreads samples across the board columns", async () => {
    await loadSampleIssues(PROJECT_ID);
    const statuses = new Set(
      (await listIssues(PROJECT_ID)).map((i) => i.status)
    );

    expect(statuses).toEqual(
      new Set(["backlog", "todo", "in_progress", "done"])
    );
  });
});
