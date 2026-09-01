# 3. ARCHITECTURE CONTRACT — SIX-ROLE SOURCE-OF-TRUTH QUESTIONNAIRE
## Custom Jeopardy — HOW Behavior Is Represented in Code

**Purpose:** Freeze the shared technical contracts that all six parallel developers and AI agents must follow.

Complete this **after Documents 1 and 2 are approved**.

> **Rule:** No role or AI agent may silently change a frozen shared contract.

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

## Technology Stack — Original Q1–6

### Q1 — Frontend framework

- [ ] Next.js
- [ ] React + Vite
- [ ] Vue
- [ ] Svelte
- [ ] Other: ________________________

### Q2 — Language

- [ ] TypeScript
- [ ] JavaScript
- [ ] Other: ________________________

### Q3 — Styling

- [ ] Tailwind CSS
- [ ] CSS Modules
- [ ] Plain CSS
- [ ] Styled Components
- [ ] Other: ________________________

### Q4 — Backend / realtime technology

- [ ] Supabase
- [ ] Firebase
- [ ] Node + WebSocket server
- [ ] Socket.IO
- [ ] Convex
- [ ] Other: ________________________

### Q5 — Database

- [ ] PostgreSQL
- [ ] Supabase Postgres
- [ ] Firebase
- [ ] SQLite
- [ ] No persistent database
- [ ] Other: ________________________

### Q6 — Hosting

- [ ] Vercel
- [ ] Netlify
- [ ] Render
- [ ] Railway
- [ ] Other: ________________________

## Core Domain Types — Original Section C

For each type, choose exactly one action.

| Type | Keep | Rename | Remove | Final Name |
|---|---|---|---|---|
| `GameState` | [ ] | [ ] | [ ] | __________ |
| `Game` | [ ] | [ ] | [ ] | __________ |
| `GameRoom` | [ ] | [ ] | [ ] | __________ |
| `Player` | [ ] | [ ] | [ ] | __________ |
| `Round` | [ ] | [ ] | [ ] | __________ |
| `Category` | [ ] | [ ] | [ ] | __________ |
| `Clue` | [ ] | [ ] | [ ] | __________ |
| `BuzzerState` | [ ] | [ ] | [ ] | __________ |
| `TimerState` | [ ] | [ ] | [ ] | __________ |
| `DailyDoubleState` | [ ] | [ ] | [ ] | __________ |
| `FinalJeopardyState` | [ ] | [ ] | [ ] | __________ |
| `GameSettings` | [ ] | [ ] | [ ] | __________ |
| `GameHistoryEvent` | [ ] | [ ] | [ ] | __________ |
| `GameCommand` | [ ] | [ ] | [ ] | __________ |

Additional shared types:

```text
________________________________________
________________________________________
```

## `GameState` Contract — Original Section D

Candidate:

```ts
interface GameState {
  gameId: string
  roomCode: string
  status: GameStatus
  phase: GamePhase

  roundIndex: number

  players: Player[]
  rounds: Round[]

  selectedClueId: string | null
  controllingPlayerId: string | null
  buzzedPlayerId: string | null

  buzzer: BuzzerState
  timer: TimerState | null

  dailyDouble: DailyDoubleState | null
  finalJeopardy: FinalJeopardyState | null

  history: GameHistoryEvent[]
  settings: GameSettings
}
```

For every field:

```text
Keep / Rename / Remove:
________________________________________
```

Missing fields:

```text
________________________________________
________________________________________
```

### Original Q11 — Should `GameState` contain derived values?

- [ ] Yes
- [ ] No — derive when needed

## Naming Conventions — Original Q37–38

### TypeScript variables

- [ ] camelCase
- [ ] snake_case
- [ ] Other: __________

### Database columns

- [ ] snake_case
- [ ] camelCase
- [ ] Other: __________

### Components

- [ ] PascalCase
- [ ] Other: __________

### Files

