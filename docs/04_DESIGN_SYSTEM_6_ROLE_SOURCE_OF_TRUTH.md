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
- [ ] Playful
- [ ] Competitive
- [ ] Minimal
- [ ] Cinematic
- [ ] Neon
- [ ] Clean
- [ ] Funny / chaotic
- [ ] Other: ________________________

### Q2 — Traditional Jeopardy resemblance

```text
1 = Completely original
10 = Very close to traditional Jeopardy

Answer: ______ / 10
```

### Q3 — Overall light/dark direction

- [ ] Primarily dark
- [ ] Primarily light
- [ ] Dark game display + light controls
- [ ] Themeable

### Q4 — Visual adjectives

```text
1. ________________________
2. ________________________
3. ________________________
4. ________________________
5. ________________________
```

## Brand / Identity — Original Q5–8

```text
Game/project name shown in UI:
________________________________________
```

Logo:

- [ ] Yes
- [ ] No
- [ ] Later

Custom intro/title screen:

- [ ] Yes
- [ ] No

```text
Tagline:
________________________________________
```

## Shared Color System — Original Q9–18

```text
Main background: ________________________
Board tile: _____________________________
Score/value: ____________________________
Primary text: ___________________________
Secondary text: _________________________
Correct: _______________________________
Incorrect: _____________________________
Warning: _______________________________
```

Player colors:

- [ ] Fixed palette
- [ ] Player chooses
- [ ] Random
- [ ] No Player-specific colors

If fixed:

```text
1. ________________________
2. ________________________
3. ________________________
4. ________________________
5. ________________________
6. ________________________
```

Color alone communicates important state:

- [ ] No
- [ ] Yes

## Shared Typography — Original Q19–21

Display font style:

- [ ] Bold sans serif
- [ ] Condensed sans serif
- [ ] Serif
- [ ] Game-show inspired
- [ ] Retro
- [ ] Other: ________________________

UI/control font:

- [ ] Sans serif
- [ ] Monospace
- [ ] Serif
- [ ] Same as display font

```text
Display font: ________________________
UI font: ____________________________
```

## Shared Shape / Spacing — Original Q24–28

```text
Density, 1 compact → 10 spacious: ______ / 10
```

Corner radius:

- [ ] Sharp / square
- [ ] Slightly rounded
- [ ] Rounded
- [ ] Very rounded

Borders:

- [ ] Strong visible
- [ ] Thin subtle
- [ ] Mostly borderless
- [ ] Mixed

Shadows:

- [ ] None
- [ ] Subtle
- [ ] Strong / dramatic
- [ ] Only overlays/modals

Spacing base:

- [ ] 4px
- [ ] 8px
- [ ] Other: ________________________

## Shared Components — Original Section K

Approve reusable components:

- [ ] `Button`
- [ ] `IconButton`
- [ ] `Card`
- [ ] `Modal`
- [ ] `Drawer`
- [ ] `Input`
- [ ] `Select`
- [ ] `Checkbox`
- [ ] `Tooltip`
- [ ] `Toast`
- [ ] `PlayerBadge`
- [ ] `ScoreDisplay`
- [ ] `Timer`
- [ ] `ClueTile`
- [ ] `CategoryHeader`
- [ ] `BuzzerButton`
- [ ] `StatusIndicator`
- [ ] `ConfirmationDialog`
- [ ] `ScreenLayout`
- [ ] `LoadingState`
- [ ] `ErrorState`

Add:

```text
________________________________________
________________________________________
```

## Shared Button System — Original Q48–51

Variants:

- [ ] Primary
- [ ] Secondary
- [ ] Danger
- [ ] Success
- [ ] Ghost
- [ ] Icon-only

Sizes:

- [ ] Small
- [ ] Medium
- [ ] Large
- [ ] Extra-large / Host controls

```text
Disabled state:
________________________________________

Loading state:
________________________________________
```

## Design Ownership Rules — Original Q79–82

### Q79 — Can feature teams invent new button style?

- [ ] No
- [ ] Yes
- [ ] Only with team approval

### Q80 — Can feature teams introduce new colors?

- [ ] No
- [ ] Yes
- [ ] Only with team approval

### Q81 — Can feature teams create duplicate shared components?

- [ ] No
- [ ] Yes

### Q82 — Who approves design-system changes?

- [ ] All 6
- [ ] Majority
- [ ] Design owner
- [ ] Other: ________________________

