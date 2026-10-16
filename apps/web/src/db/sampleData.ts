import type { Issue } from "@tracker/schema";
import { createIssue, listIssues } from "./issueRepo";

type Sample = {
  title: string;
  description: string;
  status: Issue["status"];
  priority: Issue["priority"];
};

export const SAMPLE_ISSUES: Sample[] = [
  {
    title: "Fix layout shift on hero image",
    description:
      "Reserve width and height so the page does not jump when the image loads.",
    status: "in_progress",
    priority: "high",
  },
  {
    title: "Fix hydration mismatch warning on pricing page",
    description: "Date formatting differs between server and client render.",
    status: "in_progress",
    priority: "urgent",
  },
  {
    title: "Make modal focus-trap accessible",
    description:
      "Trap focus inside the dialog, close on Escape, and return focus to the trigger.",
    status: "todo",
    priority: "high",
  },
  {
    title: "Add error boundary around the dashboard",
    description:
      "Show a friendly fallback and a retry button instead of a blank screen.",
    status: "todo",
    priority: "high",
  },
  {
    title: "Add skeleton loaders to the product list",
    description:
      "Replace the spinner with skeleton cards to reduce perceived loading time.",
    status: "todo",
    priority: "medium",
  },
  {
    title: "Write tests for the useDebounce hook",
    description:
      "Cover fast typing, unmount during the delay, and changing the delay value.",
    status: "todo",
    priority: "low",
  },
  {
    title: "Responsive navbar breaks below 768px",
    description: "Menu items overflow on tablets. Switch to a hamburger menu.",
    status: "backlog",
    priority: "high",
  },
  {
    title: "Lazy-load below-the-fold images",
    description: "Use loading=lazy and proper srcset sizes for the gallery.",
    status: "backlog",
    priority: "medium",
  },
  {
    title: "Replace prop drilling with context in checkout",
    description:
      "Cart and shipping data pass through five components. Move to a context.",
    status: "backlog",
    priority: "low",
  },
  {
    title: "Audit bundle size and split heavy routes",
    description:
      "Find large dependencies and use dynamic import for the admin area.",
    status: "backlog",
    priority: "medium",
  },
  {
    title: "Debounce the search input",
    description:
      "Wait 300 ms after typing stops before calling the search API.",
    status: "done",
    priority: "medium",
  },
  {
    title: "Migrate class components to hooks",
    description:
      "Convert the remaining legacy components in the settings area.",
    status: "done",
    priority: "low",
  },
];

// Adds the samples through the normal repository, so they sync like any other issue.
// Does nothing if the project already has issues.
export async function loadSampleIssues(projectId: string): Promise<number> {
  if ((await listIssues(projectId)).length > 0) return 0;

  for (const sample of SAMPLE_ISSUES) {
    await createIssue({ projectId, ...sample });
  }
  return SAMPLE_ISSUES.length;
}
