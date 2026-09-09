# Working with AI

The goal is to learn while shipping a game. AI helps you plan, write, test, and review code; you remain responsible for what you merge.

## One task, one branch, one small change

1. **Choose a task.** Take an unclaimed task from the current [roadmap milestone](ROADMAP.md). Name one owner and one teammate who will review it.
2. **Describe success.** Write what the user should be able to do, what is outside scope, and how you will check it.
3. **Ask for a plan first.** Have the agent inspect the relevant docs and code, explain the proposed change, and list the files it expects to edit. Read the plan before approving implementation.
4. **Build a small slice.** Use your own branch. Give the agent one task, not an entire role or milestone. If it needs someone else's interface changed, agree on that change with the owner first.
5. **Check the result.** Read the diff (the changed lines), run the relevant checks, and try the feature yourself. Ask the agent to explain code you cannot yet explain.
6. **Open a pull request (PR).** Include the task, a short summary, and evidence: test output, screenshots, or exact manual steps and results. State checks you could not run.
7. **Review and merge.** Another teammate reviews it. After merging, check the combined app and update the task status. A demo that works only on your branch is not integrated work.

Avoid assigning multiple agents the same files at once. Parallel work is useful only when the tasks have separate owners and agreed interfaces.

## Copy this task brief

Fill this in before asking an agent to implement anything:

```text
Task:
Owner / reviewer:
User-visible result:
Relevant docs and code:
Allowed files or module:
Depends on:
Out of scope:
Acceptance checks (observable pass/fail conditions):
```

Example: **Reject a second buzz while an answer is in progress.** Happy owns the rule; Scarlet reviews its effect on the player screen. Given open buzzers, when A's buzz is accepted and B buzzes afterward, A stays the answering player and B's request is rejected without changing scores. Realtime delivery and UI redesign are separate tasks.

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
- UI changes were tried at their intended screen size; multiplayer changes were tried with separate browser sessions.
- No passwords, tokens, or private environment files are included in code, prompts, screenshots, or commits.
- The owner can explain the change, its dependencies, and at least one way it could fail.
- A teammate has reviewed it; changed behavior or interfaces are documented in the same PR.

AI review is useful, but it does not replace the teammate review or your own test.

## Learn together

At each milestone demo, everyone explains one change they owned and one mistake they learned from. Pair up when blocked. If a task cannot be explained or verified in one focused review, split it into smaller tasks.
