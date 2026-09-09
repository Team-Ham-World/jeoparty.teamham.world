# Medchu — host controls

**Outcome:** the host can run a game through clear controls without editing data or guessing whether an action succeeded.

Follow the [shared agent instructions](../README.md#shared-instructions-for-every-guide) and the [ordinary clue rules](../../PROJECT.md#ordinary-clue-rules).

## Your boundary

- Own host lobby/dashboard interactions: start, select, open/reopen, judge, reveal, return, and later score correction.
- Happy validates actions and calculates their effects. John verifies host permissions and delivers the host view.
- Private host data belongs only in the authorized host view. A host-looking screen or hidden button is not a permission check.

## Start here

- `src/features/host/host-starter.tsx` — your starter component.
- `src/app/host/page.tsx` — your route; a thin wrapper around the starter.

The scaffold starter is honest placeholder UI with no game features; it does not fulfill M1.

## Before implementation — milestone 0

With Happy and John, agree on the host view, command acknowledgments, and legal controls for each phase. Judgment must identify the current clue and answering attempt, not just the player's name.

Review public-display handoffs with Ivvy and shared control styles with the other screen owners.

**Ready for M1 when:** milestone 0 has passed, the host module is assigned, and host-view/judgment interfaces are agreed. Use a labeled fixture preview while the real engine path is being connected.

## First task — M1: judge the current attempt (milestone 1)

Build the judging panel: current clue, current answering player, and correct/incorrect actions. Wire it to the agreed command interface without changing scores inside the component.

**Acceptance checks:**

- Correct/incorrect controls are available only when the host view permits judging a current attempt.
- A judgment sends the agreed clue/attempt identifiers and selected verdict; it does not send a client-calculated score total.
- While awaiting a result, repeated clicks do not create additional judgments. The transport handles retries with the original command identity.
- Success renders the newly confirmed state. Rejection displays useful feedback rather than pretending the judgment succeeded.
- If the current attempt changes, a response to the previous request cannot overwrite the newer view. Use John's ordered-update interface.
- Offline controls are disabled; keyboard access, labels, and pending/error behavior are tested.

**Handoff:** Happy's rules apply the verdict; John authorizes the request; Ivvy and Scarlet display its outcome. **Suggested reviewer:** Happy, with John checking command integration.

## Next slices — select separately

| Milestone | Slice | Proof to provide |
|---|---|---|
| 1 | Select/read, open/reopen, reveal, return controls | Host can complete the ordinary clue sequence; illegal actions are unavailable and server rejections remain visible |
| 2 | Host lobby/start and live room connection | Only the authorized host can operate the room; player requests cannot gain host powers |
| 3 | Score correction and refresh recovery | A reason is required; confirmed correction does not rewind clue progress; refreshed host sees current state |
| 5 | Add controls for each expanded mode | Every control maps to an agreed engine action and private host view |

General undo/redo, timer controls, player removal, and special-round administration are not part of M1.

## Give this to your agent

```text
I am Medchu. Read AGENTS.md, docs/pointers/README.md, and docs/pointers/medchu/README.md, following their shared-doc links.
Inspect the current code and milestone. Target M1 only if its prerequisites are met; otherwise identify my milestone-0 preparation and blockers.
Propose the judging panel, command inputs, owned files, and pending/error tests. Keep scoring and authorization outside my UI. Wait for my approval before implementing.
```
