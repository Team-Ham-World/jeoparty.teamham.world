# 1. PRODUCT SPEC — SIX-ROLE SOURCE-OF-TRUTH QUESTIONNAIRE
## Custom Jeopardy — WHAT We Are Building

**Purpose:** Define Version 1 scope, users, screens, product priorities, feature boundaries, and success criteria before coding.

> **Rule:** If a feature is not approved here, an AI coding agent must not silently add it.

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

These decisions affect the whole product and therefore cannot belong to only one subsystem.

### Original Q1 — Working project name

```text
Project name:
________________________________________
```

### Original Q2 — One-sentence product definition

Example:

> A browser-based custom Jeopardy game that lets a host run a game on a TV while players use their phones as buzzers.

```text
Our definition:
________________________________________
________________________________________
```

### Original Q3 — Primary purpose

Choose all that apply:

- [ ] Party game with friends
- [ ] Classroom / education
- [ ] Family game night
- [ ] Stream / online event
- [ ] Club / organization events
- [ ] Reusable personal project
- [ ] Portfolio project
- [ ] Other: ________________________

### Original Q4 — Product priorities

Rank **1 = most important** to **6 = least important**.

```text
___ Fun / game feel
___ Reliability
___ Easy setup
___ Multiplayer responsiveness
___ Customization
___ Visual polish
```

### Original Q5 — Who uses the application?

- [ ] Host
- [ ] Players
- [ ] Audience / spectators
- [ ] Game creator / editor
- [ ] Administrator
- [ ] Other: ________________________

### Required Screens — Version 1 scope

Check every screen required for Version 1.

- [ ] Landing / Home
- [ ] Create Game
- [ ] Edit Question Pack
- [ ] Host Lobby
- [ ] Player Join
- [ ] Player Lobby
- [ ] Main Game Board / TV
- [ ] Clue Screen
- [ ] Player Buzzer Screen
- [ ] Host Control Panel
- [ ] Daily Double Screen
- [ ] Final Jeopardy Wager Screen
- [ ] Final Jeopardy Answer Screen
- [ ] Results / Winner Screen
- [ ] Game History
- [ ] Settings
- [ ] Saved Games
- [ ] Other: ________________________

### Core Feature Priority Matrix

For every feature, select exactly one priority.

| Feature | Must Have | Should Have | Later | Never |
|---|---|---|---|---|
| Custom categories | [ ] | [ ] | [ ] | [ ] |
| Custom clues/questions | [ ] | [ ] | [ ] | [ ] |
| Scores | [ ] | [ ] | [ ] | [ ] |
| Phone buzzers | [ ] | [ ] | [ ] | [ ] |
| Room codes | [ ] | [ ] | [ ] | [ ] |
| Daily Doubles | [ ] | [ ] | [ ] | [ ] |
| Final Jeopardy | [ ] | [ ] | [ ] | [ ] |
| Timers | [ ] | [ ] | [ ] | [ ] |
| Sound effects | [ ] | [ ] | [ ] | [ ] |
| Animations | [ ] | [ ] | [ ] | [ ] |
| Save/resume games | [ ] | [ ] | [ ] | [ ] |
| Question pack import | [ ] | [ ] | [ ] | [ ] |
| Question pack export | [ ] | [ ] | [ ] | [ ] |
| Images in clues | [ ] | [ ] | [ ] | [ ] |
| Video in clues | [ ] | [ ] | [ ] | [ ] |
| Audio in clues | [ ] | [ ] | [ ] | [ ] |
| Undo | [ ] | [ ] | [ ] | [ ] |
| Manual score adjustment | [ ] | [ ] | [ ] | [ ] |
| Player reconnect | [ ] | [ ] | [ ] | [ ] |
| Game statistics | [ ] | [ ] | [ ] | [ ] |
| Accounts/login | [ ] | [ ] | [ ] | [ ] |

Add missing features:

```text
Feature: __________________   Priority: __________
Feature: __________________   Priority: __________
Feature: __________________   Priority: __________
```

### Original Q31 — What MUST work before Version 1 is finished?

```text
1. ________________________________________
2. ________________________________________
3. ________________________________________
4. ________________________________________
5. ________________________________________
```

### Original Q32 — Explicitly OUT OF SCOPE for Version 1

```text
1. ________________________________________
2. ________________________________________
3. ________________________________________
4. ________________________________________
5. ________________________________________
```

### Original Q33 — What can be mocked or simplified in Version 1?

```text
________________________________________
________________________________________
```

### Original Q34 — Definition of a successful full game

Example:

> A Host creates a room, three Players join on phones, the Host runs every round, buzzers work reliably, scores stay synchronized, Final Jeopardy completes, and the winner is shown without refreshing or manually editing data.

```text
Our definition:
________________________________________
________________________________________
________________________________________
```

