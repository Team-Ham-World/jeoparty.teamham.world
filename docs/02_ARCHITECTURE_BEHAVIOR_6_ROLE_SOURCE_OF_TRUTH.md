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

- [x] `LOBBY`
- [x] `ROUND_INTRO`
- [x] `BOARD`
- [x] `CLUE_SELECTED`
- [x] `READING_CLUE`
- [x] `BUZZERS_OPEN`
- [x] `PLAYER_BUZZED`
- [x] `JUDGING_ANSWER`
- [x] `ANSWER_REVEAL`
- [x] `DAILY_DOUBLE`
- [x] `DAILY_DOUBLE_WAGER`
- [x] `FINAL_WAGER`
- [x] `FINAL_CLUE`
- [x] `FINAL_ANSWERING`
- [x] `FINAL_REVEAL`
- [x] `RESULTS`
- [x] `PAUSED`
- [x] `GAME_OVER`

Other phases:

```text
None required; the 18 listed phases comprehensively cover the full lifecycle.
```

### Original Q2 — Should exactly one phase be active at a time?

- [x] Yes
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
Lifecycle is fully deterministic: LOBBY -> ROUND_INTRO -> BOARD -> CLUE_SELECTED -> READING_CLUE -> BUZZERS_OPEN -> PLAYER_BUZZED -> JUDGING_ANSWER -> (if incorrect & attempts remain -> BUZZERS_OPEN; else -> ANSWER_REVEAL) -> BOARD -> (repeat until round end) -> ROUND_INTRO (Double Jeopardy) -> ... -> FINAL_WAGER -> FINAL_CLUE -> FINAL_ANSWERING -> FINAL_REVEAL -> RESULTS -> GAME_OVER.
```

## Cross-role edge cases — Original Q73–79

### Q73 — Player disconnects after winning the buzz

```text
Server detects player disconnect. Host dashboard flags "Player Disconnected". Host can either wait (up to answering timeout), award/penalize if answered verbally prior to disconnect, or press "Reset Buzzers" to reopen buzzers for all remaining eligible players without penalty.
```

### Q74 — Host marks Player correct accidentally, then selects next clue

```text
Host clicks "Undo" on Host Dashboard. The engine rolls back the last score mutation and restores the previous clue state and controlling player.
```

### Q75 — Two Players have the same final score

```text
A tie is declared and both players are displayed as Co-Champions. If configured in Game Settings, Host can trigger an optional sudden-death Tiebreaker Clue.
```

### Q76 — No Players qualify for Final Jeopardy

```text
The game transitions through Final Jeopardy as an audience exhibition round or directly to RESULTS screen declaring the highest scorer the winner.
```

### Q77 — Daily Double clue is canceled

```text
Host clicks "Cancel Clue". Clue tile is marked unselected, wager is refunded/reverted, and board returns to previous controlling player.
```

### Q78 — Timer expires at the same moment a buzz arrives

```text
Server timestamp is authoritative. If server receives buzz before or equal to the authoritative timer expiration instant, the buzz is awarded; otherwise buzzer lockout closes and timeout triggers.
```

### Q79 — Host loses internet but Players remain connected

```text
Server maintains state in memory and database. Display and player phones show "Waiting for Host...". When host reconnects, server delivers full state snapshot and resumes exactly where left off.
```

### Completion Decision — Global behavior philosophy

When something unexpected happens, should the system prefer:

- [ ] Pause and preserve state
- [ ] Continue automatically where safe
- [ ] Give Host a recovery decision
- [x] Case-by-case as defined below

```text
Preserve state authoritatively on server, provide Host with unambiguous one-click recovery options, and allow safe automatic progression when timers naturally expire.
```

---

# PART B — ROLE 1: ENGINE & RULES
## Owner: Person 1

## Board Control — Original Q12–16

### Q12 — Who chooses the first clue?

- [x] Host
- [ ] Random Player
- [ ] Player 1
- [ ] Previous game winner
- [ ] Other: ________________________

### Q13 — After a correct answer, who controls the board?

- [x] Correct Player
- [ ] Host
- [ ] Previous controlling Player
- [ ] Other: ________________________

### Q14 — After all Players fail a clue, who controls the board?

- [x] Previous controlling Player
- [ ] Host
- [ ] Random Player
- [ ] Other: ________________________

### Q15 — Can Host override board control?

- [x] Yes
- [ ] No

### Q16 — Can a Player select a clue from their phone?

- [ ] Yes
- [x] No — Host selects
- [ ] Only controlling Player
- [ ] Optional setting

## Clue Selection — Original Q17–19

### Q17 — What happens when a clue is selected?

Put in order:

```text
1 Validate selection
2 Mark clue selected
3 Hide/remove clue value from board
4 Show clue on main display
5 Start reading state
6 Open buzzers
7 Start timer
8 Other: N/A
```

### Q18 — When is a clue considered used?

- [x] Immediately when selected
- [ ] After answer is resolved
- [ ] When returning to board
- [ ] Other: ________________________

### Q19 — Can Host cancel a selected clue?

- [x] Yes
- [ ] No

If yes, does it become available again?

- [x] Yes
- [ ] No

## Scoring — Original Q32–37

### Q32 — Correct answer rule

- [x] `score += clueValue`
- [ ] Custom: ________________________

### Q33 — Incorrect answer rule

- [x] `score -= clueValue`
- [ ] No penalty
- [ ] Custom: ________________________

### Q34 — Can score become negative?

- [x] Yes
- [ ] No

### Q35 — Can Host manually adjust score?

- [x] Yes
- [ ] No

### Q36 — Should manual adjustments require a reason?

- [ ] Yes
- [x] No

### Q37 — Should every score mutation be recorded?

- [x] Yes
- [ ] No

## Daily Double — Original Q38, Q40–45

### Q38 — How many Daily Doubles?

```text
Jeopardy round: 1
Double Jeopardy: 2
Other rounds: 0
```

### Q40 — Who answers a Daily Double?

- [x] Selecting Player only
- [ ] Everyone
- [ ] Configurable

### Q41 — Minimum wager

```text
$5
```

### Q42 — Maximum wager

- [ ] Current score
- [ ] Highest clue value
- [x] Greater of current score or highest clue value
- [ ] Custom: ________________________

### Q43 — What if Player score is negative?

```text
Player can wager up to the highest clue value available on that round's board ($1,000 in Jeopardy, $2,000 in Double Jeopardy) with a $5 minimum.
```

### Q44 — Can Host override a wager?

- [x] Yes
- [ ] No

### Q45 — Is the wager visible to everyone?

- [x] Yes
- [ ] No
- [ ] Only after answer

## Final Jeopardy — Original Q46–47

### Q46 — Who qualifies?

- [ ] Everyone
- [x] Positive scores only
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

- [x] Approved
- [ ] Modify:

```text
N/A (Approved as written)
```

## Timers — Original Q54

### Q54 — Which timers exist?

- [x] Clue reading timer
- [x] Buzz window
- [x] Answer timer
- [x] Daily Double wager timer
- [x] Daily Double answer timer
- [x] Final wager timer
- [x] Final answer timer
- [ ] Round timer
- [ ] Other: ________________________

## Undo / History — Original Q58–61

### Q58 — Maintain event history?

- [x] Yes
- [ ] No

### Q59 — How much history?

- [x] Entire game
- [ ] Last 50 actions
- [ ] Last 10 actions
- [ ] Last action only

### Q60 — What must be undoable?

- [x] Correct/incorrect judgment
- [x] Score changes
- [x] Selected clue
- [x] Used clue
- [x] Board control
- [x] Daily Double result
- [x] Final result
- [x] Player removal
- [x] Round transition
- [ ] Other: ________________________

### Q61 — Is Redo required?

- [x] Yes
- [ ] No

### Completion Question — What makes a command invalid?

- [x] Wrong phase
- [x] Wrong actor
- [x] Clue already used
- [x] Player not eligible
- [x] Invalid wager
- [x] Timer expired
- [x] Duplicate command
- [ ] Other: ________________________

**Role 1 sign-off**

```text
Owner: Role 1 Specialist
[x] Engine behavior complete
```

---

# PART C — ROLE 2: BOARD & PRESENTATION
## Owner: Person 2

These questions define what the public display does as the engine changes state.

### Completion Question — What should the TV display show in each phase?

```text
LOBBY:
Room code, QR code to join, URL (jeoparty.teamham.world), connected players/teams list with avatars, custom title logo.

