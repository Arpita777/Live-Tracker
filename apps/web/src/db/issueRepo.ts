import { IssueSchema, type Issue } from "@tracker/schema";
import { db } from "./db";

type NewIssueInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: Issue["status"];
  priority?: Issue["priority"];
};

export async function createIssue(input: NewIssueInput): Promise<Issue> {
  const now = Date.now();

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
  });

  await db.issues.add(issue);
  return issue;
}

export async function updateIssue(
  id: string,
  changes: Partial<Omit<Issue, "id" | "createdAt">>
): Promise<void> {
  await db.issues.update(id, { ...changes, updatedAt: Date.now() });
}

// Soft delete: we mark it as deleted instead of removing the row
export async function deleteIssue(id: string): Promise<void> {
  const now = Date.now();
  await db.issues.update(id, { deletedAt: now, updatedAt: now });
}

export async function restoreIssue(id: string): Promise<void> {
  await db.issues.update(id, { deletedAt: null, updatedAt: Date.now() });
}

export async function listIssues(projectId: string): Promise<Issue[]> {
  const rows = await db.issues.where("projectId").equals(projectId).toArray();
  return rows.filter((i) => i.deletedAt === null);
}
