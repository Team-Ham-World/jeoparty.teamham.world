"use client";

import { useEffect } from "react";
import type { AttemptView, ClueView, FinalView, HostView } from "@/features/engine/contract";
import { HotHam } from "@/features/ui/brand";
import { Countdown } from "@/features/ui/countdown";
import { formatDelta, formatScore, listNames, nameOf, ordinal } from "@/features/ui/format";
import { WagerForm } from "@/features/ui/wager-form";
import type { HostActions } from "./host-screen";

const STAGE_LABEL: Record<ClueView["stage"], string> = {
  wager: "Wager",
  reading: "Reading",
  open: "Buzzers open",
  answering: "Answering",
  closed: "Buzzers closed",
  revealed: "Answer revealed",
};

/** The attempt the host is judging right now (the pending one). */
export function currentAttempt(clue: ClueView): AttemptView | null {
  return clue.attempts.find((a) => a.result === "pending" && a.playerId === clue.answeringPlayerId) ?? null;
}

type Shortcut = { key: string; run: () => void };

/** Single-letter shortcuts while no input or dialog has focus. */
function useShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      if (document.querySelector("dialog[open]")) return;
      const match = shortcuts.find((s) => s.key === event.key.toLowerCase());
      if (match) {
        event.preventDefault();
        match.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts]);
}

