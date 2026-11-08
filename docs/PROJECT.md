# Project guide

HAM Quiz is a HAM-themed browser quiz-show game: a host runs it, a shared display shows it, and players use their phones as buzzers. Prioritize **fun, reliability, easy setup, then extra features**.

The repository is named `jeoparty.teamham.world` for history; the product, OAuth client and subdomain are **HAM Quiz**, `quiz`, `quiz.teamham.world`. The org brand rule forbids trademarked names such as "Jeopardy" in product names, so the UI also never says "Daily Double" or "Final Jeopardy" (see [Rules](RULES.md#ham-quiz-rules)).

## Decisions

Labels: **Agreed** (owner decided), **Implemented** (code exists), **Verified** (checks demonstrate it).

| Decision | Status |
|---|---|
| Name HAM Quiz; slug `quiz` | Agreed 2026-11-07 |
| Full game: up to two 6×5 rounds, wager clues, final round, server timers, pause, reconnect, restart recovery, pack editor | Agreed, implemented, verified by engine, server integration, smoke and e2e tests |
| Host and players sign in with TeamHam.world; the TV uses a host-issued display link | Agreed, implemented, verified against the local fixture. Live HAM is unverified until the client is registered |
| Runtime: one persistent Node 24 service (Next.js + `/api` + `/ws`) with SQLite, deployed with Docker behind the shared Caddy on the Oracle host | Agreed, implemented. Not deployed |
| Introspection: fresh on every HTTP request, WebSocket connect and `startGame`; ≤ 30 s lease for other in-socket commands | Agreed; see [security decisions](SECURITY.md) |
| Original HAM "Cut & Paste" look; no imitation of the TV show | Agreed, implemented |
| Players 2–6, one non-playing host, verbal answers judged by the host | Agreed, implemented |

The game rules themselves live in [RULES.md](RULES.md). Change rules there first, then the engine and its tests.

## Technical boundaries

An **authoritative server** is the single place that accepts or rejects game actions and decides the resulting state.

```text
Host / player action → server identity and permission checks → engine rules
                    → saved state → the appropriate view for each screen
```

- **One rule implementation.** The engine takes state and an action and returns a result. The server runs it in order. UI code requests actions; it never awards points or picks buzz winners.
- **Safe retries.** A unique command id prevents a retry from applying an action twice. Clue-stage commands name their clue and attempt, so a delayed request cannot affect a newer clue. The server derives the actor from credentials, never from the payload.
- **Ordered updates.** Each accepted change increments the state revision. Clients ignore older revisions and get a fresh view on reconnect.
- **Private views.** Host, player and display receive different data. Answers appear publicly only after reveal. Credentials, HAM subjects and private wagers never leave the server in public payloads. Hiding a field on screen is not enough.
- **Stable content.** Packs are validated before use. A running game keeps a fixed copy; used clues and scores belong to live state, not the editable pack.
- **Honest recovery.** An action is acknowledged only after it is saved. Reconnect preserves identity and score. After a restart, games resume paused.

Keep typed definitions, examples and tests beside the code (`contract.ts`, `protocol.ts`, `connection.ts`) rather than in long documents.

## Visual baseline

HAM System A ("Cut & Paste", `organization-docs/BRAND.md`): paper, ink and surface tokens; interactive blue; decorative red only for shapes; Bricolage Grotesque headings and Atkinson Hyperlegible UI text; near-zero radii; stamps for state. The TV uses a dark ink stage for 10-foot reading. Readable text, large phone targets, keyboard access, visible focus, measured contrast (`src/features/ui/contrast.test.ts`), and state in words as well as color. Animation never delays or decides a game action, and stops under reduced motion.

## Fair buzzing handoff

The wire protocol is version 2. `GameSettings` and `SettingsPatch` add `fairBuzzing` and `falseStartLockout`, both default on and editable only in the lobby. Every audience receives these two public booleans under `view.buzzing`; the host also receives the full `view.settings`.

Every `ClueView` adds `opensAt: number | null`, in server epoch milliseconds, and `buzzResult: { winnerId: PlayerId; marginMs: number | null; contenderCount: number } | null`. `buzzResult` is set after a fair decision and cleared on reopening. Collection stays in the `open` stage. Private candidates are persisted for recovery and are never copied into a view. `can.buzz` becomes false for a player who has already submitted a candidate. The ordinary buzz countdown disappears during collection; the collection deadline still runs with game timers disabled.

Clients still send `{ type: "openBuzzers", clueId }`. Only the server adds `leadMs` for the engine. The player wire command is `{ type: "buzz", clueId, reactionMs, falseStart }`. Only the server adds `arrivalMs`, `uplinkBoundMs`, and `maxOtherUplinkMs`; the last field is the largest other eligible connected player's bound when the buzz arrives. Strict validation rejects client attempts to provide these fields.

The server sends each player connection `{ t: "probe", id, at }` every two seconds, and the socket handler immediately answers `{ t: "probeAck", id }`. It retains ten RTT samples per socket and accepts outstanding probe IDs for up to ten seconds. Unknown, expired or duplicate IDs contribute no sample. The host alone receives `{ t: "pings", pings: Record<PlayerId, number | null> }` on connection changes and successful samples. Values are median RTT in ms, or null before sampling or after disconnection. With multiple sockets for one player, the host sees the lowest socket median; timing bounds remain per socket. This data is never persisted in the game.

`RoomConnection` retains `clockOffsetMs`, now estimated from the lowest-RTT of the last ten client ping samples, and adds `rttMs: number | null` for that best sample and `pings: Record<PlayerId, number | null>`. Players and displays always have an empty `pings` map. Estimate local opening time as `view.clue.opensAt - connection.clockOffsetMs`. Existing ping/pong heartbeats and reconnect replay still run.

The phone's `useBuzzerTiming` hook owns local `lit`, `lockedOut`, and `falseStart` booleans and exposes `recordEarlyTap()` and `reactionMs()`. Reaction measurement uses `performance.now()` immediately after the lit state commits. The button captures pointer taps in its wrapper while disabled, lights at the opening, disables presses for a flagged player's 250 ms lockout, then includes the flag with the eventual buzz. It currently says "Wait", "Buzz!", "Too early!", and "Sent!" using the existing button and halo styles. The TV waits for `opensAt` before showing "Buzz now!". Plain lobby checkboxes are included. Host ping and winning-margin displays are left for the front-end work.

Timing choices are documented in [Rules](RULES.md#standard-clue): 300 ms fallback RTT, p90/2 uplink estimate capped at 250 ms, 40 ms tolerance, 120–400 ms opening lead including 60 ms delivery slack, at most 250 ms collection, and a 250 ms lockout for taps in the preceding second. These bounds limit waiting and dishonest timing gains while allowing ordinary Wi-Fi/mobile jitter. They assume roughly symmetric network travel. Clock estimates, browser scheduling and self-reported false starts cannot prove a phone is honest. Live mixed-network behavior still needs a real-device playtest.

Pause during collection preserves candidates and decides immediately on resume. Pause before opening preserves the unused lead; resuming an open window without candidates resets the reaction epoch and preserves the remaining buzz duration. Restart restores paused at the last saved game clock, including the original pause time if already paused. Old saved games receive missing default settings and empty timing fields. Transport samples start over after reconnect or restart. Protocol version 1 clients must reload.
