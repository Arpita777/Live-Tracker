import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { IssueStatus, type Issue, type IssueStatusType } from "@tracker/schema";
import { deleteIssue, updateIssue } from "../../db/issueRepo";
import { STATUS_LABELS } from "./constants";

// Pure look, no drag logic. Used for the real card AND the floating copy.
export function IssueCardView({
  issue,
  onOpen,
}: {
  issue: Issue;
  onOpen?: (id: string) => void;
}) {
  return (
    <>
      <div className="card-header">
        <span className="drag-handle" aria-hidden="true">
          ⠿
        </span>
        <div className="card-title" title={issue.title}>
          {issue.title}
        </div>
      </div>
      <div className="card-meta">
        <span className={`badge badge-${issue.priority}`}>
          {issue.priority}
        </span>
      </div>
      <div className="card-actions">
        <select
          value={issue.status}
          onChange={(e) =>
            updateIssue(issue.id, { status: e.target.value as IssueStatusType })
          }
        >
          {IssueStatus.options.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button onClick={() => onOpen?.(issue.id)}>Open</button>
        <button onClick={() => deleteIssue(issue.id)}>Delete</button>
      </div>
    </>
  );
}

export function IssueCard({
  issue,
  onOpen,
  shouldFocus,
  onFocusDone,
}: {
  issue: Issue;
  onOpen: (id: string) => void;
  shouldFocus: boolean;
  onFocusDone: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
  });
  const elRef = useRef<HTMLDivElement | null>(null);

  // When the board asks for this card to be focused, do it once and report back
  useEffect(() => {
    if (shouldFocus) {
      elRef.current?.focus({ preventScroll: true });
      onFocusDone();
    }
  }, [shouldFocus, onFocusDone]);

  return (
    <div
      ref={(node) => {
        elRef.current = node;
        setNodeRef(node);
      }}
      data-card-id={issue.id}
      className="card"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("select, button")) return;
        onOpen(issue.id);
      }}
    >
      <IssueCardView issue={issue} onOpen={onOpen} />
    </div>
  );
}
