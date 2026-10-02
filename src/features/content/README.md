# Fante's content module

Start with [Fante's guide](../../../docs/pointers/fante/README.md). `content-starter.tsx` is the `/editor` onboarding screen, not the F0 validator or a working editor.

## F0 content validation

The v2.0.0 schema, pure validator and server-only sample loader are implemented. The user approved preserving this format, including five scoring tiers and a required `finalJeoparty` entry per category. It remains a proposed integration contract: Happy and John still need to review it for real consumers. No engine exists, and no F0 or milestone completion is claimed.

- `types.ts` defines the version **2.0.0** content contract and the discriminated `ValidationResult` union.
- `validate-pack.ts` exports the pure `validateQuestionPack(input: unknown)` validator.
- `index.ts` re-exports the contract and validator, plus `parseQuestionPackJson(json)` for JSON text. Invalid JSON returns an error at `$`; valid JSON goes through the same validator.
- `validate-pack.test.ts` covers validator edge cases using the expanded pack. `sample-packs.test.ts` checks the small pack, ID uniqueness across both packs, non-mutation, and representative invalid variants with exact field paths. Both read JSON with Node file I/O; the contract and validator do not import packs or expose them through a route.
- `load-sample-pack.server.ts` imports `server-only` and reads the small sample through the same parser. It is not exported from the universal `index.ts`.
- `load-sample-pack.test.ts` checks filesystem behavior. `verify-server-boundary.mjs` checks the actual Next compiler boundary without a marker mock.

### Sample inventory

| File | Ordinary board | Required reserved finals | Purpose |
|---|---|---|---|
| [`samples/sample-pack-3x3.json`](samples/sample-pack-3x3.json) | 3 categories × 3 clues = 9 | 3 | Standalone small content fixture for future ordinary-game consumers |
| [`docs/sample-pack.json`](../../../docs/sample-pack.json) | 12 categories × 5 clues = 60 | 12 | Existing expanded content and validator fixture; unchanged |

The small pack uses tiers 1–3, with points 200, 400 and 600. Its scoring table also includes tiers 4–5 at 800 and 1000, as v2 requires. Each `finalJeoparty` entry is labeled **reserved future content**; it is not one of the nine ordinary clues. Keeping these required fields does not implement final-round gameplay or change the proposed ordinary first release.

These are answer-bearing content files, not public presentation examples or a playable game. They contain no live fields or credentials and are not exported from `index.ts` or imported by UI modules. The small pack has a server-only developer loader; live consumer integration and role filtering remain separate handoffs.

```ts
import { parseQuestionPackJson } from "@/features/content";

// jsonText must come from a server-side source controlled by John's boundary.
const result = parseQuestionPackJson(jsonText);
if (result.ok) {
  // result.data is a QuestionPack for a future server-side engine.
} else {
  // Each error has an exact field path and a readable message.
  console.error(result.errors);
}
```

### Validation rules

- Required root fields: `schemaVersion: "2.0.0"`, non-blank `id` and `title`, positive integer dimensions, scoring, and categories. Description and custom-pack status are optional.
- Dimensions describe the actual data, not a hardcoded 12×5 board. Smaller packs such as 3×3 are supported. Every category must have exactly `cluesPerCategory` clues and one `finalJeoparty` object.
- Standard clues require non-blank IDs/prompts/answers and integer tiers 1–5. Final clues require `tier: "final"`. Clue IDs are opaque: legacy numeric suffixes never determine points.
- All defined pack, round, category, standard clue, and final clue IDs are globally unique. Duplicate errors also identify the first definition. IDs and content are not trimmed, coerced, or rewritten.
- Every scoring round defines positive safe integer points for all five tiers. The default round must reference a defined round ID. The engine chooses the active round; the validator does not award points or implement final wagers.
- F0 accepts omitted `type` (meaning text) or `type: "text"`. Reserved media and Daily Double types are rejected until their later gameplay contracts exist. Static clue `points` and `defaultPoints` are rejected in this strict tier-based contract; no legacy migration is performed.
- Optional `author`, `notes`, `tags`, and `metadata` fields are checked when supplied. Unknown extension fields are preserved, not interpreted as gameplay or rendered as media.
- Live-state keys (`scores`, `buzzers`, `used`, `currentClue`, `players`, `credentials`, `usedClues`) are rejected recursively, including inside extensions. Cycles are rejected. Root errors use `$`; field errors use paths such as `categories[0].clues[1].prompt`.
- Success returns the original object. The engine/loader must arrange the running game's fixed copy; this validator neither freezes nor owns live state.

### Boundary and handoff

Import the loader directly from `@/features/content/load-sample-pack.server` in server code only. `loadSamplePack()` reads `src/features/content/samples/sample-pack-3x3.json` relative to the project working directory. Its optional `filePath` is developer-controlled, including in tests. **Never take this path from a player or other untrusted caller without John's permission/loading boundary.** This is not an upload, storage or authorization API.

Every call reads and validates the file again and returns a fresh parsed object; there is no shared pack cache. Invalid JSON or schema returns the existing validation errors. Filesystem failures reject without being replaced by an empty or successful pack. Happy and John still own the fixed copy used by a running game.

**Do not import answer-bearing packs into `content-starter.tsx`, client components, or public assets.** No route or UI calls the loader. John still owns loading permissions and role-filtered delivery; Happy reviews the engine input. Their integration and team scope approval remain separate work. The expanded fixture does not change the proposed first-release board size or implement Final Jeoparty gameplay.

### Checks and their limits

The loader tests mock `server-only` locally because Vitest does not provide Next's compiler alias. They execute the real filesystem loader but **do not prove server-only enforcement**. No dependency or global test alias was added.

The executable boundary check copies the real loader, parser, validator, types and small sample into a unique temporary Next project under `/tmp/opencode`, symlinking the repository's installed dependencies. It runs the repository's Next Turbopack compiler with the current Node executable, without mocks or package installs. Only the temporary fixture gets a filesystem-root setting so Turbopack can follow the dependency symlink; no aliases or import rules are changed.

A server page must build and prerender only the clue count `9`, and its file trace must include the sample JSON. A subsequent client page importing the loader must fail with a `server-only` / Client Component diagnostic. The script fails if either expectation is unmet and removes its fixture by default. It never edits the real app, changes repository configuration, or uses the repository's `.next` directory.

From the workspace root with Node 24 and npm 11:

```sh
npm test -- src/features/content
node src/features/content/verify-server-boundary.mjs
```

Combined verification passed `npm run check`: lint, typecheck, all 97 tests, and
the production build. The executable server/client boundary check also passed.
A scan of the 12 production client JavaScript assets found neither the small
pack's ID nor any of its 12 answer strings.

These checks do not prove deployment packaging, engine compatibility,
role-filtered delivery, or gameplay integration. Happy and John still need to
review the contract and connected path before F0 can be accepted.
