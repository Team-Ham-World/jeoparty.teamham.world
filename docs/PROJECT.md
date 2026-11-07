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
