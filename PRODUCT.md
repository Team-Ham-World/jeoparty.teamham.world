# Product

<!-- impeccable:product-schema 1 -->

<!--
  Written by `impeccable init` on 2026-11-08 without an interview: the brief
  said not to ask the owner anything, so answers come from README.md,
  docs/PROJECT.md, docs/RULES.md, docs/ROADMAP.md, AGENTS.md and
  organization-docs/BRAND.md. Facts marked "(inferred)" were not stated in
  those documents and should be confirmed by the owner.
-->

## Platform

web

Mobile web on players' phones, a laptop browser for the host, and a TV or projector browser for the display. No native app or wrapper.

## Users

HAM is a private, friends-only group of people who make things on the internet. HAM Quiz is for them, not the public.

- **Host (one, non-playing).** A HAM member runs the game from a laptop at `/host/CODE`. They read each clue aloud, open the buzzers, judge spoken answers, correct scores and pause. They watch the room more than the screen, so the controls must work at a glance and from the keyboard. Hosting from a phone works but is secondary (inferred from the single-column host layout).
- **Players (2–6).** Signed-in HAM members stand or sit in a living room with their own phone (iOS Safari or Android Chrome, per the roadmap). They look up at the TV most of the time and down at the phone only to buzz, wager or type the final answer. They use it one-handed, in a hurry, often while laughing and talking (inferred).
- **The room (TV).** Everyone reads a TV or projector at `/display/CODE` from about 10 feet. It has no sign-in and takes no input. The host often previews it on their own 1366×768 laptop first.
- **Pack authors.** Members write or remix question packs at `/packs` and `/packs/ID` on a laptop, ahead of game night (inferred: the editor is a desktop table layout).

## Product Purpose

A HAM-themed quiz-show party game: a host runs it, a shared display shows it, and players use their phones as buzzers. Priorities, in order: **fun, reliability, easy setup, then extra features**.

Success means the group finishes a full game night with nobody confused about whose turn it is, who buzzed first, or what the score is, and nobody waits on the software.

## Positioning

This is a game made by and for one friend group, signed in with their own TeamHam.world accounts, in HAM's own "Cut & Paste" look. It does not imitate the TV quiz show it resembles. The authoritative server decides every buzz race by processing order, so the phones are honest buzzers, not trust-me timers.

## Operating Context

- A game is one evening in one physical room: a laptop for the host, a TV or projector, 2–6 phones.
- Setup flow: the host signs in, creates a room, picks a pack, generates a display link and opens it on the TV. Players sign in and join with the 5-letter room code or the QR code shown on the TV.
- Answers are spoken out loud and judged by the host. Only the final round has typed answers.
- Rounds: up to two category boards (6×5), wager clues branded "Hot HAM!", a final round with private wagers and typed answers, then results and "Play again".
- Network conditions vary: phones drop Wi-Fi, the host's laptop can sleep, and the backend can restart. The game pauses itself and recovers.

## Capabilities and Constraints

- Full game, implemented and tested: two rounds, wager clues, final round, server timers, pause and resume, host-offline auto-pause, reconnect, restart recovery, score correction with a reason, pack editor with JSON import and export.
- Screens render views and request commands. Only the engine decides rules; only the server derives identity, orders commands and stores state. Answers and other private data are never in player or display payloads. UI work must not change rules, the protocol, or what a view contains.
- Players: 2–6. One host who never plays. Room codes are 5 letters with no vowels.
- Terminology: "wager clue" (UI brand "Hot HAM!"), "final round", "room code", "display link", "pack". Never "Jeopardy", "Daily Double" or "Final Jeopardy" anywhere in product text or identifiers.
- English only (inferred: no i18n layer exists).
- No sound yet; richer sound and animation are in the backlog.
- Stack: Next.js 16, React 19, TypeScript, Tailwind 4 (used mainly for the reset; styles are hand-written CSS per feature), one Node 24 service with SQLite, deployed at https://quiz.teamham.world.

## Brand Commitments

- HAM System A "Cut & Paste" (organization-docs/BRAND.md) is binding: paper, ink, surface tokens; interactive blue; decorative red only for shapes, stamps and marker strokes, never for text or meaning; Bricolage Grotesque for display headings at 800; Atkinson Hyperlegible for all UI text; near-zero corner radii; status shown with stamps that always carry their word.
- The HAM wordmark is a traced vector graphic and is never typeset in a font. "Hot HAM!" uses the wordmark graphic for "HAM".
- The visible brand is "HAM". "Team Ham World" is for repositories and legal text only. No public "join our Discord" call to action, and no explanation of internal lore.
- Voice: controls, instructions and errors are crisp and obvious; flavor text may be playful and a little chaotic.
- Stamp rotation stays within ±4°. Card and panel rotation turns off below about 400 px.

## Evidence on Hand

- Built-in question packs in `src/features/content/samples/`.
- Fixture views for every screen state in `src/features/preview/fixtures.ts`, viewable at `/preview` in development.
- Real-app screenshots from before this polish pass in `docs/screenshots/`.
- No playtest notes, user quotes or analytics exist yet. Future work must not invent them.

## Product Principles

1. **The room comes first.** Everyone should know at a glance whose turn it is, who buzzed, and the score, from the TV at 10 feet and from a phone in one glance.
2. **Never slow the buzz.** Nothing on a phone may delay, hide or confuse buzzing, wagering or answering. Animation never decides or delays a game action.
3. **The host is the show.** The host's screen is a calm control room: the next action is always obvious and reachable by keyboard.
4. **Honest state.** Offline, paused, stale, locked out and waiting are always said in words, never only with color or motion.
5. **It's HAM's.** Made by friends for friends, in HAM's own Cut & Paste voice, never a copy of the TV show.

## Accessibility & Inclusion

- Target WCAG 2.x AA: measured contrast for every text/background pair (`src/features/ui/contrast.test.ts`), visible focus, full keyboard access for host and editor, labelled controls.
- Phone tap targets at least 44 px; the buzzer is the largest target on the screen.
- State is always carried by words as well as color.
- `prefers-reduced-motion` stops all movement; one-shot "Correct!" and "Incorrect" feedback still shows, without movement.
- TV text is sized for reading from about 10 feet (inferred minimum: about 24 px on a 1080p screen for secondary text).
