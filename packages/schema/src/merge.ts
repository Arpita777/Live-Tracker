import type { Issue } from "./issue";
import { compareHlc } from "./hlc";

// Fields that can be edited and merged. (id, createdAt, updatedAt and clocks are not.)
export const MERGEABLE_FIELDS = [
  "projectId",
  "title",
  "description",
  "status",
  "priority",
  "assigneeId",
  "labels",
  "deletedAt",
] as const;

export function applyChanges(
  issue: Issue,
  changes: Record<string, unknown>,
  hlc: string
): Issue {
  const next: Issue = { ...issue, clocks: { ...(issue.clocks ?? {}) } };

  for (const field of MERGEABLE_FIELDS) {
    if (!(field in changes)) continue;

    const current = next.clocks[field];
    // Skip if we already have a newer (or identical) write for this field
    if (current !== undefined && compareHlc(hlc, current) <= 0) continue;

    Object.assign(next, { [field]: changes[field] });
    next.clocks[field] = hlc;
  }

  // updatedAt is only for display, so just keep the latest
  if (
    typeof changes.updatedAt === "number" &&
    changes.updatedAt > next.updatedAt
  ) {
    next.updatedAt = changes.updatedAt;
  }
  return next;
}

// Build a brand-new issue from a "create" note's changes
export function issueFromCreate(
  changes: Record<string, unknown>,
  hlc: string
): Issue {
  const empty = {
    id: String(changes.id),
    projectId: "",
    title: "",
    description: "",
    status: "backlog",
    priority: "none",
    assigneeId: null,
    labels: [],
    createdAt: typeof changes.createdAt === "number" ? changes.createdAt : 0,
    updatedAt: 0,
    deletedAt: null,
    clocks: {},
  } as Issue;

  return applyChanges(empty, changes, hlc);
}
