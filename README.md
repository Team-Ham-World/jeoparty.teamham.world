# JeoParty

A browser-based Jeopardy-style game for Team Ham: a host runs the game, a shared screen shows the board, and players buzz in from their phones.

This is a six-person learning project. The aim is to build a working game **and** learn to guide, check, and explain AI-assisted code.

**Current status:** the shared scaffold is implemented and its local checks pass. It includes a welcome page, six member starting areas, and a CI definition—not a playable game. Milestone 0 remains open: the backend proof, game contracts, team scope confirmation, and teammate setup handoff are still needed.

## Read these in order

| Document | Answers |
|---|---|
| [Project](docs/PROJECT.md) | What are we building first? What rules and technical boundaries must we share? |
| [Team](docs/TEAM.md) | Who owns each part, and where do responsibilities meet? |
| [Roadmap](docs/ROADMAP.md) | What comes next, what depends on it, and how do we know it works? |
| [Workflow](docs/WORKFLOW.md) | How do we use AI, test changes, and review each other's work? |
| [Member guides](docs/pointers/README.md) | Which spec and starting task should I give my agent? |

[AGENTS.md](AGENTS.md) is the short entry point for coding agents. If your tool does not load it automatically, include it in your prompt.

## Quickstart (beginner)

Install **Node 24 LTS** with **npm 11**. If you use nvm, run `nvm install` and `nvm use` in this folder first; `.nvmrc` selects Node 24. Then:

```sh
npm ci
npm run dev
```

Then open http://127.0.0.1:3000. The dev/start scripts bind `127.0.0.1`. To use another port:

```sh
npm run dev -- --port 3001
```

No credentials or `.env` file are needed: there is no Supabase integration, database, transport, or deployed app yet. Stop the server with **Ctrl+C**. After pulling dependency changes, run `npm ci` again; use npm only so everyone shares the same lockfile.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Clean install from the lockfile |
| `npm run dev` | Start the dev server on 127.0.0.1:3000 |
| `npm run check` | Run everything: lint + typecheck (`next typegen` & `tsc`) + `npm test` + build |
| `npm run test:watch` | Re-run tests on file changes |
| `npm test -- src/lib/team.test.ts` | Run one focused test file |
| `npm run build` then `npm start` | Production build, then serve it |

Checks are defined in `.github/workflows/checks.yml` (runs `npm run check` on PRs and pushes to `main`); it has not been run remotely yet. Test files live beside the code as `*.test.ts`/`*.test.tsx`. Vitest runs in node by default; browser tests put `// @vitest-environment jsdom` at the top. Examples: `src/lib/team.test.ts` and `src/test/scaffold.test.tsx`.

ESLint 9 is pinned because the current Next.js React lint plugin fails with ESLint 10. npm may show its deprecation warning; keep the working pin until the plugin supports the newer version.

## Folder map

All routes are thin wrappers under `src/app`: `/` (starter home), `/display` (Ivvy), `/play` (Scarlet), `/host` (Medchu), `/editor` (Fante), plus informational `/workbench/engine` (Happy) and `/workbench/network` (John).

```text
src/app/            routes (thin wrappers), layout.tsx, globals.css
src/components/     starter-home.tsx, starter-panel.tsx (shared UI, Ivvy coordinates)
src/features/board/    board-starter.tsx (Ivvy)
src/features/player/   player-starter.tsx (Scarlet)
src/features/host/     host-starter.tsx (Medchu)
src/features/content/  content-starter.tsx + README.md (Fante; no validator/editor yet)
src/features/engine/   README.md only (Happy; rules absent)
src/features/network/  README.md only (John; no backend)
src/lib/team.ts     shared onboarding metadata, NOT game contracts
src/test/           shared test setup
```

`@/*` maps to `src/*`. Every screen is an honest scaffold — no buttons, game features, or private content.

## Start together

1. Review the proposed first-release scope and open decisions in the project guide (still a proposal, not team-approved).
2. Confirm the named ownership boundaries in the team guide.
3. Run the scaffold above, then pick one small task each from the current milestone—not six separate subsystem builds.

## About these docs

These guides replace the four long source-of-truth questionnaires. The originals remain in Git history. Named responsibilities are retained; the narrower release plan is a **proposal for team confirmation**, not a claim of six-person approval. Old checked sign-offs are not carried forward as evidence of approval or completed work.

Each topic has one home: product rules in Project, ownership in Team, delivery order in Roadmap, and working practices in Workflow. Keep detailed interfaces beside the code once they exist.
