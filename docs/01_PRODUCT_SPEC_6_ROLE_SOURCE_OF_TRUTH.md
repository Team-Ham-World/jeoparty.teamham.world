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
jeoparty.teamham.world (JeoParty)
```

### Original Q2 — One-sentence product definition

Example:

> A browser-based custom Jeopardy game that lets a host run a game on a TV while players use their phones as buzzers.

```text
Our definition:
A fast, browser-based 1-to-1 parody of Jeopardy with Team Ham themes and OAuth integration, enabling a host to run the game board on a TV while individual players or teams buzz in from their phones and spectators chat and react in realtime.
```

### Original Q3 — Primary purpose

Choose all that apply:

- [x] Party game with friends
- [ ] Classroom / education
- [x] Family game night
- [x] Stream / online event
- [x] Club / organization events
- [x] Reusable personal project
- [x] Portfolio project
- [x] Other: Community / Team Ham events & streams

### Original Q4 — Product priorities

Rank **1 = most important** to **6 = least important**.

```text
1 Fun / game feel
2 Reliability
3 Easy setup
4 Multiplayer responsiveness
5 Customization
6 Visual polish
```

### Original Q5 — Who uses the application?

- [x] Host
- [x] Players
- [x] Audience / spectators
- [x] Game creator / editor
- [x] Administrator
- [ ] Other: ________________________

### Required Screens — Version 1 scope

Check every screen required for Version 1.

- [x] Landing / Home
- [x] Create Game
- [x] Edit Question Pack
- [x] Host Lobby
- [x] Player Join
- [x] Player Lobby
- [x] Main Game Board / TV
- [x] Clue Screen
- [x] Player Buzzer Screen
- [x] Host Control Panel
- [x] Daily Double Screen
- [x] Final Jeopardy Wager Screen
- [x] Final Jeopardy Answer Screen
- [x] Results / Winner Screen
- [ ] Game History
- [x] Settings
- [x] Saved Games
- [ ] Other: ________________________

### Core Feature Priority Matrix

For every feature, select exactly one priority.

| Feature | Must Have | Should Have | Later | Never |
|---|---|---|---|---|
| Custom categories | [ ] | [x] | [ ] | [ ] |
| Custom clues/questions | [x] | [ ] | [ ] | [ ] |
| Scores | [x] | [ ] | [ ] | [ ] |
| Phone buzzers | [ ] | [x] | [ ] | [ ] |
| Room codes | [ ] | [x] | [ ] | [ ] |
| Daily Doubles | [x] | [ ] | [ ] | [ ] |
| Final Jeopardy | [x] | [ ] | [ ] | [ ] |
| Timers | [x] | [ ] | [ ] | [ ] |
| Sound effects | [x] | [ ] | [ ] | [ ] |
| Animations | [x] | [ ] | [ ] | [ ] |
| Save/resume games | [x] | [ ] | [ ] | [ ] |
| Question pack import | [ ] | [ ] | [x] | [ ] |
| Question pack export | [ ] | [ ] | [x] | [ ] |
| Images in clues | [x] | [ ] | [ ] | [ ] |
| Video in clues | [ ] | [x] | [ ] | [ ] |
| Audio in clues | [ ] | [x] | [ ] | [ ] |
| Undo | [ ] | [x] | [ ] | [ ] |
| Manual score adjustment | [x] | [ ] | [ ] | [ ] |
| Player reconnect | [x] | [ ] | [ ] | [ ] |
| Game statistics | [ ] | [ ] | [x] | [ ] |
| Accounts/login | [ ] | [ ] | [x] | [ ] |

Add missing features:

```text
Feature: Teams selection   Priority: Must have
Feature: Team ham login Oauth system    Priority: must have
Feature: audience chat/ reactions after an answer from audience  Priority: Must have
Feature: accessibility control option of chat to display if typing or not   Priority: Must have
```

### Original Q31 — What MUST work before Version 1 is finished?

```text
1. Realtime buzzer system with sub-millisecond tie-breaking, lockout, and zero dual-buzz bugs.
2. Synchronized state across TV/Display, Host dashboard, Player phones, and Spectator views.
3. Complete 3-phase Jeopardy game loop (Jeopardy, Double Jeopardy, Final Jeopardy + Daily Doubles).
4. Host controls: clue selection, judging, score adjustment, buzzer unlock/reset, timer overrides, and undo.
5. Question pack creation/editing/loading with persistence and Team Ham OAuth authentication.
```

### Original Q32 — Explicitly OUT OF SCOPE for Version 1

```text
1. Native mobile applications (iOS/Android App Store binaries; web PWA is used instead).
2. AI-generated voice speech synthesis reading clues aloud automatically.
3. Multi-game tournament bracket management systems.
4. Paid subscriptions, microtransactions, or monetization/monetary wagering.
5. Offline mesh network communication without internet/local network server connectivity.
```

### Original Q33 — What can be mocked or simplified in Version 1?

```text
- Player avatars can use generated letter-badges / Team Ham theme avatars instead of full custom image uploads.
- Advanced game analytics/statistics can be simplified to final game scoreboard and summary stats.
- Local sound effects can use high-quality bundled Web Audio API / audio assets without requiring external CDN streaming.
```

### Original Q34 — Definition of a successful full game

Example:

> A Host creates a room, three Players join on phones, the Host runs every round, buzzers work reliably, scores stay synchronized, Final Jeopardy completes, and the winner is shown without refreshing or manually editing data.

```text
Our definition:
a 1-1 parody of jeopardy game with themes of Ham. A host creates and controls a room, players/teams join seamlessly on mobile devices, the main game board displays cleanly on a TV, buzzers and scores stay strictly synchronized in real-time, Daily Doubles and Final Jeopardy execute flawlessly, and the final winner is crowned without page reloads.
```

### Original Q35 — Unacceptable failures

- [x] Scores desynchronize
- [x] Two Players win the same buzz
- [x] Refresh destroys the game
- [x] Players cannot reconnect
- [x] Used clues reappear
- [x] Host loses control
- [x] Final Jeopardy exposes answers early
- [x] Other: Accidental double-judging or desynchronized game phase lockouts

### Product-level non-negotiables

```text
1. Rock-solid buzzer fairness and sub-second real-time responsiveness across all connected devices.
2. Absolute data integrity: scores, current phase, and clue states must never desync across views.
3. Zero question/answer leaks: correct responses and hidden Daily Double positions are never sent to players before reveal.
```

---

# PART B — ROLE 1: ENGINE & RULES
## Owner: Person 1

### Original Q9 — Required game modes for Version 1

- [x] Jeopardy round
- [x] Double Jeopardy
- [x] Final Jeopardy
- [x] Custom rounds
- [ ] Lightning round
- [ ] Practice mode
- [ ] Other: ________________________

### Original Q10 — Player limits

```text
Minimum: 1 (Practice / Solo with Host) or 2 (Competitive)
Maximum: 16 (Individual players or Teams)
Ideal/default: 3 to 6
```

### Original Q11 — Is there always one Host?

- [x] Yes
- [ ] No

### Original Q12 — Can the Host also play?

- [ ] Yes
- [ ] No
- [x] Optional setting

### Original Q13 — Can a game be played without player phones?

- [ ] No — phones are required
- [x] Yes — Host can manually control buzzing
- [ ] Yes — keyboard/controller alternative
- [ ] Other: ________________________

### Completion Question — How traditional should the rules be?

```text
1 = Very custom / loose rules
10 = Closely follow traditional Jeopardy