ROUND_INTRO:
Animated round title banner ("JEOPARDY!", "DOUBLE JEOPARDY!"), category title cascade with sound effect.

BOARD:
Full 6x5 category & clue matrix with available dollar values, persistent player/team score podiums at bottom, controlling player highlight glow.

CLUE_SELECTED / READING_CLUE:
Fullscreen clue card zoom, category and dollar value banner, clue text, media container (if applicable), reading pulse indicator.

BUZZERS_OPEN:
Clue text remains visible, illuminated golden border / buzzer countdown bar indicator, active buzzing prompt.

PLAYER_BUZZED / JUDGING_ANSWER:
Buzzed player name, avatar, and team prominently highlighted with 5s countdown answer bar, clue text remains visible.

ANSWER_REVEAL:
Correct response displayed in contrasting gold/white banner, score update delta animation on player podium.

DAILY_DOUBLE:
"DAILY DOUBLE!" splash animation with fanfare sound, wager prompt, selected player callout, clue reveal after wager.

FINAL_WAGER:
Category name displayed, 30s countdown timer with "Thinking" music, player wager status indicators (Wager Submitted ✓).

FINAL_CLUE / FINAL_ANSWERING:
Clue prompt displayed, 30s countdown timer with iconic theme song, live "Answer Submitted ✓" indicators.