- [ ] kebab-case
- [ ] camelCase
- [ ] PascalCase
- [ ] Other: __________

### Canonical names

```text
Player: ________________________
Clue: _________________________
Category: _____________________
Round: ________________________
Game: _________________________
GameRoom: _____________________
Selected clue field: __________
Board controller field: _______
Buzz winner field: ____________
```

## Folder Ownership — Original Q39–41

Approved structure:

```text
________________________________________
________________________________________
________________________________________
```

Primary ownership:

```text
Person 1 / Engine:
________________________________________

Person 2 / Board:
________________________________________

Person 3 / Player:
________________________________________

Person 4 / Host:
________________________________________

Person 5 / Content:
________________________________________

Person 6 / Network:
________________________________________
```

Shared/frozen folders:

```text
________________________________________
```

## Dependency Rules — Original Q42–44

### Q42 — Who may install dependencies?

- [ ] Anyone
- [ ] Integration owner
- [ ] Team approval required

### Q43 — May AI agents replace a library without approval?

- [ ] No
- [ ] Yes

### Q44 — May feature code import another feature's internal files?

- [ ] No — use public interfaces
- [ ] Yes
- [ ] Case-by-case

## Testing Contract — Original Q52–54

### Required test types

- [ ] Unit tests for game rules
- [ ] State-machine transition tests
- [ ] Realtime integration tests
- [ ] Database tests
- [ ] End-to-end Host → Player test
- [ ] Mobile browser test
- [ ] Accessibility tests
- [ ] Other: ________________________

### Q53 — Must PR pass tests before merge?

- [ ] Yes
- [ ] No

### Q54 — Required CI checks

- [ ] Typecheck
- [ ] Lint
- [ ] Unit tests
- [ ] Build
- [ ] E2E
- [ ] Other: ________________________

## Contract Change Process — Original Q55–57

### What counts as shared-contract change?

- [ ] Add/remove `GameState` field
- [ ] Rename shared type
- [ ] Change command payload
- [ ] Change database schema
- [ ] Change realtime event
- [ ] Change game phase
- [ ] Add dependency used across features
- [ ] Other: ________________________

### Q56 — Approval requirement

- [ ] All 6 must approve
- [ ] Majority approval
- [ ] Architecture owner approves
- [ ] Other: ________________________

### Q57 — Require short proposal?

- [ ] Yes
- [ ] No

Template:

```text
CHANGE:
WHY:
AFFECTED SYSTEMS:
MIGRATION NEEDED:
BREAKING CHANGE:
```

---

# PART B — ROLE 1: ENGINE & RULES
## Owner: Person 1

## Command Contract — Original Q18–20

Candidate commands:

```text
CREATE_GAME
JOIN_GAME
LEAVE_GAME
START_GAME
PAUSE_GAME
RESUME_GAME
SELECT_CLUE
OPEN_BUZZERS
BUZZ
MARK_CORRECT
MARK_INCORRECT
REVEAL_ANSWER
RESET_BUZZERS
ADJUST_SCORE
SUBMIT_DAILY_DOUBLE_WAGER
RESOLVE_DAILY_DOUBLE
ADVANCE_ROUND
SUBMIT_FINAL_WAGER
SUBMIT_FINAL_ANSWER
RESOLVE_FINAL_ANSWER
UNDO
REDO
END_GAME
```

### Q18 — Final command set

```text
________________________________________
________________________________________
```

### Q19 — Standard command envelope

```ts
interface GameCommand<T> {
  id: string
  gameId: string
  actorId: string
  type: string
  payload: T
  createdAt: string
}
```

- [ ] Use as written
- [ ] Modify:

```text
________________________________________
```

### Q20 — Unique command IDs for idempotency?

- [ ] Yes
- [ ] No

## Events / History — Original Q21–24

### Q21 — Commands and history events separate?

- [ ] Yes
- [ ] No

### Q22 — Required history events

```text
________________________________________
________________________________________
________________________________________
```

