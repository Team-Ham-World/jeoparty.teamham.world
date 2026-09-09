# Team responsibilities

Each area has one accountable owner. You may pair with anyone, but the owner coordinates changes and makes sure the result works with the rest of the game.

For a starting task, acceptance checks, and a copyable agent prompt, open your [member implementation guide](pointers/README.md). Shared ownership remains defined here.

| Role | Owner | Owns | Scaffold location (J0) |
|---|---|---|---|
| 1 — Engine & rules | **Happy** | Game phases, legal actions, clue usage, scoring calculations, board control; later wagers and undo rules | `src/features/engine/README.md` only — rules absent; info route `src/app/workbench/engine/page.tsx` |
| 2 — Board & presentation | **Ivvy** | Shared TV/projector view, board, clue display, public scores, presentation and shared visual conventions | `src/features/board/board-starter.tsx`, route `src/app/display/page.tsx` |
| 3 — Player experience | **Scarlet** | Join flow, phone UI, buzzer feedback, player score display; later wager/answer inputs | `src/features/player/player-starter.tsx`, route `src/app/play/page.tsx` |
| 4 — Host controls | **Medchu** | Host lobby/dashboard, clue controls, judging buttons, recovery controls and host feedback | `src/features/host/host-starter.tsx`, route `src/app/host/page.tsx` |
| 5 — Content | **Fante** | Question-pack format, sample packs, content validation; later the pack editor and media | `src/features/content/content-starter.tsx` + `src/features/content/README.md` (no validator/editor yet), route `src/app/editor/page.tsx` |
| 6 — Network, persistence & integration | **John** | Room creation, identity/permissions, realtime delivery, authoritative server execution, reconnects, storage, deployment and integration setup | `src/features/network/README.md` only — no backend; info route `src/app/workbench/network/page.tsx` |

All routes are thin wrappers under `src/app`. Ivvy coordinates `src/components/`, `src/app/globals.css`, and `src/app/layout.tsx` with their consumers. John coordinates root configs, CI (`.github/workflows/checks.yml`), shared `src/test/` setup, and routing setup. `src/lib/team.ts` is shared onboarding metadata, not game contracts. Every screen is a scaffold: no game controls or private content. The public `/host` and `/editor` routes are guidance pages, not authorized tools.

**Scoring has three distinct jobs:** Medchu provides the judging controls, Happy owns score changes, and Scarlet/Ivvy show the resulting scores. John delivers the same authoritative result to every screen.

## How the pieces connect

1. **Fante → Happy:** a validated question pack the engine can load.
2. **Happy → everyone:** game actions, state transitions, errors, and example states for each screen.
3. **Medchu / Scarlet → John → Happy:** host/player actions go through server permission checks into the game engine.
4. **Happy → John → Ivvy / Scarlet / Medchu:** the resulting state is stored/distributed as the appropriate view for each audience.
5. **John ↔ each owner:** test the real connection together. Integration is everyone's work, not a final task handed to John.

While networking is being built, screens may use shared example states. Keep those examples aligned with the agreed interface; they are not a second implementation of the rules.

## Shared files and decisions

An **interface** is the agreed shape of data or actions passed between two parts of the app.

| Shared area | Coordinates | Consult before changing |
|---|---|---|
| Game state, actions and rule errors | Happy | John and owners of affected screens |
| Question-pack format | Fante | Happy; John when storage changes |
| Room protocol, identity, database and environment setup | John | Owners who send or receive the affected data |
| Shared UI components and visual conventions | Ivvy | Scarlet, Medchu and Fante |
| Scope, stack and milestone order | All six | Agree together before dependent work starts |

For an interface change: describe the change and affected callers in the task, get agreement from the coordinating owner and affected teammates, then update code, examples, tests, and relevant docs together. Avoid parallel edits to the same shared file.

Boundaries still hold: Happy writes game logic, not screens or database/network code; Ivvy displays state and does not decide winners, scores, or transitions; Scarlet sends player actions and does not choose the winning buzz or calculate scores; Medchu's judging UI is validated by the engine; Fante defines valid content without changing live game state or building storage; John calls the engine and does not duplicate game rules in network handlers.

## What ownership means

- Break your area into small tasks for the **current milestone**, not a separate six-week subsystem build.
- Include a reviewer and a checkable result for each task.
- Ask for help early when blocked by another area; agree on example inputs/outputs so work can continue safely.
- Demo your part working in the combined app and explain the code you accepted from AI.

Use the same [workflow](WORKFLOW.md) regardless of which AI tool you choose.