FINAL_REVEAL:
Step-by-step player reveal sequence (Answer -> Correct/Incorrect -> Wager Reveal -> Updated Score) in ascending score order.

RESULTS / GAME_OVER:
Final scoreboard, 1st/2nd/3rd place podium animation, confetti, winning player/team crowned champion.

PAUSED:
Semi-transparent overlay with "GAME PAUSED BY HOST" banner, timers frozen.
```

### Completion Question — When should the correct response appear on the public display?

- [x] Host-triggered only
- [ ] Automatically after clue closes
- [ ] Automatically after all attempts fail
- [ ] Other: ________________________

### Completion Question — What information must never appear on the TV before reveal?

- [x] Correct response
- [x] Hidden Daily Double status
- [x] Private wagers
- [x] Final answers
- [x] Host-only notes
- [x] Reconnect/security tokens
- [ ] Other: ________________________

### Completion Question — If clue media fails to load, what should the display do?

```text
Display a graceful fallback card showing the text-only clue prompt with a subtle media error icon; notify Host dashboard so host can verbally explain or skip.
```

### Completion Question — Does presentation animation ever delay the authoritative game state?

- [x] No — animation is cosmetic only
- [ ] Yes — engine waits for defined transition completion
- [ ] Only for: ________________________

**Role 2 sign-off**

```text
Owner: Role 2 Specialist
[x] Board/presentation behavior complete
```

---

# PART D — ROLE 3: PLAYER / BUZZER / SCORING EXPERIENCE
## Owner: Person 3

## Player Lifecycle — Original Q4–8

### Q4 — How does a Player join?

- [x] Enter room code
- [x] Open QR code
- [x] Open invite URL
- [ ] Host adds Player
- [ ] Other: ________________________

### Q5 — Required join data

- [x] Display name
- [x] Avatar
- [x] Color
- [ ] PIN
- [ ] Nothing except room code
- [ ] Other: ________________________

### Q6 — Must Player names be unique?

- [x] Yes
- [ ] No

### Q7 — Can Players rename themselves?

- [ ] Anytime
- [x] Lobby only
- [ ] Host only
- [ ] No

### Q8 — Can Players leave voluntarily?

- [x] Yes
- [ ] No

## Buzzer Behavior — Original Q20–27

### Q20 — When do buzzers become active?

- [ ] Immediately when clue appears
- [x] Host manually opens buzzers
- [ ] Automatically after delay
- [ ] Automatically after clue reading timer
- [ ] Other: ________________________

### Q21 — What happens to early buzzes?

- [ ] Ignored
- [x] Player temporarily locked
- [ ] Player penalized
- [ ] Buzz accepted
- [ ] Configurable

### Q22 — What determines the winning buzz?

- [x] First valid buzz received by server
- [ ] Server timestamp
- [ ] Host browser timestamp
- [ ] Synchronized client timestamps
- [ ] Other: ________________________

### Q23 — When one Player wins the buzz

- [x] Lock all other Players
- [ ] Keep others open
- [ ] Pause others until answer resolved

### Q24 — How long does the Player have to answer?

```text
5 seconds
```

### Q25 — If Player answers incorrectly

- [x] Reopen buzzers for eligible Players
- [ ] End clue
- [ ] Host decides
- [ ] Other: ________________________

### Q26 — Can same Player buzz twice on one clue?

- [ ] Yes
- [x] No

### Q27 — What happens when nobody buzzes?

- [x] Timer expires → reveal answer
- [ ] Host manually closes clue
- [ ] Clue stays open indefinitely
- [ ] Other: ________________________

## Answer Input — Original Q29

### Q29 — Does Player type an answer?

- [ ] No — verbal answer only
- [ ] Yes
- [x] Only in Final Jeopardy

## Final Jeopardy Player Inputs — Original Q48–51

### Q48 — Wager timer

```text
30 seconds
```

### Q49 — Answer timer

```text
30 seconds
```

### Q50 — Can Players edit wagers after submission?

- [x] Yes, until locked
- [ ] No
- [ ] Host can reopen

### Q51 — Can Players edit answers after submission?

- [x] Yes, until timer expires
- [ ] No
- [ ] Host can reopen

### Completion Question — What feedback does a Player receive after buzzing?

```text
Buzz sent:
Immediate haptic pulse + visual "BUZZING..." glow state on buzzer button.

