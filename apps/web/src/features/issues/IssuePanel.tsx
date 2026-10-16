import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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

const when = (ms: number) =>
  ms > 0
    ? new Date(ms).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

export function IssuePanel({ issue, onClose }: Props) {
  // Drafts: what you're typing, before you press Save
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Make the title box exactly as tall as its text
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

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
    <aside
      className={`panel priority-${issue.priority}`}
      aria-label="Issue details"
    >
      <div className="panel-top">
        <h2>Issue details</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className="panel-chips">
        <span className="status-chip">
          <span className={`dot dot-${issue.status}`} />
          {STATUS_LABELS[issue.status]}
        </span>
        <span className={`badge badge-${issue.priority}`}>
          {issue.priority}
        </span>
      </div>

      <form onSubmit={handleSave} className="panel-form">
        <label>
          Title
          <textarea
            ref={titleRef}
            className="panel-title-input"
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              // A title is one line of text: Enter saves instead of adding a new line
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        {!isValid && (
          <small className="error">Title must be 1 to 200 characters.</small>
        )}
        {trimmed.length > 160 && isValid && (
          <small className="hint">{trimmed.length} / 200 characters</small>
        )}

        <label>
          Description
          <textarea
            rows={6}
            value={description}
            placeholder="Add more detail..."
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <button
          className="primary"
          type="submit"
          disabled={!isValid || !isDirty}
        >
          Save changes
        </button>
      </form>

      <div className="panel-form panel-row">
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

      <div className="panel-meta">
        <span>
          <strong>Created</strong> {when(issue.createdAt)}
        </span>
        <span>
          <strong>Updated</strong> {when(issue.updatedAt)}
        </span>
      </div>

      <button className="danger" onClick={handleDelete}>
        Delete issue
      </button>
    </aside>
  );
}
