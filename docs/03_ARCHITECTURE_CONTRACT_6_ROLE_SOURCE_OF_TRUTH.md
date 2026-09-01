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

- [x] Next.js
- [ ] React + Vite
- [ ] Vue
- [ ] Svelte
- [ ] Other: ________________________

### Q2 — Language

- [x] TypeScript
- [ ] JavaScript
- [ ] Other: ________________________

### Q3 — Styling

- [x] Tailwind CSS
- [ ] CSS Modules
- [ ] Plain CSS
- [ ] Styled Components
- [ ] Other: ________________________

### Q4 — Backend / realtime technology

- [x] Supabase
- [ ] Firebase
- [ ] Node + WebSocket server
- [ ] Socket.IO
- [ ] Convex
- [ ] Other: ________________________

### Q5 — Database

- [ ] PostgreSQL
- [x] Supabase Postgres
- [ ] Firebase
- [ ] SQLite
- [ ] No persistent database
- [ ] Other: ________________________

### Q6 — Hosting

- [x] Vercel
- [ ] Netlify
- [ ] Render
- [ ] Railway
- [ ] Other: ________________________

## Core Domain Types — Original Section C

For each type, choose exactly one action.

| Type | Keep | Rename | Remove | Final Name |
|---|---|---|---|---|
| `GameState` | [x] | [ ] | [ ] | GameState |
| `Game` | [x] | [ ] | [ ] | Game |
| `GameRoom` | [x] | [ ] | [ ] | GameRoom |
| `Player` | [x] | [ ] | [ ] | Player |
| `Round` | [x] | [ ] | [ ] | Round |
| `Category` | [x] | [ ] | [ ] | Category |
| `Clue` | [x] | [ ] | [ ] | Clue |
| `BuzzerState` | [x] | [ ] | [ ] | BuzzerState |
| `TimerState` | [x] | [ ] | [ ] | TimerState |
| `DailyDoubleState` | [x] | [ ] | [ ] | DailyDoubleState |
| `FinalJeopardyState` | [x] | [ ] | [ ] | FinalJeopardyState |
| `GameSettings` | [x] | [ ] | [ ] | GameSettings |
| `GameHistoryEvent` | [x] | [ ] | [ ] | GameHistoryEvent |
| `GameCommand` | [x] | [ ] | [ ] | GameCommand |

Additional shared types:

```text
HostGameView, PlayerGameView, DisplayGameView, QuestionPack, ClueMedia, GamePhase, GameStatus, GameErrorCode, ReactionEvent, TeamSelection.
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
Keep all candidate fields as written.
```

Missing fields:

```text
teams?: TeamSelection[]
reactions?: ReactionEvent[]
activeCluePrompt?: string | null
```

### Original Q11 — Should `GameState` contain derived values?

- [ ] Yes
- [x] No — derive when needed

## Naming Conventions — Original Q37–38

### TypeScript variables

- [x] camelCase
- [ ] snake_case
- [ ] Other: __________

### Database columns

- [x] snake_case
- [ ] camelCase
- [ ] Other: __________

### Components

- [x] PascalCase
- [ ] Other: __________

### Files

- [x] kebab-case
- [ ] camelCase
- [ ] PascalCase
- [ ] Other: __________

### Canonical names

```text
Player: Player
Clue: Clue
Category: Category
Round: Round
Game: Game
GameRoom: GameRoom
Selected clue field: selectedClueId
Board controller field: controllingPlayerId
Buzz winner field: buzzedPlayerId
```

## Folder Ownership — Original Q39–41

Approved structure:

```text
src/engine/ (Role 1: rules & state machine)
src/components/display/ & src/app/display/ (Role 2: TV board)
src/components/player/ & src/app/play/ (Role 3: phone UI)
src/components/host/ & src/app/host/ (Role 4: dashboard)
src/content/ & src/app/editor/ (Role 5: packs & editor)
src/network/ & src/lib/supabase/ (Role 6: realtime & db)
src/types/ & src/constants/ (Shared / Frozen contracts)
```

Primary ownership:

