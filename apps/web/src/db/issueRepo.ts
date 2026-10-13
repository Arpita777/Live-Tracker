import {
  IssueSchema,
  MERGEABLE_FIELDS,
  applyChanges,
  type Issue,
  type Mutation,
} from "@tracker/schema";
import { db } from "./db";
import { clock } from "../sync/clock";

type NewIssueInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: Issue["status"];
  priority?: Issue["priority"];
};

// Put a note in the tray. Always call this inside a transaction.
function enqueue(
  issueId: string,
  type: Mutation["type"],
  changes: Record<string, unknown>,
  hlc: string
) {
  return db.outbox.add({
    id: crypto.randomUUID(),
    issueId,
    type,
    changes,
    createdAt: Date.now(),
    hlc,
  });
}

export async function createIssue(input: NewIssueInput): Promise<Issue> {
  const now = Date.now();
  const hlc = clock.now();

  const issue: Issue = IssueSchema.parse({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "backlog",
    priority: input.priority ?? "none",
    assigneeId: null,
    labels: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    clocks: Object.fromEntries(MERGEABLE_FIELDS.map((f) => [f, hlc])),
  });

  // Both writes succeed together, or neither happens
  await db.transaction("rw", db.issues, db.outbox, async () => {
    await db.issues.add(issue);
    await enqueue(issue.id, "create", { ...issue }, hlc);
  });

  return issue;
}

export async function updateIssue(
  id: string,
  changes: Partial<Omit<Issue, "id" | "createdAt" | "clocks" | "updatedAt">>
): Promise<void> {
  const hlc = clock.now();
  const fullChanges = { ...changes, updatedAt: Date.now() };

  await db.transaction("rw", db.issues, db.outbox, async () => {
    const existing = await db.issues.get(id);
    if (!existing) return; // no such issue, so nothing to send

    await db.issues.put(applyChanges(existing, fullChanges, hlc));
    await enqueue(id, "update", fullChanges, hlc);
  });
}

// Soft delete: just an update that sets deletedAt
export function deleteIssue(id: string): Promise<void> {
  return updateIssue(id, { deletedAt: Date.now() });
}

export function restoreIssue(id: string): Promise<void> {
  return updateIssue(id, { deletedAt: null });
}

export async function listIssues(projectId: string): Promise<Issue[]> {
  const rows = await db.issues.where("projectId").equals(projectId).toArray();
  return rows.filter((i) => i.deletedAt === null);
}
