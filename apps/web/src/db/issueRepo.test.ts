import "fake-indexeddb/auto"; // must be the first import: it installs the fake database
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import {
  createIssue,
  updateIssue,
  deleteIssue,
  restoreIssue,
  listIssues,
} from "./issueRepo";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("issueRepo", () => {
  // Empty the table before every test so tests don't affect each other
  beforeEach(async () => {
    await db.issues.clear();
  });

  it("creates an issue with sensible defaults", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Write tests",
    });

    expect(issue.status).toBe("todo");
    expect(issue.deletedAt).toBeNull();

    const saved = await db.issues.get(issue.id);
    expect(saved?.title).toBe("Write tests");
  });

  it("rejects an empty title", async () => {
    await expect(
      createIssue({ projectId: PROJECT_ID, title: "" })
    ).rejects.toThrow();
  });

  it("updates fields and refreshes updatedAt", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Edit me",
    });
    await wait(5);

    await updateIssue(issue.id, { status: "done" });

    const saved = await db.issues.get(issue.id);
    expect(saved?.status).toBe("done");
    expect(saved!.updatedAt).toBeGreaterThan(issue.updatedAt);
  });

  it("soft deletes: hidden from the list but the row still exists", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Delete me",
    });

    await deleteIssue(issue.id);

    expect(await listIssues(PROJECT_ID)).toHaveLength(0);

    const row = await db.issues.get(issue.id);
    expect(row).toBeDefined();
    expect(row?.deletedAt).not.toBeNull();
  });

  it("restores a deleted issue", async () => {
    const issue = await createIssue({
      projectId: PROJECT_ID,
      title: "Come back",
    });
    await deleteIssue(issue.id);

    await restoreIssue(issue.id);

    expect(await listIssues(PROJECT_ID)).toHaveLength(1);
  });
});
