# Repository guidance

- Start with [README.md](README.md) for status, commands and the folder map.
- Game behavior is defined in [docs/RULES.md](docs/RULES.md); change the rules there first, then the engine and its tests. Product decisions and technical boundaries are in [docs/PROJECT.md](docs/PROJECT.md); remaining work is in [docs/ROADMAP.md](docs/ROADMAP.md).
- The typed interfaces are `src/features/engine/contract.ts` (engine and views), `src/features/network/protocol.ts` (wire protocol) and `src/features/network/connection.ts` (what screens consume). Change them deliberately and update every caller, example and test in the same change.
- Follow [docs/WORKFLOW.md](docs/WORKFLOW.md): one bounded task, a plan first, small changes, checks, review.
- Keep the boundaries: screens render views and request commands; only the engine decides rules; only the server derives identity, orders commands and stores state. Never put answers or other private data in player or display payloads.
- Never use "Jeopardy", "Daily Double" or "Final Jeopardy" in product text or new identifiers.
- Explain plans and important code choices in plain language. Prefer code the owner can understand over clever abstractions.
- Use the repository scripts for checks (`npm run check`, `npm run test:smoke`, `npm run test:e2e`). Report what ran, what passed, and what remains unverified.
- Keep credentials out of source, prompts and output. Commit, push or deploy only when explicitly asked.
