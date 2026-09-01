# 4. DESIGN SYSTEM — SIX-ROLE SOURCE-OF-TRUTH QUESTIONNAIRE
## Custom Jeopardy — HOW Everything Should Look and Feel

**Purpose:** Give all six developers and their AI agents one shared visual language.

> **Rule:** Feature teams reuse the approved system. They do not invent duplicate buttons, cards, colors, spacing rules, or interaction patterns.

## Six Role Ownership Model

| Role | Owner |
|---|---|
| **Role 1 — Engine & Rules** | Core game rules, scoring, phases, state machine, Daily Double, Final Jeopardy, history/undo |
| **Role 2 — Board & Presentation** | TV/projector board, clue presentation, game-show presentation, display behavior |
| **Role 3 — Player / Buzzer / Scoring Experience** | Player join flow, phone UI behavior, buzzers, player inputs, wagers |
| **Role 4 — Host Controls** | Host dashboard, judging, manual controls, live game administration |
| **Role 5 — Content / Question Editor** | Question packs, categories, clues, media, editor behavior and content schema |
| **Role 6 — Network / Persistence / Integration** | Realtime, rooms, reconnects, persistence, deployment, integration, security boundaries |

### Ownership Rules

1. A question inside a role section is **owned by that role**. That role is responsible for proposing and recording the final answer.
2. A question inside **All-Member Decisions** requires agreement from all six members before it becomes source of truth.
3. A role may consult another role, but there must still be one accountable owner.
4. If an answer changes a frozen shared contract, follow the contract-change process in Document 3.
5. Do not leave blanks, select contradictory options, or allow an AI to invent an unanswered requirement.


---

# PART A — ALL-MEMBER DECISIONS
## Requires 6/6 Approval

## Overall Visual Direction — Original Q1–4

### Q1 — What should the game feel like?

Pick up to 5:

- [ ] Classic TV game show
- [ ] Modern game show
- [ ] Retro
- [ ] Arcade
- [ ] Premium
- [ ] Dramatic
- [x] Playful
- [x] Competitive
- [x] Minimal
- [ ] Cinematic
- [ ] Neon
- [x] Clean
- [x] Funny / chaotic
- [ ] Other: ________________________

### Q2 — Traditional Jeopardy resemblance

```text
1 = Completely original
10 = Very close to traditional Jeopardy

Answer: 8 / 10 (Faithful tribute to classic Jeopardy board & clue layouts with modern sleek responsiveness and Team Ham character)
```

### Q3 — Overall light/dark direction

- [ ] Primarily dark
- [ ] Primarily light
- [x] Dark game display + light controls
- [ ] Themeable

### Q4 — Visual adjectives

```text
1. Electric
2. Crisp
3. Vibrant
4. Ergonomic
5. High-contrast
```

## Brand / Identity — Original Q5–8

```text
Game/project name shown in UI:
JeoParty
```

Logo:

- [x] Yes
- [ ] No
- [ ] Later

Custom intro/title screen:

- [x] Yes
- [ ] No

```text
Tagline:
The Ultimate Parody Game Show by Team Ham
```

## Shared Color System — Original Q9–18

```text
Main background: #070B19 (Deep Cosmic Studio Blue)
Board tile: #060CE9 (Iconic Jeopardy Blue)
Score/value: #FFCC00 (Game Show Gold)
Primary text: #FFFFFF (Crisp White)
Secondary text: #94A3B8 (Slate Muted Gray)
Correct: #10B981 (Emerald Green)
Incorrect: #EF4444 (Crimson Red)
Warning: #F59E0B (Amber Orange)
```

Player colors:

- [x] Fixed palette
- [ ] Player chooses
- [ ] Random
- [ ] No Player-specific colors

If fixed:

```text
1. #EC4899 (Ham Pink)
2. #3B82F6 (Electric Blue)
3. #10B981 (Mint Emerald)
4. #F59E0B (Amber Gold)
5. #8B5CF6 (Vivid Purple)
6. #06B6D4 (Cyan)
```

Color alone communicates important state:

- [x] No
- [ ] Yes

## Shared Typography — Original Q19–21

Display font style:

- [ ] Bold sans serif
- [ ] Condensed sans serif
- [ ] Serif
- [x] Game-show inspired
- [ ] Retro
- [ ] Other: ________________________

UI/control font:

- [x] Sans serif
- [ ] Monospace
- [ ] Serif
- [ ] Same as display font