---

# PART B — ROLE 1: ENGINE & RULES
## Owner: Person 1

Role 1 owns **semantic state presentation rules**: what game state means visually, not the styling itself.

### Original Q52 — What forms of feedback are permitted/required?

- [ ] Visual state
- [ ] Toast
- [ ] Sound
- [ ] Haptic/vibration
- [ ] Animation
- [ ] Depends on action

### Completion Question — Which game states must always be visually distinguishable?

- [ ] Waiting/lobby
- [ ] Board control
- [ ] Reading clue
- [ ] Buzzers closed
- [ ] Buzzers open
- [ ] Buzz won
- [ ] Judging
- [ ] Answer revealed
- [ ] Paused
- [ ] Daily Double
- [ ] Final Jeopardy
- [ ] Game over
- [ ] Other: ________________________

### Completion Question — Score changes should display

- [ ] New total only
- [ ] Delta then new total
- [ ] Animated count
- [ ] Other: ________________________

### Completion Question — UI may optimistically show a game-result change before server confirms?

- [ ] No
- [ ] Yes
- [ ] Only non-critical actions

### Completion Question — Required semantic labels/icons

```text
Correct:
________________________________________

Incorrect:
________________________________________

Paused:
________________________________________

Disconnected:
________________________________________

Buzzer open:
________________________________________

Buzz won:
________________________________________
```

**Role 1 sign-off**

```text
Owner: ________________________
[ ] Game-state presentation semantics complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

## Display Typography — Original Q22–23

Clue text:

- [ ] ALL CAPS
- [ ] Sentence case
- [ ] Title case
- [ ] Match traditional Jeopardy feel

```text
Maximum clue lines before resizing: ______
```

## Main TV / Projector — Original Q29–33

```text
Columns/categories: ______
Rows/clues: ______
```

Scores always visible:

- [ ] Yes
- [ ] No
- [ ] Only on board screen

Score location:

- [ ] Bottom
- [ ] Top
- [ ] Side
- [ ] Separate scoreboard

Controlling Player highlighted:

- [ ] Yes
- [ ] No

How:

- [ ] Border
- [ ] Glow
- [ ] Icon
- [ ] Label
- [ ] Animation
- [ ] Other: ________________________

## Clue Screen — Original Q34–36

Show:

- [ ] Category
- [ ] Value
- [ ] Clue text
- [ ] Timer
- [ ] Player scores
- [ ] Buzzer status
- [ ] Current buzzed Player
- [ ] Media
- [ ] Other: ________________________

Clue text transition:

- [ ] None
- [ ] Fade
- [ ] Scale
- [ ] Slide
- [ ] Typewriter
- [ ] Other: ________________________

When Player buzzes:

- [ ] Player name appears
- [ ] Screen accent changes
- [ ] Sound plays
- [ ] Timer changes
- [ ] Other: ________________________

## Motion — Original Q56–59

```text
Motion intensity 1–10: ______
```

Major-animation events:

- [ ] Game start
- [ ] Round start
- [ ] Clue selection
- [ ] Correct answer
- [ ] Wrong answer
- [ ] Daily Double
- [ ] Final Jeopardy
- [ ] Winner reveal
- [ ] Score changes
- [ ] Other: ________________________

```text
Fast UI: ______ ms
Normal UI: ______ ms
Major reveal: ______ ms
```

Reduced motion:

- [ ] Respect OS `prefers-reduced-motion`
- [ ] Add in-app setting
- [ ] Both

## Sound — Original Q60–63

Sound:

- [ ] Yes
- [ ] No
- [ ] Later

Sound events:

- [ ] Game start
- [ ] Clue reveal
- [ ] Buzzer open
- [ ] Buzz win
- [ ] Correct
- [ ] Wrong
- [ ] Daily Double
- [ ] Timer warning
- [ ] Timer expired
- [ ] Final Jeopardy
- [ ] Winner
- [ ] Other: ________________________

Volume control:

- [ ] Host only
- [ ] Each client
- [ ] Both

Global mute:

- [ ] Yes
- [ ] No

## Board Responsive Rules — Original Q65, Q67

TV assumes landscape:

- [ ] Yes
- [ ] No

If board does not fit:

- [ ] Scale entire board
- [ ] Reduce text size
- [ ] Horizontal scroll
- [ ] Dynamic column count
- [ ] Other: ________________________

## Screen Hierarchy — Original Main Board, Clue, Final Jeopardy

```text
MAIN BOARD
Primary:
________________________________________
Secondary:
________________________________________
Persistent:
________________________________________

