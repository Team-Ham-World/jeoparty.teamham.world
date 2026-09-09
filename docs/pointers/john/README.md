# John — network, persistence & integration

**Outcome:** every screen receives the right confirmed state, and concurrent or repeated requests cannot corrupt the game.

Follow the [shared agent instructions](../README.md#shared-instructions-for-every-guide). The [runtime decision](../../PROJECT.md#technical-direction) is still open; these instructions do not select a new backend for you.

## Your boundary

- Own shared setup, room identity/permissions, ordered command execution, retries, filtered views, realtime delivery, reconnect, and later durable storage/deployment.
- Happy supplies game transitions; Fante supplies validated content. Do not duplicate their rules in handlers or database adapters.
- Coordinate integration with each screen owner; you are not responsible for implementing their screens or fixing all integration work alone.

## Before implementation — milestone 0

Review the installed starter and pending scope decisions with all six. Node 24, npm, Vitest, and the initial folders are already configured; coordinate any changes to that shared setup. With Happy, plan the smallest authority experiment; do not build both backend options as production systems.

**J0 handoff:** reproduce the existing setup with a teammate before closing this task. Its completion does not settle the runtime decision or authorize deployment.

## First task — J0: make the repository runnable (milestone 0)

**Status: implemented and locally checked; human handoff pending.** The scripts pass locally and member routes were browser-checked. CI has not run remotely, and teammate fresh-checkout reproduction has not been verified. Confirm the handoff—do not rescaffold. Next is the separate J1 authority proof.

**Acceptance checks:**

- The app starts locally using the documented commands and shows a minimal starter page.
- Lint, typecheck, test, and build scripts exist and run successfully. Include a small real smoke test, not an empty suite reported as success.
- README setup matches the actual package manager, required runtime, and scripts. Include safe environment-variable examples only where needed; no real secrets.
- Another teammate can follow setup from a fresh checkout after the change is shared and reproduce the checks.
- Module ownership is recorded in Team using the actual scaffold paths; no duplicate app foundations or speculative services are created.

**Handoff:** all five teammates can use the same commands and assigned modules. **Suggested reviewer:** Happy; have a second teammate reproduce setup. J0 alone does not complete milestone 0.

## Start here

- `src/features/network/README.md` — your module; currently README only, no backend.
- `src/app/workbench/network/page.tsx` — informational route; a thin wrapper, not transport.
- Root configs, `.github/workflows/checks.yml`, `src/test/` setup, and the starter routes — coordinated by you; verify them rather than rebuilding.

The scaffold starter does not fulfill J1 or any milestone-1 slice.

## Next slices — select separately

| Milestone | Slice | Proof to provide |
|---|---|---|
| 0 — J1 | Prove one authority path with Happy, then record the agreed runtime | Two competing actions yield one accepted winner; duplicate command has one effect; unauthorized action is rejected. Use a minimal controlled test actor setup, not a claim that production identity is finished |
| 1 | Connect a validated pack, real engine, host/player test actions, and display | One ordinary clue works end to end; simulated sessions are labeled and kept out of deployed access paths |
| 2 | Real rooms, credentials, command delivery, filtered views | Actor comes from verified credentials; room code is not host permission; player/display responses and updates exclude unrevealed answers and tokens |
| 2 | Exercise contention, retries, and stale updates | Stable command IDs prevent duplicate effects; stale judgments fail; increasing revisions stop older updates replacing newer ones |
| 3 | Refresh/reconnect and hosted playtest, with deployment approval | Same identity/score returns while the backend runs; fresh snapshot before actions resume; unavailable games show an error rather than silently resetting |
| 4 | Pack storage, then durable active-game recovery | Acknowledgment/durability behavior is documented; backend restart preserves acknowledged progress; save failures are tested |

Agree with Happy and consumers on command payloads/results and the three client views before implementation. Credentials remain separate from public player records. Apply filtering to command responses, updates, and reconnect snapshots—not just initial page data.

OAuth, chat, multiple production backends, and backend-restart guarantees are not part of J0. Do not make extra infrastructure a prerequisite for a runnable starter.

## Give this to your agent

```text
I am John. Read AGENTS.md, docs/pointers/README.md, and docs/pointers/john/README.md, following their shared-doc links.
J0 is implemented and locally checked: reproduce the existing setup against its acceptance checks and report remaining handoff gaps. Do not rescaffold.
Then propose the minimum J1 authority proof with Happy as separate work. Keep the runtime decision open and do not silently choose a backend. Wait for my approval before implementing.
```
