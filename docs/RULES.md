# HAM Quiz rules

**Status: Agreed** by the project owner on 2026-11-07, replacing the proposals in [PROJECT.md](PROJECT.md). The engine (`src/features/engine`) implements these rules, and its tests are the proof. Screens display the results and never decide them.

Wording: never use "Jeopardy", "Daily Double", or "Final Jeopardy" in product UI, copy, or new identifiers (see `organization-docs/BRAND.md`). Use **wager clue** (the UI may brand it "Hot Ham!") and **final round**.

## Roles

| Role | Who | Can |
|---|---|---|
| Host | The HAM account that created the room. Non-playing. | Configure, run, judge, correct scores, pause, end. |
| Player | 2–6 HAM accounts that joined the room | Buzz, wager when allowed, answer the final round. |
| Display | A TV/projector opened via a host-issued display link | Read-only public view. No sign-in, no commands. |

A room code alone never grants host powers. Identity is the HAM account (server-derived, never client-supplied).

## Lobby

- Signed-in accounts join with the room code or link. At most 6 players. The host cannot also be a player in their own room.
- The host chooses a pack and settings, may remove lobby players, and starts with 2–6 players.
- Accounts that join after the game starts **wait** for the next game. **Play again** returns everyone to the lobby with scores reset and adds waiting accounts while seats remain.

## Settings (host, lobby only)

| Setting | Default | Bounds |
|---|---|---|
| `categoriesPerRound` | min(6, pack categories) | 1–6 and ≤ pack categories ÷ rounds |
| `rounds` | 2 if the pack has ≥ 2 × categoriesPerRound categories, else 1 | 1–2 |
| `wagerClues` | `[1, 2]`, clamped to available cells | each 0–3, ≤ cells in that round |
| `finalRound` | `true` | — |
| `fairBuzzing` | `true` | boolean, independent of lockout |
| `falseStartLockout` | `true` | boolean, independent of fair buzzing |
| `timers.enabled` | `true` | — |
| `timers.buzzWindowMs` | 10 000 | 3 000–60 000 |
| `timers.answerWindowMs` | 10 000 | 3 000–60 000 |
| `timers.finalAnswerMs` | 45 000 | 10 000–180 000 |

Changing the pack resets settings to that pack's defaults.

## Boards

- Round `r` (0-based) uses pack categories `[r·C, (r+1)·C)` where C = `categoriesPerRound`. Each column shows all of its category's clues ordered by tier, then pack order.
- Values: round 0 uses the scoring round `defaultRoundId`. Round 1 uses the first *other* scoring round in pack order, otherwise the default values × 2. A clue's value is `pointsByTier[clue.tier]` of its round. Clue IDs never determine points.
- Wager clues: `wagerClues[r]` cells per round, placed by the game's seeded random generator, preferring cells that are not the round's lowest tier. Players and the display cannot see where they are until selected. The host can.
- Final round clue: the `finalClue` of the first pack category not used on any board. If every category is used, use a seeded-random used category's final clue.
- The running game keeps a fixed copy of the pack. Editing a saved pack never changes a game in progress.

## Control

The **controller** picks the next clue; the host clicks it for them and the display shows "*Name* picks". Round 1 starts with a seeded-random player; each later round starts with the lowest score (ties: earliest join). A correct judgment makes the answering player the controller. Incorrect answers do not change control.

## Standard clue

Stages: `reading → open → answering → closed ⇄ open → revealed`.

1. **Select** (host, board, available clue) → `reading`. The prompt is public; the answer is host-only; buzzers are closed.
2. **Open buzzers** (host, `reading`, or `closed` when eligible players remain) → `open`. With Fair buzzing on, the server schedules `opensAt` in server time. The lead is the largest connected eligible player's one-way p90 RTT estimate plus 60 ms, clamped to 120–400 ms. No samples means 300 ms RTT. Phones and the TV light at `opensAt` using their clock offset, or immediately if the view arrives late. The buzz timer starts at `opensAt`.
3. **Buzz** (player, `open`, no earlier attempt on this clue):
   - With Fair buzzing off, the first buzz the server processes wins immediately → `answering`, as before.
   - With Fair buzzing on, the phone sends `reactionMs` measured with its monotonic clock from when its buzzer actually lit, plus `falseStart`. The server records arrival at the start of the socket handler, before authentication or room queuing. Effective press time is `opensAt + reactionMs`, clamped between `arrival − uplinkBound − 40 ms` and `arrival`. The uplink bound is half that connection's p90 RTT, capped at 250 ms. Slower connections receive compensation only up to that cap. A buzz arriving earlier than `opensAt − 40 ms` is rejected. Arrivals within 40 ms before opening are tolerated, with effective time clamped to arrival.
   - The first valid buzz starts collection while the stage stays `open`. The decision deadline is `max(firstArrival, min(firstArrival + 250 ms, firstEffective + largest other eligible connected uplink bound + 40 ms))`. Bounds come from the server when the first buzz arrives. Each player gets one candidate. Arrivals through the deadline may join, even if authentication finishes later; later arrivals are rejected. Lowest effective time wins; equal times use socket arrival order. The answer timer starts when the decision runs. Views show the winner, runner-up margin in ms or null with one contender, and contender count, never raw reaction times.
   - With False-start lockout on, tapping in the 1 second before the buzzer lights locks that phone for 250 ms after lighting. The eventual buzz carries `falseStart: true`. Fair mode also enforces an effective time of at least `opensAt + 250 ms`; arrivals before that point are rejected. Without Fair buzzing, the phone alone enforces lockout. Early taps during reading are remembered for 1 second; taps before a scheduled opening only count in its final second. This is a friends-only rule: a modified client can hide false starts or lie about reaction time within the server's physical bounds. RTT assumes roughly symmetric travel and cannot prove honesty.
   - Buzzes in other stages are rejected (`buzzersClosed`). Disconnection does not remove a collected candidate; no new bound is needed to decide it. Disconnected players are excluded from lead and collection-bound calculations. A player with no samples uses the default bound.
