# 2. ARCHITECTURE BEHAVIOR — SIX-ROLE SOURCE-OF-TRUTH QUESTIONNAIRE
## Custom Jeopardy — HOW It Should Behave

**Purpose:** Define precise game behavior before representing it in code.

> **Rule:** AI implements these decisions. AI does not invent game rules.

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

### Original Q1 — What phases can a game be in?

- [ ] `LOBBY`
- [ ] `ROUND_INTRO`
- [ ] `BOARD`
- [ ] `CLUE_SELECTED`
- [ ] `READING_CLUE`
- [ ] `BUZZERS_OPEN`
- [ ] `PLAYER_BUZZED`
- [ ] `JUDGING_ANSWER`
- [ ] `ANSWER_REVEAL`
- [ ] `DAILY_DOUBLE`
- [ ] `DAILY_DOUBLE_WAGER`
- [ ] `FINAL_WAGER`
- [ ] `FINAL_CLUE`
- [ ] `FINAL_ANSWERING`
- [ ] `FINAL_REVEAL`
- [ ] `RESULTS`
- [ ] `PAUSED`
- [ ] `GAME_OVER`

Other phases:

```text
________________________________________
```

### Original Q2 — Should exactly one phase be active at a time?

- [ ] Yes
- [ ] No

### Original Q3 — Normal lifecycle

Complete or modify:

```text
LOBBY
  ↓
ROUND_INTRO
  ↓
BOARD
  ↓
CLUE
  ↓
BUZZERS
  ↓
ANSWER
  ↓
BOARD
  ↓
NEXT ROUND
  ↓
FINAL JEOPARDY
  ↓
RESULTS
```

```text
Changes:
________________________________________
```

## Cross-role edge cases — Original Q73–79

### Q73 — Player disconnects after winning the buzz

```text
________________________________________
```

### Q74 — Host marks Player correct accidentally, then selects next clue

```text
________________________________________
```

### Q75 — Two Players have the same final score

```text
________________________________________
```

### Q76 — No Players qualify for Final Jeopardy

```text
________________________________________
```

### Q77 — Daily Double clue is canceled

```text
________________________________________
```

### Q78 — Timer expires at the same moment a buzz arrives

```text
________________________________________
```

### Q79 — Host loses internet but Players remain connected

```text
________________________________________
```

### Completion Decision — Global behavior philosophy

When something unexpected happens, should the system prefer:

- [ ] Pause and preserve state
- [ ] Continue automatically where safe
- [ ] Give Host a recovery decision
- [ ] Case-by-case as defined below

```text
________________________________________
```

---

# PART B — ROLE 1: ENGINE & RULES
## Owner: Person 1

## Board Control — Original Q12–16

### Q12 — Who chooses the first clue?

- [ ] Host
- [ ] Random Player
- [ ] Player 1
- [ ] Previous game winner
- [ ] Other: ________________________

### Q13 — After a correct answer, who controls the board?

- [ ] Correct Player
- [ ] Host
- [ ] Previous controlling Player
- [ ] Other: ________________________

### Q14 — After all Players fail a clue, who controls the board?

- [ ] Previous controlling Player
- [ ] Host
- [ ] Random Player
- [ ] Other: ________________________

### Q15 — Can Host override board control?

- [ ] Yes
- [ ] No

### Q16 — Can a Player select a clue from their phone?

- [ ] Yes
- [ ] No — Host selects
- [ ] Only controlling Player
- [ ] Optional setting

## Clue Selection — Original Q17–19

### Q17 — What happens when a clue is selected?

Put in order:

```text
___ Validate selection
___ Mark clue selected
___ Show clue on main display
___ Start reading state
___ Start timer
___ Open buzzers
___ Hide/remove clue value from board
___ Other: ________________________
```

### Q18 — When is a clue considered used?

- [ ] Immediately when selected
- [ ] After answer is resolved
- [ ] When returning to board
- [ ] Other: ________________________

### Q19 — Can Host cancel a selected clue?

- [ ] Yes
- [ ] No

If yes, does it become available again?

- [ ] Yes
- [ ] No

## Scoring — Original Q32–37

### Q32 — Correct answer rule

- [ ] `score += clueValue`
- [ ] Custom: ________________________

### Q33 — Incorrect answer rule

- [ ] `score -= clueValue`
- [ ] No penalty
- [ ] Custom: ________________________

### Q34 — Can score become negative?

- [ ] Yes
- [ ] No

### Q35 — Can Host manually adjust score?

- [ ] Yes
- [ ] No

### Q36 — Should manual adjustments require a reason?

- [ ] Yes
- [ ] No

### Q37 — Should every score mutation be recorded?

- [ ] Yes
- [ ] No

