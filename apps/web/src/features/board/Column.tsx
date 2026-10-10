import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { IssueStatusType } from "@tracker/schema";
import { STATUS_LABELS } from "./constants";

type Props = {
  status: IssueStatusType;
  count: number;
  children: ReactNode;
};

export function Column({ status, count, children }: Props) {
  // The column's id is its status, so on drop we know where the card went
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={isOver ? "column column-over" : "column"}
    >
      <h2>
        {STATUS_LABELS[status]} <span>{count}</span>
      </h2>
      {children}
    </section>
  );
}