4. **Judge** (host, `answering`, must name the current clue and attempt): correct adds the value, makes the player controller, and closes buzzing (`closed`). Incorrect subtracts the value, locks the player out of this clue, and moves to `closed`; the host may reopen while eligible players remain. Negative scores are allowed.
5. Timers: buzz-window expiry moves `open → closed`. Answer-window expiry marks the attempt **timed out** for display; the host still judges it.
6. **End attempts** (host, `reading`/`open`/`closed`) → `closed` with no more buzzes. Not allowed while `answering` or collecting (judge first).
7. **Reveal** (host, `reading`/`open`/`closed`) → `revealed`; the answer becomes public. Not allowed while `answering` or collecting.
8. **Return to board** (host, `revealed`) marks the clue completed. When the round has no available clues, play moves to the next round's intro, the final round, or results.

## Wager clue

Stages: `wager → answering → closed → revealed`.

- Selecting a wager cell → `wager`. Public views show the category, value slot, and controller, but **not** the prompt.
- The controller (or the host on their behalf) submits an integer wager from **5** to **max(controller score, highest clue value on the current board)**. → `answering`: the prompt and wager become public; the controller is the only answerer; the answer timer starts.
- Judge ±wager. Control stays with the controller either way. Then reveal and return to board as normal.
- **Cancel:** the host may end attempts during `wager` (for example, the controller is gone): no score change, → `closed`.

## Final round

Starts after the last ordinary round when `finalRound` is on. **Eligible:** players with a score > 0 at that moment. If nobody is eligible, skip to results. Eligibility, wager limits, and reveal order use scores captured at the start of the final round; later score corrections do not change them.

1. `wagers`: the category is public, the prompt hidden. Each eligible player submits an integer wager 0–score, changeable until locked. No timer. Everyone sees *who* has submitted, never amounts.
2. **Show final clue** (host) locks wagers (missing → 0) → `answering`. The prompt is public and the final answer timer starts when timers are enabled. Players type answers (≤ 200 characters, editable until locked).
3. **Lock answers** (host) or timer expiry → `judging`. Missing answers are empty.
4. `judging`: responses go in ascending order of score at the start of the final round (ties: later joiner first). The host must **reveal the next response** (its text becomes public), then **judge** it (±wager; the wager becomes public). Out-of-order requests are rejected.
5. After the last judgment → `done`: the correct answer is public. **Finish** (host) → results.

## Results and ending

Standings sort by score. Every player with the top score wins (shared win), even if it is zero or negative. The host may **end game** at any time during play (straight to results), then **play again**.

## Pause, presence and recovery

- Host **pause/resume** any time after start. While paused, timers freeze with their remaining time, and every gameplay command except resume, score correction, and end game is rejected (`paused`). Server-only presence, membership, rename, and recovery commands still run; timer expiry is rejected while paused.
- Pausing during collection freezes the candidates and decides the winner immediately on resume, with a fresh answer timer. No candidates are added while paused. Pausing before `opensAt` preserves the remaining lead. Resuming an open window without candidates schedules a fresh opening after that remaining lead, restarts phone reaction measurement, and preserves the remaining buzz time. A restart follows the same rules, frozen at the last saved command time; transport latency samples start fresh. Older saved games receive the two default-on settings.
- If the host's last connection drops during a game, the game auto-pauses (`hostOffline`). Resuming is always the host's explicit action.
- Player disconnects are shown but do not change the game; the host decides whether to wait, judge, or end attempts. Voluntary departure removes lobby and waiting members immediately. During play, retain the player's scores and attempts through results, mark them disconnected, and free their seat on play again. Reconnecting before then cancels the departure.
- After a backend restart, games in progress are restored **paused** (`restored`), with scores, clue progress, and remaining timer time intact. Acknowledged actions are saved before they are acknowledged or broadcast.
- Clients ignore views with older revisions, show *offline/stale* while disconnected, and disable game actions until a fresh view arrives.

## Score correction

The host may add or subtract a non-zero integer (|delta| ≤ 100 000) with a reason (1–120 characters) at any point after start, including while paused and on results. It is logged and never undoes clue progress or reopens attempts. There is no general undo.

## Commands and safety

- Every client command carries a unique id. Retrying the same id never applies it twice; the server replays the first outcome.
- Clue-stage commands name the clue (and attempt) they target, so a delayed request cannot affect a different clue.
- Rejected commands never change state or the revision. Every accepted command increments the revision by exactly one.
