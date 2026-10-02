# Fante's content module

Start with [Fante's guide](../../../docs/pointers/fante/README.md). `content-starter.tsx` is the `/editor` onboarding screen, not the F0 validator or a working editor.

## F0 content validation

- `types.ts` defines the version **2.0.0** content contract and the discriminated `ValidationResult` union.
- `validate-pack.ts` exports the pure `validateQuestionPack(input: unknown)` validator.
- `index.ts` re-exports the contract and validator, plus `parseQuestionPackJson(json)` for JSON text. Invalid JSON returns an error at `$`; valid JSON goes through the same validator.
- `validate-pack.test.ts` reads `docs/sample-pack.json` only in Node tests. The module does not import the pack, perform file I/O, or expose it through a route.

```ts
import { parseQuestionPackJson } from "@/features/content";

// jsonText must come from a server-side source controlled by John's loader.
const result = parseQuestionPackJson(jsonText);
if (result.ok) {
  // result.data is a QuestionPack; pass it to the server-side engine.
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

This is validation, not a pack editor, media importer, engine, loader, or permission layer. **Do not import answer-bearing packs into `content-starter.tsx`, client components, or public assets.** John still owns server-only loading and filtering; Happy reviews the engine input. Their integration and team scope approval remain separate work. The expanded fixture does not change the proposed first-release board size or implement Final Jeoparty gameplay.

Checks:

```sh
npx vitest run src/features/content
npm run check
```
