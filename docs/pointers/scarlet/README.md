# Scarlet — player experience

**Outcome:** a player can join on a phone, understand whether they can buzz, and see the server-confirmed result and score.

Follow the [shared agent instructions](../README.md#shared-instructions-for-every-guide). You own the scoring **experience**, not score calculations.

## Your boundary

- Own player join/lobby screens, mobile buzzer interaction, feedback, score display, and reconnect UI.
- Happy decides eligibility and scoring. John verifies identity, decides delivery/retry behavior, and provides the player view.
- Use John's client connection interface rather than inventing token storage, a second socket client, or local winner selection.

## Start here

- `src/features/player/player-starter.tsx` — your starter component.
- `src/app/play/page.tsx` — your route; a thin wrapper around the starter.

The scaffold starter is honest placeholder UI with no game features; it does not fulfill S1.

## Before implementation — milestone 0

Review player-view examples with Happy and John: waiting, buzzers open, request pending, you won, another player won, already attempted, and disconnected. Distinguish local “request pending” feedback from an authoritative win.

Agree on the buzz-request interface and how acknowledgments/errors arrive. Coordinate large controls, labels, and focus styles with Ivvy.

**Ready for S1 when:** milestone 0 has passed, the player module is assigned, and the view/action interfaces are agreed. A labeled fixture preview may precede real networking.

## First task — S1: build the buzzer interaction (milestone 1)

Create a player buzzer component that consumes the agreed view and calls the agreed action interface. Do not implement room joining or real transport in this same task.

**Acceptance checks:**

- Only the eligible/open state enables buzzing. Closed, already-attempted, and offline states use a genuinely disabled control with an explanatory label.
- A tap or keyboard activation sends a request; it never immediately awards a win or changes a score.
- While that request is pending, repeated activation does not generate fresh competing commands. Let John's transport own retries of the original request.
- Confirmed “you won,” “another player won,” and rejection states have distinct readable feedback, not just different colors.
- A pending request can resolve to either success or rejection without leaving the control stuck. Connection loss uses the disconnected state.
- Test enabled/disabled/pending behavior and action calls; try the component at phone width and with keyboard focus.

**Handoff:** John connects the action and view to a real player session in milestone 2. Happy checks that labels match eligibility rules. **Suggested reviewer:** Ivvy for interaction; John for integration.

## Next slices — select separately

| Milestone | Slice | Proof to provide |
|---|---|---|
| 1 | Add player score and waiting/answering views | Scores come from confirmed state, including negative totals |
| 2 | Join a room and connect real buzzing with John | Invalid/full/started rooms give useful feedback; two real phones receive the correct winner |
| 3 | Refresh and same-browser reconnect | Same player and score return; stale UI disables actions until a fresh snapshot arrives |
| 5 | Add special-round player inputs | Only after wager/answer rules and private-view contracts are agreed |

Phone clue selection, typed ordinary answers, teams, haptics, and optimistic score changes are not part of S1.

## Give this to your agent

```text
I am Scarlet. Read AGENTS.md, docs/pointers/README.md, and docs/pointers/scarlet/README.md, following their shared-doc links.
Inspect the current code and milestone. Target S1 only if its prerequisites are met; otherwise identify my milestone-0 preparation and blockers.
Propose the buzzer states, action integration, owned files, and acceptance checks without implementing networking or scoring rules. Wait for my approval before implementing.
```
