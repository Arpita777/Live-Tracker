import { describe, it, expect } from "vitest";
import { IssueSchema } from "./issue";

const validIssue = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  title: "First issue",
  description: "",
  status: "todo",
  priority: "medium",
  assigneeId: null,
  labels: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  deletedAt: null,
};

describe("IssueSchema", () => {
  it("accepts a valid issue", () => {
    expect(IssueSchema.safeParse(validIssue).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(IssueSchema.safeParse({ ...validIssue, title: "" }).success).toBe(
      false
    );
  });

  it("rejects an unknown status", () => {
    expect(
      IssueSchema.safeParse({ ...validIssue, status: "nope" }).success
    ).toBe(false);
  });
});
