import { useMemo } from "react";
import type { Issue, IssueStatusType } from "@tracker/schema";
import { BOARD_COLUMNS, STATUS_LABELS } from "./constants";
import { IssueCard } from "./IssueCard";
import "./board.css";

export function Board({ issues }: { issues: Issue[] }) {
  // Put each issue into the bucket for its status
  const byStatus = useMemo(() => {
    const groups: Record<IssueStatusType, Issue[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      done: [],
      canceled: [],
    };
    const sorted = [...issues].sort((a, b) => a.createdAt - b.createdAt);
    for (const issue of sorted) groups[issue.status].push(issue);
    return groups;
  }, [issues]);

  return (
    <div className="board">
      {BOARD_COLUMNS.map((status) => (
        <section key={status} className="column">
          <h2>
            {STATUS_LABELS[status]} <span>{byStatus[status].length}</span>
          </h2>
          {byStatus[status].map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </section>
      ))}
    </div>
  );
}
