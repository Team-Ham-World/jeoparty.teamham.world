"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type {
  BoardCellView,
  BoardView,
  ClueId,
  HostBoardCellView,
} from "@/features/engine/contract";
import { formatScore } from "@/features/ui/format";

/*
  The categories × values grid, drawn from the contract's BoardView.
  - "stage": the TV. Paper slips pasted on the ink stage. Read-only.
  - "host": the host's board. Available cells are buttons when `onSelect` is
    given; wager cells (host-only data) carry a "Hot HAM" mark.
  - "phone": a compact read-only board for players.
  The grid never decides anything: cell state and values come from the view.

  Keyboard (host, when `onSelect` is given): the board is one tab stop. The
  arrow keys move between open cells, Home and End jump to the first and last
  one, and Enter or Space picks it (they're ordinary buttons).
*/

export type BoardVariant = "stage" | "host" | "phone";

const STATE_WORD = { available: "open", active: "now playing", completed: "done" } as const;

function isWagerCell(cell: BoardCellView): cell is HostBoardCellView {
  return "wager" in cell && (cell as HostBoardCellView).wager === true;
}

/** A cell position: `col` is the category, `row` the value tier. */
export interface CellPosition {
  col: number;
  row: number;
}

/** Pickable cells as grid[col][row]: the clue id, or null when it can't be picked. */
export type PickGrid = readonly (readonly (ClueId | null)[])[];

const MOVE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

/** Every pickable cell, left to right along each row, top row first. */
function readingOrder(grid: PickGrid): CellPosition[] {
  const rows = Math.max(0, ...grid.map((column) => column.length));
  const cells: CellPosition[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < grid.length; col++) if (grid[col][row]) cells.push({ col, row });
  return cells;
}

/** The pickable cell in `col` nearest to `row` (the upper one on a tie), if any. */
function nearestInColumn(grid: PickGrid, col: number, row: number): CellPosition | null {
  const column = grid[col];
  for (let distance = 0; distance < column.length; distance++) {
    if (column[row - distance]) return { col, row: row - distance };
    if (column[row + distance]) return { col, row: row + distance };
  }
  return null;
}

/**
 * Where a navigation key moves focus from `from`, skipping cells that can't
 * be picked. Up/Down stay in the category. Left/Right keep the same value
 * when a category in that direction has it open, otherwise they go to the
 * nearest open value in the next category that has one. Returns null when
 * nothing is in that direction.
 */
export function nextCell(grid: PickGrid, from: CellPosition, key: string): CellPosition | null {
  const order = readingOrder(grid);
  switch (key) {
    case "Home":
      return order[0] ?? null;
    case "End":
      return order[order.length - 1] ?? null;
    case "ArrowUp":
    case "ArrowDown": {
      const step = key === "ArrowUp" ? -1 : 1;
      const column = grid[from.col];
      for (let row = from.row + step; row >= 0 && row < column.length; row += step)
        if (column[row]) return { col: from.col, row };
      return null;
    }
    case "ArrowLeft":
    case "ArrowRight": {
      const step = key === "ArrowLeft" ? -1 : 1;
      const columns: number[] = [];
      for (let col = from.col + step; col >= 0 && col < grid.length; col += step) columns.push(col);
      const sameRow = columns.find((col) => grid[col][from.row]);
      if (sameRow !== undefined) return { col: sameRow, row: from.row };
      for (const col of columns) {
        const nearest = nearestInColumn(grid, col, from.row);
        if (nearest) return nearest;
      }
      return null;
    }
    default:
      return null;
  }
}

