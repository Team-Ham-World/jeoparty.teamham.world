# Member implementation guides

Pick your guide, then give its path to your agent. Each guide defines a small starting task and the work that follows—not permission to build an entire subsystem at once.

| Member | Guide | First implementation task |
|---|---|---|
| Happy | [Engine & rules](happy/README.md) | H1: validate and accept a buzz in the game engine |
| Ivvy | [Board & presentation](ivvy/README.md) | I1: render a read-only clue display |
| Scarlet | [Player experience](scarlet/README.md) | S1: render buzzer states and send a buzz request |
| Medchu | [Host controls](medchu/README.md) | M1: request a judgment for the current attempt |
| Fante | [Content](fante/README.md) | F0: validate a small text pack and supply test data |
| John | [Network & integration](john/README.md) | Confirm the J0 setup handoff, then plan the J1 authority proof |

Task IDs are labels for these guides, not existing tracker issues or completed work. Milestone numbers refer to the [roadmap](../ROADMAP.md).

## Shared instructions for every guide

Read [AGENTS.md](../../AGENTS.md), [Project](../PROJECT.md), [Team](../TEAM.md), the current [Roadmap](../ROADMAP.md) milestone, and [Workflow](../WORKFLOW.md) before implementation.

- **The shared docs govern scope and behavior.** These guides break that work into tasks; they do not approve pending proposals. If code, shared docs, and a guide disagree, report the conflict to the owner before changing behavior.
- **Check readiness.** The J0 scaffold exists and is the foundation to run — do not rescaffold. In milestone 0, confirm scope, establish the runtime, agree on shared data/actions, and allocate remaining modules. Later-milestone tasks stay blocked until their dependencies are ready.
- **Own only your slice.** Inspect actual paths before proposing edits. Use your assigned module and tests; get agreement before editing shared configuration, types, or another member's files. Do not create six app scaffolds or duplicate shared types.
- **Use one selected task per implementation request.** Propose the files and checks first. After the human approves the plan and required decisions are settled, implement that task only and verify it using the repository's actual scripts.
- **Check existing work first.** If the selected task is already implemented, verify its acceptance checks and report remaining gaps rather than rebuilding it. Choose follow-up work explicitly.
- **Keep examples honest.** Agreed sample data can unblock UI work. It must use the real interface and be labeled as a preview, not as functioning multiplayer. Secret-bearing packs stay server-side, including during demos.
- **Report evidence.** Return changed files, checks run/results, skipped checks, a short explanation, and the next handoff. Apply the workflow's teammate review before merge. Commit, push, and deploy only when explicitly authorized.

## Start without stepping on each other

1. All six confirm the milestone-0 decisions. John scaffolded the foundation (J0); others run it and review rather than starting competing apps.
2. Fante and Happy agree on pack inputs. Happy and John agree on actions, state, and the authority proof. Ivvy, Scarlet, and Medchu describe what their screens need and review the example views.
3. After confirming the scaffold checks, Fante implements F0. Happy and John complete the milestone-0 contract/runtime proof together (separate J1 work). John leads integration setup; Happy supplies the minimal rule behavior needed by the proof.
4. Once milestone 0 passes, begin H1/I1/S1/M1 in separate assigned modules. UI previews may use agreed examples until the connected path is ready.
5. Connect the pieces for the milestone-1 demo. Nobody waits until their entire area is “finished” to integrate.

During milestone 0, Happy coordinates shared state/actions and example views with John and the screen owners. John owns the server-side filtering and delivery of those views. Each screen owner owns rendering its view, not defining a rival shape.

## Two messages to your agent

Use the starter prompt in your own guide first. It asks for a plan, not automatic implementation of unapproved work.

After checking the plan and resolving its blockers, send:

> Implement only the selected task from the plan I approved. Follow its acceptance checks and the shared workflow. If a new shared decision or ownership conflict appears, explain it before changing that interface. Finish with verification results and a short explanation I can teach back; do not commit, push, or deploy.

When a task is done, choose the next small task from the same milestone. The “Next slices” tables are an order of work, not a single implementation request.