### Q23 — History events immutable?

- [ ] Yes
- [ ] No

### Q24 — Undo behavior

- [ ] Append reversal event
- [ ] Delete old event
- [ ] Other: ________________________

## State Mutation — Original Q25–27

### Q25 — How may authoritative game state change?

- [ ] Reducer/state-machine function
- [ ] Server actions
- [ ] RPC functions
- [ ] Direct database writes
- [ ] Combination: ________________________

### Q26 — Should UI components contain scoring/game-rule logic?

- [ ] No
- [ ] Yes

### Q27 — Business-rule module/path

```text
________________________________________
```

## Domain Errors — Original Q45–46

Example:

```ts
type GameErrorCode =
  | "INVALID_PHASE"
  | "PLAYER_NOT_ELIGIBLE"
  | "BUZZERS_CLOSED"
  | "CLUE_ALREADY_USED"
  | "INVALID_WAGER"
```

### Q45 — Error representation

- [ ] Structured error codes
- [ ] Plain thrown errors
- [ ] Other: ________________________

### Q46 — Should expected user mistakes be exceptions?

- [ ] No — structured result
- [ ] Yes
- [ ] Depends: ________________________

### Completion Question — Define canonical command result

```text
Success shape:
________________________________________

Expected rejection shape:
________________________________________
```

**Role 1 sign-off**

```text
Owner: ________________________
[ ] Engine contract complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

### Display Client View Contract

Define what `DisplayGameView` is allowed to receive.

- [ ] Board/category data
- [ ] Used clue state
- [ ] Scores
- [ ] Controlling Player
- [ ] Current clue
- [ ] Current phase
- [ ] Buzzer status
- [ ] Buzz winner after authoritative decision
- [ ] Timer state
- [ ] Correct answer only after reveal
- [ ] Daily Double presentation state
- [ ] Final Jeopardy public state
- [ ] Private wagers
- [ ] Private Final answers
- [ ] Host secrets
- [ ] Reconnect tokens
- [ ] Other: ________________________

### Completion Question — Define `DisplayGameView`

```ts
interface DisplayGameView {
  // Fill after team decisions
}
```

```text
Fields:
________________________________________
________________________________________
```

### Completion Question — What presentation-only state remains local?

Examples: transition progress, sound-playing flag, animation queue.

```text
________________________________________
```

### Completion Question — Does display ever send authoritative commands?

- [ ] No — read-only
- [ ] Yes, only clue selection
- [ ] Yes, specified commands:

```text
________________________________________
```

**Role 2 sign-off**

```text
Owner: ________________________
[ ] Display contract complete
```

---

# PART D — ROLE 3: PLAYER / BUZZER / SCORING EXPERIENCE
## Owner: Person 3

## `Player` Contract — Original Q12–13

Candidate:

```ts
interface Player {
  id: string
  displayName: string
  score: number
  connected: boolean
  avatar?: string
  color?: string
  correctCount: number
  incorrectCount: number
  buzzCount: number
}
```

### Q12 — Keep/add Player fields

- [ ] `id`
- [ ] `displayName`
- [ ] `score`
- [ ] `connected`
- [ ] `avatar`
- [ ] `color`
- [ ] `correctCount`
- [ ] `incorrectCount`
- [ ] `buzzCount`

Add:

```text
________________________________________
```

### Q13 — Private Final Jeopardy data on `Player`?

- [ ] Yes
- [ ] No — separate private state
- [ ] Unsure

## Player Client View

Define what `PlayerGameView` may receive:

- [ ] Board
- [ ] Own Player record
- [ ] Everyone's public scores
- [ ] Current clue
- [ ] Game phase
- [ ] Buzzer status
- [ ] Eligibility to buzz
- [ ] Own wager
- [ ] Own Final answer
- [ ] Correct response before reveal
- [ ] Other Players' private wagers
- [ ] Other Players' Final answers
- [ ] Host-only notes
- [ ] Other: ________________________

Define:

```ts
interface PlayerGameView {
  // Fill after team decisions
}
```

```text
Fields:
________________________________________
________________________________________
```

### Completion Question — Player commands

- [ ] `JOIN_GAME`
- [ ] `LEAVE_GAME`
- [ ] `BUZZ`
- [ ] `SELECT_CLUE`
- [ ] `SUBMIT_DAILY_DOUBLE_WAGER`
- [ ] `SUBMIT_FINAL_WAGER`
- [ ] `SUBMIT_FINAL_ANSWER`
- [ ] Other: ________________________

**Role 3 sign-off**

```text
Owner: ________________________
[ ] Player contract complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

