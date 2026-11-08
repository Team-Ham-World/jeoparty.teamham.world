# Roadmap

## Done (2026-11-07)

The original milestones 0–5 are implemented and covered by automated tests:

| Milestone | Result |
|---|---|
| 0. Foundation | Runtime chosen (persistent Node service + SQLite), shared contract, checks and CI |
| 1. One clue end to end | Select, buzz, judge, reveal, return to board through the real engine and server |
| 2. Real phones | Rooms, HAM sign-in, join flow, permission checks, filtered views per recipient, concurrent buzz race with one winner |
| 3. First release | Results with shared winners, score correction with reason, refresh/reconnect, stale/offline indicators, pause and host-offline auto-pause |
| 4. Content and durability | Pack editor with validation, import/export; saved packs; games restored (paused) after a backend restart |
| 5. Fuller gameplay | Two rounds, server timers, wager clues, final round with private wagers and answers |

UI/UX polish (2026-11-08): an [Impeccable](https://github.com/pbakaus/impeccable) audit of every screen at phone, laptop and TV sizes found 48 issues (one blocking: the 6-player final round ran off the TV). All were fixed or deliberately adjusted; the design system as built is recorded in [DESIGN.md](../DESIGN.md) and the product context in [PRODUCT.md](../PRODUCT.md).

Evidence: `npm run check` (engine, content, server, security and UI tests), `npm run test:smoke` (production build plays a clue), `npm run test:e2e` (separate browsers for host, TV and players play complete games).

## Before launch

1. ~~Register the HAM client~~: done 2026-11-07. See [HAM registration](HAM_REGISTRATION.md).
2. ~~Deploy~~: live at https://quiz.teamham.world since 2026-11-07. See [Deployment](DEPLOYMENT.md#current-deployment).
3. **Live verification:** real HAM sign-in and sign-out, a superseding login, two or more real phones on different networks, a TV at 10 feet, iOS Safari and Android Chrome, one backend restart mid-game.
4. **Playtest** a full game with the group and record what to change.

## Backlog

Choose from actual playtests, one at a time, each with its rules written in [RULES.md](RULES.md) first: teams, chat/reactions, media clues, configurable rules, host transfer, statistics/history, richer sound and animation, spectators.
