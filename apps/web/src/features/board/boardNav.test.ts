import { describe, it, expect } from "vitest";
import { findPosition, nextPosition } from "./boardNav";

// column 0: a, b    column 1: (empty)    column 2: c
const columns = [["a", "b"], [], ["c"]];

describe("boardNav", () => {
  it("finds a card's position", () => {
    expect(findPosition(columns, "c")).toEqual({ col: 2, row: 0 });
    expect(findPosition(columns, "zzz")).toBeNull();
  });

  it("moves down and stops at the end", () => {
    expect(nextPosition(columns, { col: 0, row: 0 }, "ArrowDown")).toEqual({
      col: 0,
      row: 1,
    });
    expect(nextPosition(columns, { col: 0, row: 1 }, "ArrowDown")).toEqual({
      col: 0,
      row: 1,
    });
  });

  it("moves up and stops at the top", () => {
    expect(nextPosition(columns, { col: 0, row: 0 }, "ArrowUp")).toEqual({
      col: 0,
      row: 0,
    });
  });

  it("skips empty columns when going sideways", () => {
    expect(nextPosition(columns, { col: 0, row: 0 }, "ArrowRight")).toEqual({
      col: 2,
      row: 0,
    });
    expect(nextPosition(columns, { col: 2, row: 0 }, "ArrowLeft")).toEqual({
      col: 0,
      row: 0,
    });
  });

  it("clamps the row in a shorter column", () => {
    expect(nextPosition(columns, { col: 0, row: 1 }, "ArrowRight")).toEqual({
      col: 2,
      row: 0,
    });
  });

  it("stays put when there is no column further along", () => {
    expect(nextPosition(columns, { col: 2, row: 0 }, "ArrowRight")).toEqual({
      col: 2,
      row: 0,
    });
  });
});