```text
Person 1 / Engine:
src/engine/ (game state machine, reducer, scoring rules, turn logic)

Person 2 / Board:
src/components/display/, src/app/display/ (fullscreen TV presentation, animations)

Person 3 / Player:
src/components/player/, src/app/play/, src/hooks/useBuzzer.ts (mobile buzzer UI, player wagers)

Person 4 / Host:
src/components/host/, src/app/host/, src/hooks/useHostControls.ts (host dashboard, judging)

Person 5 / Content:
src/content/, src/app/editor/, src/lib/importers/ (question pack schema, editor, CSV/JSON parser)

Person 6 / Network:
src/network/, src/lib/supabase/, src/app/api/ (realtime sync, persistence, Team Ham OAuth)
```

Shared/frozen folders:

```text
src/types/ (shared domain models and view contracts)
src/constants/ (game rules defaults, token configurations)
```

## Dependency Rules — Original Q42–44

### Q42 — Who may install dependencies?

- [ ] Anyone
- [x] Integration owner
- [ ] Team approval required

### Q43 — May AI agents replace a library without approval?

- [x] No
- [ ] Yes

### Q44 — May feature code import another feature's internal files?

- [x] No — use public interfaces
- [ ] Yes
- [ ] Case-by-case

## Testing Contract — Original Q52–54

### Required test types

- [x] Unit tests for game rules
- [x] State-machine transition tests
- [x] Realtime integration tests
- [x] Database tests
- [x] End-to-end Host → Player test
- [ ] Mobile browser test
- [ ] Accessibility tests
- [ ] Other: ________________________

### Q53 — Must PR pass tests before merge?

- [x] Yes
- [ ] No

### Q54 — Required CI checks

- [x] Typecheck
- [x] Lint
- [x] Unit tests
- [x] Build
- [ ] E2E
- [ ] Other: ________________________

## Contract Change Process — Original Q55–57

### What counts as shared-contract change?

- [x] Add/remove `GameState` field
- [x] Rename shared type
- [x] Change command payload
- [x] Change database schema
- [x] Change realtime event
- [x] Change game phase
- [x] Add dependency used across features
- [ ] Other: ________________________

### Q56 — Approval requirement

- [x] All 6 must approve
- [ ] Majority approval
- [ ] Architecture owner approves
- [ ] Other: ________________________

### Q57 — Require short proposal?

- [x] Yes
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
All 22 candidate commands above plus:
SEND_REACTION
SELECT_TEAM
OVERRIDE_WAGER
CANCEL_CLUE
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

- [x] Use as written
- [ ] Modify:

```text
N/A (Used as written)
```

### Q20 — Unique command IDs for idempotency?

- [x] Yes
- [ ] No

## Events / History — Original Q21–24

### Q21 — Commands and history events separate?

- [x] Yes
- [ ] No

### Q22 — Required history events

```text
GAME_STARTED, CLUE_SELECTED, BUZZERS_OPENED, PLAYER_BUZZED, ANSWER_JUDGED,
SCORE_ADJUSTED, DAILY_DOUBLE_WAGERED, ROUND_ADVANCED, FINAL_WAGER_SUBMITTED,
FINAL_ANSWER_SUBMITTED, FINAL_RESOLVED, GAME_ENDED, STATE_UNDONE
```

### Q23 — History events immutable?

- [x] Yes
- [ ] No

### Q24 — Undo behavior

- [x] Append reversal event
- [ ] Delete old event
- [ ] Other: ________________________

## State Mutation — Original Q25–27

### Q25 — How may authoritative game state change?

- [x] Reducer/state-machine function
- [ ] Server actions
- [ ] RPC functions
- [ ] Direct database writes
- [ ] Combination: ________________________

### Q26 — Should UI components contain scoring/game-rule logic?

- [x] No
- [ ] Yes

### Q27 — Business-rule module/path

```text
src/engine/gameReducer.ts and src/engine/rules.ts
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

- [x] Structured error codes
- [ ] Plain thrown errors
- [ ] Other: ________________________

### Q46 — Should expected user mistakes be exceptions?

- [x] No — structured result
- [ ] Yes
- [ ] Depends: ________________________

### Completion Question — Define canonical command result

```text
Success shape:
{ ok: true, state: GameState, event: GameHistoryEvent }

Expected rejection shape:
{ ok: false, error: GameErrorCode, message: string }
```

**Role 1 sign-off**

```text
Owner: Role 1 Specialist
[x] Engine contract complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

### Display Client View Contract

Define what `DisplayGameView` is allowed to receive.

