import { useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { IssueStatus, type Issue, type IssueStatusType } from "@tracker/schema";
import { updateIssue } from "../../db/issueRepo";
import { BOARD_COLUMNS } from "./constants";
import { Column } from "./Column";
import { IssueCard } from "./IssueCard";
import "./board.css";

export function Board({ issues }: { issues: Issue[] }) {
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

  // Only start dragging after the pointer moves 5px, so plain clicks still work
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return; // dropped outside any column

    const parsed = IssueStatus.safeParse(over.id);
    if (!parsed.success) return;

    const issue = issues.find((i) => i.id === active.id);
    if (issue && issue.status !== parsed.data) {
      updateIssue(issue.id, { status: parsed.data });
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="board">
        {BOARD_COLUMNS.map((status) => (
          <Column key={status} status={status} count={byStatus[status].length}>
            {byStatus[status].map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}
