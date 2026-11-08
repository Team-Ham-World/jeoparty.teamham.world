# HAM Quiz

A party quiz-show game for HAM. A host runs the game from a laptop, a TV or projector shows the board, and 2–6 players buzz in from their phones. Host and players sign in with TeamHam.world; the TV opens from a link the host generates.

**Status:** the full game is implemented and tested locally: two rounds, wager clues ("Hot HAM!"), a final round, server timers, pause and reconnect recovery, games that survive a backend restart, and a pack editor. It is live at **https://quiz.teamham.world** (deployed 2026-11-07, last updated 2026-11-08, with Docker behind the shared Caddy on the Oracle host and proxied by Cloudflare), using HAM sign-in with the registered `quiz` client. See [Deployment](docs/DEPLOYMENT.md#current-deployment).

## Quickstart

Install **Node 24** and **npm 11** (`.nvmrc` selects Node 24), then:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Locally, "Sign in with HAM" uses a **development fixture** (a stand-in for TeamHam.world, clearly stamped "not live HAM"), so no credentials or `.env` are needed. To play a game on one machine, use separate browser profiles or private windows for the host and each player, pick a different fixture name in each, and open the TV link from the host's lobby in another window.

Use another port with `PORT=3001 PUBLIC_ORIGIN=http://127.0.0.1:3001 npm run dev`. Stop with Ctrl+C.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Combined server (Next.js + API + WebSockets) on 127.0.0.1:3000 with fixture sign-in |
| `npm run check` | Lint, formatting check, typecheck, unit/integration tests, Next build, server bundle |
| `npm run format` | Format the code with Prettier |
| `npm run test:smoke` | Starts the production build and plays one clue end to end (run after `check`) |
| `npm run test:e2e` | Playwright: host, TV and players in separate browsers play complete games |
| `npm test -- <path>` | Run one test file |
| `npm run build` then `npm start` | Production build, then serve it |

CI (`.github/workflows/checks.yml`) runs `npm run check` and the smoke test.

## How it works

```text
Host / player phone ──▶ /ws (cookie identity, Origin, role checks)
                          │
                          ▼
                 room actor: one command at a time
                          │ engine.apply(state, actor, command, now)
                          ▼
                 save to SQLite ──▶ ack ──▶ a separate view per recipient
                                            (host / each player / TV)
```

- **One rule implementation.** `src/features/engine` is pure TypeScript: state + command → new state, plus a view for each audience. Screens never decide scores, buzz winners or transitions.
- **Authoritative server.** `src/server` is one Node 24 process that serves Next.js and owns `/api/*` and `/ws`. Each room processes commands strictly in order, saves before acknowledging, replays the original result for a retried command id, and runs the timers.
- **Private views.** Answers, wager-clue locations and other players' final wagers/answers are absent from player and TV payloads until they are public. Tests check the actual frames sent.
- **HAM sign-in.** Confidential authorization-code flow with PKCE and introspection, ported from Pusoy Dos. See [security decisions](docs/SECURITY.md) for the introspection policy.

## Folder map

```text
src/app/                 routes: / (home), /r/[code] (player), /host/[code], /display/[code], /packs, /preview (dev only)
src/features/engine/     rules, views, restore; contract.ts is the shared interface
src/features/content/    question-pack format v3, validator, built-in packs in samples/
src/features/network/    protocol.ts (wire types), connection.ts, client/ (WebSocket hook + API helpers)
src/features/ui/         design system (HAM "Cut & Paste"), shared components
src/features/{board,player,host,display,lobby,editor,preview}/   screens
src/server/              HTTP + WebSocket server, HAM OAuth, rooms, SQLite storage, tests
tests/e2e/               Playwright end-to-end tests
deploy/, Dockerfile, docker-compose.yml   single-instance deployment behind Caddy
```

## Docs

| Document | Answers |
|---|---|
| [Rules](docs/RULES.md) | Exactly how a game plays: rounds, buzzing, wagers, final round, pause and recovery |
| [Project](docs/PROJECT.md) | What the product is, decisions made, and the technical boundaries |
| [Roadmap](docs/ROADMAP.md) | What is done, what remains before launch, and the backlog |
| [Deployment](docs/DEPLOYMENT.md) | Environment, Docker/Caddy, limits, backups |
| [HAM registration](docs/HAM_REGISTRATION.md) | Owner steps to register the `quiz` OAuth client |
| [Security decisions](docs/SECURITY.md) | The approved introspection policy |
| [Workflow](docs/WORKFLOW.md) | How to make and verify changes with AI help |

[AGENTS.md](AGENTS.md) is the entry point for coding agents.