## Host Client View

Define what `HostGameView` may receive:

- [ ] Full public board
- [ ] Correct responses
- [ ] Player wagers
- [ ] Final answers
- [ ] Full game history
- [ ] Player connection state
- [ ] Timer state
- [ ] Buzzer winner
- [ ] Host-only notes
- [ ] Private reconnect tokens
- [ ] Other: ________________________

Define:

```ts
interface HostGameView {
  // Fill after team decisions
}
```

```text
Fields:
________________________________________
________________________________________
```

### Host Command Permissions

Check commands Host is authorized to submit:

- [ ] `START_GAME`
- [ ] `PAUSE_GAME`
- [ ] `RESUME_GAME`
- [ ] `SELECT_CLUE`
- [ ] `OPEN_BUZZERS`
- [ ] `RESET_BUZZERS`
- [ ] `MARK_CORRECT`
- [ ] `MARK_INCORRECT`
- [ ] `REVEAL_ANSWER`
- [ ] `ADJUST_SCORE`
- [ ] `ADVANCE_ROUND`
- [ ] `UNDO`
- [ ] `REDO`
- [ ] `END_GAME`
- [ ] Other: ________________________

### Original Q51 — How is Host authority verified?

- [ ] Host token
- [ ] Auth account
- [ ] Room secret
- [ ] Session cookie
- [ ] Other: ________________________

### Completion Question — Can more than one Host controller be active?

- [ ] No
- [ ] Yes, synchronized
- [ ] Yes, but one is primary
- [ ] Other: ________________________

**Role 4 sign-off**

```text
Owner: ________________________
[ ] Host contract complete
```

---

# PART F — ROLE 5: CONTENT / QUESTION EDITOR
## Owner: Person 5

## `Clue` Contract — Original Q14–16

Candidate:

```ts
interface Clue {
  id: string
  categoryId: string
  value: number
  prompt: string
  correctResponse: string
  used: boolean
  dailyDouble: boolean
  media?: ClueMedia
}
```

### Q14 — Final field names

```text
Question text field: ________________________
Answer field: ______________________________
Used field: _________________________________
Daily Double field: _________________________
```

### Q15 — Should `correctResponse` be sent to Player clients before reveal?

- [ ] Never
- [ ] Yes
- [ ] Only Host receives it

### Q16 — Media representation

- [ ] URL
- [ ] Storage file ID
- [ ] Embedded/base64
- [ ] Other: ________________________

## Content Domain Contract

Define fields for:

```text
QuestionPack:
________________________________________

Round:
________________________________________

Category:
________________________________________

ClueMedia:
________________________________________

FinalJeopardyContent:
________________________________________
```

### Completion Question — How is a live game protected from later Question Pack edits?

- [ ] Copy/freeze content into live game snapshot
- [ ] Reference live Question Pack directly
- [ ] Version Question Packs
- [ ] Other: ________________________

### Completion Question — Required content validation errors

- [ ] Missing title
- [ ] Missing category
- [ ] Missing clue prompt
- [ ] Missing correct response
- [ ] Duplicate clue IDs
- [ ] Invalid values
- [ ] Missing media
- [ ] Invalid Daily Double configuration
- [ ] Missing Final Jeopardy
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner: ________________________
[ ] Content contract complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