### Original Q35 — Unacceptable failures

- [ ] Scores desynchronize
- [ ] Two Players win the same buzz
- [ ] Refresh destroys the game
- [ ] Players cannot reconnect
- [ ] Used clues reappear
- [ ] Host loses control
- [ ] Final Jeopardy exposes answers early
- [ ] Other: ________________________

### Product-level non-negotiables

```text
1. ________________________________________
2. ________________________________________
3. ________________________________________
```

---

# PART B — ROLE 1: ENGINE & RULES
## Owner: Person 1

### Original Q9 — Required game modes for Version 1

- [ ] Jeopardy round
- [ ] Double Jeopardy
- [ ] Final Jeopardy
- [ ] Custom rounds
- [ ] Lightning round
- [ ] Practice mode
- [ ] Other: ________________________

### Original Q10 — Player limits

```text
Minimum: ______
Maximum: ______
Ideal/default: ______
```

### Original Q11 — Is there always one Host?

- [ ] Yes
- [ ] No

### Original Q12 — Can the Host also play?

- [ ] Yes
- [ ] No
- [ ] Optional setting

### Original Q13 — Can a game be played without player phones?

- [ ] No — phones are required
- [ ] Yes — Host can manually control buzzing
- [ ] Yes — keyboard/controller alternative
- [ ] Other: ________________________

### Completion Question — How traditional should the rules be?

```text
1 = Very custom / loose rules
10 = Closely follow traditional Jeopardy

Answer: ______ / 10
```

### Completion Question — Which gameplay rules must be configurable per game?

- [ ] Player count
- [ ] Number of rounds
- [ ] Category count
- [ ] Clue count
- [ ] Clue values
- [ ] Incorrect-answer penalties
- [ ] Timers
- [ ] Daily Double count/rules
- [ ] Final Jeopardy eligibility
- [ ] Other: ________________________

**Role 1 sign-off**

```text
Owner name: ________________________
[ ] My Product Spec questions are complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

### Original Q7 — Main display device support

- [ ] TV
- [ ] Projector
- [ ] Laptop screen
- [ ] Desktop monitor
- [ ] Other: ________________________

### Original Q14 — Which screen is shown on the TV/projector?

```text
________________________________________
```

### Completion Question — Does the audience display run independently from the Host screen?

- [ ] Yes — separate route/window/device
- [ ] No — Host mirrors the same screen
- [ ] Optional
- [ ] Other: ________________________

### Completion Question — Must spectators be able to open a read-only display URL?

- [ ] Yes
- [ ] No
- [ ] Later

**Role 2 sign-off**

```text
Owner name: ________________________
[ ] My Product Spec questions are complete
```

---

# PART D — ROLE 3: PLAYER / BUZZER / SCORING EXPERIENCE
## Owner: Person 3

### Original Q7 — Player device support

- [ ] Desktop
- [ ] Laptop
- [ ] Tablet
- [ ] Phone
- [ ] Other: ________________________

### Original Q16 — Which screen do Players use?

```text
________________________________________
```

### Completion Question — Is a phone the primary Player experience?

- [ ] Yes
- [ ] No
- [ ] Phone plus desktop/tablet equally supported

### Completion Question — What must a Player be able to do in Version 1?

- [ ] Join room
- [ ] Choose/display name
- [ ] See own score
- [ ] See all scores
- [ ] Buzz
- [ ] See whether buzz was won/lost
- [ ] Submit Daily Double wager
- [ ] Submit Final Jeopardy wager
- [ ] Submit Final Jeopardy answer
- [ ] Reconnect
- [ ] Leave game
- [ ] Other: ________________________

**Role 3 sign-off**

```text
Owner name: ________________________
[ ] My Product Spec questions are complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

### Original Q6 — Does the Host need technical knowledge?

- [ ] No — anyone should be able to host
- [ ] Some familiarity is okay
- [ ] Yes — mainly for our group

### Original Q7 — Host device support

- [ ] Desktop
- [ ] Laptop
- [ ] Tablet
- [ ] Phone
- [ ] Other: ________________________

### Original Q15 — Which screen does the Host use?

```text
________________________________________
```

### Completion Question — What must the Host be able to do in Version 1?

- [ ] Create/start a room
- [ ] Start/pause/resume game
- [ ] Select clue
- [ ] Open/close/reset buzzers
- [ ] Mark correct/incorrect
- [ ] Reveal answer
- [ ] Manually adjust score
- [ ] Change board control
- [ ] Undo
- [ ] Advance rounds
- [ ] Manage connected Players
- [ ] Run Final Jeopardy
- [ ] End game
- [ ] Other: ________________________

**Role 4 sign-off**

```text
Owner name: ________________________
[ ] My Product Spec questions are complete
```