## Daily Double — Original Q38, Q40–45

### Q38 — How many Daily Doubles?

```text
Jeopardy round: ______
Double Jeopardy: ______
Other rounds: ______
```

### Q40 — Who answers a Daily Double?

- [ ] Selecting Player only
- [ ] Everyone
- [ ] Configurable

### Q41 — Minimum wager

```text
$________
```

### Q42 — Maximum wager

- [ ] Current score
- [ ] Highest clue value
- [ ] Greater of current score or highest clue value
- [ ] Custom: ________________________

### Q43 — What if Player score is negative?

```text
________________________________________
```

### Q44 — Can Host override a wager?

- [ ] Yes
- [ ] No

### Q45 — Is the wager visible to everyone?

- [ ] Yes
- [ ] No
- [ ] Only after answer

## Final Jeopardy — Original Q46–47

### Q46 — Who qualifies?

- [ ] Everyone
- [ ] Positive scores only
- [ ] Score above: $________
- [ ] Custom: ________________________

### Q47 — Confirm game-rule order

```text
1. Reveal category
2. Players submit wagers privately
3. Reveal clue
4. Players submit answers privately
5. Timer expires
6. Host reveals Players one by one
7. Host judges answer
8. Wager added/subtracted
9. Winner shown
```

- [ ] Approved
- [ ] Modify:

```text
________________________________________
```

## Timers — Original Q54

### Q54 — Which timers exist?

- [ ] Clue reading timer
- [ ] Buzz window
- [ ] Answer timer
- [ ] Daily Double wager timer
- [ ] Daily Double answer timer
- [ ] Final wager timer
- [ ] Final answer timer
- [ ] Round timer
- [ ] Other: ________________________

## Undo / History — Original Q58–61

### Q58 — Maintain event history?

- [ ] Yes
- [ ] No

### Q59 — How much history?

- [ ] Entire game
- [ ] Last 50 actions
- [ ] Last 10 actions
- [ ] Last action only

### Q60 — What must be undoable?

- [ ] Correct/incorrect judgment
- [ ] Score changes
- [ ] Selected clue
- [ ] Used clue
- [ ] Board control
- [ ] Daily Double result
- [ ] Final result
- [ ] Player removal
- [ ] Round transition
- [ ] Other: ________________________

### Q61 — Is Redo required?

- [ ] Yes
- [ ] No

### Completion Question — What makes a command invalid?

- [ ] Wrong phase
- [ ] Wrong actor
- [ ] Clue already used
- [ ] Player not eligible
- [ ] Invalid wager
- [ ] Timer expired
- [ ] Duplicate command
- [ ] Other: ________________________

**Role 1 sign-off**

```text
Owner: ________________________
[ ] Engine behavior complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

These questions define what the public display does as the engine changes state.

### Completion Question — What should the TV display show in each phase?

```text
LOBBY:
________________________________________

ROUND_INTRO:
________________________________________

BOARD:
________________________________________

CLUE_SELECTED / READING_CLUE:
________________________________________

BUZZERS_OPEN:
________________________________________

PLAYER_BUZZED / JUDGING_ANSWER:
________________________________________

ANSWER_REVEAL:
________________________________________

DAILY_DOUBLE:
________________________________________

FINAL_WAGER:
________________________________________

FINAL_CLUE / FINAL_ANSWERING:
________________________________________

FINAL_REVEAL:
________________________________________

RESULTS / GAME_OVER:
________________________________________

