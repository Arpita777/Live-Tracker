export type Pos = { col: number; row: number };
export type NavKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

// columns = one array of issue ids per board column
export function findPosition(columns: string[][], id: string): Pos | null {
  for (let col = 0; col < columns.length; col++) {
    const row = columns[col]!.indexOf(id);
    if (row !== -1) return { col, row };
  }
  return null;
}

export function nextPosition(columns: string[][], pos: Pos, key: NavKey): Pos {
  const current = columns[pos.col] ?? [];

  if (key === "ArrowUp") return { col: pos.col, row: Math.max(pos.row - 1, 0) };
  if (key === "ArrowDown") {
    return { col: pos.col, row: Math.min(pos.row + 1, current.length - 1) };
  }

  // Left or right: skip empty columns, keep the same row (or the last one)
  const step = key === "ArrowLeft" ? -1 : 1;
  for (let c = pos.col + step; c >= 0 && c < columns.length; c += step) {
    const target = columns[c]!;
    if (target.length > 0) {
      return { col: c, row: Math.min(pos.row, target.length - 1) };
    }
  }
  return pos; // nowhere to go
}
