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
*/

export type BoardVariant = "stage" | "host" | "phone";

const STATE_WORD = { available: "open", active: "now playing", completed: "done" } as const;

function isWagerCell(cell: BoardCellView): cell is HostBoardCellView {
  return "wager" in cell && (cell as HostBoardCellView).wager === true;
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
  const rows = Math.max(1, ...board.categories.map((category) => category.cells.length));
  return (
    <div
      className={`board board--${variant}`}
      style={{ "--cols": board.categories.length, "--rows": rows } as React.CSSProperties}
      role="group"
      aria-label={label ?? `${board.roundTitle} board`}
    >
      {board.categories.map((category, columnIndex) => {
        const headingId = `board-${variant}-${board.roundIndex}-${columnIndex}`;
        return (
          <section key={category.id} className="board__col" aria-labelledby={headingId}>
            <h3 id={headingId} className="board__cat">
              <span>{category.title}</span>
            </h3>
            {category.cells.map((cell) => {
              const wager = isWagerCell(cell);
              const value = formatScore(cell.value);
              const className = `board__cell board__cell--${cell.state} ${wager ? "board__cell--wager" : ""}`;
              if (onSelect && cell.state === "available") {
                return (
                  <button
                    key={cell.clueId}
                    type="button"
                    className={className}
                    disabled={disabled}
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