Answer: 9 / 10 (Traditional rules with Team Ham flavor and configurable options)
```

### Completion Question — Which gameplay rules must be configurable per game?

- [x] Player count
- [x] Number of rounds
- [x] Category count
- [x] Clue count
- [x] Clue values
- [x] Incorrect-answer penalties
- [x] Timers
- [x] Daily Double count/rules
- [x] Final Jeopardy eligibility
- [ ] Other: ________________________

**Role 1 sign-off**

```text
Owner name: Role 1 — Engine & Rules Specialist
[x] My Product Spec questions are complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

### Original Q7 — Main display device support

- [x] TV
- [x] Projector
- [x] Laptop screen
- [x] Desktop monitor
- [ ] Other: ________________________

### Original Q14 — Which screen is shown on the TV/projector?

```text
Main Game Board / TV Display Route (/display or /board/:roomCode) featuring fullscreen animated 6x5 board, category headers, active clue modal with media support, buzzer status banner, and persistent team/player podium scoreboards.
```

### Completion Question — Does the audience display run independently from the Host screen?

- [x] Yes — separate route/window/device
- [ ] No — Host mirrors the same screen
- [ ] Optional
- [ ] Other: ________________________

### Completion Question — Must spectators be able to open a read-only display URL?

- [x] Yes
- [ ] No
- [ ] Later

