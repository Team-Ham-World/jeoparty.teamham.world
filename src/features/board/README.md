# Board

`BoardGrid` draws the categories × values grid from the contract's
`BoardView` (`src/features/engine/contract.ts`). It never decides anything:
values, cell state (`available` / `active` / `completed`) and, for the host
only, `wager` come from the view.

| Variant | Where | Notes |
|---|---|---|
| `stage` | TV (`DisplayScreen`) | Paper slips on the ink stage; completed cells become dashed outlines with the value struck through and the word "done". Read-only. |
| `host` | Host control room | Available cells are buttons when `onSelect` is passed; disabled when `selectClue` isn't allowed or the view is stale. Wager cells carry a pink "Hot" tag. |
| `phone` | Player phone | Compact and read-only, so players can see what's left. |

Columns line up with CSS subgrid, so category headers of different lengths
share one row height. Every cell has words for its state (screen readers hear
"400, done"), not only a style.

Styles live in `board.css`. Tests that cover the board run through the screens
that use it (`host-judge.test.tsx`, `display-screen.test.tsx`); see the
`/preview` gallery (dev only) for every state.
