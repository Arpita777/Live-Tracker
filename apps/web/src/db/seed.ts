import type { Issue } from "@tracker/schema";
import { db } from "./db";

const VERBS = [
  "Fix",
  "Add",
  "Update",
  "Remove",
  "Refactor",
  "Document",
  "Test",
  "Review",
];
const THINGS = [
  "login",
  "sidebar",
  "search",
  "billing",
  "emails",
  "dashboard",
  "settings",
  "export",
  "upload",
  "profile",
];
const STATUSES: Issue["status"][] = ["backlog", "todo", "in_progress", "done"];
const PRIORITIES: Issue["priority"][] = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
];

const pick = <T>(list: T[]): T =>
  list[Math.floor(Math.random() * list.length)]!;

export async function seedIssues(
  projectId: string,
  count = 10_000
): Promise<void> {
  const now = Date.now();

  const issues: Issue[] = Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    projectId,
    title: `${pick(VERBS)} ${pick(THINGS)} #${i + 1}`,
    description: "",
    status: pick(STATUSES),
    priority: pick(PRIORITIES),
    assigneeId: null,
    labels: [],
    createdAt: now + i, // slightly different times so the order is stable
    updatedAt: now + i,
    deletedAt: null,
    clocks: {},
  }));

  await db.issues.bulkAdd(issues);
}
export async function clearIssues(): Promise<void> {
  await db.transaction("rw", db.issues, db.outbox, db.meta, async () => {
    await db.issues.clear();
    await db.outbox.clear();
    await db.meta.clear();
  });
}
