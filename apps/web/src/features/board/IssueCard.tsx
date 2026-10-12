import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { IssueCardView } from "./IssueCardView";
import { type Issue } from "@tracker/schema";

export function IssueCard({
  issue,
  onOpen,
  shouldFocus,
  onFocusDone,
}: {
  issue: Issue;
  onOpen: (id: string) => void;
  shouldFocus: boolean;
  onFocusDone: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
  });

  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldFocus) {
      elRef.current?.focus({ preventScroll: true });
      onFocusDone();
    }
  }, [shouldFocus, onFocusDone]);

  return (
    <div
      ref={(node) => {
        elRef.current = node;
        setNodeRef(node);
      }}
      data-card-id={issue.id}
      className="card"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("select, button")) return;
        onOpen(issue.id);
      }}
    >
      <IssueCardView issue={issue} onOpen={onOpen} />
    </div>
  );
}
