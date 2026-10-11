import { useDraggable } from "@dnd-kit/core";
import { IssueCardView } from "./IssueCardView";
import { type Issue } from "@tracker/schema";

export function IssueCard({
  issue,
  onOpen,
}: {
  issue: Issue;
  onOpen: (id: string) => void;
}) {
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
      onClick={(e) => {
        // Ignore clicks on the dropdowns and buttons inside the card
        if ((e.target as HTMLElement).closest("select, button")) return;
        onOpen(issue.id);
      }}
    >
      {/* <div className="card-header">
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
        <button onClick={() => onOpen(issue.id)}>Open</button>
      </div> */}
      <IssueCardView issue={issue} onOpen={onOpen} />
    </div>
  );
}
