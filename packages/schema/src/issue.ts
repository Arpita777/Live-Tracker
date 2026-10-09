import { z } from "zod";

export const IssueStatus = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled",
]);
export const IssuePriority = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "urgent",
]);

export const IssueSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  status: IssueStatus,
  priority: IssuePriority,
  assigneeId: z.uuid().nullable(),
  labels: z.array(z.string()),
  createdAt: z.number().int(), // epoch ms for now; we upgrade to HLC in M4
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable(), // tombstone for soft deletes
});

export type Issue = z.infer<typeof IssueSchema>;
export type IssueStatusType = z.infer<typeof IssueStatus>;
export type IssuePriorityType = z.infer<typeof IssuePriority>;
