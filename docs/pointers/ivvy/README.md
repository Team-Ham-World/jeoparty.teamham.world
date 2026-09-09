# Ivvy — board & presentation

**Outcome:** people watching the shared screen can follow the game and read clues and scores comfortably.

Follow the [shared agent instructions](../README.md#shared-instructions-for-every-guide) and the [visual baseline](../../PROJECT.md#visual-baseline).

## Your boundary

- Own the read-only board, clue/reveal display, public scores, results presentation, and small shared visual conventions.
- Happy owns game outcomes; John provides the filtered public view. Medchu owns selectable host controls.
- Render only the public view. Never import the full pack or private engine state into display components, even to hide its answers with CSS.

## Start here

- `src/features/board/board-starter.tsx` — your starter component.
- `src/app/display/page.tsx` — your route; a thin wrapper around the starter.
- `src/components/starter-home.tsx`, `src/components/starter-panel.tsx`, `src/app/globals.css`, `src/app/layout.tsx` — shared UI you coordinate with Scarlet, Medchu, and Fante as consumers.

The scaffold starter is honest placeholder UI with no game features; it does not fulfill I1.

## Before implementation — milestone 0

With Happy and John, review public-view examples for reading, buzzing, answering, reveal, and results. Confirm that unrevealed answers are absent, not merely invisible.

Agree on basic colors, typography, focus styles, and reusable controls with Scarlet and Medchu. Start with what the first screens need; do not scaffold a large design system.

**Ready for I1 when:** milestone 0 has passed, your display module is assigned, and the public-view examples and basic styles are agreed.

## First task — I1: show a clue and its reveal (milestone 1)

Build a read-only display component for a selected clue. Use agreed public-view fixtures until John's live delivery is ready. Any fixture preview must be clearly labeled and separate from production gameplay controls.

**Acceptance checks:**

- A reading view displays the category, clue value, and prompt, with no answer available in its input.
- A reveal view displays the answer supplied by the server; the component does not reveal it on a local timer.
- Open-buzzer and answering views communicate their status in text, including the answering player's name when present.
- Long prompts wrap without hiding essential information; try a typical shared-display size and a smaller browser window.
- Presentation is read-only: clicking or animation cannot change game state.
- Component checks cover reading versus reveal; report manual readability and contrast checks.

**Handoff:** John supplies the same view through live updates; Medchu's actions drive it in the connected demo. **Suggested reviewer:** Medchu; John checks the data boundary.

## Next slices — select separately

| Milestone | Slice | Proof to provide |
|---|---|---|
| 1 | Add the ordinary board and public scores | Completed clues are visibly unavailable; confirmed scores render correctly, including negatives |
| 2 | Connect live display updates | Separate display follows host/player outcomes without receiving unrevealed answers |
| 3 | Add results and stale/offline presentation | Ties display correctly; disconnected state is obvious and fresh state restores the view |
| 5 | Add views for each expanded mode | Presentation follows the agreed server phase, never its own animation timing |

Sound effects, elaborate transitions, team layouts, and special-round screens are not part of I1.

## Give this to your agent

```text
I am Ivvy. Read AGENTS.md, docs/pointers/README.md, and docs/pointers/ivvy/README.md, following their shared-doc links.
Inspect the current code and milestone. Target I1 only if its prerequisites are met; otherwise identify my milestone-0 preparation and blockers.
Propose a small read-only display change, its view inputs, owned files, and visual/component checks. Wait for my approval before implementing.
```
