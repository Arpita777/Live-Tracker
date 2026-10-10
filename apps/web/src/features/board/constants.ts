import type { IssueStatusType } from "@tracker/schema";

export const STATUS_LABELS: Record<IssueStatusType, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

// Which columns the board shows, in order. "canceled" is hidden for now.
export const BOARD_COLUMNS: IssueStatusType[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
];