- [x] Board/category data
- [x] Used clue state
- [x] Scores
- [x] Controlling Player
- [x] Current clue
- [x] Current phase
- [x] Buzzer status
- [x] Buzz winner after authoritative decision
- [x] Timer state
- [x] Correct answer only after reveal
- [x] Daily Double presentation state
- [x] Final Jeopardy public state
- [ ] Private wagers
- [ ] Private Final answers
- [ ] Host secrets
- [ ] Reconnect tokens
- [ ] Other: ________________________

### Completion Question — Define `DisplayGameView`

```ts
interface DisplayGameView {
  gameId: string
  roomCode: string
  phase: GamePhase
  roundIndex: number
  board: { categories: { id: string; title: string; clues: { id: string; value: number; used: boolean }[] }[] }
  currentClue: { id: string; categoryTitle: string; value: number; prompt: string; media?: ClueMedia; correctResponse?: string } | null
  buzzer: { state: "closed" | "open" | "buzz_won" | "locked"; buzzedPlayerId: string | null; timeRemainingMs?: number }
  players: { id: string; displayName: string; score: number; avatar?: string; color?: string; isControlling: boolean; teamId?: string }[]
  dailyDouble: { active: boolean; playerId: string | null; wager: number | null } | null
  finalJeopardy: { category: string; cluePrompt: string | null; revealedPlayers: { id: string; answer: string; wager: number; isCorrect: boolean }[] } | null
  timer: { durationMs: number; expiresAt: string | null } | null
}
```

```text
Fields:
Defined above in DisplayGameView interface.
```

### Completion Question — What presentation-only state remains local?

Examples: transition progress, sound-playing flag, animation queue.

```text
animationQueue: AnimationStep[], activeSoundEffect: string | null, isBoardTransitioning: boolean, screenShakeLevel: number
```

### Completion Question — Does display ever send authoritative commands?

- [x] No — read-only
- [ ] Yes, only clue selection
- [ ] Yes, specified commands:

```text
N/A (Read-only display)
```

**Role 2 sign-off**

```text
Owner: Role 2 Specialist
[x] Display contract complete
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

- [x] `id`
- [x] `displayName`
- [x] `score`
- [x] `connected`
- [x] `avatar`
- [x] `color`
- [x] `correctCount`
- [x] `incorrectCount`
- [x] `buzzCount`

Add:

```text
teamId?: string
reconnectToken?: string
```

### Q13 — Private Final Jeopardy data on `Player`?

- [ ] Yes
- [x] No — separate private state
- [ ] Unsure

## Player Client View

Define what `PlayerGameView` may receive:

- [x] Board
- [x] Own Player record
- [x] Everyone's public scores
- [x] Current clue
- [x] Game phase
- [x] Buzzer status
- [x] Eligibility to buzz
- [x] Own wager
- [x] Own Final answer
- [ ] Correct response before reveal
- [ ] Other Players' private wagers
- [ ] Other Players' Final answers
- [ ] Host-only notes
- [ ] Other: ________________________

Define:

```ts
interface PlayerGameView {
  gameId: string
  roomCode: string
  phase: GamePhase
  me: Player
  allPlayers: { id: string; displayName: string; score: number; avatar?: string; color?: string; connected: boolean; teamId?: string }[]
  currentClue: { id: string; categoryTitle: string; value: number; prompt: string; media?: ClueMedia } | null
  buzzer: { state: "closed" | "open" | "buzz_won" | "locked"; buzzedPlayerId: string | null; isMyBuzz: boolean; lockedOut: boolean }
  dailyDouble: { active: boolean; isMyTurn: boolean; maxWager: number; minWager: number; submittedWager: number | null } | null
  finalJeopardy: { category: string; cluePrompt: string | null; myWager: number | null; myAnswer: string | null; isSubmitted: boolean } | null
  timer: { durationMs: number; expiresAt: string | null } | null
}
```

```text
Fields:
Defined above in PlayerGameView interface.
```

### Completion Question — Player commands

- [x] `JOIN_GAME`
- [x] `LEAVE_GAME`
- [x] `BUZZ`
- [x] `SELECT_CLUE`
- [x] `SUBMIT_DAILY_DOUBLE_WAGER`
- [x] `SUBMIT_FINAL_WAGER`
- [x] `SUBMIT_FINAL_ANSWER`
- [x] Other: SEND_REACTION, SELECT_TEAM

**Role 3 sign-off**

```text
Owner: Role 3 Specialist
[x] Player contract complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