```text
Display font: Impact / Anton / Montserrat Black (fallback: sans-serif)
UI font: Inter / Plus Jakarta Sans (fallback: system-ui, sans-serif)
```

## Shared Shape / Spacing — Original Q24–28

```text
Density, 1 compact → 10 spacious: 6 / 10
```

Corner radius:

- [ ] Sharp / square
- [x] Slightly rounded
- [ ] Rounded
- [ ] Very rounded

Borders:

- [ ] Strong visible
- [ ] Thin subtle
- [ ] Mostly borderless
- [x] Mixed

Shadows:

- [ ] None
- [ ] Subtle
- [ ] Strong / dramatic
- [x] Only overlays/modals

Spacing base:

- [ ] 4px
- [x] 8px
- [ ] Other: ________________________

## Shared Components — Original Section K

Approve reusable components:

- [x] `Button`
- [x] `IconButton`
- [x] `Card`
- [x] `Modal`
- [x] `Drawer`
- [x] `Input`
- [x] `Select`
- [x] `Checkbox`
- [x] `Tooltip`
- [x] `Toast`
- [x] `PlayerBadge`
- [x] `ScoreDisplay`
- [x] `Timer`
- [x] `ClueTile`
- [x] `CategoryHeader`
- [x] `BuzzerButton`
- [x] `StatusIndicator`
- [x] `ConfirmationDialog`
- [x] `ScreenLayout`
- [x] `LoadingState`
- [x] `ErrorState`

Add:

```text
ReactionFloatingBar, PodiumDisplay, WagerSlider
```

## Shared Button System — Original Q48–51

Variants:

- [x] Primary
- [x] Secondary
- [x] Danger
- [x] Success
- [x] Ghost
- [x] Icon-only

Sizes:

- [x] Small
- [x] Medium
- [x] Large
- [x] Extra-large / Host controls

```text
Disabled state:
opacity: 0.45, cursor: not-allowed, filter: grayscale(40%), pointer-events: none

Loading state:
Subtle spinning ring/pulse indicator replacing icon/text, button disabled
```

## Design Ownership Rules — Original Q79–82

### Q79 — Can feature teams invent new button style?

- [x] No
- [ ] Yes
- [ ] Only with team approval

### Q80 — Can feature teams introduce new colors?

- [x] No
- [ ] Yes
- [ ] Only with team approval

### Q81 — Can feature teams create duplicate shared components?

- [x] No
- [ ] Yes

### Q82 — Who approves design-system changes?

- [x] All 6
- [ ] Majority
- [ ] Design owner
- [ ] Other: ________________________

---

# PART B — ROLE 1: ENGINE & RULES
## Owner: Person 1

Role 1 owns **semantic state presentation rules**: what game state means visually, not the styling itself.

### Original Q52 — What forms of feedback are permitted/required?

- [x] Visual state
- [x] Toast
- [x] Sound
- [x] Haptic/vibration
- [x] Animation
- [x] Depends on action

### Completion Question — Which game states must always be visually distinguishable?

- [x] Waiting/lobby
- [x] Board control
- [x] Reading clue
- [x] Buzzers closed
- [x] Buzzers open
- [x] Buzz won
- [x] Judging
- [x] Answer revealed
- [x] Paused
- [x] Daily Double
- [x] Final Jeopardy
- [x] Game over
- [ ] Other: ________________________

### Completion Question — Score changes should display

- [ ] New total only
- [x] Delta then new total
- [ ] Animated count
- [ ] Other: ________________________

### Completion Question — UI may optimistically show a game-result change before server confirms?

- [x] No
- [ ] Yes
- [ ] Only non-critical actions

### Completion Question — Required semantic labels/icons

```text
Correct:
Green Checkmark icon (✓) + "+$[value]"

Incorrect:
Red Cross icon (✗) + "-$[value]"

Paused:
Amber Pause Bars (⏸) + "GAME PAUSED"

Disconnected:
Grey Wifi Off icon (⚡/📶✕) + "RECONNECTING..."

Buzzer open:
Pulsing Golden Glow + "BUZZ IN NOW"

Buzz won:
Illuminated Spotlight Banner + "[PLAYER] BUZZED IN"
```

**Role 1 sign-off**

