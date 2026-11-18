# Board

`BoardGrid` renders the categories and values from the engine's
`BoardView` (`src/features/engine/contract.ts`). Cell values and states
(`available`, `active`, `completed`) come from that view. The engine
includes the `wager` flag only for the host.

| Variant | Where | Notes |
|---|---|---|
| `stage` | TV (`DisplayScreen`) | Read-only violet tiles on the dark stage, with large values and muted, hatched slots for played clues. |
| `host` | Host desk | Violet tiles with a "Hot" marker for hidden wager clues and hatched played slots. Available cells are buttons when `onSelect` is passed. Selection requires a fresh view and permission to use `selectClue`. |
| `phone` | Player handset | Compact and read-only, with empty dashed slots for played clues. The picker calls out the category and value and the host makes the selection. |

The host board is one tab stop. Arrow keys move between open cells, Home and End
jump to the first and last open cells, and Enter or Space selects the clue.

Columns line up with CSS subgrid, so category headers of different lengths
share one row height. A visually hidden h2 names the board under the page h1
and above the category h3s. Cell names describe their value and state so
screen readers can distinguish a played slot.

Category titles wrap between words. Browsers don't hyphenate capitalised words,
so a Title Case word wider than a phone column (about 8 letters at 360 px with
six categories) still breaks without a hyphen.

Styles live in `board.css`. `board-grid.test.tsx` covers the keyboard movement
(`nextCell`) and the tab stop; the screens' tests (`host-judge.test.tsx`,
`display-screen.test.tsx`) cover the board in context. See the `/preview`
gallery (dev only) for every state.

[Design system](../../../DESIGN.md#shared-game-components)
