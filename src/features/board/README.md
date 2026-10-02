# Team Ham display — local presentation preview

This is the user-approved **full presentation preview**, not a live game, an agreed
engine contract, or completion of I1 or any roadmap milestone. Milestone 0 is still
blocked on the shared scope/contracts, Happy and John’s authority proof, runtime
decision, and teammate setup confirmation.

## Try the preview

Run `npm run dev` and visit `/display`. The light **Local presentation preview**
strip contains a keyboard-accessible example chooser and a link home. It changes
examples only: no commands, gameplay progression, timers, randomness, networking,
sound, or special rounds are implemented. The board tiles are plain list items,
not selectable controls. The route stays a thin wrapper around `BoardStarter`.

Examples cover the ordinary 3 × 3 board, completed clues, negative scores, reading,
open buzzers, a named answering player, revealed answer, tied results, offline and
stale views, and long text/large scores. A warning qualifies the last supplied
status; a stale open-buzzer example does not tell viewers to buzz now.

## Public-only proposed inputs

`presentation-types.ts` contains **PROPOSED integration inputs local to this
module**, not a rival shared game-state definition. `BoardPresentation` renders its
`view` prop and never imports fixtures, a question pack, private state or transport.
Happy and John must review/replace these shapes with the agreed public view before
integration. Values, availability, score ordering, scores, answering names and
winners are all supplied. The display does not derive winners from scores, sort
standings, award points or decide clue completion.

The phase union permits an `answer` only for `reveal`. Reading, open and answering
inputs contain a category, value and prompt, not an answer. TypeScript is not a
runtime security boundary: John must filter real payloads server-side and test
their delivery. Never pass a private pack and rely on the screen hiding fields.

`preview-fixtures.ts` is invented public demo data. Its revealed example includes
an intentionally public answer, so that demo answer is available in the preview
bundle. These are not secret live questions. Do not reuse this fixture wrapper as
a live display or import private packs to populate it.

## Presentation and checks

`board.module.css` keeps the dark stage, rich blue tiles, gold values and light
preview controls local. Georgia gives clues a readable display face; local system
fallbacks require no font downloads. Layouts grow with content rather than clipping
or truncating. Narrow screens retain all three categories and stack score cards.
At desktop widths, spacing and board-row minimums use viewport height rather than
width alone, so the ordinary board and scores share one screen at 1440 × 900 and
1920 × 1080. These are minimum heights, not clipping limits: long text may scroll.
There is no animation. Status words accompany color; only the short phase and
connection status use one polite live region, not the entire board or scoreboard.

Deterministic colocated tests cover every example, privacy of unrevealed inputs,
supplied results (including an intentionally inconsistent winner to catch local
calculation), negative scores, completed clues, warnings, lack of game controls,
and chooser behavior. Run:

```sh
npm test -- src/features/board/board-presentation.test.tsx src/test/scaffold.test.tsx
```

DOM tests do not prove TV readability, actual wrapping, contrast, or keyboard
behavior in a real browser. The desktop-fit follow-up checked all nine examples
in Chromium at 1440 × 900, 1920 × 1080, 390 × 844 and 320 × 640 using a separate dev
server. All normal desktop examples (including warnings) fit; long examples and
narrow screens scroll without horizontal overflow or clipped content. Keyboard
checks covered the skip link, chooser, home link, visible focus and changing the
native select with arrow keys. Computed text contrast was at least 6.12:1 across
the background colors/gradient stops; the preview focus ring was 6.71:1.

Final verification passed `npm run check`: lint, typecheck, all 77 tests, and the
production build. The same browser harness then passed all 36 example/viewport
combinations against that production build, including keyboard and contrast checks.
Exact measurements and screenshots are under `/tmp/opencode/board-layout-evidence/`.
The harness is `/tmp/opencode/board-layout-check.mjs`. These are temporary local
evidence, not repository dependencies. Physical-projector viewing, screen-reader
speech and non-Chromium browsers remain unverified. Teammate review is still needed.

## Handoffs

- **Ivvy / Medchu:** review readability, phase copy and presentation. Shared styles
  remain unchanged and still require consumer coordination.
- **Happy / John:** agree on public inputs, server-side answer filtering, score and
  winner delivery, connection freshness semantics, and a real connected path.
- The root README now identifies the preview separately from the remaining scaffold.

Live host/player behavior, reconnect guarantees and a complete playable game are
unimplemented and unverified. No integration or milestone completion is claimed.
