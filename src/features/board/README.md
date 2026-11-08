# Board

`BoardGrid` draws the categories × values grid from the contract's
`BoardView` (`src/features/engine/contract.ts`). It never decides anything:
values, cell state (`available` / `active` / `completed`) and, for the host
only, `wager` come from the view.

| Variant | Where | Notes |
|---|---|---|
| `stage` | TV (`DisplayScreen`) | Paper slips on the ink stage; completed cells become dashed outlines with the value struck through. Read-only. |
| `host` | Host control room | Available cells are buttons when `onSelect` is passed; disabled when `selectClue` isn't allowed or the view is stale. Wager cells carry a pink "Hot" tag; completed cells read "done". The board is one tab stop: arrow keys move between open cells, Home/End jump to the first and last, Enter/Space pick. |
| `phone` | Player phone | Compact and read-only, so players can see what's left; completed cells are empty dashed slots. |

Columns line up with CSS subgrid, so category headers of different lengths
share one row height. A visually hidden h2 names the board, so the outline goes
page h1 → board h2 → category h3s. Every cell has words for its state (screen
readers hear "400, done"), not only a style.

Category titles wrap between words. Browsers don't hyphenate capitalised words,
so a Title Case word wider than a phone column (about 8 letters at 360 px with
six categories) still breaks without a hyphen.

Styles live in `board.css`. `board-grid.test.tsx` covers the keyboard movement
(`nextCell`) and the tab stop; the screens' tests (`host-judge.test.tsx`,
`display-screen.test.tsx`) cover the board in context. See the `/preview`
gallery (dev only) for every state.