---

# PART F — ROLE 5: CONTENT / QUESTION EDITOR
## Owner: Person 5

### Original Q17 — Can users create multiple Jeopardy games/question packs?

- [ ] Yes
- [ ] No

### Original Q18 — What should a question pack contain?

- [ ] Title
- [ ] Description
- [ ] Author
- [ ] Categories
- [ ] Clues
- [ ] Correct answers
- [ ] Media
- [ ] Daily Double locations
- [ ] Round settings
- [ ] Visual theme
- [ ] Other: ________________________

### Original Q19 — How should packs be created?

- [ ] Built-in editor
- [ ] JSON import
- [ ] CSV import
- [ ] Spreadsheet import
- [ ] Manual code/file editing
- [ ] Other: ________________________

### Original Q20 — Should editing autosave?

- [ ] Yes
- [ ] No

### Completion Question — Which content types are required for Version 1?

- [ ] Text-only clues
- [ ] Image clues
- [ ] Audio clues
- [ ] Video clues
- [ ] Multiple acceptable answers
- [ ] Explanations/notes for Host
- [ ] Tags/difficulty
- [ ] Other: ________________________

### Completion Question — Can a Host start a game with incomplete content?

- [ ] No — block start
- [ ] Yes — warn only
- [ ] Yes — allow blanks
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner name: ________________________
[ ] My Product Spec questions are complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

### Original Q8 — Browser support

- [ ] Chrome
- [ ] Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari
- [ ] Mobile Chrome
- [ ] Other: ________________________

### Original Q21 — How do Players join?

- [ ] Room code
- [ ] QR code
- [ ] Direct URL
- [ ] Local network only
- [ ] Host manually adds them

### Original Q22 — Does a room require a password/PIN?

- [ ] No
- [ ] Optional
- [ ] Always

### Original Q23 — Can Players join after the game starts?

- [ ] No
- [ ] Yes, anytime
- [ ] Only between clues
- [ ] Only between rounds

### Original Q24 — Should disconnected Players be able to reconnect?

- [ ] Yes
- [ ] No

### Original Q25 — Is remote internet play required?

- [ ] Yes
- [ ] No
- [ ] Later

### Original Q26 — What should be saved?

- [ ] Question packs
- [ ] Unfinished games
- [ ] Finished games
- [ ] Scores
- [ ] Game history
- [ ] Player statistics
- [ ] Host settings
- [ ] Themes
- [ ] Nothing after game ends
- [ ] Other: ________________________

### Original Q27 — Should a live game survive a page refresh?

- [ ] Yes
- [ ] No

### Original Q28 — Should a live game survive the Host accidentally closing the browser?

- [ ] Yes
- [ ] No
- [ ] Best effort only

### Original Q29 — Are user accounts required?

- [ ] No accounts
- [ ] Host account only
- [ ] Host and Player accounts
- [ ] Later

### Original Q30 — If no Player accounts exist, how are Players identified?

- [ ] Temporary player ID
- [ ] Name only
- [ ] Name + reconnect token
- [ ] Other: ________________________

### Completion Question — Deployment target for Version 1

```text
________________________________________
```

### Completion Question — Should one room be playable across different networks?

- [ ] Yes — internet-hosted multiplayer
- [ ] No — same local network only
- [ ] Both
- [ ] Later

**Role 6 sign-off**

```text
Owner name: ________________________
[ ] My Product Spec questions are complete
```

---

# PART H — SIX-PERSON OWNERSHIP CONFIRMATION
## Requires 6/6 Approval

```text
Person 1 — Engine & Rules:
Name: ________________________
Scope notes: ________________________________________

Person 2 — Board & Presentation:
Name: ________________________
Scope notes: ________________________________________

Person 3 — Player / Buzzer / Scoring Experience:
Name: ________________________
Scope notes: ________________________________________

Person 4 — Host Controls:
Name: ________________________
Scope notes: ________________________________________

Person 5 — Content / Question Editor:
Name: ________________________
Scope notes: ________________________________________

Person 6 — Network / Persistence / Integration:
Name: ________________________
Scope notes: ________________________________________
```

---

# PART I — FINAL PRODUCT APPROVAL
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

> Read this completed six-role Product Spec as the source of truth for the Custom Jeopardy project. Preserve every approved decision. Produce a concise final `PRODUCT_SPEC.md` covering Version 1 scope, user roles, required screens, gameplay modes, must-have features, non-goals, content requirements, multiplayer requirements, persistence requirements, supported devices/browsers, and success criteria. Do not invent missing requirements. If any unanswered field, contradiction, or incompatible choice remains, stop and list it as a blocker instead of assuming an answer. The resulting spec will be consumed by six parallel coding agents: Engine, Board, Player, Host, Content, and Network.
