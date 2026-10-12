import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { findPosition, nextPosition, type NavKey } from "./boardNav";
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
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);
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

  const columnIds = useMemo(
    () => BOARD_COLUMNS.map((s) => byStatus[s].map((i) => i.id)),
    [byStatus]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
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

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (activeId) return; // a drag is in progress, so dnd-kit owns the arrow keys

    // Only react when the card itself is focused, not the dropdown or buttons inside it
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-card-id]");
    if (!el || el !== e.target) return;

    const id = el.dataset.cardId!;
    const pos = findPosition(columnIds, id);
    if (!pos) return;

    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const next = nextPosition(columnIds, pos, e.key as NavKey);
      const nextId = columnIds[next.col]?.[next.row];
      if (nextId && nextId !== id) setFocusRequest(nextId);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onOpenIssue(id);
    } else if (e.key === "[" || e.key === "]") {
      const target = BOARD_COLUMNS[pos.col + (e.key === "[" ? -1 : 1)];
      if (target) {
        updateIssue(id, { status: target });
        setFocusRequest(id); // the card is rebuilt in the new column, so focus it again
      }
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
      <div className="board" onKeyDown={handleKeyDown}>
        {BOARD_COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            issues={byStatus[status]}
            onOpenIssue={onOpenIssue}
            focusRequestId={focusRequest}
            onFocusDone={clearFocusRequest}
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