**Role 2 sign-off**

```text
Owner name: Role 2 — Board & Presentation Specialist
[x] My Product Spec questions are complete
```

---

# PART D — ROLE 3: PLAYER / BUZZER / SCORING EXPERIENCE
## Owner: Person 3

### Original Q7 — Player device support

- [x] Desktop
- [x] Laptop
- [x] Tablet
- [x] Phone
- [ ] Other: ________________________

### Original Q16 — Which screen do Players use?

```text
Player Mobile Web View (/play/:roomCode or /join) featuring full-screen responsive buzzer, team/player identity badge, current score, buzz state feedback, Daily Double / Final Jeopardy wager inputs, and Final Jeopardy answer submission.
```

### Completion Question — Is a phone the primary Player experience?

- [x] Yes
- [ ] No
- [ ] Phone plus desktop/tablet equally supported

### Completion Question — What must a Player be able to do in Version 1?

- [x] Join room
- [x] Choose/display name
- [x] See own score
- [x] See all scores
- [x] Buzz
- [x] See whether buzz was won/lost
- [x] Submit Daily Double wager
- [x] Submit Final Jeopardy wager
- [x] Submit Final Jeopardy answer
- [x] Reconnect
- [x] Leave game
- [x] Other: Select team avatar/color and send audience reactions

**Role 3 sign-off**