CLUE SCREEN
Primary:
________________________________________
Secondary:
________________________________________

FINAL JEOPARDY
Primary:
________________________________________
Secondary:
________________________________________
```

**Role 2 sign-off**

```text
Owner: ________________________
[ ] Board/presentation design complete
```

---

# PART D — ROLE 3: PLAYER / BUZZER / SCORING EXPERIENCE
## Owner: Person 3

## Player Phone UI — Original Q37–40

Primary layout:

- [ ] Huge single BUZZ button
- [ ] Buzz button + score
- [ ] Buzz button + clue
- [ ] Full miniature game view

```text
Active-buzzer button occupies: ______ % of screen
```

Define states:

```text
CLOSED:
________________________________________

OPEN:
________________________________________

PRESSED / SENT:
________________________________________

WON BUZZ:
________________________________________

LOCKED:
________________________________________

WRONG / INELIGIBLE:
________________________________________
```

Phone vibration:

- [ ] Buzzer open
- [ ] Buzz win
- [ ] Wrong answer
- [ ] Never
- [ ] Optional setting

### Original Q66 — Player portrait support

- [ ] Primarily portrait
- [ ] Primarily landscape
- [ ] Both equally

## Player Buzzer Screen Hierarchy — Original Screen Checklist

```text
Primary:
________________________________________

Secondary:
________________________________________

Persistent:
________________________________________
```

### Completion Question — Minimum Player information visible during clue

- [ ] Name
- [ ] Score
- [ ] Buzz state
- [ ] Clue text
- [ ] Timer
- [ ] Connectivity
- [ ] Other: ________________________

**Role 3 sign-off**

```text
Owner: ________________________
[ ] Player design complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

## Host Dashboard — Original Q41–44

Rank:

```text
___ Speed
___ Information density
___ Large controls
___ Visual beauty
___ Keyboard shortcuts
___ Touch friendliness
```

Always visible:

- [ ] Current clue
- [ ] Correct answer
- [ ] Buzz winner
- [ ] Scores
- [ ] Timer
- [ ] Game phase
- [ ] Board controller
- [ ] Undo
- [ ] Connection status
- [ ] Other: ________________________

Large/obvious actions:

- [ ] Correct
- [ ] Wrong
- [ ] Reveal answer
- [ ] Open buzzers
- [ ] Reset buzzers
- [ ] Return to board
- [ ] Pause
- [ ] Undo
- [ ] Other: ________________________

Dangerous action confirmation:

```text
End game:       [ ] Yes  [ ] No
Restart game:   [ ] Yes  [ ] No
Remove Player:  [ ] Yes  [ ] No
Clear scores:   [ ] Yes  [ ] No
```

### Original Q53 — How should successful Host actions feel?

```text
________________________________________
```

## Host Screen Hierarchy — Original Screen Checklist

```text
Primary:
________________________________________

Secondary:
________________________________________

Persistent:
________________________________________
```

### Completion Question — Host keyboard shortcuts required?

- [ ] Yes
- [ ] No

If yes:

```text
Correct: ________________________
Wrong: _________________________
Open buzzers: __________________
Reveal: ________________________
Pause: _________________________
Undo: __________________________
Other: _________________________
```

**Role 4 sign-off**

```text
Owner: ________________________
[ ] Host design complete
```

---

# PART F — ROLE 5: CONTENT / QUESTION EDITOR
## Owner: Person 5

## Question Editor — Original Q45–47

Layout:

- [ ] Spreadsheet/table
- [ ] Cards
- [ ] One category at a time
- [ ] Full game-board preview
- [ ] Other: ________________________

Inline validation:

- [ ] Yes
- [ ] No

Required controls:

- [ ] Add category
- [ ] Remove category
- [ ] Reorder category
- [ ] Add clue
- [ ] Edit clue
- [ ] Set value
- [ ] Set answer
- [ ] Attach media
- [ ] Set Daily Double
- [ ] Preview game
- [ ] Import
- [ ] Export
- [ ] Other: ________________________

### Original Q74 — Empty board/editor state

```text
________________________________________
```

## Question Editor Screen Hierarchy — Original Screen Checklist

