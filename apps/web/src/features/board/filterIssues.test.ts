import { describe, it, expect } from "vitest";
import type { Issue } from "@tracker/schema";
import { filterIssues, DEFAULT_FILTERS } from "./filterIssues";

function makeIssue(title: string, priority: Issue["priority"]): Issue {
  return {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title,
    description: "",
    status: "todo",
    priority,
    assigneeId: null,
    labels: [],
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
  };
}

const issues = [
  makeIssue("Fix login bug", "high"),
  makeIssue("Write docs", "low"),
  makeIssue("Fix typo in docs", "low"),
];

describe("filterIssues", () => {
  it("returns everything with default filters", () => {
    expect(filterIssues(issues, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it("searches titles ignoring upper/lower case", () => {
    const result = filterIssues(issues, { ...DEFAULT_FILTERS, search: "DOCS" });
    expect(result).toHaveLength(2);
  });

  it("filters by priority", () => {
    const result = filterIssues(issues, {
      ...DEFAULT_FILTERS,
      priority: "high",
    });
    expect(result.map((i) => i.title)).toEqual(["Fix login bug"]);
  });

  it("combines search and priority", () => {
    const result = filterIssues(issues, { search: "fix", priority: "low" });
    expect(result.map((i) => i.title)).toEqual(["Fix typo in docs"]);
  });
});