```text
Owner name: Role 3 — Player Experience Specialist
[x] My Product Spec questions are complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

### Original Q6 — Does the Host need technical knowledge?

- [x] No — anyone should be able to host
- [ ] Some familiarity is okay
- [ ] Yes — mainly for our group

### Original Q7 — Host device support

- [x] Desktop
- [x] Laptop
- [x] Tablet
- [x] Phone
- [ ] Other: ________________________

### Original Q15 — Which screen does the Host use?

```text
Host Control Dashboard (/host/:roomCode) with real-time clue selection matrix, answer reveal prompt, judging buttons (Correct/Incorrect/Skip), buzzer reset, score adjustments, undo/redo, timer controls, and connected player management.
```

### Completion Question — What must the Host be able to do in Version 1?

- [x] Create/start a room
- [x] Start/pause/resume game
- [x] Select clue
- [x] Open/close/reset buzzers
- [x] Mark correct/incorrect
- [x] Reveal answer
- [x] Manually adjust score
- [x] Change board control
- [x] Undo
- [x] Advance rounds
- [x] Manage connected Players
- [x] Run Final Jeopardy
- [x] End game
- [ ] Other: ________________________

**Role 4 sign-off**

```text
Owner name: Role 4 — Host Controls Specialist
[x] My Product Spec questions are complete
```

---

# PART F — ROLE 5: CONTENT / QUESTION EDITOR
## Owner: Person 5

### Original Q17 — Can users create multiple Jeopardy games/question packs?

- [x] Yes
- [ ] No

### Original Q18 — What should a question pack contain?

- [x] Title
- [x] Description
- [x] Author
- [x] Categories
- [x] Clues
- [x] Correct answers
- [x] Media
- [x] Daily Double locations
- [x] Round settings
- [x] Visual theme
- [ ] Other: ________________________

### Original Q19 — How should packs be created?

- [x] Built-in editor
- [x] JSON import
- [x] CSV import
- [ ] Spreadsheet import
- [ ] Manual code/file editing
- [ ] Other: ________________________

### Original Q20 — Should editing autosave?

- [x] Yes
- [ ] No

### Completion Question — Which content types are required for Version 1?

- [x] Text-only clues
- [x] Image clues
- [x] Audio clues
- [x] Video clues
- [x] Multiple acceptable answers
- [x] Explanations/notes for Host
- [ ] Tags/difficulty
- [ ] Other: ________________________

### Completion Question — Can a Host start a game with incomplete content?

- [x] No — block start
- [ ] Yes — warn only
- [ ] Yes — allow blanks
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner name: Role 5 — Content & Question Editor Specialist
[x] My Product Spec questions are complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

### Original Q8 — Browser support

- [x] Chrome
- [x] Edge
- [x] Firefox
- [x] Safari
- [x] Mobile Safari
- [x] Mobile Chrome
- [ ] Other: ________________________

### Original Q21 — How do Players join?

- [x] Room code
- [x] QR code
- [x] Direct URL
- [ ] Local network only
- [ ] Host manually adds them

### Original Q22 — Does a room require a password/PIN?

- [ ] No
- [x] Optional
- [ ] Always

### Original Q23 — Can Players join after the game starts?

- [ ] No
- [x] Yes, anytime
- [ ] Only between clues
- [ ] Only between rounds

### Original Q24 — Should disconnected Players be able to reconnect?

- [x] Yes
- [ ] No

### Original Q25 — Is remote internet play required?

- [x] Yes
- [ ] No
- [ ] Later

### Original Q26 — What should be saved?

- [x] Question packs
- [x] Unfinished games
- [x] Finished games
- [x] Scores
- [x] Game history
- [x] Player statistics
- [x] Host settings
- [x] Themes
- [ ] Nothing after game ends
- [ ] Other: ________________________

### Original Q27 — Should a live game survive a page refresh?

- [x] Yes
- [ ] No

### Original Q28 — Should a live game survive the Host accidentally closing the browser?

- [x] Yes
- [ ] No
- [ ] Best effort only

### Original Q29 — Are user accounts required?

- [ ] No accounts
- [x] Host account only
- [ ] Host and Player accounts
- [ ] Later

### Original Q30 — If no Player accounts exist, how are Players identified?

- [ ] Temporary player ID
- [ ] Name only
- [x] Name + reconnect token
- [ ] Other: ________________________

### Completion Question — Deployment target for Version 1

```text
Web App deployed on Vercel / Railway with Supabase (PostgreSQL + Auth + Realtime WebSocket) hosted on jeoparty.teamham.world
```

### Completion Question — Should one room be playable across different networks?

- [x] Yes — internet-hosted multiplayer
- [ ] No — same local network only
- [ ] Both
- [ ] Later

**Role 6 sign-off**

```text
Owner name: Role 6 — Network & Persistence Specialist
[x] My Product Spec questions are complete
```

---

# PART H — SIX-PERSON OWNERSHIP CONFIRMATION
## Requires 6/6 Approval

```text
Person 1 — Engine & Rules:
Name: Role 1 Specialist
Scope notes: Core state machine, scoring, game rules, Daily Double, Final Jeopardy, history/undo

Person 2 — Board & Presentation:
Name: Role 2 Specialist
Scope notes: TV presentation, responsive 6x5 board, clue modal, animations, score podiums

Person 3 — Player / Buzzer / Scoring Experience:
Name: Role 3 Specialist
Scope notes: Mobile phone buzzer UI, player join/reconnect, wagers, answer input

Person 4 — Host Controls:
Name: Role 4 Specialist
Scope notes: Host dashboard, judging controls, score adjustments, game lifecycle administration

Person 5 — Content / Question Editor:
Name: Role 5 Specialist
Scope notes: Question pack schema, pack builder/editor, JSON/CSV importer, media attachments

Person 6 — Network / Persistence / Integration:
Name: Role 6 Specialist
Scope notes: Realtime WebSocket sync, PostgreSQL persistence, Team Ham OAuth, room management
```

---

# PART I — FINAL PRODUCT APPROVAL
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

> Read this completed six-role Product Spec as the source of truth for the Custom Jeopardy project. Preserve every approved decision. Produce a concise final `PRODUCT_SPEC.md` covering Version 1 scope, user roles, required screens, gameplay modes, must-have features, non-goals, content requirements, multiplayer requirements, persistence requirements, supported devices/browsers, and success criteria. Do not invent missing requirements. If any unanswered field, contradiction, or incompatible choice remains, stop and list it as a blocker instead of assuming an answer. The resulting spec will be consumed by six parallel coding agents: Engine, Board, Player, Host, Content, and Network.
