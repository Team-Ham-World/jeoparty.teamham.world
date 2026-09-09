# Project guide

JeoParty is a Team Ham–themed browser quiz game: a host runs it, a shared display shows it, and players use their phones as buzzers. Prioritize **fun, reliability, easy setup, then extra features**.

## Decision status

The product direction and [named owners](TEAM.md) come from the earlier docs and team assignments. The smaller release scope and simplified rules below are **proposed**, pending team confirmation in milestone 0. Implemented so far is the J0 scaffold only (starter app, scripts, CI definition) — no game rules, engine, content validator, backend, or approved scope.

Use these labels when updating a decision: **Proposed** (needs agreement), **Agreed** (record who agreed), **Implemented** (code exists), **Verified** (checks demonstrate it). Agreement is not proof that a feature works.

## First release: a complete small game

Target a private online playtest, not a public platform:

- One non-playing host, one shared display, and **2–6 individual players**.
- A room code for joining, plus separate host and player credentials for permissions and reconnects. A room code alone must not grant host powers.
- One **3-category × 3-clue text-only board**, loaded from a developer-maintained question pack. This is not a user-facing file importer.
- Host-selected clues, phone buzzers, verbal answers, host judging, visible scores, and a final scoreboard.
- Host-paced play without automatic timers; manual score correction with a recorded reason.
- Refresh and same-browser reconnect while the backend remains running. Backend-restart recovery is a later milestone and must not be promised before it is tested.

This deliberately reduces the original V1. The [roadmap](ROADMAP.md) keeps the remaining features visible without making them prerequisites for the first game.

## Ordinary clue rules

These rules are the proposed first-release baseline. Happy turns them into tests; screen owners use them rather than inventing local variations.

| Step | Behavior |
|---|---|
| Join/start | Players join in the lobby. The host starts with 2–6 players. New players wait for the next game after play starts; existing players may reconnect. |
| Select/read | Only the host selects an unused clue. Show its prompt, keep the answer private, and leave buzzers closed while it is read. |
| Open/buzz | The host opens buzzers. Accept the first eligible buzz processed by the server and close buzzers for everyone else. Early buzzes are rejected without a penalty. |
| Judge | Only the host judges the current answering player. Correct adds the clue value; incorrect subtracts it. Negative scores are allowed. A player gets one attempt per clue. |
| Continue | After an incorrect answer, the host may reopen for remaining eligible players. After a correct answer, or when the host ends attempts, no further buzzes are accepted. |
| Reveal/finish | Only the host reveals the answer, then returns to the board. The clue becomes completed and cannot be selected again. When all clues are complete, show results; tied leaders share the win. |
| Correct a score | The host may adjust a score with a reason. This does not undo clue progress, reopen an attempt, or replay past actions. General undo/redo is not included. |

There is no automatic progression while waiting for host input. If an answering player disconnects, the host can wait for reconnect or end attempts and reveal. A disconnected screen shows its stale/offline status and disables game actions until it has a fresh snapshot.

**Buzzer fairness:** server processing order decides the winner, not a phone's timestamp. Network delay can affect the result. Promise one consistent winner—not perfect physical tap ordering or microsecond accuracy.

## Technical direction

**Installed (J0 scaffold):** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, ESLint, and Vitest 5 with Testing Library/jsdom — on Node 24 LTS / npm 11 (see root README for setup). **Future services:** Supabase/Postgres and Vercel remain intended choices, not installed infrastructure. There is no database, transport, backend, or deployed app.

**Open before gameplay integration:** how will the backend process simultaneous actions one at a time for each room? Supabase Realtime distributes updates; it does not by itself establish the required command ordering.

Happy and John should prove one of these approaches in milestone 0:

- Keep the selected services and use database transactions to order and atomically apply room actions.
- Propose a persistent Node service that orders room actions, with a host that supports that runtime. This changes the hosting architecture and needs team agreement.

Choose one after a small working test, not after building two full implementations. Record the choice here and put actual setup commands in the README once they exist. The runtime decision is still open; milestone 0 is in progress, not complete.

## Shared technical boundaries

An **authoritative server** is the single place that accepts or rejects game actions and decides the resulting state.

```text
Host / player action → server identity and permission checks → Happy's rules
                    → confirmed state → appropriate view for each screen
```

- **One rule implementation.** Happy's engine takes state and an action and returns a result. John runs it through the authoritative path. UI code requests actions; it does not award points or buzz wins.
- **Safe retries.** A unique command ID prevents retries from applying the same action twice. Judgments identify the clue and answering attempt so an old request cannot affect a new one. The server derives the actor from credentials, not a client-supplied player ID.
- **Ordered updates.** Each change has an increasing state revision (a change number). Clients ignore older revisions and fetch a fresh view on reconnect.
- **Private views.** Host, player, and display receive different data. Answers appear publicly only after reveal. Credentials, private notes, and future private wagers stay out of public payloads, history, and downloadable app bundles. Hiding a field on screen is not enough.
- **Stable content.** Fante validates IDs, categories, integer clue values, prompts, and answers before a game starts. A running game uses a fixed copy; used clues and scores belong to live state, not the editable pack.
- **Honest recovery.** Define whether a successful action is only accepted in memory or also saved durably. Reconnect preserves the player's identity and score within the supported lifetime; an unavailable game must not silently become a new one.

Before separate implementations start, agree on the minimum pack, game phases, actions, rejection reasons, and three screen views. For each action, state who can send it, the allowed phase, and its effect. Keep typed definitions, example data, and tests beside the code; avoid another large speculative contract document.

## Visual baseline

Keep Team Ham personality with a familiar blue board, gold values, a dark shared display, and light controls. Start with reusable buttons, inputs, and status messages—not a large component library.

Use readable TV text, large phone targets, keyboard access, visible focus, and tested text/background contrast. Communicate states with words as well as color. Animation must never delay or decide a game action. Elaborate sound, motion, and custom branding can wait.

## Changes from the questionnaires

| Previous conflict or burden | Proposed treatment |
|---|---|
| Most features marked V1; some also marked “Later” | One small release above; further work ordered in the roadmap |
| Host-only clue selection, but player commands also allow selection | Host-only selection for this release |
| Automatic timeout reveal versus host-only reveal; unclear early-buzz penalties | Host-paced reveal; reject early buzzes without penalties |
| Whole-game undo/redo and exact recovery promises | Manual score correction first; distinguish reconnect from backend-restart recovery |
| Private fields in shared types; raw game state returned to clients | Server-internal state, explicit role-specific client views |
| Every interface change requires all six approvals | Owner and affected consumers review ordinary changes; all six agree on scope and major stack choices |

Before a later feature starts, settle its unanswered rules: team scoring, board control, timer durations/host-loss behavior, Daily Double cancellation, and Final Jeopardy eligibility/missing submissions. Agents should flag those decisions, not fill them in silently.
