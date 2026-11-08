---
name: HAM Quiz
description: HAM System A "Cut & Paste": paper slips pasted on paper for phones, host and editor, and on an ink stage for the TV.
colors:
  paper: "#f6f1e5"
  surface: "#fffdf6"
  ink: "#1c1a17"
  muted: "#5c5648"
  red: "#d93625"
  blue: "#1d4ed8"
  blue-tint: "#dce5fb"
  good: "#1e6b3a"
  good-tint: "#ddefd9"
  bad: "#a4271b"
  bad-tint: "#f8dcd5"
  hot: "#f4a6b8"
  highlight: "#fce38a"
  shade: "#e9e1cf"
  rule: "#cfc5ae"
  hot-tint: "#fde4ea"
  blue-press: "#173fb0"
  good-press: "#17562e"
  bad-press: "#8a1f15"
  tape: "#e6d8b0b8"
  tape-edge: "#b9a87a"
  stage: "#1c1a17"
  stage-raise: "#2b2824"
  stage-text: "#f6f1e5"
  stage-muted: "#b9b09c"
  stage-faint: "#a39a86"
  stage-blue: "#8eaeff"
  stage-good: "#9dd9ae"
  stage-bad: "#ff9a8a"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Fallback, system-ui, Arial Black, sans-serif"
    fontSize: "clamp(2.25rem, 6.5vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Fallback, system-ui, Arial Black, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Fallback, system-ui, Arial Black, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  numeral:
    fontFamily: "Bricolage Grotesque Variable, Bricolage Fallback, system-ui, Arial Black, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  body:
    fontFamily: "Atkinson Hyperlegible, Atkinson Fallback, Verdana, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Atkinson Hyperlegible, Atkinson Fallback, Verdana, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Atkinson Hyperlegible, Atkinson Fallback, Verdana, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.12em"
  stamp:
    fontFamily: "Atkinson Hyperlegible, Atkinson Fallback, Verdana, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.08em"
rounded:
  sm: "2px"
  full: "50%"
spacing:
  gutter: "16px"
  topbar-height: "60px"
  page-max: "72rem"
  page-narrow: "44rem"
  host-max: "90rem"
  phone-column: "34rem"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-hover:
    backgroundColor: "{colors.blue-tint}"
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.blue-press}"
  button-good:
    backgroundColor: "{colors.good}"
    textColor: "{colors.surface}"
  button-good-hover:
    backgroundColor: "{colors.good-press}"
  button-bad:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.surface}"
  button-bad-hover:
    backgroundColor: "{colors.bad-press}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.blue}"
  button-big:
    padding: "0.75rem 1.4rem"
    height: "56px"
  button-small:
    padding: "0.3rem 0.7rem"
    height: "36px"
  button-small-touch:
    padding: "0.45rem 0.7rem"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.7rem"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "1.25rem"
  panel-sunk:
    backgroundColor: "{colors.shade}"
    textColor: "{colors.ink}"
  stamp:
    textColor: "{colors.ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "0.12em 0.55em"
  stamp-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  stamp-good:
    backgroundColor: "{colors.good}"
    textColor: "{colors.surface}"
  stamp-bad:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.surface}"
  stamp-hot:
    backgroundColor: "{colors.hot}"
    textColor: "{colors.ink}"
  stamp-warn:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.ink}"
  banner-warn:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.ink}"
    padding: "0.7rem 1rem"
  banner-info:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.ink}"
    padding: "0.7rem 1rem"
  banner-bad:
    backgroundColor: "{colors.bad-tint}"
    textColor: "{colors.ink}"
    padding: "0.7rem 1rem"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stage-text}"
    padding: "0.7rem 0.9rem"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    width: "min(32rem, calc(100% - 32px))"
  buzz-live:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "min(70vw, 17rem, 32dvh)"
  buzz-idle:
    backgroundColor: "{colors.shade}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
  buzz-early:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  ping:
    textColor: "{colors.muted}"
  ping-slow:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  tv-margin:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  board-cell-stage:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  board-cell-stage-active:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
  board-cell-host:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    height: "3.25rem"
  board-cell-host-wager:
    backgroundColor: "{colors.hot-tint}"
    textColor: "{colors.ink}"
  tv-score:
    backgroundColor: "{colors.stage-raise}"
    textColor: "{colors.stage-text}"
  tv-score-answering:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.stage-text}"
