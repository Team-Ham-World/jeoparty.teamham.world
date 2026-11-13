# HAM Quiz content

Packs use `schemaVersion: "3.0.0"`. Earlier versions are rejected. Import types,
`validateQuestionPack`, or `parseQuestionPackJson` from this directory's index.
These functions are pure and preserve optional metadata.

Each pack declares its dimensions, categories, and scoring rounds. Every category
has ordinary text clues with tiers 1–5 and one `finalClue` with tier `"final"`.
Every scoring round defines positive integer points for all five tiers, each at
most 1,000,000; `defaultRoundId` references one of those rounds. IDs are unique across all
pack, round, category, and clue definitions within a pack.

An ordinary or final clue may include `picture: { id, alt }`. These are the only two keys. The id must match `pic_` followed by 43 base64url characters and comes from `POST /api/pictures`. The description is a string of 0–200 characters; it may be empty. `picture: undefined` counts as absent. The prompt is still required and the pack schema version stays `"3.0.0"`.

`pictureSrc` builds the public URL. `pictureOf` copies a reference into engine state, and `pictureRefs` lists references with validator field paths. The engine's `promptView` hides pictures whenever it hides their prompt. Bytes live as JPEG BLOBs in SQLite. Exports carry references, not pictures. Importing into another account or after an unused picture is swept requires uploading the picture again.

Validation reports exact field paths. Blank required text, invalid dimensions,
unsupported clue types, static clue points, circular objects, and live game
state keys are rejected, including inside extension metadata.

Bundled packs live in `samples/`:

- `ham-starter-pack.json`: 12 categories × 5 clues, two scoring rounds.
- `sample-pack-3x3.json`: Ham Snack, 3 categories × 3 clues, one scoring round.

Both include final-round content. Prompts and question-form answers are content;
the engine owns board selection, timers, wagers, scores, and clue progress.

Answer-bearing JSON must stay on the server. `load-sample-pack.server.ts` loads
the small sample by default and accepts developer-controlled paths. The public
index performs no file I/O and imports no pack. Run
`node src/features/content/verify-server-boundary.mjs` to check Next's server-only
boundary in an isolated build fixture. Run `npm test -- src/features/content`
for validator, loader, and pack tests.
