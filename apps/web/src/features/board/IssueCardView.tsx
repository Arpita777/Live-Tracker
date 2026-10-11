import { IssueStatus, type Issue, type IssueStatusType } from "@tracker/schema";
import { STATUS_LABELS } from "./constants";
import { updateIssue, deleteIssue } from "../../db/issueRepo";

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
        <button onClick={() => onOpen?.(issue.id)}>Open</button>
        <button onClick={() => deleteIssue(issue.id)}>Delete</button>
      </div>
    </>
  );
}
