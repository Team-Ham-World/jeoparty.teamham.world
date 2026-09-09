# Fante — content

**Outcome:** the engine receives valid questions, and later a creator can prepare and reuse packs without editing code.

Follow the [shared agent instructions](../README.md#shared-instructions-for-every-guide) and the [content boundary](../../PROJECT.md#shared-technical-boundaries).

## Your boundary

- Own the question-pack format, validation, sample content, and later the text editor.
- Happy owns live clue usage and scores. John owns pack storage/loading permissions and server delivery.
- A pack contains content, not players, used-clue flags, scores, or credentials. Answer-bearing packs must not enter public assets or client bundles.

## Start here

- `src/features/content/content-starter.tsx` and `src/features/content/README.md` — your starter component and module notes; no validator or editor exists yet.
- `src/app/editor/page.tsx` — your route; a thin wrapper around the starter.

The scaffold starter is honest placeholder UI with no game features; it does not fulfill F0.

## Before implementation — milestone 0

Confirm the first-release board dimensions with the team. Agree with Happy on category/clue IDs, titles, integer clue values, prompts, answers, and useful validation errors. Define identifier uniqueness, empty-text handling, and allowed value constraints before encoding them.

With John, choose the server-only location and loader boundary. The loader calls your validator; it should not maintain a second validation implementation.

**Ready for F0 when:** the pack decisions are agreed, John has provided the scaffold/test runner and assigned your module, and Happy has accepted the pack input. F0 is part of milestone 0; it does not wait for milestone 0 to finish.

## First task — F0: validate and supply a text pack (milestone 0)

Implement the agreed pack type and validator with one complete small board. Supply minimal test fixtures for engine checks without claiming that a partial fixture is a valid full game pack.

**Acceptance checks:**

- A complete pack with the agreed dimensions passes and can be consumed by Happy's engine interface.
- Tests reject missing required text, duplicate IDs, non-integer values, and wrong board dimensions according to the agreed rules.
- Errors identify the invalid category/clue/field so a human can fix the content.
- Validation does not silently rewrite valid content or add live game state.
- Sample questions and answers are readable and internally consistent; Happy reviews at least one clue through the engine input.
- The pack and answers are loaded through the server-only boundary. Public example views contain only information allowed for their phase; John verifies filtering.

**Handoff:** Happy receives the valid pack and invalid test cases; John receives the validation/loader contract. Screen owners get filtered examples, not the secret-bearing file. **Suggested reviewer:** Happy; John checks loading placement.

## Next slices — select separately

| Milestone | Slice | Proof to provide |
|---|---|---|
| 1 | Support the one-clue integration demo | Engine loads validated content and screens show the expected prompt/reveal |
| 3 | Refine the complete playtest pack | All clues can be played; long text remains usable with Ivvy's display |
| 4 | Text editor, then pack save/load with John | Invalid content cannot start a game; editing a pack leaves the running copy unchanged |
| 5 | Extend content for expanded modes | New fields follow agreed rules and have validation tests |

An editor, uploads, JSON/CSV import/export, media, and special-clue fields are not part of F0. Developer-maintained test data is not an import feature.

## Give this to your agent

```text
I am Fante. Read AGENTS.md, docs/pointers/README.md, and docs/pointers/fante/README.md, following their shared-doc links.
Inspect the current code and milestone. Target F0 only if its prerequisites are met; otherwise identify the pack decisions or scaffold work I need from Happy and John.
Propose the smallest validator, server-only sample pack, owned files, and valid/invalid tests. Do not add an editor or invent unresolved schema rules. Wait for my approval before implementing.
```
