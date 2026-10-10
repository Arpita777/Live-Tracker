import { useDraggable } from "@dnd-kit/core";
import { IssueStatus, type Issue, type IssueStatusType } from "@tracker/schema";
import { deleteIssue, updateIssue } from "../../db/issueRepo";
import { STATUS_LABELS } from "./constants";

export function IssueCard({ issue }: { issue: Issue }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: issue.id });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card"
      {...attributes}
      {...listeners}
    >
      <div className="card-header">
        <button className="drag-handle" aria-label={`Drag ${issue.title}`}>
          ⠿
        </button>
        <div className="card-title">{issue.title}</div>
      </div>

      <div className="card-meta">Priority: {issue.priority}</div>

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
        <button onClick={() => deleteIssue(issue.id)}>Delete</button>
      </div>
    </div>
  );
}
