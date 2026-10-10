import type { Issue, IssuePriorityType } from "@tracker/schema";

export type Filters = {
  search: string;
  priority: "all" | IssuePriorityType;
};

export const DEFAULT_FILTERS: Filters = { search: "", priority: "all" };

export function filterIssues(issues: Issue[], filters: Filters): Issue[] {
  const text = filters.search.trim().toLowerCase();

  return issues.filter((issue) => {
    const matchesText = text === "" || issue.title.toLowerCase().includes(text);
    const matchesPriority =
      filters.priority === "all" || issue.priority === filters.priority;
    return matchesText && matchesPriority;
  });
}
