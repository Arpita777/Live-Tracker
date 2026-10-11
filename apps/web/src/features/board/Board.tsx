import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { IssueStatus, type Issue, type IssueStatusType } from "@tracker/schema";
import { updateIssue } from "../../db/issueRepo";
import { BOARD_COLUMNS } from "./constants";
import { Column } from "./Column";
import { IssueCardView } from "./IssueCardView";
import "./board.css";

export function Board({
  issues,
  onOpenIssue,
}: {
  issues: Issue[];
  onOpenIssue: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIssue = issues.find((i) => i.id === activeId) ?? null;

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const parsed = IssueStatus.safeParse(over.id);
    if (!parsed.success) return;

    const issue = issues.find((i) => i.id === active.id);
    if (issue && issue.status !== parsed.data) {
      updateIssue(issue.id, { status: parsed.data });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="board">
        {BOARD_COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            issues={byStatus[status]}
            onOpenIssue={onOpenIssue}
          />
        ))}
      </div>

      <DragOverlay>
        {activeIssue ? (
          <div className="card card-overlay">
            <IssueCardView issue={activeIssue} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
