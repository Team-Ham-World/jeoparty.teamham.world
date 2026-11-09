# Working with AI

The goal is to learn while shipping a game. AI helps you plan, write, test, and review code; you remain responsible for what you merge.

## One task, one branch, one small change

1. **Choose a task.** Take one item from the [roadmap](ROADMAP.md) or a bug. Decide who (or which separate review agent) will review it.
2. **Describe success.** Write what the user should be able to do, what is outside scope, and how you will check it.
3. **Ask for a plan first.** Have the agent inspect the relevant docs and code, explain the proposed change, and list the files it expects to edit. Read the plan before approving implementation.
4. **Build a small slice.** Use your own branch. Give the agent one task, not a whole subsystem. If it needs a shared interface changed (`contract.ts`, `protocol.ts`, `connection.ts`), change every caller and test in the same task.
5. **Check the result.** Read the diff (the changed lines), run the relevant checks, and try the feature yourself. Ask the agent to explain code you cannot yet explain.
6. **Open a pull request (PR).** Include the task, a short summary, and evidence: test output, screenshots, or exact manual steps and results. State checks you could not run.
7. **Review and merge.** Someone else, or an independent review agent on a different model, reviews it. After merging, check the combined app. A demo that works only on your branch is not integrated work.

Avoid assigning multiple agents the same files at once. Parallel work is useful only when the tasks touch separate folders and build against agreed interfaces.

## Copy this task brief

Fill this in before asking an agent to implement anything:

```text
Task:
Reviewer:
User-visible result:
Relevant docs and code:
Allowed files or module:
Depends on:
Out of scope:
Acceptance checks (observable pass/fail conditions):
```

Example: **Reject a second buzz while an answer is in progress.** Given open buzzers, when A's buzz is accepted and B buzzes afterward, A stays the answering player and B's request is rejected without changing scores. Realtime delivery and UI redesign are separate tasks.

## Useful prompts

**Before coding:**

> Read AGENTS.md and the docs relevant to this task. Inspect the existing implementation. Restate the goal, propose the smallest change, and explain how to test it. Flag conflicts or missing decisions before writing code.

**When something breaks:**

> Reproduce this failure, explain the cause using the code and error output, and propose a small fix. Add a regression test where practical. Avoid unrelated rewrites.

**Before opening a PR:**

> Review this diff against the task's acceptance checks. Look for incorrect behavior, missing tests, and changes outside scope. List exactly which checks ran and their results. Explain the change so I can teach it back.

## Ready to merge

- The acceptance checks pass, including a relevant failure case.
- Repository checks pass; use the scripts actually provided by the project. Missing checks are reported, not invented.
- UI changes were tried at their intended screen size; multiplayer changes were tried with separate browser sessions (or `npm run test:e2e`).
- No passwords, tokens, or private environment files are included in code, prompts, screenshots, or commits.
- The owner can explain the change, its dependencies, and at least one way it could fail.
- It has been reviewed; changed behavior or interfaces are documented in the same PR.

AI review is useful, but it does not replace trying the change yourself.

## Keep it explainable

If a task cannot be explained or verified in one focused review, split it into smaller tasks. Ask the agent to explain any code you cannot yet explain before you merge it.