## Source of Truth — Original Q7–10

### Q7 — Authoritative live `GameState`

Choose ONE:

- [ ] Backend server process
- [ ] Database row/document
- [ ] Host client
- [ ] Realtime service
- [ ] Other: ________________________

### Q8 — Can clients mutate authoritative state directly?

- [ ] No — clients submit commands
- [ ] Yes
- [ ] Only certain local/UI state

### Q9 — Client-only state

```text
________________________________________
________________________________________
```

### Q10 — Shared state

```text
________________________________________
________________________________________
```

## Shared Client Shape Strategy — Original Q17

- [ ] Separate `HostGameView`
- [ ] Separate `PlayerGameView`
- [ ] Separate `DisplayGameView`
- [ ] One shared payload for all
- [ ] Other: ________________________

## Networking — Original Q28–31

### Q28 — How do clients receive updates?

- [ ] WebSocket
- [ ] Supabase Realtime
- [ ] Server-Sent Events
- [ ] Polling
- [ ] Other: ________________________

### Q29 — How do clients send commands?

- [ ] HTTP/API
- [ ] WebSocket
- [ ] RPC
- [ ] Server Action
- [ ] Other: ________________________

### Q30 — What update shape do clients receive?

- [ ] Entire view/state snapshot
- [ ] State patches/deltas
- [ ] Events
- [ ] Depends on client/screen

### Q31 — On reconnect

- [ ] Fresh full snapshot
- [ ] Missed events
- [ ] Both
- [ ] Other: ________________________

## Persistence — Original Q32–35

Candidate records:

- [ ] `games`
- [ ] `game_rooms`
- [ ] `players`
- [ ] `question_packs`
- [ ] `rounds`
- [ ] `categories`
- [ ] `clues`
- [ ] `game_events`
- [ ] `game_snapshots`
- [ ] `reconnect_tokens`

Add/remove:

```text
________________________________________
```

### Q33 — Store live `GameState` as

- [ ] Normalized tables
- [ ] JSON snapshot
- [ ] Snapshot + event log
- [ ] Memory only
- [ ] Other: ________________________

### Q34 — Finished games immutable?

- [ ] Yes
- [ ] No
- [ ] Host can reopen

### Q35 — Retention

```text
________________________________________
```

## IDs — Original Q36

- [ ] UUID
- [ ] NanoID
- [ ] Database-generated
- [ ] Other: ________________________

## Unexpected Server Errors — Original Q47

```text
________________________________________
```

## Security / Trust — Original Q48–50

### Q48 — Can Player submit score directly?

- [ ] No
- [ ] Yes

### Q49 — Can Player declare themselves buzz winner?

- [ ] No
- [ ] Yes

### Q50 — Can Player retrieve correct answers before reveal?

- [ ] No
- [ ] Yes

### Completion Question — Realtime message envelope

```ts
interface RealtimeMessage {
  // Fill after decisions
}
```

```text
Required fields:
________________________________________
```

### Completion Question — Versioning strategy for contracts/messages

- [ ] Explicit schema version
- [ ] App version only
- [ ] No versioning in v1
- [ ] Other: ________________________

**Role 6 sign-off**

```text
Owner: ________________________
[ ] Network/persistence contract complete
```

---

# PART H — FINAL ARCHITECTURE CONTRACT APPROVAL
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

> Using the approved Product Spec, Architecture Behavior Questionnaire, and this completed six-role Architecture Contract Questionnaire, produce the frozen shared technical contract. Generate TypeScript domain interfaces, `GameState`, commands, events, client view types, error codes, state-machine types, content types, realtime message contracts, persistence schema proposal, security/trust rules, module boundaries, and folder ownership. Preserve the six-role boundaries. Do not implement feature UI. Do not silently resolve contradictions. Any unresolved field is a blocker. Output should be suitable for six parallel coding agents and clearly identify files/contracts they may not change without the approved contract-change process.