```text
Primary:
________________________________________

Secondary:
________________________________________

Persistent:
________________________________________
```

### Completion Question — Media editor behavior

- [ ] Drag/drop upload
- [ ] File picker
- [ ] URL input
- [ ] Preview media
- [ ] Replace media
- [ ] Remove media
- [ ] File/type validation
- [ ] Other: ________________________

### Completion Question — Validation presentation

- [ ] Inline per field
- [ ] Summary at top
- [ ] Modal on save
- [ ] Toast
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner: ________________________
[ ] Content/editor design complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

## Connection / Error Feedback — Original Q54–55

### Q54 — How should errors feel?

```text
________________________________________
```

### Q55 — Connection loss presentation

- [ ] Banner
- [ ] Modal
- [ ] Status dot
- [ ] Toast
- [ ] Full-screen interruption
- [ ] Other: ________________________

## Target Viewports — Original Q64

- [ ] 360×640 phone
- [ ] 390×844 phone
- [ ] Tablet portrait
- [ ] Tablet landscape
- [ ] 1280×720 laptop
- [ ] 1920×1080 TV
- [ ] 2560×1440 display
- [ ] Other: ________________________

## Accessibility — Original Q68–73

Keyboard support:

- [ ] Host only
- [ ] Full app
- [ ] No

Visible focus states:

- [ ] Yes
- [ ] No

Minimum text contrast:

- [ ] WCAG AA
- [ ] WCAG AAA where possible
- [ ] Not specified

State uses text/icons in addition to color:

- [ ] Yes
- [ ] No

Minimum touch target:

- [ ] 44×44 px
- [ ] 48×48 px
- [ ] Other: ________________________

Screen reader support:

- [ ] Host controls
- [ ] Player controls
- [ ] Editor
- [ ] Entire app
- [ ] Not required for v1

## Loading / Reconnect / Fatal States — Original Q75–77

```text
Loading a game:
________________________________________

Reconnecting:
________________________________________

Fatal error:
________________________________________
```

## Design Tokens — Original Section S / Q78

Centralize:

- [ ] Colors
- [ ] Font sizes
- [ ] Font families
- [ ] Font weights
- [ ] Spacing
- [ ] Radii
- [ ] Shadows
- [ ] Z-index layers
- [ ] Animation durations
- [ ] Breakpoints

```text
Token implementation location:
________________________________________
```

### Completion Question — How should stale/offline state be signaled?

```text
________________________________________
```

### Completion Question — Responsive QA responsibility

- [ ] Role 6 owns cross-device verification
- [ ] Each role owns its screens; Role 6 runs integration QA
- [ ] Other: ________________________

**Role 6 sign-off**

```text
Owner: ________________________
[ ] Integration/accessibility/system-state design complete
```

---

# PART H — FINAL DESIGN APPROVAL
## Requires 6/6 Approval

```text
Person 1: __________________  [ ] Approved
Person 2: __________________  [ ] Approved
Person 3: __________________  [ ] Approved
Person 4: __________________  [ ] Approved
Person 5: __________________  [ ] Approved
Person 6: __________________  [ ] Approved
```

Status:

- [ ] DRAFT
- [ ] NEEDS DISCUSSION
- [ ] APPROVED / FROZEN

## Source-of-Truth Completion Gate

Before this document can be marked **APPROVED / FROZEN**:

- [ ] Every required question has an explicit answer.
- [ ] Every `Other:` choice is explained.
- [ ] No mutually exclusive options are both selected unless the question explicitly allows multiple selections.
- [ ] Every role owner has reviewed their section.
- [ ] Every item in **All-Member Decisions** has 6/6 approval.
- [ ] Cross-document contradictions have been resolved.
- [ ] Any intentional deferral is labeled `DEFERRED` and states which future version owns it.
- [ ] The final AI handoff prompt is run only after the document is complete.


---

# AI HANDOFF PROMPT

> Use this completed six-role Design System Questionnaire as the visual source of truth. Produce `DESIGN_SYSTEM.md` containing design tokens, typography, color roles, spacing, radii, shared component variants, game-state semantics, TV/board rules, Player UI rules, Host UI rules, Editor UI rules, system/loading/reconnect/error states, motion, sound, responsive behavior, and accessibility. Preserve the six-role ownership boundaries. Do not independently redesign the product or alter game behavior. If a visual requirement is unresolved or contradictory, list it as a blocker instead of inventing a choice.
