import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Issue, IssueStatusType } from "@tracker/schema";
import { STATUS_LABELS } from "./constants";
import { IssueCard } from "./IssueCard";

const CARD_HEIGHT = 120; // every card is treated as this tall (px)

type Props = {
  status: IssueStatusType;
  issues: Issue[];
  onOpenIssue: (id: string) => void;
  focusRequestId: string | null;
  onFocusDone: () => void;
};

export function Column({
  status,
  issues,
  onOpenIssue,
  focusRequestId,
  onFocusDone,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  // The scrolling box: the virtualizer watches this element
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 5, // draw 5 extra cards above/below for smooth scrolling
  });

  // If the card we want to focus lives here, scroll it into the visible window
  useEffect(() => {
    if (!focusRequestId) return;
    const index = issues.findIndex((i) => i.id === focusRequestId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [focusRequestId, issues, virtualizer]);

  return (
    <section
      ref={setNodeRef}
      className={isOver ? "column column-over" : "column"}
    >
      <h2>
        <span className={`dot dot-${status}`} />
        {STATUS_LABELS[status]}
        <span className="count-pill">{issues.length}</span>
      </h2>

      <div ref={scrollRef} className="column-scroll">
        {/* A tall invisible box so the scrollbar has the right size */}
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const issue = issues[row.index]!;
            return (
              <div
                key={issue.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: CARD_HEIGHT,
                  transform: `translateY(${row.start}px)`,
                }}
              >
                <IssueCard
                  issue={issue}
                  onOpen={onOpenIssue}
                  shouldFocus={issue.id === focusRequestId}
                  onFocusDone={onFocusDone}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
