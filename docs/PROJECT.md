# Project guide

HAM Quiz is a HAM-themed browser quiz-show game: a host runs it, a shared display shows it, and players use their phones as buzzers. Prioritize **fun, reliability, easy setup, then extra features**.

The repository is named `jeoparty.teamham.world` for history; the product, OAuth client and subdomain are **HAM Quiz**, `quiz`, `quiz.teamham.world`. The org brand rule forbids trademarked names such as "Jeopardy" in product names, so the UI also never says "Daily Double" or "Final Jeopardy" (see [Rules](RULES.md#ham-quiz-rules)).

## Decisions

Labels: **Agreed** (owner decided), **Implemented** (code exists), **Verified** (checks demonstrate it).

| Decision | Status |
|---|---|
| Name HAM Quiz; slug `quiz` | Agreed 2026-11-07 |
| Full game: up to two 6×5 rounds, wager clues, final round, server timers, pause, reconnect, restart recovery, pack editor | Agreed, implemented, verified by engine, server integration, smoke and e2e tests |
| Host and players sign in with TeamHam.world; the TV uses a host-issued display link | Agreed, implemented, verified against the local fixture. The production client is registered. A full live sign-in remains unverified in the [deployment record](DEPLOYMENT.md#current-deployment) |
| Runtime: one persistent Node 24 service (Next.js + `/api` + `/ws`) with SQLite, deployed with Docker behind the shared Caddy on the Oracle host | Agreed, implemented, deployed. See the [deployment record](DEPLOYMENT.md#current-deployment) |
| Introspection: fresh on every HTTP request, WebSocket connect and `startGame`; ≤ 30 s lease for other in-socket commands | Agreed; see [security decisions](SECURITY.md) |
| Original HAM Quiz broadcast-studio design | Implemented and verified across the lobby, host, player, TV and pack editor. [Design system](../DESIGN.md) |
| Picture clues have one optional JPEG; bytes live in SQLite, URLs are public and unguessable, phones show pictures where there is no buzzer | Agreed, implemented; verified by content, engine, HTTP, socket, screen and end-to-end tests |
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
- **Private views.** The host view includes the answer key and hidden wager-clue locations. Each player receives their own private submissions and allowed inputs. The read-only display receives the public game. The engine releases answers, final wagers and responses according to the reveal rules. Credentials and HAM subjects stay out of all game views.
- **Pictures.** Packs hold picture references. The engine copies them next to the prompt and sends a picture URL only under the same visibility gate as the prompt. The host sees both throughout. The server owns uploads, ownership checks, quotas and cleanup. Anyone holding a picture URL can fetch it without signing in.
- **Stable content.** Packs are validated before use. A running game keeps a fixed copy; used clues and scores belong to live state, not the editable pack.
- **Honest recovery.** An action is acknowledged only after it is saved. Reconnect preserves identity and score. After a restart, games resume paused.

Keep typed definitions, examples and tests beside the code (`contract.ts`, `protocol.ts`, `connection.ts`) rather than in long documents.

## Room setup

The signed-in host opens setup at `/?view=create`, chooses a built-in or saved pack, and can adjust its default settings. The form submits the pack ID and optional settings patch together to `POST /api/rooms`. If the pack list is unavailable, the host can create with the server's default pack. The server resolves the pack for the account, applies the engine's defaults and validates any overrides before saving the room. On rejection, the host can correct the draft and try again.

The lobby shows the current pack and format. The host can still change the pack or edit settings before starting. Switching packs or reloading a saved pack resets the settings to that pack's defaults. Once play starts, the room uses its fixed copy. Players use the room code, join link or QR to sign in and join. The TV uses a separate host-issued display link.

## Visual baseline

The broadcast-studio design pairs cream forms and navigation with a dark TV stage for 10-foot reading. Violet panels, peach actions and short monospace status cues tie together the host desk, player handset and TV. Keep large phone targets, keyboard access, visible focus, measured contrast (`src/features/ui/contrast.test.ts`), and state in words as well as color. Game actions run independently of animation, and reduced motion stops movement. [Design system](../DESIGN.md), [approved mockup](../design/mockups/broadcast-studio.html).

## Picture clues on screen

`CluePicture` (`src/features/ui/clue-picture.tsx`) draws every clue picture uncropped in a frame that each screen sizes, so nothing moves when it loads. A failed load says "Picture didn't load". The description is reserved for alt text, so it can't give an answer away on the TV.

- **TV.** The picture sits beside the prompt at the full height of the prompt's row, as wide as a 16:9 picture needs and at most 55%. A prompt beside a picture counts double when choosing its size, with one extra smallest step. The answer row stays reserved. The small scrolling layout stacks picture and prompt. Final judging and results leave the picture out.
- **Host.** The host can see the picture even when the prompt is still private. Keep the frame compact so the answer and action bar stay in reach on a 768 px laptop.
- **Phones.** Pictures appear on wager clues once the wager is in and in the final round. Standard clues reserve the space for the buzzer.
- **Editor.** Every clue and final clue has Add, Replace and Remove, and takes a picture pasted or dropped on it. The browser re-encodes to JPEG (1600 px long edge, quality 0.82, one retry at 1200 px and 0.7) before uploading. Save waits for uploads, and a late upload never undoes a newer Remove or Replace.

## Fair buzzing handoff

The wire protocol is version 3. Version 2 clients must reload to receive picture clues. `GameSettings` and `SettingsPatch` include `fairBuzzing` and `falseStartLockout`. Both default on and the host can edit them during setup or in the lobby. Every audience receives these two public booleans under `view.buzzing`. The host also receives the full `view.settings`.

Every `ClueView` adds `opensAt: number | null`, in server epoch milliseconds, and `buzzResult: { winnerId: PlayerId; marginMs: number | null; contenderCount: number } | null`. `buzzResult` is set after a fair decision and cleared on reopening. Collection stays in the `open` stage. Private candidates are persisted for recovery and are never copied into a view. `can.buzz` becomes false for a player who has already submitted a candidate. The ordinary buzz countdown disappears during collection; the collection deadline still runs with game timers disabled.

Clients still send `{ type: "openBuzzers", clueId }`. Only the server adds `leadMs` for the engine. The player wire command is `{ type: "buzz", clueId, reactionMs, falseStart }`. Only the server adds `arrivalMs`, `uplinkBoundMs`, and `maxOtherUplinkMs`; the last field is the largest other eligible connected player's bound when the buzz arrives. Strict validation rejects client attempts to provide these fields.

The server sends each player connection `{ t: "probe", id, at }` every two seconds, and the socket handler immediately answers `{ t: "probeAck", id }`. It retains ten RTT samples per socket and accepts outstanding probe IDs for up to ten seconds. Unknown, expired or duplicate IDs contribute no sample. The host alone receives `{ t: "pings", pings: Record<PlayerId, number | null> }` on connection changes and successful samples. Values are median RTT in ms, or null before sampling or after disconnection. With multiple sockets for one player, the host sees the lowest socket median; timing bounds remain per socket. This data is never persisted in the game.

`RoomConnection` retains `clockOffsetMs`, now estimated from the lowest-RTT of the last ten client ping samples, and adds `rttMs: number | null` for that best sample and `pings: Record<PlayerId, number | null>`. Players and displays always have an empty `pings` map. Estimate local opening time as `view.clue.opensAt - connection.clockOffsetMs`. Existing ping/pong heartbeats and reconnect replay still run.

The phone's `useBuzzerTiming` hook owns local `lit`, `lockedOut`, and `falseStart` booleans and exposes `recordEarlyTap()` and `reactionMs()`. Reaction measurement uses `performance.now()` immediately after the lit state commits. The button captures pointer taps in its wrapper while disabled, lights at the opening, disables presses for a flagged player's 250 ms lockout, then includes the flag with the eventual buzz. The TV waits for `opensAt` before showing "Buzz now!".

The [buzzer](../DESIGN.md#the-buzzer), [ping chip](../DESIGN.md#ping-chip) and [winning margin](../DESIGN.md#winning-margin) present these timings during play.

- **Phone buzzer.** "Wait" changes to "Buzz!" as soon as the hook lights, without a fade or layout shift. A false start shows "Too early!" for the 250 ms lockout with the help "Locked for a moment: you tapped before it lit." and a short double vibration where supported. Once the lockout lifts, the help says "Go! You were held back for tapping early." An already ineligible phone keeps its existing state. The lobby tells players "Wait for the light." while lockout is on. `PinnedBuzzerTiming` in `buzz-button.tsx` lets previews hold these brief states.
- **Setup controls.** "Fair buzzing" and "False-start lockout" are checkbox rows in the "Buzzing" group, with each explanation available as an accessible description. They are saved with the initial setup. In the lobby, Save and Undo cover them and unsaved edits block Start. These controls are available before play.
- **Host pings.** `connection.pings` shows beside each name in the lobby roster and the game scoreboard. Show "measuring…" before the first sample and replace the ping with "away" while disconnected. A "312 ms · slow" chip above a 250 ms median warns that the phone's 90th-percentile round trip may be nearing the roughly 500 ms where compensation is capped (see `src/features/host/ping.tsx`). The lobby adds a one-line note when any phone is slow. Tests pass a non-empty map to the player and TV screens to verify that pings stay host-only.
- **Winning margin.** `formatMargin` (`src/features/ui/format.ts`) turns `buzzResult.marginMs` into "by 0.04 s" or "by a hair" under 10 ms. A single contender has no margin. Show it only while the race winner answers, beside the TV's buzz cue, in the host's status line, on the winner's "You're up!" cue and in the other phones' help line.
- **Room note.** The TV lobby's header corner says "Fair buzzing on · fastest reaction wins" while the setting is on.
- **Previews.** `/preview` has the light-up played live (tap early to false-start), the held "Too early!" and after-lockout states, races won by 0.04 s and by a hair (TV, host, both phones), and host lobby and board pings with a slow and an unmeasured phone. Every host preview carries normal pings.

Timing choices are documented in [Rules](RULES.md#standard-clue): 300 ms fallback RTT, p90/2 uplink estimate capped at 250 ms, 40 ms tolerance, 120–400 ms opening lead including 60 ms delivery slack, at most 250 ms collection, and a 250 ms lockout for taps in the preceding second. These bounds limit waiting and dishonest timing gains while allowing ordinary Wi-Fi/mobile jitter. They assume roughly symmetric network travel. Clock estimates, browser scheduling and self-reported false starts cannot prove a phone is honest. Live mixed-network behavior still needs a real-device playtest.

Pause during collection preserves candidates and decides immediately on resume. Pause before opening preserves the unused lead; resuming an open window without candidates resets the reaction epoch and preserves the remaining buzz duration. Restart restores paused at the last saved game clock, including the original pause time if already paused. Old saved games receive missing default settings and empty timing fields. Transport samples start over after reconnect or restart. Protocol versions 1 and 2 must reload.
