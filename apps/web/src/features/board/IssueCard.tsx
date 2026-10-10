import { IssueStatus, type Issue, type IssueStatusType } from "@tracker/schema";
import { deleteIssue, updateIssue } from "../../db/issueRepo";
import { STATUS_LABELS } from "./constants";

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className="card">
      <div className="card-title">{issue.title}</div>
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