```text
Owner: Role 1 Specialist
[x] Game-state presentation semantics complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

## Display Typography — Original Q22–23

Clue text:

- [x] ALL CAPS
- [ ] Sentence case
- [ ] Title case
- [x] Match traditional Jeopardy feel

```text
Maximum clue lines before resizing: 6
```

## Main TV / Projector — Original Q29–33

```text
Columns/categories: 6
Rows/clues: 5
```

Scores always visible:

- [x] Yes
- [ ] No
- [ ] Only on board screen

Score location:

- [x] Bottom
- [ ] Top
- [ ] Side
- [ ] Separate scoreboard

Controlling Player highlighted:

- [x] Yes
- [ ] No

How:

- [x] Border
- [x] Glow
- [x] Icon
- [ ] Label
- [ ] Animation
- [ ] Other: ________________________

## Clue Screen — Original Q34–36

Show:

- [x] Category
- [x] Value
- [x] Clue text
- [x] Timer
- [x] Player scores
- [x] Buzzer status
- [x] Current buzzed Player
- [x] Media
- [ ] Other: ________________________

Clue text transition:

- [ ] None
- [ ] Fade
- [x] Scale
- [ ] Slide
- [ ] Typewriter
- [ ] Other: ________________________

When Player buzzes:

- [x] Player name appears
- [x] Screen accent changes
- [x] Sound plays
- [x] Timer changes
- [ ] Other: ________________________

## Motion — Original Q56–59

```text
Motion intensity 1–10: 7 / 10
```

Major-animation events:

- [x] Game start
- [x] Round start
- [x] Clue selection
- [x] Correct answer
- [x] Wrong answer
- [x] Daily Double
- [x] Final Jeopardy
- [x] Winner reveal
- [x] Score changes
- [ ] Other: ________________________

```text
Fast UI: 150 ms
Normal UI: 300 ms
Major reveal: 750 ms
```

Reduced motion:

- [ ] Respect OS `prefers-reduced-motion`
- [ ] Add in-app setting
- [x] Both

## Sound — Original Q60–63

Sound:

- [x] Yes
- [ ] No
- [ ] Later

Sound events:

- [x] Game start
- [x] Clue reveal
- [x] Buzzer open
- [x] Buzz win
- [x] Correct
- [x] Wrong
- [x] Daily Double
- [x] Timer warning
- [x] Timer expired
- [x] Final Jeopardy
- [x] Winner
- [ ] Other: ________________________

Volume control:

- [ ] Host only
- [ ] Each client
- [x] Both

Global mute:

- [x] Yes
- [ ] No

## Board Responsive Rules — Original Q65, Q67

TV assumes landscape:

- [x] Yes
- [ ] No

If board does not fit:

- [x] Scale entire board
- [ ] Reduce text size
- [ ] Horizontal scroll
- [ ] Dynamic column count
- [ ] Other: ________________________

## Screen Hierarchy — Original Main Board, Clue, Final Jeopardy

```text
MAIN BOARD
Primary:
Category Headers & 6x5 Clue Dollar Matrix

Secondary:
Category introductory cards and current round banner

Persistent:
Bottom player podium scoreboard and room join code in top corner

CLUE SCREEN
Primary:
Large readable clue text & media container

Secondary:
Category title, dollar value badge, active buzzer countdown bar

FINAL JEOPARDY
Primary:
Category reveal -> Clue text -> Sequential Player answer & wager cards