function ActionButton({
  label,
  hint,
  tone = "",
  enabled,
  busy,
  onClick,
}: {
  label: string;
  hint?: string;
  tone?: "" | "btn--primary" | "btn--good" | "btn--bad";
  enabled: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn btn--big ${tone}`}
      disabled={!enabled}
      aria-busy={busy || undefined}
      aria-keyshortcuts={hint}
      onClick={onClick}
    >
      {label}
      {hint ? <kbd aria-hidden="true">{hint}</kbd> : null}
    </button>
  );
}

export function HostClue({ view, clue, actions, clockOffsetMs }: { view: HostView; clue: ClueView; actions: HostActions; clockOffsetMs: number }) {
  const attempt = currentAttempt(clue);
  const stake = clue.kind === "wager" ? (clue.wager ?? clue.value) : clue.value;
  const answering = nameOf(view.players, clue.answeringPlayerId);
  const controller = nameOf(view.players, view.controllerId);

  const can = actions.can;
  const open = () => actions.run({ type: "openBuzzers", clueId: clue.clueId });
  const judge = (correct: boolean) => {
    if (attempt) actions.run({ type: "judge", clueId: clue.clueId, attemptId: attempt.id, correct });
  };
  const end = () => actions.run({ type: "endAttempts", clueId: clue.clueId });
  const reveal = () => actions.run({ type: "reveal", clueId: clue.clueId });
  const back = () => actions.run({ type: "returnToBoard", clueId: clue.clueId });

  const last = clue.attempts[clue.attempts.length - 1] ?? null;
  const solved = last?.result === "correct";
  const skipped = clue.kind === "wager" && clue.stage === "closed" && clue.attempts.length === 0;
  // Show (re)open only while the rules allow it; `can` adds the stale check for enabling.
  const showOpen = clue.kind === "standard" && (clue.stage === "reading" || (clue.stage === "closed" && view.allowedCommands.includes("openBuzzers")));
  const canOpen = can("openBuzzers") && (clue.stage === "reading" || clue.stage === "closed");
  const canJudge = can("judge") && clue.stage === "answering" && attempt !== null;
  const canEnd = can("endAttempts") && (clue.stage === "reading" || clue.stage === "open" || clue.stage === "wager");
  const canReveal = can("reveal") && clue.stage !== "answering" && clue.stage !== "revealed" && clue.stage !== "wager";
  const canBack = can("returnToBoard") && clue.stage === "revealed";

  useShortcuts([
    { key: "o", run: () => canOpen && open() },
    { key: "c", run: () => canJudge && judge(true) },
    { key: "x", run: () => canJudge && judge(false) },
    { key: "e", run: () => canEnd && clue.stage !== "wager" && end() },
    { key: "r", run: () => canReveal && reveal() },
    { key: "b", run: () => canBack && back() },
  ]);

  return (
    <section className={`host-clue host-clue--${clue.stage}`} aria-labelledby="host-clue-title">
      <header className="host-clue__head">
        <h2 id="host-clue-title" className="name">
          {clue.categoryTitle} <span className="num">· {formatScore(clue.value)}</span>
        </h2>
        <div className="row">
          {clue.kind === "wager" ? <span className="stamp stamp--hot stamp--flat">Wager clue</span> : null}
          <span className="stamp stamp--ink stamp--flat" role="status">
            {skipped ? "Skipped" : STAGE_LABEL[clue.stage]}
          </span>
        </div>
      </header>

      <div className="host-clue__body">
        {clue.kind === "wager" && clue.stage === "wager" ? (
          <div className="host-clue__hot">
            <HotHam />
            <p>
              The screen shows the wager clue. <strong className="name">{controller}</strong> wagers before anyone sees the clue.
            </p>
          </div>
        ) : null}

        <div className={`host-prompt ${(clue.prompt ?? "").length > 160 ? "host-prompt--long" : ""}`}>
          <span className="eyebrow">{clue.kind === "wager" && clue.stage === "wager" ? "Prompt · hidden from everyone else" : "Prompt · read this aloud"}</span>
          <p>{clue.prompt}</p>
        </div>

        <div className="host-answer">
          <span className="eyebrow">{clue.stage === "revealed" ? "Answer · now on the big screen" : "Answer · only you can see this"}</span>
          <p>{clue.answer}</p>
        </div>

        {clue.wager !== null ? (
          <p className="host-note">
            <strong className="name">{controller}</strong> wagered <strong className="num">{formatScore(clue.wager)}</strong>.
          </p>
        ) : null}

        {view.timer && (clue.stage === "open" || clue.stage === "answering") ? <Countdown timer={view.timer} clockOffsetMs={clockOffsetMs} /> : null}

        {clue.attempts.length > 0 ? (
          <ol className="host-attempts" aria-label="Attempts on this clue">
            {clue.attempts.map((a) => (
              <li key={a.id} className={`host-attempt host-attempt--${a.result}`}>
                <span className="name">{nameOf(view.players, a.playerId)}</span>
                <span>
                  {a.result === "pending" ? "answering" : a.result}
                  {a.timedOut ? " · time ran out" : ""}
                </span>
                <span className="num">{a.delta !== null ? formatDelta(a.delta) : ""}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="host-clue__actions">
        {clue.stage === "wager" ? (
          <div className="host-wager">
            <h3>
              Waiting for <span className="name">{controller}</span>&apos;s wager
            </h3>
            <p className="muted">They lock it in on their phone. If they say it out loud instead, enter it for them here.</p>
            {view.wagerBounds ? (
              <WagerForm
                min={view.wagerBounds.min}
                max={view.wagerBounds.max}
                disabled={!can("submitWager")}
                busy={actions.pending === "submitWager"}
                label={`${controller}'s wager`}
                submitLabel={`Lock in for ${controller}`}
                onSubmit={(amount) => actions.run({ type: "submitWager", clueId: clue.clueId, amount })}
              />
            ) : null}
            <button type="button" className="btn btn--quiet" disabled={!canEnd} onClick={end}>
              Skip this clue (no score change)
            </button>
          </div>
        ) : clue.stage === "answering" ? (
          <>
            <p className="host-callout">
              <strong className="name">{answering}</strong> is answering{attempt?.timedOut ? " · time ran out, judge anyway" : ""}.
            </p>
            <div className="row">
              <ActionButton label={`Correct ${formatDelta(stake)}`} hint="C" tone="btn--good" enabled={canJudge} busy={actions.pending === "judge"} onClick={() => judge(true)} />
              <ActionButton label={`Incorrect ${formatDelta(-stake)}`} hint="X" tone="btn--bad" enabled={canJudge} busy={actions.pending === "judge"} onClick={() => judge(false)} />
            </div>
          </>
        ) : clue.stage === "revealed" ? (
          <div className="row">
            <ActionButton label="Back to board" hint="B" tone="btn--primary" enabled={canBack} busy={actions.pending === "returnToBoard"} onClick={back} />
          </div>
        ) : (
          <>
            {clue.stage === "open" ? <p className="host-callout">Buzzers are open. Waiting for a buzz…</p> : null}
            {clue.stage === "closed" ? (
              <p className="host-callout">
                {solved && last ? (
                  <>
                    <strong className="name">{nameOf(view.players, last.playerId)}</strong> got it. Reveal the answer, then head back to the board.
                  </>
                ) : skipped ? (
                  "Wager clue skipped with no score change. Reveal the answer to move on."
                ) : clue.kind === "wager" && last ? (
                  <>
                    <strong className="name">{nameOf(view.players, last.playerId)}</strong> missed it. Reveal the answer to move on.
                  </>
                ) : showOpen ? (
                  "Reopen for players who haven't tried, or reveal the answer."
                ) : (
                  "Everyone has had a go. Reveal the answer."
                )}
              </p>
            ) : null}
            <div className="row">
              {showOpen ? (
                <ActionButton
                  label={clue.stage === "closed" ? "Reopen buzzers" : "Open buzzers"}
                  hint="O"
                  tone="btn--primary"
                  enabled={canOpen}
                  busy={actions.pending === "openBuzzers"}
                  onClick={open}
                />
              ) : null}
              <ActionButton label="Reveal answer" hint="R" tone={clue.stage === "closed" && !showOpen ? "btn--primary" : ""} enabled={canReveal} busy={actions.pending === "reveal"} onClick={reveal} />
              {clue.stage !== "closed" ? <ActionButton label="End attempts" hint="E" enabled={canEnd} busy={actions.pending === "endAttempts"} onClick={end} /> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function HostFinal({ view, final, actions, clockOffsetMs }: { view: HostView; final: FinalView; actions: HostActions; clockOffsetMs: number }) {
  const can = actions.can;
  const next = final.responses.find((r) => r.playerId === final.nextResponderId) ?? null;

  return (
    <section className="host-clue host-final" aria-labelledby="host-final-title">
      <header className="host-clue__head">
        <h2 id="host-final-title" className="name">
          Final round · {final.categoryTitle}
        </h2>
        <span className="stamp stamp--ink stamp--flat" role="status">
          {final.stage === "wagers" ? "Wagers" : final.stage === "answering" ? "Answering" : final.stage === "judging" ? "Judging" : "Done"}
        </span>
      </header>

      <div className="host-clue__body">
        <div className="host-prompt">
          <span className="eyebrow">{final.stage === "wagers" ? "Prompt · hidden until wagers lock" : "Prompt · on the big screen"}</span>
          <p>{final.prompt}</p>
        </div>
        <div className="host-answer">
          <span className="eyebrow">{final.stage === "done" ? "Answer · now on the big screen" : "Answer · only you can see this"}</span>
          <p>{final.answer}</p>
        </div>

        {final.stage === "answering" && view.timer ? <Countdown timer={view.timer} clockOffsetMs={clockOffsetMs} /> : null}

        {final.stage === "wagers" || final.stage === "answering" ? (
          <ul className="host-checklist" aria-label={final.stage === "wagers" ? "Wagers in" : "Answers in"}>
            {final.eligiblePlayerIds.map((id) => {
              const done = (final.stage === "wagers" ? final.wagerSubmittedIds : final.answerSubmittedIds).includes(id);
              return (
                <li key={id} className={done ? "is-done" : undefined}>
                  <span aria-hidden="true">{done ? "✓" : "○"}</span>
                  <span className="name">{nameOf(view.players, id)}</span>
                  <span className="muted">{done ? (final.stage === "wagers" ? "wagered" : "answered") : "waiting"}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <ol className="host-responses" aria-label="Responses in reveal order">
            {final.responses.map((r) => (
              <li key={r.playerId} className={`host-response host-response--${r.status} ${r.playerId === final.nextResponderId ? "is-next" : ""}`}>
                <div className="host-response__who">
                  <strong className="name">{nameOf(view.players, r.playerId)}</strong>
                  <span className="muted">
                    {r.status === "hidden" ? "not revealed yet" : r.status === "revealed" ? "on screen" : r.correct ? "correct" : "incorrect"}
                    {r.wager !== null ? ` · wager ${formatScore(r.wager)}` : ""}
                  </span>
                </div>
                <p className="host-response__said">{r.answer ? `“${r.answer}”` : "(no answer)"}</p>
                {r.delta !== null ? <span className="num host-response__delta">{formatDelta(r.delta)}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="host-clue__actions">
        {final.stage === "wagers" ? (
          <>
            <p className="host-callout">
              {final.wagerSubmittedIds.length} of {final.eligiblePlayerIds.length} wagers in. Missing wagers count as 0.
            </p>
            <div className="row">
              <ActionButton label="Show final clue" tone="btn--primary" enabled={can("showFinalClue")} busy={actions.pending === "showFinalClue"} onClick={() => actions.run({ type: "showFinalClue" })} />
            </div>
          </>
        ) : final.stage === "answering" ? (
          <>
            <p className="host-callout">
              {final.answerSubmittedIds.length} of {final.eligiblePlayerIds.length} answers in. Answers lock when time runs out.
            </p>
            <div className="row">
              <ActionButton label="Lock answers" tone="btn--primary" enabled={can("lockFinalAnswers")} busy={actions.pending === "lockFinalAnswers"} onClick={() => actions.run({ type: "lockFinalAnswers" })} />
            </div>
          </>
        ) : final.stage === "judging" && next ? (
          next.status === "hidden" ? (
            <div className="row">
              <ActionButton
                label={`Reveal ${nameOf(view.players, next.playerId)}'s response`}
                tone="btn--primary"
                enabled={can("revealFinalResponse")}
                busy={actions.pending === "revealFinalResponse"}
                onClick={() => actions.run({ type: "revealFinalResponse", playerId: next.playerId })}
              />
            </div>
          ) : (
            <>
              <p className="host-callout">
                Judge <strong className="name">{nameOf(view.players, next.playerId)}</strong>: “{next.answer ?? ""}”
              </p>
              <div className="row">
                <ActionButton
                  label={`Correct ${next.wager !== null ? formatDelta(next.wager) : ""}`}
                  tone="btn--good"
                  enabled={can("judgeFinal")}
                  busy={actions.pending === "judgeFinal"}
                  onClick={() => actions.run({ type: "judgeFinal", playerId: next.playerId, correct: true })}
                />
                <ActionButton
                  label={`Incorrect ${next.wager !== null ? formatDelta(-next.wager) : ""}`}
                  tone="btn--bad"
                  enabled={can("judgeFinal")}
                  busy={actions.pending === "judgeFinal"}
                  onClick={() => actions.run({ type: "judgeFinal", playerId: next.playerId, correct: false })}
                />
              </div>
            </>
          )
        ) : (
          <div className="row">
            <ActionButton label="Show results" tone="btn--primary" enabled={can("finishGame")} busy={actions.pending === "finishGame"} onClick={() => actions.run({ type: "finishGame" })} />
          </div>
        )}
      </div>
    </section>
  );
}

export function HostResults({ view, actions }: { view: HostView; actions: HostActions }) {
  const results = view.results;
  if (!results) return null;
  const winners = results.standings.filter((s) => results.winnerIds.includes(s.playerId)).map((s) => s.name);
  return (
    <section className="panel host-results" aria-labelledby="host-results-title">
      <span className="stamp stamp--red">Game over</span>
      <h2 id="host-results-title" className="host-results__title">
        {winners.length > 1 ? `Shared win: ${listNames(winners)}` : `${winners[0] ?? "Nobody"} wins!`}
      </h2>
      <ol className="host-standings">
        {results.standings.map((s) => (
          <li key={s.playerId} className={results.winnerIds.includes(s.playerId) ? "is-winner" : undefined}>
            <span className="num">{ordinal(s.rank)}</span>
            <span className="name">{s.name}</span>
            <span className={`score ${s.score < 0 ? "score--neg" : ""}`}>{formatScore(s.score)}</span>
          </li>
        ))}
      </ol>
      <div className="row">
        <button type="button" className="btn btn--primary btn--big" disabled={!actions.can("playAgain")} onClick={() => actions.run({ type: "playAgain" })}>
          Play again
        </button>
        <span className="muted">Everyone goes back to the lobby with scores reset.</span>
      </div>
    </section>
  );
}