## Host Client View

Define what `HostGameView` may receive:

- [x] Full public board
- [x] Correct responses
- [x] Player wagers
- [x] Final answers
- [x] Full game history
- [x] Player connection state
- [x] Timer state
- [x] Buzzer winner
- [x] Host-only notes
- [ ] Private reconnect tokens
- [ ] Other: ________________________

Define:

```ts
interface HostGameView {
  gameId: string
  roomCode: string
  phase: GamePhase
  roundIndex: number
  board: { categories: { id: string; title: string; clues: (Clue & { isDailyDouble: boolean })[] }[] }
  currentClue: (Clue & { categoryTitle: string; notes?: string }) | null
  buzzer: { state: "closed" | "open" | "buzz_won" | "locked"; buzzedPlayerId: string | null; buzzedPlayerName?: string }
  players: Player[]
  dailyDouble: { active: boolean; playerId: string | null; wager: number | null; maxWager: number } | null
  finalJeopardy: { category: string; cluePrompt: string; correctResponse: string; submissions: { playerId: string; playerName: string; wager: number; answer: string; isCorrect?: boolean; revealed: boolean }[] } | null
  history: GameHistoryEvent[]
  timer: { durationMs: number; expiresAt: string | null; isPaused: boolean } | null
  canUndo: boolean
  canRedo: boolean
}
```

```text
Fields:
Defined above in HostGameView interface.
```

### Host Command Permissions

Check commands Host is authorized to submit:

- [x] `START_GAME`
- [x] `PAUSE_GAME`
- [x] `RESUME_GAME`
- [x] `SELECT_CLUE`
- [x] `OPEN_BUZZERS`
- [x] `RESET_BUZZERS`
- [x] `MARK_CORRECT`
- [x] `MARK_INCORRECT`
- [x] `REVEAL_ANSWER`
- [x] `ADJUST_SCORE`
- [x] `ADVANCE_ROUND`
- [x] `UNDO`
- [x] `REDO`
- [x] `END_GAME`
- [x] Other: OVERRIDE_WAGER, KICK_PLAYER, CANCEL_CLUE

### Original Q51 — How is Host authority verified?

- [x] Host token
- [x] Auth account
- [ ] Room secret
- [ ] Session cookie
- [ ] Other: ________________________

### Completion Question — Can more than one Host controller be active?

- [ ] No
- [x] Yes, synchronized
- [ ] Yes, but one is primary
- [ ] Other: ________________________

**Role 4 sign-off**

```text
Owner: Role 4 Specialist
[x] Host contract complete
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
Question text field: prompt
Answer field: correctResponse
Used field: used
Daily Double field: isDailyDouble
```

### Q15 — Should `correctResponse` be sent to Player clients before reveal?

- [x] Never
- [ ] Yes
- [ ] Only Host receives it

### Q16 — Media representation

- [x] URL
- [ ] Storage file ID
- [ ] Embedded/base64
- [ ] Other: ________________________

## Content Domain Contract

Define fields for:

```text
QuestionPack:
interface QuestionPack { id: string; title: string; description?: string; author: string; rounds: Round[]; finalJeopardy: FinalJeopardyContent; theme?: string; createdAt: string; updatedAt: string }

Round:
interface Round { id: string; name: string; categories: Category[]; dailyDoubleCount: number }

Category:
interface Category { id: string; title: string; clues: Clue[] }

ClueMedia:
interface ClueMedia { type: "image" | "audio" | "video"; url: string; altText?: string }

FinalJeopardyContent:
interface FinalJeopardyContent { category: string; prompt: string; correctResponse: string; media?: ClueMedia }
```

### Completion Question — How is a live game protected from later Question Pack edits?

- [x] Copy/freeze content into live game snapshot
- [ ] Reference live Question Pack directly
- [ ] Version Question Packs
- [ ] Other: ________________________

### Completion Question — Required content validation errors

- [x] Missing title
- [x] Missing category
- [x] Missing clue prompt
- [x] Missing correct response
- [x] Duplicate clue IDs
- [x] Invalid values
- [x] Missing media
- [x] Invalid Daily Double configuration
- [x] Missing Final Jeopardy
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner: Role 5 Specialist
[x] Content contract complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

## Source of Truth — Original Q7–10