---

# Design System: HAM Quiz

## Overview

**Creative North Star: "The Pasted-Up Game Show"**

Every surface is a set of paper slips cut out and pasted down. On the phone, the host laptop and the pack editor the slips sit on warm paper; on the TV they sit on a dark ink stage so they pop from across a room. Slips have hard 2–4 px ink outlines, hard offset shadows with no blur, and corners that are almost square. State is shown the way a zine would show it: rubber stamps with a word on them, a yellow highlighter pass behind "you", a ham-pink highlighter for wager clues, and one hand-drawn red marker stroke under a single heading per screen.

The system is HAM's organisation-wide System A (organization-docs/BRAND.md), specialised for a party game. It is dense where people operate (host console, editor), loud and sparse where people react (TV, buzzer), and always readable first: Atkinson Hyperlegible carries every word of UI, and Bricolage Grotesque at weight 800 is reserved for headings, scores and clue values. Decoration is cheap and physical (tape, tilt, a dot grid on the TV), never glossy: no gradients except the highlighter strips, no blur shadows, no glassmorphism, no rounded cards.

Motion is short and paper-like: slips drop in, stamps thud down at a slight angle, the buzzer breathes while live and shakes "no" once on a false start. Nothing moves under reduced motion, and the one-shot "Correct!"/"Incorrect" feedback then holds still for its usual 2.4 s.

