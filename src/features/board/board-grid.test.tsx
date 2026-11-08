// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoardView, CellState, HostBoardCellView } from "@/features/engine/contract";
import { BoardGrid, nextCell, type PickGrid } from "./board-grid";

/*
  A 3 × 3 host board. "x" marks a played cell:

            Alpha   Beta   Gamma
    100       ·      x       ·
    200       x      ·       ·
    300       ·      x       x
*/
const PLAYED = new Set(["b-100", "a-200", "b-300", "c-300"]);

function cell(category: string, value: number, wager = false): HostBoardCellView {
  const clueId = `${category}-${value}`;
  const state: CellState = PLAYED.has(clueId) ? "completed" : "available";
  return { clueId, value, state, wager };
}

const BOARD: BoardView<HostBoardCellView> = {
  roundIndex: 0,
  roundTitle: "Round 1",
  categories: [
    { id: "a", title: "Alpha", cells: [cell("a", 100), cell("a", 200), cell("a", 300)] },
    { id: "b", title: "Beta", cells: [cell("b", 100), cell("b", 200, true), cell("b", 300)] },
    { id: "c", title: "Gamma", cells: [cell("c", 100), cell("c", 200), cell("c", 300)] },
  ],
};

const GRID: PickGrid = BOARD.categories.map((category) =>
  category.cells.map((c) => (c.state === "available" ? c.clueId : null)),
);

describe("nextCell", () => {
  it("moves up and down within a category, skipping played cells", () => {
    expect(nextCell(GRID, { col: 0, row: 0 }, "ArrowDown")).toEqual({ col: 0, row: 2 });
    expect(nextCell(GRID, { col: 0, row: 2 }, "ArrowUp")).toEqual({ col: 0, row: 0 });
    expect(nextCell(GRID, { col: 0, row: 2 }, "ArrowDown")).toBeNull();
  });

  it("moves across categories at the same value, skipping played cells", () => {
    expect(nextCell(GRID, { col: 0, row: 0 }, "ArrowRight")).toEqual({ col: 2, row: 0 });
    expect(nextCell(GRID, { col: 2, row: 0 }, "ArrowLeft")).toEqual({ col: 0, row: 0 });
    expect(nextCell(GRID, { col: 2, row: 0 }, "ArrowRight")).toBeNull();
  });

  it("falls back to the nearest open value when no category that way has this one", () => {
    // Nothing else is open at 300, so → goes to Beta's 200.
    expect(nextCell(GRID, { col: 0, row: 2 }, "ArrowRight")).toEqual({ col: 1, row: 1 });
  });

  it("jumps to the first and last open cell with Home and End", () => {
    expect(nextCell(GRID, { col: 1, row: 1 }, "Home")).toEqual({ col: 0, row: 0 });
    expect(nextCell(GRID, { col: 0, row: 0 }, "End")).toEqual({ col: 0, row: 2 });
  });
});

describe("BoardGrid keyboard (host)", () => {
  function renderHost(onSelect = vi.fn()) {
    render(<BoardGrid board={BOARD} variant="host" onSelect={onSelect} />);
    return onSelect;
  }

  it("puts one cell in the tab order and keeps every cell a named button", () => {
    renderHost();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(buttons.filter((b) => b.tabIndex === 0)).toEqual([
      screen.getByRole("button", { name: "Alpha for 100" }),
    ]);
    expect(
      screen.getByRole("button", { name: "Beta for 200, wager clue (Hot HAM)" }),
    ).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus and the tab stop with the arrow keys", () => {
    renderHost();
    const start = screen.getByRole("button", { name: "Alpha for 100" });
    start.focus();
    fireEvent.keyDown(start, { key: "ArrowRight" });
    const gamma = screen.getByRole("button", { name: "Gamma for 100" });
    expect(gamma).toHaveFocus();
    expect(gamma).toHaveAttribute("tabindex", "0");
    expect(start).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(gamma, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Gamma for 200" })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("button", { name: "Alpha for 300" })).toHaveFocus();
  });

  it("leaves Enter, Space and clicks to the button, which picks the clue", () => {
    const onSelect = renderHost();
    const cellButton = screen.getByRole("button", { name: "Gamma for 200" });
    // Not prevented, so the browser turns Enter/Space into a click as usual.
    expect(fireEvent.keyDown(cellButton, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(cellButton, { key: " " })).toBe(true);
    fireEvent.click(cellButton);
    expect(onSelect).toHaveBeenCalledWith("c-200");
  });

  it("has a board heading between the page h1 and the category h3s", () => {
    renderHost();
    expect(screen.getByRole("heading", { level: 2, name: "Round 1 board" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Round 1 board" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});

describe("BoardGrid (read-only)", () => {
  it("has no buttons or tab stops on the TV, and played cells still say done", () => {
    const { container } = render(<BoardGrid board={BOARD} variant="stage" />);
    expect(container.querySelector("button, [tabindex]")).toBeNull();
    expect(screen.getByText("100, done", { selector: ".sr-only" })).toBeInTheDocument();
  });
});
