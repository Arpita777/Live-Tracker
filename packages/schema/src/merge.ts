import type { Issue } from "./issue";
import { compareHlc, parseHlc } from "./hlc";

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

export type FieldConflict = {
  issueId: string;
  field: string;
  winner: { value: unknown; hlc: string };
  loser: { value: unknown; hlc: string };
};

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export function applyChangesDetailed(
  issue: Issue,
  changes: Record<string, unknown>,
  hlc: string
): { issue: Issue; conflicts: FieldConflict[] } {
  const next: Issue = { ...issue, clocks: { ...(issue.clocks ?? {}) } };
  const conflicts: FieldConflict[] = [];

  // "_base": for each field, the clock the author saw before editing.
  // No _base (creates, local edits) means we cannot judge conflicts.
  const base =
    changes._base && typeof changes._base === "object"
      ? (changes._base as Record<string, string>)
      : null;

  for (const field of MERGEABLE_FIELDS) {
    if (!(field in changes)) continue;

    const current = next.clocks[field];
    const incoming = changes[field];
    const currentValue = next[field];

    if (current !== undefined) {
      const order = compareHlc(hlc, current);
      if (order === 0) continue; // this exact write again

      const sameDevice = parseHlc(hlc).node === parseHlc(current).node;
      const authorMissedIt = base !== null && base[field] !== current;

      if (!sameDevice && authorMissedIt && !sameValue(incoming, currentValue)) {
        const incomingWins = order > 0;
        const mine = { value: currentValue, hlc: current };
        const theirs = { value: incoming, hlc };
        conflicts.push({
          issueId: issue.id,
          field,
          winner: incomingWins ? theirs : mine,
          loser: incomingWins ? mine : theirs,
        });
      }

      if (order < 0) continue; // older write loses
    }

    Object.assign(next, { [field]: incoming });
    next.clocks[field] = hlc;
  }

  // updatedAt is only for display, so just keep the latest
  if (
    typeof changes.updatedAt === "number" &&
    changes.updatedAt > next.updatedAt
  ) {
    next.updatedAt = changes.updatedAt;
  }

  // createdAt never changes after creation: keep the earliest real value.
  // 0 means "unknown yet" (the issue was built from an update that arrived early).
  if (typeof changes.createdAt === "number" && changes.createdAt > 0) {
    if (next.createdAt === 0 || changes.createdAt < next.createdAt) {
      next.createdAt = changes.createdAt;
    }
  }

  return { issue: next, conflicts };
}

export function applyChanges(
  issue: Issue,
  changes: Record<string, unknown>,
  hlc: string
): Issue {
  return applyChangesDetailed(issue, changes, hlc).issue;
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
