---
name: HAM Quiz
description: Broadcast studio design for the host desk, player handset, shared TV and pack library.
colors:
  cream: "#faf4e9"
  surface: "#fffaf1"
  panel: "#eee6d8"
  ink: "#191621"
  muted: "#5e5665"
  rule: "#d4c9b9"
  violet: "#504388"
  lilac: "#c6b8ff"
  peach: "#ff9864"
  stage-raised: "#292336"
---

# HAM Quiz design system

Use the approved broadcast studio mockup as the visual reference for the full game. The walkthrough has sample accounts and a role switcher. Build the layouts around the app's accounts, packs, rooms and engine views. [Mockup](design/mockups/broadcast-studio.html), [product context](PRODUCT.md), [game rules](docs/RULES.md).

## Visual language

- Use warm cream for navigation, forms and the player handset, and near-black ink for the home hero and TV stage. The receiver illustration, orbit and soft violet glow establish the broadcast look. Keep them decorative and away from text and controls.
- Use aligned panels, thin rules, modest corner radii and restrained shadows. Use violet for links, selection and the board, lilac for labels on dark surfaces, and peach for the primary action, live buzzer and on-air accents. Name the game state in words and reinforce it with color. Keep verdicts, errors and warnings distinct and labelled.
- Use the bundled Bricolage Grotesque for the studio typography, with tight, heavy headings, large invitation codes and tabular values and scores. Use tracked monospace for short labels, compact room codes, status cues and keyboard hints. Use Atkinson Hyperlegible for longer reading text on the handset. Give clue prompts room to wrap. Use the traced HAM wordmark in the lockup and in "Hot HAM!".
- Use the shared tokens in `src/app/globals.css`. Make keyboard focus visible on cream and dark surfaces. Update the measured foreground/background pairs in `src/features/ui/contrast.ts` when adding a combination. Target 4.5:1 for text and 3:1 for control boundaries and focus indicators.

## Home, setup and packs

Home pairs the illustrated broadcast hero with clear entry points for hosting and joining by five-letter code. Keep Play, Pack library and the account controls easy to find. Signed-in hosts can reopen their existing rooms or close them with confirmation. Loading, sign-in, error and closed-room screens use the same navigation and a concise notice.

After HAM sign-in, the host opens **Create a lobby** and selects a built-in or saved pack. Show each pack's title and dimensions and mark the selected card visibly and programmatically. The game-format summary shows rounds, categories per round and whether the final round is on. **Adjust settings** expands the format, wager clue, buzzing and timer controls. Settings start with the selected pack's defaults and reset when the pack changes. Closing the settings keeps the draft. If a draft is invalid, reopen the settings and focus the field. If the pack list is unavailable, offer the server's default pack.

**Create game** sends the pack and any settings overrides together, then opens the new lobby. Show creation errors on the form and retain the host's choices for a retry.

The pack library uses the same card treatment. The editor groups pack and category navigation and keeps prompt, answer key, point tier and picture controls labelled. Built-in packs are read-only and can be duplicated. Preserve JSON import and export, validation, and draft recovery. Focus Restore first in the unsaved-draft dialog and require an explicit Restore or Discard choice.

## Host desk

- **Lobby.** Put the room code, join link and QR code where the host can share them quickly. Keep the private TV link controls distinct from player invites. Show seats, waiting players, connection and ping status, and player removal with confirmation. Summarize the chosen pack and format and offer edits before play. Changing the pack or reloading its saved copy resets the settings. Unsaved changes block Start and offer Save or Undo. Show all start blockers in words.
- **Game.** Give the board or clue the main area and keep scores and player states visible. Keep the private answer key clearly labelled on the desk. Reserve a stable action area for the current status, countdown, allowed actions and attempts, so the next action stays in reach on a laptop. Collapse columns on narrow screens without hiding the main action. Keep phase-specific shortcuts visible, including S to show the final clue, L to lock answers, R to reveal, C/X to judge and F for results.
- **Game controls.** Keep pause and resume reachable. Put score correction with a reason, ending the game, and TV link management near the game controls. Confirm destructive actions. Replacing a display link disconnects the old screen, so focus Cancel first. Keep Close room available in the lobby and on results.

