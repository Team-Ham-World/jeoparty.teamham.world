# Product

<!-- impeccable:product-schema 1 -->

<!--
  Product context draws on README.md, docs/PROJECT.md, docs/RULES.md,
  docs/ROADMAP.md, AGENTS.md and organization-docs/BRAND.md.
  Notes marked "(inferred)" are assumptions about the audience.
-->

## Platform

web

Mobile web on players' phones, a laptop browser for the host, and a TV or projector browser for the display. No native app or wrapper.

## Users

HAM is a private, friends-only group of people who make things on the internet. HAM Quiz is for them, not the public.

- **Host (one, non-playing).** A HAM member sets up the lobby and runs the game from a laptop at `/host/CODE`. They read each clue aloud, open the buzzers, judge spoken answers, correct scores and pause. They watch the room more than the screen, so the controls must work at a glance and from the keyboard. Hosting from a phone is secondary.
- **Players (2–6).** Signed-in HAM members use their own phone (iOS Safari or Android Chrome, per the roadmap). They follow the TV and use the phone to buzz, wager or type the final answer. When they have the pick, they call out their choice for the host to select. They use the phone one-handed, often while laughing and talking (inferred).
- **The room (TV).** Everyone reads the display at `/display/CODE` from about 10 feet. It opens from a host-issued link and shows the public game read-only, without HAM sign-in. The host often previews it on their own 1366×768 laptop first.
- **Pack authors.** Members write or remix question packs at `/packs` and `/packs/ID` on a laptop ahead of game night (inferred). The library and editor are separate from live play.

## Product Purpose

A HAM-themed quiz-show party game: a host runs it, a shared display shows it, and players use their phones as buzzers. Priorities, in order: **fun, reliability, easy setup, then extra features**.

Success means the group finishes a full game night with nobody confused about whose turn it is, who buzzed first, or what the score is, and nobody waits on the software.

## Positioning

This is a game made by and for one friend group. Hosts and players use their TeamHam.world accounts. The broadcast-studio design gives HAM Quiz its own show identity. The server decides every buzz race under the game rules, using bounded reaction times in fair mode and processing order otherwise.

## Operating Context

- A game is one evening in one physical room: a laptop for the host, a TV or projector, 2–6 phones.
- The host signs in, chooses a built-in or saved pack, and can adjust its default game format before creating a lobby. The host can still change the pack and settings in the lobby. They share the player code, join link or QR and open the TV with its separate display link. Players sign in with HAM to take a seat.
- Answers are spoken out loud and judged by the host. Only the final round has typed answers.
- Rounds: up to two category boards (6×5), wager clues branded "Hot HAM!", a final round with private wagers and typed answers, then results and "Play again".
- Network conditions vary: phones drop Wi-Fi, the host's laptop can sleep, and the backend can restart. The game pauses itself and recovers.

## Capabilities and Constraints

- Full game, implemented and tested: two rounds, wager clues, final round, server timers, pause and resume, host-offline auto-pause, reconnect, restart recovery, score correction with a reason, pack editor with JSON import and export.
- Screens render role-specific views and request commands. The engine decides rules. The server derives identity, orders commands and stores state. The host has the answer key and game controls, each player has their own allowed inputs and private submissions, and the TV gets the public view. The engine controls when answers, wagers and responses become public.
- Players: 2–6. One host who never plays. Room codes are 5 letters with no vowels.
- Terminology: "wager clue" (UI brand "Hot HAM!"), "final round", "room code", "display link", "pack". Never "Jeopardy", "Daily Double" or "Final Jeopardy" anywhere in product text or identifiers.
- English only (inferred: no i18n layer exists).
- No sound yet; richer sound and animation are in the backlog.
- Stack: Next.js 16, React 19, TypeScript, Tailwind 4 (used mainly for the reset; styles are hand-written CSS per feature), one Node 24 service with SQLite, deployed at https://quiz.teamham.world.

## Brand Commitments

- The broadcast studio uses cream forms and navigation, a dark TV stage, violet panels and peach action accents. The host desk makes private controls easy to scan, the TV carries the show, and the handset keeps the player's next action in reach. [Design system](DESIGN.md).
- The HAM wordmark is a traced vector graphic and is never typeset in a font. "Hot HAM!" uses the wordmark graphic for "HAM".
- The visible brand is "HAM". "Team Ham World" is for repositories and legal text only. No public "join our Discord" call to action, and no explanation of internal lore.
- Voice: controls, instructions and errors are crisp and obvious; flavor text may be playful and a little chaotic.

## Evidence on Hand

- Built-in question packs in `src/features/content/samples/`.
- Fixture views for every screen state in `src/features/preview/fixtures.ts`, viewable at `/preview` in development.
- The approved [broadcast studio mockup](design/mockups/broadcast-studio.html) and earlier real-app screenshots in `docs/screenshots/`.
- No playtest notes, user quotes or analytics exist yet. Future work must not invent them.

## Product Principles

1. **The room comes first.** Everyone should know at a glance whose turn it is, who buzzed, and the score, from the TV at 10 feet and from a phone in one glance.
2. **Never slow the buzz.** Nothing on a phone may delay, hide or confuse buzzing, wagering or answering. Animation never decides or delays a game action.
3. **The host is the show.** The host's screen is a calm control room: the next action is always obvious and reachable by keyboard.
4. **Honest state.** Offline, paused, stale, locked out and waiting are always said in words, never only with color or motion.
5. **It's HAM's.** Use the group's own voice and give the show an original visual identity.

## Accessibility & Inclusion

- Target WCAG 2.x AA: measured contrast for every text/background pair (`src/features/ui/contrast.test.ts`), visible focus, full keyboard access for host and editor, labelled controls.
- Phone tap targets at least 44 px; the buzzer is the largest target on the screen.
- State is always carried by words as well as color.
- `prefers-reduced-motion` stops all movement; one-shot "Correct!" and "Incorrect" feedback still shows, without movement.
- TV text is sized for reading from about 10 feet (inferred minimum: about 24 px on a 1080p screen for secondary text).