**Key Characteristics:**
- Warm paper (#f6f1e5) and surface (#fffdf6) grounds with near-black ink (#1c1a17) for text and 2 px borders.
- Hard offset shadows (2 px, 4 px, 6 px) in ink; on the TV, pure black or decorative red.
- Near-zero 2 px radius everywhere; only the buzzer is round.
- Stamps (uppercase, tracked, bordered, tilted −2°) carry state words.
- One accent each for meaning: blue = you can press it, green = correct, rust = incorrect, pink = Hot HAM!, yellow = attention or "you".
- Decorative red only as marker strokes, red stamp outlines, the TV starburst and shadow accents.
- The TV is a dark ink stage with a faint dot grid; everything on it scales in em from one root size.

## Colors

A warm, papery neutral base with five functional accents, each paired with a word, and one decorative red that never carries meaning.

### Primary
- **Press Blue** (blue): the only interactive color. Primary buttons, links, the live buzzer, focus rings (3 px outline, 3 px offset), the active board cell, the "you pick" slip, and the answering player's TV tile. Hover darkens it to blue-press (#173fb0).
- **Press Tint** (blue-tint): hover fill for ordinary buttons, the info banner, the "answering" attempt row and the revealed final response on the host.

### Secondary
- **Correct Green** (good): "Correct" buttons and stamps, the "You're up!" slip, the correct flash. Always paired with the word. Tint (good-tint) for correct rows and the submitted tag on the TV.
- **Incorrect Rust** (bad): "Incorrect" buttons and stamps, negative scores, field errors, the low-time countdown fill, the "Too early!" buzzer. Always paired with the word or a minus sign. Tint (bad-tint) for incorrect rows and the error banner.

### Tertiary
- **Ham Pink** (hot): the "Hot HAM!" wager brand and wager stamps. The host board uses a lighter pink (hot-tint, #fde4ea) for hidden wager cells.
- **Highlighter Yellow** (highlight): answers, warnings, the stale/paused banner, the "you" row highlight strip, the host's "slow" ping chip and text selection.
- **Marker Red** (red): decorative only. Marker underline, red stamp double outline, the "Too early!" buzzer's outer ring, TV category-slip shadow, TV room-code letter shadow, podium shadow, the Hot HAM! starburst. Never text, never a state signal.

### Neutral
- **Paper** (paper): page background on every paper surface; also TV board cells and TV tags.
- **Surface** (surface): panels, cards, inputs, dialogs, clue cards, button faces.
- **Ink** (ink): all text, every border, every hard shadow, ink header bars on clue cards, the toast background.
- **Muted Ink** (muted): secondary text, disabled buttons (dashed outline), idle buzzer label. 6.47:1 on paper.
- **Shade** (shade): sunken paper: the idle buzzer, the empty-state panel.
- **Rule** (rule): dashed hairlines between list rows and section dividers. Decorative; never text.
- **Tape** (tape, tape-edge): the translucent masking-tape strip and its dashed ends. Decorative only.

### Stage (TV)
- **Stage** (stage) and **Stage Raise** (stage-raise): the TV background and score tiles.
- **Stage Text / Muted / Faint**: TV text at three strengths (15.4:1, ≥4.5:1, ≥4.5:1 on stage).
- **Stage Blue / Good / Bad**: lifted accents for the dark stage: "Picks" tag and outlines, negative TV scores.

### Named Rules
**The Word-With-Color Rule.** No color carries state alone. Every green has "Correct", every rust has "Incorrect" or a minus, every pink has "Hot HAM!" or "Wager", every yellow has a sentence.

**The Red Is Paint Rule.** Marker red (#d93625) is 4.14:1 on paper. It decorates shapes and outlines only. If removing it would lose information, it was used wrong.

**The Measured Pair Rule.** Every text/background pair is listed in `src/features/ui/contrast.ts` and tested at 4.5:1 (text) or 3:1 (non-text). A new pair is added there before it ships.

## Typography

**Display Font:** Bricolage Grotesque Variable (with a metric-matched Arial Bold fallback, then system-ui, Arial Black)
**Body Font:** Atkinson Hyperlegible 400 and 700 (with a metric-matched Verdana fallback, then system-ui)

**Character:** A chunky, slightly irregular grotesque at 800 for anything you read from a distance (headings, scores, clue values, the buzzer label), against a deliberately plain, high-legibility sans for every control and sentence. The pairing reads as a handmade poster with very clear instructions on it.

### Hierarchy
- **Display** (800, clamp(2.25rem, 6.5vw, 4rem), 1.04): the home hero only. Phone big headings use clamp(1.75rem, 8vw, 2.4rem).
- **Headline** (800, 2.25rem / 36 px, 1.12, −0.02em): page h1 (packs, editor, host lobby), host results title.
- **Title** (800, 1.375rem / 22 px, 1.12): panel and section h2. Home cards step up to 1.75rem.
- **Numeral** (800, 1.25–2.05em, 1, −0.03em, tabular): scores, board values, clue values, room codes (with +0.08–0.2em tracking).
- **Body** (400, 1rem / 16 px, 1.5): sentences. Clue prompts are body font at 700: 1.375rem on the phone, 1.75rem on the host, 1.4–2.6em on the TV by prompt length.
- **Label** (700, 0.8125rem / 13 px, 0.12em, uppercase): eyebrows above fields and sections. Field labels are 0.875rem 700, not uppercase.
- **Stamp** (700, 0.8125rem, 0.08em, uppercase): state stamps; `--fs-2xs` (0.75rem) for tags inside board cells and host roster rows.

The type scale is `--fs-2xs` 0.75 (the floor: tags and labels inside dense board cells and rows) · `--fs-xs` 0.8125 · `--fs-sm` 0.875 · `--fs-md` 1 · `--fs-lg` 1.125 · `--fs-xl` 1.375 · `--fs-2xl` 1.75 · `--fs-3xl` 2.25 · `--fs-4xl` 3 rem. The TV uses its own em scale off a root of min(1.5625vw, 2.78vh) (30 px at 1920×1080, about 21 px at 1366×768, fixed 15 px below 900×520).

### Named Rules
**The Wordmark Is Not Type Rule.** "HAM" is always the traced wordmark SVG (currentColor fill). It is never set in Bricolage or any font, including inside "Hot HAM!".

**The Display Face Earns Its Size Rule.** Bricolage appears only at 1.375rem and up, or in numerals. Controls, labels and stamps stay in Atkinson.

## Layout

- **Paper pages** (home, packs, editor, notices): a 60 px top bar with a 2 px ink bottom rule, then a centred `.page` column, max 72rem (44rem narrow), padding 2rem top and 4rem bottom, with 16 px safe-area-aware side gutters. Notices (loading, sign-in, errors, closed rooms) use `NoticeShell`: the same top bar with the lockup only, then a 34rem column that starts 12vh down (padding, so the page never scrolls).
- **Host console:** lobby is a 12-column grid (players 4 · invite 4 · big screen 4 · setup 12), collapsing to 6+6+12 below 1180 px and one column below 720 px, with a sticky "Start game" bar at the bottom. Panels in a row share one height, roster rows carry each phone's ping chip, timer inputs are 8rem wide, and the start bar paints a paper band above itself so content disappears cleanly under it. While settings are unsaved the bar says so, offers "Save changes" and disables "Start game". In game, a main column plus a 17–21rem sticky score sidebar, collapsing to one column below 960 px. The clue card's action area has the same shape in every stage, so the main button never moves: a status sentence with the countdown at its right, then the buttons, then the attempts list. It is sticky at the bottom of the viewport.
- **Player phone:** one column, max 34rem, full dynamic height: top bar (lockup, room code, connection), a "you" strip (name and score), banners, then a flex main area where the buzzer pins to the bottom (`margin-top: auto`). Phone banners are compact (0.45rem × 0.75rem padding, `--fs-sm` title) so a reconnecting or paused banner never pushes the buzzer off screen. The logo links home only in the lobby, on results and on the bench. Above 600 px the column gets 2 px ink side borders.
- **TV stage:** a full-viewport three-row grid (header, main, score strip) with overflow hidden and everything in em, so 1366×768 and 1920×1080 have the same composition. Below 900 px wide or 520 px tall it becomes a scrolling page at 15 px.
- **Board:** CSS grid, one column per category, header row plus one row per value via subgrid. Gaps: 0.45em TV, 0.4rem host (0.25rem up to 480 px), 0.25rem phone.
- **Rhythm:** spacing uses literal rem steps rather than tokens: 0.25, 0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5 rem. Stacks default to 1rem gaps (0.5rem tight); rows to 0.75rem.
- **Breakpoints in use:** 400, 420, 560, 600, 640, 720, 760, 900 (TV), 960, 1180 px, plus a 30rem container query for the display-link panel.

## Elevation & Depth

Depth is printed, not lit. Slips lift off the page with hard offset ink shadows and no blur; pressing a button moves it into its own shadow (translate 2 px, shadow 0). Sunken things (idle buzzer, empty states, disabled controls) lose their shadow and turn dashed. On the TV, shadows go pure black or decorative red because ink would vanish on the ink stage.

### Shadow Vocabulary
- **Small slip** (`box-shadow: 2px 2px 0 var(--ink)`): buttons, host board cells, picker slip.
- **Slip** (`box-shadow: 4px 4px 0 var(--ink)`): panels, clue cards, big buttons, the "you're up" slip, the start bar.
- **Dialog** (`box-shadow: 6px 6px 0 var(--ink)`): modal dialogs on desktop (removed on phones, where dialogs become bottom sheets).
- **Toast** (`box-shadow: 4px 4px 0 #1c1a1740`): the only translucent shadow.
- **Buzzer** (`0 8px 0 ink, 0 0 0 6px paper, 0 8px 0 6px ink`): a 3D arcade button with a paper ring; pressing drops it 7 px.
- **TV slip** (`0.25–0.3em 0.25–0.3em 0 #000`, or `0.12–0.25em … var(--red)` on category headers, code letters and the podium).

### Named Rules
**The No-Blur Rule.** Shadows have zero blur radius. A soft shadow is a different brand.

**The Press-Into-Shadow Rule.** Pressable slips translate by their shadow offset on `:active` and lose the shadow. Nothing scales on press except the buzzer, which drops.

## Shapes

Near-square everywhere: `--radius` is 2 px on buttons, inputs, panels, stamps, dialogs and board cells. The buzzer is the one circle. Borders are 2 px solid ink by default; 1.5 px on phone board cells, kbd keys and small tags; 3 px on the buzzer; 8 px left borders on banners, toasts and the host picker slip as a colored spine. Dashed borders mean "not active": disabled buttons, completed board cells, waiting tags, sunk panels, the final-clue editor box, hairline row dividers.

Small rotations make it feel pasted: stamps −2°, home cards −0.4°/+0.5°, TV category headers ±0.7–0.8°, TV code letters ±1.5–2°, the QR slip +1.5°, the TV answer −1°, Hot HAM! −2°. Card and panel rotation turns off below 400 px; stamps keep theirs. Masking tape (a translucent 5.5rem `tape` strip with dashed `tape-edge` ends, rotated −3°) sits on the top edge of a few hero slips.

## Components

### Buttons
Tactile slips you press down into their shadow.
- **Shape:** near-square (2 px), 2 px ink border, small slip shadow.
- **Default:** surface face, ink text, Atkinson 700, min height 44 px, padding 0.5rem 1rem. Hover fills blue-tint.
- **Primary / Good / Bad:** blue, green or rust face with surface text; hover darkens to blue-press, good-press or bad-press.
- **Quiet:** no border or shadow, blue underlined text, blue-tint on hover. Used for "Go home", "My packs", "Leave room", secondary links.
- **Big:** min height 56 px, 1.125rem text, 4 px slip shadow. Used for the one primary action of a screen. **Small:** min height 36 px with a mouse or trackpad and 44 px on touch screens (`pointer: coarse`), 0.875rem text.
- **Disabled:** transparent, dashed muted border, muted text, no shadow, not-allowed cursor.
- **Shortcut hint:** a `kbd` chip (1.5 px border, 3 px bottom border) inside host action buttons, drawn by CSS so the button's text stays the action alone. The final round has its own keys (S show the clue, L lock answers, R reveal the next response, C/X judge, F results), never on screen at the same time as the clue keys.

### Stamps
Rubber stamps for state.
- **Style:** inline, uppercase 0.8125rem 700 at 0.08em tracking, 2 px currentColor border, rotated −2° unless `--flat`.
- **Variants:** dashed (muted, "not yet"), ink (inverted), blue (outline), good, bad, hot, warn (filled), red (double red outline, ink text).

### Cards / Containers
- **Panel:** surface, 2 px ink border, 2 px radius, 4 px slip shadow, 1.25rem padding. `--flat` drops the shadow; `--sunk` is shade with a dashed border and no shadow.
- **Clue card:** surface slip with an ink header bar (category in uppercase Atkinson, value in Bricolage) and the prompt in Atkinson 700.
- **Banner:** 8 px colored left spine, 2 px border, bold title with a regular-weight sentence; warn (yellow), info (blue-tint), bad (bad-tint).

### Inputs / Fields
- **Style:** surface, 2 px ink border, 2 px radius, min height 44 px, padding 0.5rem 0.7rem. Labels 0.875rem 700 above; hints 0.8125rem muted below.
- **Focus:** the global 3 px blue outline at 3 px offset.
- **Error:** rust border plus 1 px inset rust ring; message in 0.875rem 700 rust, prefixed "! ".
- **Disabled:** dashed border, transparent, muted text.
- **Wager input:** 56 px tall with a Bricolage 1.75rem numeral; quick-amount small buttons below, each naming its amount ("Min 5", "Half 600", "All in 1,200").
- **Segmented control:** a 2 px bordered strip of 40 px buttons (44 px on touch); pressed = ink fill.
- **Checkbox row:** a native checkbox (1.25rem, blue accent) and a 700 label in a 44 px row. When the option needs explaining, the sentence sits under the label text (indented past the box, 0.875rem muted, at most 48ch) and is the checkbox's accessible description. The host lobby's "Buzzing" group ("Fair buzzing", "False-start lockout") uses these, laid on the same three columns as the fields above it.

### Navigation
- **Top bar:** lockup (HAM wordmark + "Quiz" in Bricolage) at 1.5rem left, a flexible middle slot, account and sign-out on the right; wraps on narrow screens. The phone top bar is lighter: lockup 1.3rem, room code, connection pill.
- **Connection pill:** a 0.65rem circle (green filled = live, yellow dashed = reconnecting, empty = closed) plus the word.

### Dialogs and Toasts
- **Dialog:** native `<dialog>` with showModal, 32rem max, 6 px slip shadow, dashed rule above the footer, ink backdrop at 65%. Below 560 px it becomes a full-width bottom sheet with only a top border.
- **Toast:** ink slip at the bottom centre (top centre on screens up to 600 px wide, so it stays clear of the buzzer and its help sentence), 8 px left spine (stage-bad for errors, stage-blue for info), a drawn-cross dismiss button (32 px, 44 px on touch), auto-dismiss after 6 s, at most three.
- **Countdown:** a label and the time left over a 0.6rem bar: whole seconds under a minute ("7s"), `m:ss` from a minute up ("2:59"). Screen readers hear "2 minutes 59 seconds left".

### The Buzzer (signature)
A round arcade button, `clamp(9rem, 100dvh - 34.5rem, min(70vw, 17rem))` across: its size depends only on the screen height, so it never resizes or moves when a banner or note appears. The help sentence under it always reserves two lines. Fires on pointer-down (and on Enter/Space); its accessible name is always the word on its face, and the help sentence is its description.
- **Idle:** shade face, dashed muted ring, a state word (Wait, Locked, Hold, Closed, Offline, Paused). "Hold" names who won and, with fair buzzing, by how much ("Medchu got there first by 0.04 s.").
- **Live:** blue face, ink ring, a paper halo and an 8 px ink drop shadow. Lighting up has no transition, so every phone turns blue on the same frame, and nothing around it moves. The halo is a separate decorative `.buzz-halo` layer that breathes every 1.4 s by animating only `scale` and `opacity`.
- **Sent:** on press it drops 7 px (a 60 ms eased press, the only transition), turns ink and reads "Sent!".
- **Too early!:** a false start, for the 250 ms lockout only. Rust face with surface text, held down 7 px in its base (so it can't look pressable), ringed paper then marker red like the red stamp, and the halo stops breathing. It shakes once, 240 ms on `translate` so it finishes inside the lockout; under reduced motion it holds still. On small buzzers the label breaks onto two lines. Help: "Locked for a moment: you tapped before it lit." When the lockout lifts it snaps up to blue "Buzz!" and the help says "Go! You were held back for tapping early." A phone that can't buzz the clue anyway never shows it.

### The Board (signature)
One grid component in three skins, under a visually hidden h2 so headings never skip a level. TV: paper slips on ink with tilted category headers shadowed in red, completed cells dashed with the value struck through (no visible "done" word; screen readers still hear it), the active cell blue with a paper outline and a 1.04 scale. Host: surface buttons with small slip shadows; hover turns blue; hidden wager cells hot-tint with a tilted "Hot" tag; completed cells read "done". One cell is in the tab order and the arrow keys move between open cells (Home/End jump to the first and last). Phone: a compact read-only board with `--fs-2xs` category labels; completed cells are empty dashed slots. Category titles wrap between words; browsers don't hyphenate capitalised words, so a Title Case word wider than a phone column still breaks without a hyphen.

### Hot HAM! (signature)
"Hot" in Bricolage, the HAM wordmark graphic, "!" in Bricolage, on a ham-pink slip with a red offset shadow, tilted −2°. On the TV it sits on a red 16-point starburst.

### TV Score Strip
One tile per player in a single row: name (two lines max, breaking after `.`, `_` and `-`; 0.8em with 5–6 players) over a Bricolage score, on stage-raise with a faint paper border. Tiles in a row stretch to the tallest and the score sits at the bottom, so scores line up. Tags (0.8em, 24 px at 1080p) sit on the top edge: "Picks" (stage-blue), "Answering" (blue tile lifted 0.3em), "Locked out" (also a dashed tile border and a dimmed score), "Away" (dashed).

Nothing on the TV is smaller than 24 px at 1080p. In the final round's judging and results, responses sit in rows of up to three (2×2 for four), long answers are clamped with an ellipsis, each verdict is a flat Correct/Incorrect stamp followed by the score change, and the correct answer slip always fits above the score strip. The results podium breaks long names at `.`, `_` and `-` and steps down in size only when a part can't fit; three or more co-winners get smaller slips, three to a row.

### Winning margin
With fair buzzing, how far ahead the race winner was, shown only while they answer and only with two or more contenders. Hundredths of a second ("by 0.04 s"), "by a hair" under 10 ms (rounding would claim "0.00 s"), tenths from a second up. On the TV it is a stamped slip after "<name> buzzed in!": surface, 2 px ink border, −2°, Atkinson 700 at 0.6 of the cue (about 29 px at 1080p), lower-case so the seconds read "s", stamping in 140 ms after the cue. The host's status line adds " · first by 0.04 s"; the winner's "You're up!" slip adds a small "You got there first by 0.04 s."; the others read it in the buzzer's help line. The TV lobby's free header corner says "Fair buzzing on · fastest reaction wins" while it is on, and the phone lobby says "Wait for the light." while the false-start lockout is on.

### Ping chip (host only)
Each phone's server-measured median ping beside its name, in the host lobby roster and the score sidebar's tag row: `--fs-2xs` 700 tabular muted digits ("38 ms"), never on a phone or the TV. Above 250 ms it becomes a yellow chip with a 1.5 px ink border that also says "slow" ("312 ms · slow"), because fair buzzing stops fully compensating near there; the lobby then adds one line, "Slow ping: fair buzzing can only make up for so much lag. Moving closer to the Wi-Fi helps." Before the first sample it says "measuring…"; an away phone shows only its "away" tag. Screen readers hear "Ping 312 ms, slow".

## Do's and Don'ts

### Do:
- **Do** put every color in `:root` in `src/app/globals.css` and add each new text/background pair to `src/features/ui/contrast.ts`.
- **Do** use a stamp with a word for every state, and keep stamp rotation within ±4°.
- **Do** use `.btn--big` for the single primary action on a screen and keep every phone tap target at least 44 px.
- **Do** size everything on the TV in em off `.tv` so 1366×768 and 1920×1080 keep the same composition.
- **Do** keep one red marker stroke per screen at most.
- **Do** stop all movement under `prefers-reduced-motion`, but keep one-shot judged feedback visible and still.

### Don't:
- **Don't** use marker red (#d93625) for text, links or any state signal.
- **Don't** add blurred shadows, gradients (other than the highlighter strip), glass effects or radii above 2 px (the buzzer excepted).
- **Don't** typeset "HAM" in a font; use the wordmark component.
- **Don't** use Bricolage for controls, labels, stamps or body text.
- **Don't** rotate cards or panels below 400 px wide.
- **Don't** let animation delay or gate a game action.
- **Don't** write "Jeopardy", "Daily Double" or "Final Jeopardy" anywhere.