PAUSED:
________________________________________
```

### Completion Question — When should the correct response appear on the public display?

- [ ] Host-triggered only
- [ ] Automatically after clue closes
- [ ] Automatically after all attempts fail
- [ ] Other: ________________________

### Completion Question — What information must never appear on the TV before reveal?

- [ ] Correct response
- [ ] Hidden Daily Double status
- [ ] Private wagers
- [ ] Final answers
- [ ] Host-only notes
- [ ] Reconnect/security tokens
- [ ] Other: ________________________

### Completion Question — If clue media fails to load, what should the display do?

```text
________________________________________
```

### Completion Question — Does presentation animation ever delay the authoritative game state?

- [ ] No — animation is cosmetic only
- [ ] Yes — engine waits for defined transition completion
- [ ] Only for: ________________________

**Role 2 sign-off**

```text
Owner: ________________________
[ ] Board/presentation behavior complete
```

---

# PART D — ROLE 3: PLAYER / BUZZER / SCORING EXPERIENCE
## Owner: Person 3

## Player Lifecycle — Original Q4–8

### Q4 — How does a Player join?

- [ ] Enter room code
- [ ] Open QR code
- [ ] Open invite URL
- [ ] Host adds Player
- [ ] Other: ________________________

### Q5 — Required join data

- [ ] Display name
- [ ] Avatar
- [ ] Color
- [ ] PIN
- [ ] Nothing except room code
- [ ] Other: ________________________

### Q6 — Must Player names be unique?

- [ ] Yes
- [ ] No

### Q7 — Can Players rename themselves?

- [ ] Anytime
- [ ] Lobby only
- [ ] Host only
- [ ] No

### Q8 — Can Players leave voluntarily?

- [ ] Yes
- [ ] No

## Buzzer Behavior — Original Q20–27

### Q20 — When do buzzers become active?

- [ ] Immediately when clue appears
- [ ] Host manually opens buzzers
- [ ] Automatically after delay
- [ ] Automatically after clue reading timer
- [ ] Other: ________________________

### Q21 — What happens to early buzzes?

- [ ] Ignored
- [ ] Player temporarily locked
- [ ] Player penalized
- [ ] Buzz accepted
- [ ] Configurable

### Q22 — What determines the winning buzz?

- [ ] First valid buzz received by server
- [ ] Server timestamp
- [ ] Host browser timestamp
- [ ] Synchronized client timestamps
- [ ] Other: ________________________

### Q23 — When one Player wins the buzz

- [ ] Lock all other Players
- [ ] Keep others open
- [ ] Pause others until answer resolved

### Q24 — How long does the Player have to answer?

```text
______ seconds
```

### Q25 — If Player answers incorrectly

- [ ] Reopen buzzers for eligible Players
- [ ] End clue
- [ ] Host decides
- [ ] Other: ________________________

### Q26 — Can same Player buzz twice on one clue?

- [ ] Yes
- [ ] No

### Q27 — What happens when nobody buzzes?

- [ ] Timer expires → reveal answer
- [ ] Host manually closes clue
- [ ] Clue stays open indefinitely
- [ ] Other: ________________________

## Answer Input — Original Q29

### Q29 — Does Player type an answer?

- [ ] No — verbal answer only
- [ ] Yes
- [ ] Only in Final Jeopardy

## Final Jeopardy Player Inputs — Original Q48–51

### Q48 — Wager timer

```text
______ seconds
```

### Q49 — Answer timer

```text
______ seconds
```

### Q50 — Can Players edit wagers after submission?

- [ ] Yes, until locked
- [ ] No
- [ ] Host can reopen

### Q51 — Can Players edit answers after submission?

- [ ] Yes, until timer expires
- [ ] No
- [ ] Host can reopen

### Completion Question — What feedback does a Player receive after buzzing?

```text
Buzz sent:
________________________________________

Won buzz:
________________________________________

Lost buzz:
________________________________________

Locked/ineligible:
________________________________________
```

**Role 3 sign-off**

```text
Owner: ________________________
[ ] Player/buzzer behavior complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

## Answer Judging — Original Q28, Q30–31

### Q28 — Who decides correctness?

- [ ] Host
- [ ] Automatic software check
- [ ] AI suggestion + Host final decision

### Q30 — Can Host reverse a judgment?

- [ ] Yes
- [ ] No

### Q31 — Should judgment correction also reverse score changes?

- [ ] Yes
- [ ] No
- [ ] Host chooses

## Final Jeopardy Reveal — Original Q52–53

### Q52 — When are wagers visible?

```text
________________________________________
```

### Q53 — When are answers visible?

```text
________________________________________
```

## Timer Control — Original Q55–56

### Q55 — Who controls timers?

- [ ] Automatic
- [ ] Host
- [ ] Both

### Q56 — Can Host pause a timer?

- [ ] Yes
- [ ] No

## Host Authority — Original Host Authority Section

Check every Host power:

- [ ] Start game
- [ ] Pause game
- [ ] Resume game
- [ ] End game
- [ ] Select clue
- [ ] Override controlling Player
- [ ] Open buzzers
- [ ] Close buzzers
- [ ] Reset buzzers
- [ ] Mark correct
- [ ] Mark incorrect
- [ ] Reveal answer
- [ ] Change score
- [ ] Skip clue
- [ ] Restore clue
- [ ] Kick Player
- [ ] Reconnect Player
- [ ] Undo
- [ ] Redo
- [ ] Advance round
- [ ] Restart round
- [ ] Restart game
- [ ] Other: ________________________

### Completion Question — Which Host actions require confirmation?

- [ ] End game
- [ ] Restart game
- [ ] Restart round
- [ ] Remove Player
- [ ] Large score correction
- [ ] Undo round transition
- [ ] Other: ________________________

**Role 4 sign-off**

```text
Owner: ________________________
[ ] Host-control behavior complete
```

---