Secondary:
30-second theme countdown music visualization and wager status checkmarks
```

**Role 2 sign-off**

```text
Owner: Role 2 Specialist
[x] Board/presentation design complete
```

---

# PART D — ROLE 3: PLAYER / BUZZER / SCORING EXPERIENCE
## Owner: Person 3

## Player Phone UI — Original Q37–40

Primary layout:

- [ ] Huge single BUZZ button
- [x] Buzz button + score
- [ ] Buzz button + clue
- [ ] Full miniature game view

```text
Active-buzzer button occupies: 65 % of screen
```

Define states:

```text
CLOSED:
Dark slate button (#1E293B) with "BUZZERS LOCKED" text, subtle lock icon

OPEN:
Electric bright golden/yellow button (#EAB308) with pulsing border and "TAP TO BUZZ!" text

PRESSED / SENT:
Active state compression with blue radial glow and "BUZZ SENT..." text

WON BUZZ:
Vibrant green button (#10B981) with celebration flash and "YOU BUZZED IN! ANSWER NOW!"

LOCKED:
Muted grey button (#475569) with "ANOTHER PLAYER BUZZED" text

WRONG / INELIGIBLE:
Crimson red border with disabled background and "LOCKED OUT FOR THIS CLUE"
```

Phone vibration:

- [x] Buzzer open
- [x] Buzz win
- [x] Wrong answer
- [ ] Never
- [x] Optional setting

### Original Q66 — Player portrait support

- [x] Primarily portrait
- [ ] Primarily landscape
- [ ] Both equally

## Player Buzzer Screen Hierarchy — Original Screen Checklist

```text
Primary:
Massive central buzzer button / Wager submission slider / Final Jeopardy input field

Secondary:
Buzz feedback banner and countdown timer bar

Persistent:
Player nickname, team badge, current score, and connection indicator
```

### Completion Question — Minimum Player information visible during clue

- [x] Name
- [x] Score
- [x] Buzz state
- [x] Clue text
- [x] Timer
- [x] Connectivity
- [ ] Other: ________________________

**Role 3 sign-off**

```text
Owner: Role 3 Specialist
[x] Player design complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

## Host Dashboard — Original Q41–44

Rank:

```text
1 Speed
2 Information density
3 Large controls
4 Keyboard shortcuts
5 Touch friendliness
6 Visual beauty
```

Always visible:

- [x] Current clue
- [x] Correct answer
- [x] Buzz winner
- [x] Scores
- [x] Timer
- [x] Game phase
- [x] Board controller
- [x] Undo
- [x] Connection status
- [ ] Other: ________________________

Large/obvious actions:

- [x] Correct
- [x] Wrong
- [x] Reveal answer
- [x] Open buzzers
- [x] Reset buzzers
- [x] Return to board
- [x] Pause
- [x] Undo
- [ ] Other: ________________________

Dangerous action confirmation:

```text
End game:       [x] Yes  [ ] No
Restart game:   [x] Yes  [ ] No
Remove Player:  [x] Yes  [ ] No
Clear scores:   [x] Yes  [ ] No
```

### Original Q53 — How should successful Host actions feel?

```text
Immediate, crisp, tactile (micro-feedback click animation) with unambiguous visual state transitions and instant undo availability.
```

## Host Screen Hierarchy — Original Screen Checklist

```text
Primary:
Active Clue prompt & Answer with giant Correct (Green) / Incorrect (Red) judging buttons

Secondary:
Interactive 6x5 clue grid matrix and connected player score adjustment list

Persistent:
Top navigation bar with phase indicator, room code, timer controls, Pause, and Undo/Redo
```

### Completion Question — Host keyboard shortcuts required?

- [x] Yes
- [ ] No

If yes:

```text
Correct: C or Enter
Wrong: W or Backspace
Open buzzers: Spacebar
Reveal: R
Pause: P or Escape
Undo: U or Ctrl+Z
Other: 1-6 for quick player selection
```

**Role 4 sign-off**

```text
Owner: Role 4 Specialist
[x] Host design complete
```

---

# PART F — ROLE 5: CONTENT / QUESTION EDITOR
## Owner: Person 5

## Question Editor — Original Q45–47

Layout:

- [ ] Spreadsheet/table
- [ ] Cards
- [ ] One category at a time
- [x] Full game-board preview
- [ ] Other: ________________________

Inline validation:

- [x] Yes
- [ ] No

Required controls:

- [x] Add category
- [x] Remove category
- [x] Reorder category
- [x] Add clue
- [x] Edit clue
- [x] Set value
- [x] Set answer
- [x] Attach media
- [x] Set Daily Double
- [x] Preview game
- [x] Import
- [x] Export
- [ ] Other: ________________________

### Original Q74 — Empty board/editor state

```text
Clean placeholder board with prefilled standard values ($200-$1000) and "+ Click to add Category" cards with "Import Template (JSON/CSV)" quick-start button.
```

## Question Editor Screen Hierarchy — Original Screen Checklist

```text
Primary:
6x5 Visual Game Board editor grid with category headers and clue cards

Secondary:
Clue editing modal (Prompt, Correct Answer, Value, Media upload, Daily Double toggle)

Persistent:
Pack metadata header (Title, Description, Round tabs: Jeopardy / Double / Final) and Save / Export action bar
```

### Completion Question — Media editor behavior

- [x] Drag/drop upload
- [x] File picker
- [x] URL input
- [x] Preview media
- [x] Replace media
- [x] Remove media
- [x] File/type validation
- [ ] Other: ________________________

### Completion Question — Validation presentation

- [x] Inline per field
- [x] Summary at top
- [ ] Modal on save
- [x] Toast
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner: Role 5 Specialist
[x] Content/editor design complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

## Connection / Error Feedback — Original Q54–55

### Q54 — How should errors feel?

```text
Non-intrusive for transient issues (auto-reconnecting toast), clear and reassuring for recoverable errors, and actionable with a single-click "Retry" or "Reload State" button.
```

### Q55 — Connection loss presentation

- [x] Banner
- [ ] Modal
- [x] Status dot
- [ ] Toast
- [ ] Full-screen interruption
- [ ] Other: ________________________

## Target Viewports — Original Q64

- [x] 360×640 phone
- [x] 390×844 phone
- [x] Tablet portrait
- [x] Tablet landscape
- [x] 1280×720 laptop
- [x] 1920×1080 TV
- [x] 2560×1440 display
- [ ] Other: ________________________

## Accessibility — Original Q68–73

Keyboard support:

- [ ] Host only
- [x] Full app
- [ ] No

Visible focus states:

- [x] Yes
- [ ] No

Minimum text contrast:

- [x] WCAG AA
- [ ] WCAG AAA where possible
- [ ] Not specified

State uses text/icons in addition to color:

- [x] Yes
- [ ] No

Minimum touch target:

- [ ] 44×44 px
- [x] 48×48 px
- [ ] Other: ________________________

Screen reader support:

- [ ] Host controls
- [ ] Player controls
- [ ] Editor
- [x] Entire app
- [ ] Not required for v1

## Loading / Reconnect / Fatal States — Original Q75–77

```text
Loading a game:
Animated spinning JeoParty golden emblem with "Entering the Game Show..." progress pulse.

Reconnecting:
Amber top banner "Connection lost. Re-establishing link..." with automatic background exponential-backoff retry.

Fatal error:
Clean recovery card "Something went wrong" with "Restore Room Snapshot" and "Contact Host" buttons.
```

## Design Tokens — Original Section S / Q78

Centralize:

- [x] Colors
- [x] Font sizes
- [x] Font families
- [x] Font weights
- [x] Spacing
- [x] Radii
- [x] Shadows
- [x] Z-index layers
- [x] Animation durations
- [x] Breakpoints

```text
Token implementation location:
tailwind.config.ts and src/styles/tokens.css
```

### Completion Question — How should stale/offline state be signaled?

```text
Desaturate non-essential UI elements slightly, display a persistent orange "Reconnecting..." badge in top navbar, and disable time-critical actions like buzzer taps until link is verified.
```

### Completion Question — Responsive QA responsibility

- [ ] Role 6 owns cross-device verification
- [x] Each role owns its screens; Role 6 runs integration QA
- [ ] Other: ________________________

**Role 6 sign-off**

```text
Owner: Role 6 Specialist
[x] Integration/accessibility/system-state design complete
```

---

# PART H — FINAL DESIGN APPROVAL
## Requires 6/6 Approval

```text
Person 1: Role 1 Specialist  [x] Approved
Person 2: Role 2 Specialist  [x] Approved
Person 3: Role 3 Specialist  [x] Approved
Person 4: Role 4 Specialist  [x] Approved
Person 5: Role 5 Specialist  [x] Approved
Person 6: Role 6 Specialist  [x] Approved
```

Status:

- [ ] DRAFT
- [ ] NEEDS DISCUSSION
- [x] APPROVED / FROZEN

## Source-of-Truth Completion Gate

Before this document can be marked **APPROVED / FROZEN**:

- [x] Every required question has an explicit answer.
- [x] Every `Other:` choice is explained.
- [x] No mutually exclusive options are both selected unless the question explicitly allows multiple selections.
- [x] Every role owner has reviewed their section.
- [x] Every item in **All-Member Decisions** has 6/6 approval.
- [x] Cross-document contradictions have been resolved.
- [x] Any intentional deferral is labeled `DEFERRED` and states which future version owns it.
- [x] The final AI handoff prompt is run only after the document is complete.


---

# AI HANDOFF PROMPT

> Use this completed six-role Design System Questionnaire as the visual source of truth. Produce `DESIGN_SYSTEM.md` containing design tokens, typography, color roles, spacing, radii, shared component variants, game-state semantics, TV/board rules, Player UI rules, Host UI rules, Editor UI rules, system/loading/reconnect/error states, motion, sound, responsive behavior, and accessibility. Preserve the six-role ownership boundaries. Do not independently redesign the product or alter game behavior. If a visual requirement is unresolved or contradictory, list it as a blocker instead of inventing a choice.
