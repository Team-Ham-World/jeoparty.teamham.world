# Roadmap

**Current milestone: 0 — in progress.** The J0 scaffold is implemented (starter app on Next 16 / React 19 / TS 5.9 / Tailwind 4 with lint, typecheck, test, and build scripts plus a CI definition), but milestone 0 is **not** complete. This remains a delivery plan, not a record of finished work. Game scope is still a proposal; do not claim team approval.

Build a working path through the whole app before expanding individual parts. Each milestone depends on the previous one. Move on when its demo and checks pass—not because a date arrived or an agent said “done.”

## 0. Get everyone running the same foundation

**Coordinate:** John with Happy; all six confirm scope and try setup.

- Confirm the proposed [first release and rule choices](PROJECT.md), including board size, player limit, host pacing, and reconnect limits.
- Choose the authoritative runtime with a small test: two competing actions produce one winner; a retry does not repeat its effect; an unauthorized action is rejected.
- Scaffold the app and chosen backend path. Add repeatable lint, typecheck, test, and build scripts, then document actual setup commands and safe environment examples. **App scaffold done:** `npm run check` passes locally; member routes were browser-checked. The backend path is still open, and CI/teammate setup remain unverified.
- Happy defines the small action/state interface; Fante supplies a valid example pack. Agree on sample host/player/display views, folder ownership, and one basic UI style. *(Interfaces, pack, and views still outstanding; folder ownership is assigned — see Team.)*
- Record team agreement on scope/runtime and create small milestone-1 tasks with owners and reviewers. *(Still outstanding.)*

**Done when:** all six can run the starter app and checks locally, the authority test passes, and everyone can explain how an action reaches the engine. Remaining: the Happy/John authority proof, agreed contracts, team confirmation of scope/runtime, and a human fresh-checkout reproduction of setup and checks. Do not parallelize incompatible engines or transports.

## 1. Play one clue end to end

**Contribute:** Fante supplies content; Happy implements rules; Medchu builds host controls; Ivvy builds the display; Scarlet builds player states; John connects the execution path.

- Select and display one clue, open buzzing, accept a test player's buzz, judge, change the score, reveal, and return to the board.
- Use shared example states for UI work that is waiting on integration. Label simulated players/networking clearly.
- Test correct/incorrect scoring, one attempt per player, invalid actions, and preventing repeated judgments.

**Done when:** one connected demo exercises the sequence above using the real engine. Separate screen mockups do not count. Real-phone competition is the next milestone.

## 2. Join and compete from real phones

**Coordinate:** John and Scarlet; Happy checks outcomes; Medchu and Ivvy connect their live views.

- Add room creation, host/player identity, join flow, and permission checks.
- Connect phone buzzers and publish filtered views to the right recipients.
- Try competing buzzes, retries, stale requests, and a player attempting a host-only action. Verify unrevealed answers are absent from player/display network payloads.
- Test across different networks early, not only tabs on one laptop.

**Done when:** at least two real phones compete, only one player wins each buzz, and host, display, and phones agree on the confirmed outcome.

## 3. Finish and recover — first release

**Contribute:** Happy handles completion; Medchu score corrections; Scarlet reconnect UI; Ivvy results; Fante a complete pack; John reconnect/state delivery. Everyone playtests.

- Complete the small board and results screen, including tied winners and negative scores.
- Add score correction with a reason, refresh recovery, same-browser player reconnect, and stale/offline indicators.
- Test a full game with a host, separate display, and 2–6 players. Include disconnect/reconnect, a repeated request, and an answering player dropping out.
- Each screen owner checks phone/TV readability, keyboard access, focus, and status labels. John documents deployment and the current backend-lifetime limitation.

**Done when:** the group finishes a hosted game without editing code or the database mid-game, and refresh/reconnect does not duplicate players or lose scores while the backend remains running. This is the first playable release—not the complete original feature list.

## 4. Create content and keep games durably

**Coordinate:** Fante and John, with Happy validating restored state.

Deliver as separate small increments:

1. A basic text-pack editor with validation, pack saving, and loading. Editing a pack leaves an active game's copy unchanged.
2. Active-game persistence and backend-restart recovery. Define when an acknowledged action is durable and what happens if a save fails.

**Done when:** someone can create and reuse a pack without changing source code, and a tested backend restart restores acknowledged game progress without repeating score changes.

## 5. Add fuller Jeopardy gameplay, one feature at a time

**Coordinate:** Happy, with every affected screen owner and John; Fante extends content as needed.

Implement and demo in order:

1. A full-size board and second ordinary round; define who controls clue choice even though the host clicks it.
2. Server-controlled timers, including expiry, pause, and host-disconnect rules.
3. Daily Doubles, with agreed wager bounds, eligibility, and cancellation behavior.
4. Final Jeopardy, with private wagers/answers, missing-submission rules, judging, reveal order, and final scoring.

**Done per feature:** its rules, UI states, private views, and reconnect behavior are tested together before starting the next. Do not implement all four in one PR.

## Later: choose based on actual playtests

Teams, Team Ham OAuth/accounts, chat/reactions, media clues, JSON/CSV import/export, configurable rules, advanced undo/redo, statistics/history, and richer sound/animation remain a backlog—not release promises. Pick one when it solves a demonstrated need and its owner has defined the behavior.

## Keep the plan realistic

- Begin with milestone 0, not six simultaneous “build my whole area” prompts.
- Plan the next small batch of tasks; avoid fixed week estimates until the team has completed a milestone and knows its pace.
- A blocked owner can pair, review, write a test, or build agreed example data. Starting a later feature usually creates more integration work.
- Hold a short shared demo at each milestone. Record its result and update the current milestone only after the completion gate passes.

Use the task brief and review checklist in [Workflow](WORKFLOW.md).
