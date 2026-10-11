import { useEffect, useState, type FormEvent } from "react";
import {
  IssuePriority,
  IssueStatus,
  type Issue,
  type IssuePriorityType,
  type IssueStatusType,
} from "@tracker/schema";
import { deleteIssue, updateIssue } from "../../db/issueRepo";
import { STATUS_LABELS } from "../board/constants";
import "./panel.css";

type Props = {
  issue: Issue;
  onClose: () => void;
};

export function IssuePanel({ issue, onClose }: Props) {
  // Drafts: what you're typing, before you press Save
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);

  // Close when Escape is pressed
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const trimmed = title.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= 200;
  const isDirty = trimmed !== issue.title || description !== issue.description;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!isValid || !isDirty) return;
    await updateIssue(issue.id, { title: trimmed, description });
  }

  async function handleDelete() {
    await deleteIssue(issue.id);
    onClose();
  }

  return (
    <aside className="panel" aria-label="Issue details">
      <div className="panel-top">
        <h2>Issue details</h2>
        <button onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <form onSubmit={handleSave} className="panel-form">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {!isValid && (
          <small className="error">Title must be 1 to 200 characters.</small>
        )}

        <label>
          Description
          <textarea
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <button type="submit" disabled={!isValid || !isDirty}>
          Save
        </button>
      </form>

      <div className="panel-form">
        <label>
          Status
          <select
            value={issue.status}
            onChange={(e) =>
              updateIssue(issue.id, {
                status: e.target.value as IssueStatusType,
              })
            }
          >
            {IssueStatus.options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Priority
          <select
            value={issue.priority}
            onChange={(e) =>
              updateIssue(issue.id, {
                priority: e.target.value as IssuePriorityType,
              })
            }
          >
            {IssuePriority.options.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="danger" onClick={handleDelete}>
        Delete issue
      </button>
    </aside>
  );
}
