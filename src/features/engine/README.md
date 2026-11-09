# HAM Quiz engine

`engine` implements `EngineApi` from `contract.ts`. It has no framework, Node,
network, storage, wall-clock, or unseeded randomness dependencies. Pass the
server clock to each call. Process commands serially and persist an accepted
state before acknowledging it. Command-ID deduplication belongs to the server.

- `state.ts`: private JSON state, including RNG, boards, submissions and timers.
- `rules.ts`: settings, seeded board construction, scoring and progression.
- `commands.ts`: actor permissions, stage validation and command transitions.
- `views.ts`: explicit host, player and display projections and action flags.
- `restore.ts`: persisted structure and reference validation, then paused recovery.
- `engine.ts`: immutable command boundary and exported API.

Rejected commands discard their draft without changing state or revision.
Accepted commands increment the revision once. Views are detached copies;
public projections never include future wager locations or unrevealed answers.
The host sees final submissions as they arrive. Players see only their own
submissions until the host reveals and judges responses in order.

Timers use unique revision-based IDs. Resume replaces the timer ID and computes
a new deadline from frozen remaining time. Restore freezes time at the last
accepted command, since `restore` has no clock argument and process downtime
must not consume the answer window. The server sends `restored` on restart and
reschedules `nextDeadline` after every accepted command.

A voluntary departure during play keeps the score and attempts through results,
then frees the seat on play again. Server presence and membership maintenance
remain available while paused. Neither reconnect nor recovery auto-resumes play.

Run `npm test -- src/features/engine` for deterministic games using both bundled
packs, permissions, scoring, timers, privacy, and persisted-state checks.
The agreed behavior is in `docs/RULES.md`.