# PART F — ROLE 5: CONTENT / QUESTION EDITOR
## Owner: Person 5

### Original Q39 — How are Daily Doubles assigned?

- [ ] Creator manually assigns
- [ ] Randomized when game starts
- [ ] Randomized each round
- [ ] Configurable

### Completion Question — What makes a question pack valid enough to start?

- [ ] Required number of rounds
- [ ] Required category count
- [ ] Required clue count
- [ ] Every clue has prompt
- [ ] Every clue has correct response
- [ ] Final Jeopardy exists
- [ ] Daily Double placement valid
- [ ] Required media exists
- [ ] Other: ________________________

### Completion Question — What happens when content is incomplete?

- [ ] Block game start
- [ ] Warn Host and allow
- [ ] Replace missing content with placeholders
- [ ] Other: ________________________

### Completion Question — What happens if media is missing or unsupported?

- [ ] Skip media and continue clue
- [ ] Block clue
- [ ] Host chooses
- [ ] Other: ________________________

### Completion Question — Are clue prompt and correct response immutable once a live game begins?

- [ ] Yes
- [ ] No
- [ ] Host may edit with history record
- [ ] Other: ________________________

### Completion Question — Can Question Packs be edited while currently used by a live game?

- [ ] No
- [ ] Yes, live game sees edits
- [ ] Yes, but live game keeps a frozen snapshot
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner: ________________________
[ ] Content behavior complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

## Disconnect/Reconnect — Original Q9–11

### Q9 — What happens when a Player disconnects?

- [ ] Game continues
- [ ] Game pauses
- [ ] Player is removed
- [ ] Player slot stays reserved
- [ ] Host chooses

### Q10 — Can they reconnect to same slot?

- [ ] Yes
- [ ] No

### Q11 — What reconnects them?

- [ ] Stored reconnect token
- [ ] Same browser/session
- [ ] PIN
- [ ] Host approval
- [ ] Other: ________________________

## Timer Recovery — Original Q57

### Q57 — Browser refresh while timer runs

- [ ] Resume from authoritative server time
- [ ] Restart timer
- [ ] Pause until Host resumes
- [ ] Other: ________________________

## Synchronization — Original Q62–66

### Q62 — Who owns authoritative state?

Choose ONE:

- [ ] Server/backend
- [ ] Host browser
- [ ] Database directly
- [ ] Peer-to-peer

### Q63 — Should clients directly decide game results?

- [ ] No
- [ ] Yes
- [ ] Only for: ________________________

### Q64 — Two Players buzz almost simultaneously

```text
________________________________________
________________________________________
```

### Q65 — Host sends two commands quickly

- [ ] Serialize commands
- [ ] Last write wins
- [ ] Reject duplicate command
- [ ] Other: ________________________

### Q66 — Unique command ID to prevent duplicates?

- [ ] Yes
- [ ] No

## Refresh / Reconnection — Original Q67–70

### Q67 — Host refreshes during a clue

```text
________________________________________
```

### Q68 — Player refreshes

```text
________________________________________
```

### Q69 — TV/display refreshes

```text
________________________________________
```

### Q70 — Backend temporarily disconnects

- [ ] Pause game
- [ ] Retry automatically
- [ ] Show reconnecting state
- [ ] Allow local continuation
- [ ] Other: ________________________

## Game Saving — Original Q71–72

### Q71 — When should live state save?

- [ ] After every mutation
- [ ] Every few seconds
- [ ] At important checkpoints
- [ ] Manual save only

### Q72 — What must recover after crash?

- [ ] Players
- [ ] Scores
- [ ] Round
- [ ] Board state
- [ ] Current clue
- [ ] Used clues
- [ ] Board controller
- [ ] Daily Double
- [ ] Final Jeopardy
- [ ] History
- [ ] Timers
- [ ] Other: ________________________

### Completion Question — What happens when realtime connection recovers after missed updates?

- [ ] Replace local state with authoritative snapshot
- [ ] Replay missed events
- [ ] Snapshot + replay
- [ ] Other: ________________________

**Role 6 sign-off**

```text
Owner: ________________________
[ ] Network/persistence behavior complete
```

---

# PART H — FINAL BEHAVIOR APPROVAL
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

> Treat this completed six-role Architecture Behavior Questionnaire as the source of truth for runtime behavior. Produce deterministic `GAME_RULES.md` and `STATE_MACHINE.md`. List every game phase, legal transition, command precondition, side effect, scoring rule, buzzer rule, Host power, content-runtime rule, synchronization rule, recovery rule, and defined edge case. Do not choose technologies or create UI. Do not fill gaps with assumptions. If any answer conflicts with another answer or remains unresolved, stop and list it as a blocker.
