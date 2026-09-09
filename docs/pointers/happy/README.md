# Happy — engine & rules

**Outcome:** every accepted action produces the right game result, regardless of which screen sent it.

Follow the [shared agent instructions](../README.md#shared-instructions-for-every-guide). The [ordinary clue rules](../../PROJECT.md#ordinary-clue-rules) define behavior; this guide defines your implementation slice.

## Your boundary

- Own game phases, legal actions, buzz eligibility, attempts, clue completion, score calculations, and rule tests.
- John owns identity verification, command ordering/retries, transport, and storage. Screen owners request actions and display results; they do not reimplement your rules.
- Keep the engine independent of UI and network frameworks. Accept validated content from Fante and a server-verified actor/action from John.

## Start here

- `src/features/engine/README.md` — your module; currently README only, no rules implemented.
- `src/app/workbench/engine/page.tsx` — informational route; a thin wrapper, not game logic.

The scaffold starter does not fulfill H1.

## Before implementation — milestone 0

With Fante, agree on pack inputs. With John, define the smallest state/action/result interface: allowed actor, allowed phase, required identifiers, rejection reason, and effect. Include active clue/attempt identity and example states for the three screen owners.

Supply the minimal transition needed for John's authority proof; it is not the full game engine. Agree on who implements each shared file. If that proof already provides part of H1, reuse and complete it rather than starting again.

**Ready for H1 when:** scope and rule choices are agreed, the scaffold/checks exist, the interfaces are accepted by their consumers, and milestone 0 has passed.

## First task — H1: accept one eligible buzz (milestone 1)

Implement the engine transition for buzzing on an active ordinary clue, using the agreed interface. It receives actions in order; it does not choose network ordering or trust phone timestamps.

**Acceptance checks:**

- With buzzers closed, a buzz is rejected and state is unchanged; no early-buzz penalty is added.
- With buzzers open, an eligible player's buzz makes that player the answering player and closes buzzing.
- A later competing buzz is rejected without replacing the winner.
- A player who already attempted this clue cannot win another attempt on it.
- An action for a different or completed clue is rejected; buzzing never changes scores.
- Focused tests exercise these cases without requiring a browser or live database.

**Handoff:** John can call the transition through his ordered command path. Scarlet, Ivvy, and Medchu receive agreed examples of closed, open, and answering states. **Suggested reviewer:** John, with Scarlet checking the meaning of player states.

## Next slices — select separately

| Milestone | Slice | Proof to provide |
|---|---|---|
| 1 | Select/read, judge, reopen, reveal, return to board | Correct/incorrect scoring and negative totals; stale/repeated judgments cannot change another attempt; completed clues stay completed |
| 2 | Integrate real player actions with John | Competing requests yield one winner; retries cause no repeated score effect |
| 3 | Finish the board and allow score correction | Tied winners; correction records a reason without rewinding clue progress |
| 4–5 | Restore state; later expand rounds and special rules | Tests for each agreed feature before the next starts |

Timers, Daily Doubles, Final Jeopardy, teams, and general undo are not part of H1. Do not define their missing rules now.

## Give this to your agent

```text
I am Happy. Read AGENTS.md, docs/pointers/README.md, and docs/pointers/happy/README.md, following their shared-doc links.
Inspect the current code and milestone. Target H1 only if its prerequisites are met; otherwise identify my milestone-0 preparation and blockers.
Propose the smallest plan, owned files, acceptance tests, and handoff to John and the screen owners. Wait for my approval before implementing.
```