export function BoardGrid<Cell extends BoardCellView>({
  board,
  variant,
  onSelect,
  disabled = false,
  label,
}: {
  board: BoardView<Cell>;
  variant: BoardVariant;
  /** Host only: called with the clue to select. Omit for read-only boards. */
  onSelect?: (clueId: ClueId) => void;
  /** Host only: true while selecting is not allowed (stale, paused, wrong phase). */
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const [focusedClue, setFocusedClue] = useState<ClueId | null>(null);
  const buttons = useRef(new Map<ClueId, HTMLButtonElement>());

  const rows = Math.max(1, ...board.categories.map((category) => category.cells.length));
  const grid: PickGrid = board.categories.map((category) =>
    category.cells.map((cell) => (onSelect && cell.state === "available" ? cell.clueId : null)),
  );
  // One cell is the tab stop: the last one focused while it's still open,
  // otherwise the first open cell.
  const first = readingOrder(grid)[0];
  const tabStop =
    focusedClue && grid.some((column) => column.includes(focusedClue))
      ? focusedClue
      : first
        ? grid[first.col][first.row]
        : null;

  function onCellKeyDown(event: KeyboardEvent<HTMLButtonElement>, from: CellPosition) {
    if (!MOVE_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const to = nextCell(grid, from, event.key);
    const clueId = to ? grid[to.col][to.row] : null;
    if (!clueId) return;
    setFocusedClue(clueId);
    buttons.current.get(clueId)?.focus();
  }

  return (
    <div
      className={`board board--${variant}`}
      style={{ "--cols": board.categories.length, "--rows": rows } as React.CSSProperties}
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={onSelect ? `${id}-keys` : undefined}
    >
      {/* Keeps the outline in order: page h1, this board h2, category h3s. */}
      <h2 id={`${id}-title`} className="sr-only">
        {label ?? `${board.roundTitle} board`}
      </h2>
      {onSelect ? (
        <p id={`${id}-keys`} className="sr-only">
          Use the arrow keys to move between open clues.
        </p>
      ) : null}
      {board.categories.map((category, columnIndex) => {
        const headingId = `board-${variant}-${board.roundIndex}-${columnIndex}`;
        return (
          <section key={category.id} className="board__col" aria-labelledby={headingId}>
            <h3 id={headingId} className="board__cat">
              <span>{category.title}</span>
            </h3>
            {category.cells.map((cell, rowIndex) => {
              const wager = isWagerCell(cell);
              const value = formatScore(cell.value);
              const className = `board__cell board__cell--${cell.state} ${wager ? "board__cell--wager" : ""}`;
              if (onSelect && cell.state === "available") {
                return (
                  <button
                    key={cell.clueId}
                    ref={(element) => {
                      if (element) buttons.current.set(cell.clueId, element);
                      else buttons.current.delete(cell.clueId);
                    }}
                    type="button"
                    className={className}
                    disabled={disabled}
                    tabIndex={cell.clueId === tabStop ? 0 : -1}
                    onFocus={() => setFocusedClue(cell.clueId)}
                    onKeyDown={(event) => onCellKeyDown(event, { col: columnIndex, row: rowIndex })}
                    onClick={() => onSelect(cell.clueId)}
                    aria-label={`${category.title} for ${value}${wager ? ", wager clue (Hot HAM)" : ""}`}
                  >
                    <span className="board__value">{value}</span>
                    {wager ? (
                      <span className="board__hot" aria-hidden="true">
                        Hot
                      </span>
                    ) : null}
                  </button>
                );
              }
              return (
                <div key={cell.clueId} className={className}>
                  <span
                    className="board__value"
                    aria-hidden={cell.state === "completed" ? true : undefined}
                  >
                    {value}
                  </span>
                  {cell.state === "completed" ? (
                    <span className="board__done" aria-hidden="true">
                      done
                    </span>
                  ) : null}
                  {cell.state === "active" ? (
                    <span className="board__now" aria-hidden="true">
                      now
                    </span>
                  ) : null}
                  {wager && cell.state !== "completed" ? (
                    <span className="board__hot" aria-hidden="true">
                      Hot
                    </span>
                  ) : null}
                  <span className="sr-only">
                    {cell.state === "completed" ? `${value}, ` : ""}
                    {STATE_WORD[cell.state]}
                    {wager ? ", wager clue" : ""}
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