## Shared TV

Use a dark, full-viewport stage with a broadcast status line, large round and room cues, violet board and clue panels, and a score strip. The display is read-only and opens from a host-issued link. Make the lobby code and QR easy to read. During play, show the public prompt, who picks or answers, the timer and the public reveal. The answer key, hidden wager locations, private submissions and host-only controls belong to their authorized views.

Check the stage at 1366×768 and 1920×1080, with six players and long names, prompts and answers. Keep secondary game text at least 24 px at 1080p. Keep scores aligned and use words such as "Picks", "Answering", "Locked out" and "Away" for player state. Give final reveal and results room for long responses, ties and shared winners without pushing scores off-screen. Use the scrolling layout at 900 px wide or 520 px tall and below so all content stays reachable.

## Player handset

Use one column with the room and connection status, a clear cue for the current state, the player's score and one dominant action. While the board is up, tell the player who picks. The picker calls out the choice and the host selects the clue. The compact board is read-only. Standard clues prioritize the round peach buzzer. Use the handset for permitted wager and final-answer forms, acknowledgements and results. Preserve a seated player's typed entries in disabled forms during a pause. Keep the home link out of active play to prevent accidental exit.

### The buzzer

Anchor the buzzer and its help text in a stable, thumb-reachable area. Keep the buzzer the largest target and reserve space for changing cues so reconnect, pause and lockout messages leave it in place. Its visible label is its accessible name, and the help text is its description. Send a buzz on pointer-down or Enter/Space when eligible.

Switch directly from "Wait" to "Buzz!" when the game opens buzzing. Keep that change free of transition or layout shift. Use distinct labelled idle, live, sent, held, closed, offline and paused states. During a 250 ms false-start lockout show "Too early!" with a reason, then restore the live state when the lockout lifts. An already ineligible player stays in their existing state. The phone lobby says "Wait for the light." while lockout is enabled.

## Shared game components

- **Board.** Use aligned category headers and large values, with violet tiles and muted, hatched played slots on the TV. Mark hidden wager clues on the host board only. Use the shared board's accessible headings and cell names. On the host board, Tab enters once, arrows move between open cells, Home/End jump to the first or last open cell, and Enter/Space selects. See [Board](src/features/board/README.md) for variants.
- **Clue pictures.** Preserve a reserved frame and fit the full picture uncropped. On the TV, put it beside the prompt and stack it above in the small scrolling layout. Allow room for both a long prompt and the answer reveal. On the host desk, fit the picture without displacing the answer or sticky actions. On phones, show pictures only on wager clues after the wager is in and in the final round. Keep the image description as alt text. Show "Picture didn't load" inside the reserved frame on failure. The editor keeps its preview, description and Add, Replace and Remove controls together.
- **Forms and notices.** Use visible labels and associate hints and errors with the fields they describe. Keep the phone's tap targets at least 44 px. Use native dialogs with visible focus and return focus to the opener. Keep notices and toasts clear of the buzzer and help line. Label countdowns and expose the time remaining in spoken units.
- **Game state and motion.** Say when the screen is stale, reconnecting, offline, paused, waiting or locked out. Disable stale actions until a fresh view arrives. Keep motion independent of input dispatch and timing. Under `prefers-reduced-motion`, stop movement and keep one-shot "Correct!" and "Incorrect" feedback still for the usual 2.4 seconds.

### Winning margin

During a fair-buzz winner's answer, show the margin when there were at least two contenders. Use "by 0.04 s", "by a hair" under 10 ms, and tenths of a second from one second up. Place it beside the answering cue on the TV, in the host's status line, in the winner's cue and in the other phones' help text. The TV lobby says "Fair buzzing on · fastest reaction wins" while it is enabled.

### Ping chip

Show the server-measured median beside each connected player's name on the host desk, in the lobby and in game. Use "measuring…" until a sample arrives and "away" for a disconnected player. Above 250 ms include "slow" with the value and explain the limit of lag compensation in the lobby. Keep this telemetry host-only.