Won buzz:
Bold gold/green "YOU BUZZED IN! SPEAK NOW!" flashing banner + celebration vibration pattern.

Lost buzz:
Subdued neutral/disabled button state showing "ANOTHER PLAYER BUZZED FIRST".

Locked/ineligible:
Red lockout badge with "LOCKED OUT FOR THIS CLUE" until next clue.
```

**Role 3 sign-off**

```text
Owner: Role 3 Specialist
[x] Player/buzzer behavior complete
```

---

# PART E — ROLE 4: HOST CONTROLS
## Owner: Person 4

## Answer Judging — Original Q28, Q30–31

### Q28 — Who decides correctness?

- [x] Host
- [ ] Automatic software check
- [ ] AI suggestion + Host final decision

### Q30 — Can Host reverse a judgment?

- [x] Yes
- [ ] No

### Q31 — Should judgment correction also reverse score changes?

- [x] Yes
- [ ] No
- [ ] Host chooses

## Final Jeopardy Reveal — Original Q52–53

### Q52 — When are wagers visible?

```text
On Host dashboard immediately after submission locks; on TV display sequentially during individual player resolution phase.
```

### Q53 — When are answers visible?

```text
On Host dashboard as submitted in real-time; on TV display sequentially when Host clicks "Reveal Answer" for that specific player.
```

## Timer Control — Original Q55–56

### Q55 — Who controls timers?

- [ ] Automatic
- [ ] Host
- [x] Both

### Q56 — Can Host pause a timer?

- [x] Yes
- [ ] No

## Host Authority — Original Host Authority Section

Check every Host power:

- [x] Start game
- [x] Pause game
- [x] Resume game
- [x] End game
- [x] Select clue
- [x] Override controlling Player
- [x] Open buzzers
- [x] Close buzzers
- [x] Reset buzzers
- [x] Mark correct
- [x] Mark incorrect
- [x] Reveal answer
- [x] Change score
- [x] Skip clue
- [x] Restore clue
- [x] Kick Player
- [x] Reconnect Player
- [x] Undo
- [x] Redo
- [x] Advance round
- [x] Restart round
- [x] Restart game
- [ ] Other: ________________________

### Completion Question — Which Host actions require confirmation?

- [x] End game
- [x] Restart game
- [x] Restart round
- [x] Remove Player
- [x] Large score correction
- [x] Undo round transition
- [ ] Other: ________________________

**Role 4 sign-off**

```text
Owner: Role 4 Specialist
[x] Host-control behavior complete
```

---

# PART F — ROLE 5: CONTENT / QUESTION EDITOR
## Owner: Person 5

### Original Q39 — How are Daily Doubles assigned?

- [ ] Creator manually assigns
- [ ] Randomized when game starts
- [ ] Randomized each round
- [x] Configurable

### Completion Question — What makes a question pack valid enough to start?

- [x] Required number of rounds
- [x] Required category count
- [x] Required clue count
- [x] Every clue has prompt
- [x] Every clue has correct response
- [x] Final Jeopardy exists
- [x] Daily Double placement valid
- [x] Required media exists
- [ ] Other: ________________________

### Completion Question — What happens when content is incomplete?

- [x] Block game start
- [ ] Warn Host and allow
- [ ] Replace missing content with placeholders
- [ ] Other: ________________________

### Completion Question — What happens if media is missing or unsupported?

- [x] Skip media and continue clue
- [ ] Block clue
- [ ] Host chooses
- [ ] Other: ________________________

### Completion Question — Are clue prompt and correct response immutable once a live game begins?

- [x] Yes
- [ ] No
- [ ] Host may edit with history record
- [ ] Other: ________________________

### Completion Question — Can Question Packs be edited while currently used by a live game?

- [ ] No
- [ ] Yes, live game sees edits
- [x] Yes, but live game keeps a frozen snapshot
- [ ] Other: ________________________

**Role 5 sign-off**

```text
Owner: Role 5 Specialist
[x] Content behavior complete
```

---

# PART G — ROLE 6: NETWORK / PERSISTENCE / INTEGRATION
## Owner: Person 6

## Disconnect/Reconnect — Original Q9–11

### Q9 — What happens when a Player disconnects?

- [ ] Game continues
- [ ] Game pauses
- [ ] Player is removed
- [x] Player slot stays reserved
- [ ] Host chooses

### Q10 — Can they reconnect to same slot?

- [x] Yes
- [ ] No

### Q11 — What reconnects them?

- [x] Stored reconnect token
- [x] Same browser/session
- [ ] PIN
- [ ] Host approval
- [ ] Other: ________________________

## Timer Recovery — Original Q57

### Q57 — Browser refresh while timer runs

- [x] Resume from authoritative server time
- [ ] Restart timer
- [ ] Pause until Host resumes
- [ ] Other: ________________________

## Synchronization — Original Q62–66

### Q62 — Who owns authoritative state?

Choose ONE:

- [x] Server/backend
- [ ] Host browser
- [ ] Database directly
- [ ] Peer-to-peer

### Q63 — Should clients directly decide game results?

- [x] No
- [ ] Yes
- [ ] Only for: ________________________

### Q64 — Two Players buzz almost simultaneously

```text
The server's central message event loop processes buzz messages sequentially using monotonic microsecond arrival timestamps. The first valid buzz payload received wins; all subsequent buzzes are rejected or queued as in-flight arrivals.
```

### Q65 — Host sends two commands quickly

- [x] Serialize commands
- [ ] Last write wins
- [ ] Reject duplicate command
- [ ] Other: ________________________

### Q66 — Unique command ID to prevent duplicates?

- [x] Yes
- [ ] No

## Refresh / Reconnection — Original Q67–70

### Q67 — Host refreshes during a clue

```text
Host reloads page; client presents session token to server; server returns current GameState snapshot; Host UI restores active clue, judging buttons, and timer without interrupting the game.
```

### Q68 — Player refreshes

```text
Player client reconnects using stored reconnect token; server validates slot and pushes current PlayerGameView; player re-enters current phase (e.g. buzzer open or locked).
```

### Q69 — TV/display refreshes

```text
Display client reconnects via room code; server sends current DisplayGameView; TV seamlessly re-renders current board or active clue screen.
```

### Q70 — Backend temporarily disconnects

- [ ] Pause game
- [x] Retry automatically
- [x] Show reconnecting state
- [ ] Allow local continuation
- [ ] Other: ________________________

## Game Saving — Original Q71–72

### Q71 — When should live state save?

- [x] After every mutation
- [ ] Every few seconds
- [ ] At important checkpoints
- [ ] Manual save only

### Q72 — What must recover after crash?

- [x] Players
- [x] Scores
- [x] Round
- [x] Board state
- [x] Current clue
- [x] Used clues
- [x] Board controller
- [x] Daily Double
- [x] Final Jeopardy
- [x] History
- [x] Timers
- [ ] Other: ________________________

### Completion Question — What happens when realtime connection recovers after missed updates?

- [x] Replace local state with authoritative snapshot
- [ ] Replay missed events
- [ ] Snapshot + replay
- [ ] Other: ________________________

**Role 6 sign-off**

```text
Owner: Role 6 Specialist
[x] Network/persistence behavior complete
```

---

# PART H — FINAL BEHAVIOR APPROVAL
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

> Treat this completed six-role Architecture Behavior Questionnaire as the source of truth for runtime behavior. Produce deterministic `GAME_RULES.md` and `STATE_MACHINE.md`. List every game phase, legal transition, command precondition, side effect, scoring rule, buzzer rule, Host power, content-runtime rule, synchronization rule, recovery rule, and defined edge case. Do not choose technologies or create UI. Do not fill gaps with assumptions. If any answer conflicts with another answer or remains unresolved, stop and list it as a blocker.