### Q7 — Authoritative live `GameState`

Choose ONE:

- [x] Backend server process
- [ ] Database row/document
- [ ] Host client
- [ ] Realtime service
- [ ] Other: ________________________

### Q8 — Can clients mutate authoritative state directly?

- [x] No — clients submit commands
- [ ] Yes
- [ ] Only certain local/UI state

### Q9 — Client-only state

```text
Local animations, audio playback mute/volume, UI input draft values, theme preferences, temporary tooltips, and connection status banners.
```

### Q10 — Shared state

```text
Authoritative GameState (phase, active clue, players, scores, buzz winner, timers, Daily Double wagers, Final Jeopardy submissions).
```

## Shared Client Shape Strategy — Original Q17

- [x] Separate `HostGameView`
- [x] Separate `PlayerGameView`
- [x] Separate `DisplayGameView`
- [ ] One shared payload for all
- [ ] Other: ________________________

## Networking — Original Q28–31

### Q28 — How do clients receive updates?

- [ ] WebSocket
- [x] Supabase Realtime
- [ ] Server-Sent Events
- [ ] Polling
- [ ] Other: ________________________

### Q29 — How do clients send commands?

- [x] HTTP/API
- [ ] WebSocket
- [ ] RPC
- [ ] Server Action
- [ ] Other: ________________________

### Q30 — What update shape do clients receive?

- [x] Entire view/state snapshot
- [ ] State patches/deltas
- [ ] Events
- [ ] Depends on client/screen

### Q31 — On reconnect

- [x] Fresh full snapshot
- [ ] Missed events
- [ ] Both
- [ ] Other: ________________________

## Persistence — Original Q32–35

Candidate records:

- [x] `games`
- [x] `game_rooms`
- [x] `players`
- [x] `question_packs`
- [x] `rounds`
- [x] `categories`
- [x] `clues`
- [x] `game_events`
- [x] `game_snapshots`
- [x] `reconnect_tokens`

Add/remove:

```text
Add: team_definitions, user_accounts
```

### Q33 — Store live `GameState` as

- [ ] Normalized tables
- [ ] JSON snapshot
- [x] Snapshot + event log
- [ ] Memory only
- [ ] Other: ________________________

### Q34 — Finished games immutable?

- [x] Yes
- [ ] No
- [ ] Host can reopen

### Q35 — Retention

```text
Active games retained in persistent storage until 30 days after completion; Question Packs retained indefinitely.
```

## IDs — Original Q36

- [x] UUID
- [x] NanoID
- [ ] Database-generated
- [ ] Other: ________________________

## Unexpected Server Errors — Original Q47

```text
Server returns structured error envelope { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, logs stack trace, and preserves last uncorrupted snapshot without dropping room connection.
```

## Security / Trust — Original Q48–50

### Q48 — Can Player submit score directly?

- [x] No
- [ ] Yes

### Q49 — Can Player declare themselves buzz winner?

- [x] No
- [ ] Yes

### Q50 — Can Player retrieve correct answers before reveal?

- [x] No
- [ ] Yes

### Completion Question — Realtime message envelope

```ts
interface RealtimeMessage<T = unknown> {
  event: "STATE_UPDATE" | "BUZZER_EVENT" | "REACTION" | "ERROR"
  roomCode: string
  payload: T
  timestamp: string
  version: number
}
```

```text
Required fields:
Defined above in RealtimeMessage interface.
```

### Completion Question — Versioning strategy for contracts/messages

- [x] Explicit schema version
- [ ] App version only
- [ ] No versioning in v1
- [ ] Other: ________________________

**Role 6 sign-off**

```text
Owner: Role 6 Specialist
[x] Network/persistence contract complete
```

---

# PART H — FINAL ARCHITECTURE CONTRACT APPROVAL
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

> Using the approved Product Spec, Architecture Behavior Questionnaire, and this completed six-role Architecture Contract Questionnaire, produce the frozen shared technical contract. Generate TypeScript domain interfaces, `GameState`, commands, events, client view types, error codes, state-machine types, content types, realtime message contracts, persistence schema proposal, security/trust rules, module boundaries, and folder ownership. Preserve the six-role boundaries. Do not implement feature UI. Do not silently resolve contradictions. Any unresolved field is a blocker. Output should be suitable for six parallel coding agents and clearly identify files/contracts they may not change without the approved contract-change process.
