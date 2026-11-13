"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type {
  AttemptView,
  ClueView,
  FinalView,
  HostView,
  PromptView,
  TimerView,
} from "@/features/engine/contract";
import { HotHam } from "@/features/ui/brand";
import { CluePicture } from "@/features/ui/clue-picture";
import { Countdown } from "@/features/ui/countdown";
import {
  answeringMargin,
  formatDelta,
  formatScore,
  listNames,
  nameOf,
  ordinal,
} from "@/features/ui/format";
import { WagerForm } from "@/features/ui/wager-form";
import type { HostActions } from "./host-screen";

const STAGE_LABEL: Record<ClueView["stage"], string> = {
  wager: "Placing wager",
  reading: "Reading",
  open: "Buzzers open",
  answering: "Answering",
  closed: "Buzzers closed",
  revealed: "Answer revealed",
};

/** The attempt the host is judging right now (the pending one). */
export function currentAttempt(clue: ClueView): AttemptView | null {
  return (
    clue.attempts.find((a) => a.result === "pending" && a.playerId === clue.answeringPlayerId) ??
    null
  );
}

type Shortcut = { key: string; run: () => void };

/** Single-letter shortcuts while no input or dialog has focus. */
function useShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable=true], dialog")
      )
        return;
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

/**
 * A big host action with its shortcut key. The key letter is drawn by CSS
 * from `data-key` (see host.css), so the button's text and accessible name
 * are only the action; screen readers get the key from aria-keyshortcuts.
 */
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
      {hint ? <kbd aria-hidden="true" data-key={hint} /> : null}
    </button>
  );
}

/**
 * The line above the action buttons: what is happening now, plus the timer
 * while one runs. It is always at least one timer tall, so the buttons below
 * it stay in the same place from one stage to the next.
 */
function ActionStatus({
  children,
  timer,
  clockOffsetMs,
}: {
  children: ReactNode;
  timer: TimerView | null;
  clockOffsetMs: number;
}) {
  return (
    <div className="host-status">
      <p className="host-callout">{children}</p>
      {timer ? (
        <Countdown timer={timer} clockOffsetMs={clockOffsetMs} className="host-status__timer" />
      ) : null}
    </div>
  );
}

function promptLabel(shown: PromptView, where: string): string {
  return `${shown.picture ? "Prompt and picture" : "Prompt"} · ${where}`;
}

export function HostClue({
  view,
  clue,
  actions,
  clockOffsetMs,
}: {
  view: HostView;
  clue: ClueView;
  actions: HostActions;
  clockOffsetMs: number;
}) {
  const attempt = currentAttempt(clue);
  const stake = clue.kind === "wager" ? (clue.wager ?? clue.value) : clue.value;
  const answering = nameOf(view.players, clue.answeringPlayerId);
  const margin = answeringMargin(clue);
  const controller = nameOf(view.players, view.controllerId);

  const can = actions.can;
  const open = () => actions.run({ type: "openBuzzers", clueId: clue.clueId });
  const judge = (correct: boolean) => {
    if (attempt)
      actions.run({ type: "judge", clueId: clue.clueId, attemptId: attempt.id, correct });
  };
  const end = () => actions.run({ type: "endAttempts", clueId: clue.clueId });
  const reveal = () => actions.run({ type: "reveal", clueId: clue.clueId });
  const back = () => actions.run({ type: "returnToBoard", clueId: clue.clueId });

  const last = clue.attempts[clue.attempts.length - 1] ?? null;
  const solved = last?.result === "correct";
  const skipped = clue.kind === "wager" && clue.stage === "closed" && clue.attempts.length === 0;
  // Show (re)open only while the rules allow it; `can` adds the stale check for enabling.
  const showOpen =
    clue.kind === "standard" &&
    (clue.stage === "reading" ||
      (clue.stage === "closed" && view.allowedCommands.includes("openBuzzers")));
  const canOpen = can("openBuzzers") && (clue.stage === "reading" || clue.stage === "closed");
  const canJudge = can("judge") && clue.stage === "answering" && attempt !== null;
  const canEnd =
    can("endAttempts") &&
    (clue.stage === "reading" || clue.stage === "open" || clue.stage === "wager");
  const canReveal =
    can("reveal") &&
    clue.stage !== "answering" &&
    clue.stage !== "revealed" &&
    clue.stage !== "wager";
  const canBack = can("returnToBoard") && clue.stage === "revealed";
  const timer = clue.stage === "open" || clue.stage === "answering" ? view.timer : null;

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
          {/* While the wager is placed, the Hot HAM! slip below already says it. */}
          {clue.kind === "wager" && clue.stage !== "wager" ? (
            <span className="stamp stamp--hot stamp--flat">Wager clue</span>
          ) : null}
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
              The screen shows the wager clue. <strong className="name">{controller}</strong> wagers
              before anyone sees the clue.
            </p>
          </div>
        ) : null}

        <div
          className={`host-prompt ${(clue.prompt ?? "").length > 160 ? "host-prompt--long" : ""}`}
        >
          <span className="eyebrow">
            {promptLabel(
              clue,
              clue.kind === "wager" && clue.stage === "wager"
                ? "hidden from everyone else"
                : "read this aloud",
            )}
          </span>
          {clue.picture ? <CluePicture picture={clue.picture} className="host-picture" /> : null}
          <p>{clue.prompt}</p>
        </div>

        <div className="host-answer">
          <span className="eyebrow">
            {clue.stage === "revealed"
              ? "Answer · now on the big screen"
              : "Answer · only you can see this"}
          </span>
          <p>{clue.answer}</p>
        </div>

        {clue.wager !== null ? (
          <p className="host-note">
            <strong className="name">{controller}</strong> wagered{" "}
            <strong className="num">{formatScore(clue.wager)}</strong>.
          </p>
        ) : null}
      </div>

      {/* Same shape in every stage after the wager: status line, then buttons. */}
      <div className="host-clue__actions">
        {clue.stage === "wager" ? (
          <div className="host-wager">
            <h3>
              Waiting for <span className="name">{controller}</span>&apos;s wager
            </h3>
            <p className="muted">
              They lock it in on their phone. If they say it out loud instead, enter it for them
              here.
            </p>
            {view.wagerBounds ? (
              <WagerForm
                min={view.wagerBounds.min}
                max={view.wagerBounds.max}
                disabled={!can("submitWager")}
                busy={actions.pending === "submitWager"}
                label={`${controller}'s wager`}
                submitLabel={`Lock in for ${controller}`}
                onSubmit={(amount) =>
                  actions.run({ type: "submitWager", clueId: clue.clueId, amount })
                }
              />
            ) : null}
            <button type="button" className="btn btn--quiet" disabled={!canEnd} onClick={end}>
              Skip this clue (no score change)
            </button>
          </div>
        ) : (
          <>
            <ActionStatus timer={timer} clockOffsetMs={clockOffsetMs}>
              {clue.stage === "reading" ? (
                "Read the clue aloud, then open the buzzers."
              ) : clue.stage === "open" ? (
                "Buzzers are open. Waiting for a buzz…"
              ) : clue.stage === "answering" ? (
                <>
                  <strong className="name">{answering}</strong> is answering
                  {attempt?.timedOut ? (
                    " · time ran out, judge anyway"
                  ) : margin ? (
                    <span className="host-margin"> · first {margin}</span>
                  ) : null}
                  .
                </>
              ) : clue.stage === "revealed" ? (
                "The answer is on the big screen."
              ) : solved && last ? (
                <>
                  <strong className="name">{nameOf(view.players, last.playerId)}</strong> got it.
                  Reveal the answer, then head back to the board.
                </>
              ) : skipped ? (
                "Wager clue skipped with no score change. Reveal the answer to move on."
              ) : clue.kind === "wager" && last ? (
                <>
                  <strong className="name">{nameOf(view.players, last.playerId)}</strong> missed it.
                  Reveal the answer to move on.
                </>
              ) : view.paused ? (
                "The game is paused. Resume it to carry on."
              ) : showOpen ? (
                "Reopen for players who haven't tried, or reveal the answer."
              ) : (
                "No more attempts on this clue. Reveal the answer."
              )}
            </ActionStatus>
            <div className="row">
              {clue.stage === "answering" ? (
                <>
                  <ActionButton
                    label={`Correct ${formatDelta(stake)}`}
                    hint="C"
                    tone="btn--good"
                    enabled={canJudge}
                    busy={actions.pending === "judge"}
                    onClick={() => judge(true)}
                  />
                  <ActionButton
                    label={`Incorrect ${formatDelta(-stake)}`}
                    hint="X"
                    tone="btn--bad"
                    enabled={canJudge}
                    busy={actions.pending === "judge"}
                    onClick={() => judge(false)}
                  />
                </>
              ) : clue.stage === "revealed" ? (
                <ActionButton
                  label="Back to board"
                  hint="B"
                  tone="btn--primary"
                  enabled={canBack}
                  busy={actions.pending === "returnToBoard"}
                  onClick={back}
                />
              ) : (
                <>
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
                  <ActionButton
                    label="Reveal answer"
                    hint="R"
                    tone={clue.stage === "closed" && !showOpen ? "btn--primary" : ""}
                    enabled={canReveal}
                    busy={actions.pending === "reveal"}
                    onClick={reveal}
                  />
                  {clue.stage !== "closed" ? (
                    <ActionButton
                      label="End attempts"
                      hint="E"
                      enabled={canEnd}
                      busy={actions.pending === "endAttempts"}
                      onClick={end}
                    />
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Below the buttons, so a new attempt never pushes them down. */}
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
    </section>
  );
}

export function HostFinal({
  view,
  final,
  actions,
  clockOffsetMs,
}: {
  view: HostView;
  final: FinalView;
  actions: HostActions;
  clockOffsetMs: number;
}) {
  const can = actions.can;
  const next = final.responses.find((r) => r.playerId === final.nextResponderId) ?? null;
  const nextName = next ? nameOf(view.players, next.playerId) : "";
  const nextWager = next?.wager ?? null;
  // The one step the host takes next; it picks the button, its shortcut and the status line.
  const step =
    final.stage === "wagers"
      ? "showClue"
      : final.stage === "answering"
        ? "lock"
        : final.stage === "judging" && next
          ? next.status === "hidden"
            ? "reveal"
            : "judge"
          : "finish";
  const timer = final.stage === "answering" ? view.timer : null;

  const showClue = () => actions.run({ type: "showFinalClue" });
  const lock = () => actions.run({ type: "lockFinalAnswers" });
  const revealNext = () => {
    if (next) actions.run({ type: "revealFinalResponse", playerId: next.playerId });
  };
  const judgeNext = (correct: boolean) => {
    if (next) actions.run({ type: "judgeFinal", playerId: next.playerId, correct });
  };
  const finish = () => actions.run({ type: "finishGame" });

  const canShowClue = step === "showClue" && can("showFinalClue");
  const canLock = step === "lock" && can("lockFinalAnswers");
  const canReveal = step === "reveal" && can("revealFinalResponse");
  const canJudge = step === "judge" && can("judgeFinal");
  const canFinish = step === "finish" && can("finishGame");

  useShortcuts([
    { key: "s", run: () => canShowClue && showClue() },
    { key: "l", run: () => canLock && lock() },
    { key: "r", run: () => canReveal && revealNext() },
    { key: "c", run: () => canJudge && judgeNext(true) },
    { key: "x", run: () => canJudge && judgeNext(false) },
    { key: "f", run: () => canFinish && finish() },
  ]);

  // Keep the response being revealed or judged in view, clear of the sticky
  // action bar, as the host works down the list.
  const responsesRef = useRef<HTMLOListElement>(null);
  const nextKey = next ? `${next.playerId}:${next.status}` : "";
  useEffect(() => {
    const row = responsesRef.current?.querySelector<HTMLElement>(".is-next");
    if (!row) return;
    const bar = row.closest(".host-clue")?.querySelector<HTMLElement>(".host-clue__actions");
    row.style.scrollMarginBottom = `${(bar?.offsetHeight ?? 0) + 16}px`;
    row.scrollIntoView({ block: "nearest" });
  }, [nextKey]);

  return (
    <section
      className={`host-clue host-final host-final--${final.stage}`}
      aria-labelledby="host-final-title"
    >
      <header className="host-clue__head">
        <h2 id="host-final-title" className="name">
          Final round · {final.categoryTitle}
        </h2>
        <span className="stamp stamp--ink stamp--flat" role="status">
          {final.stage === "wagers"
            ? "Wagers"
            : final.stage === "answering"
              ? "Answering"
              : final.stage === "judging"
                ? "Judging"
                : "Done"}
        </span>
      </header>

      <div className="host-clue__body">
        <div className="host-prompt">
          <span className="eyebrow">
            {promptLabel(
              final,
              final.stage === "wagers" ? "hidden until wagers lock" : "on the big screen",
            )}
          </span>
          {final.picture ? <CluePicture picture={final.picture} className="host-picture" /> : null}
          <p>{final.prompt}</p>
        </div>
        <div className="host-answer">
          <span className="eyebrow">
            {final.stage === "done"
              ? "Answer · now on the big screen"
              : "Answer · only you can see this"}
          </span>
          <p>{final.answer}</p>
        </div>

        {final.stage === "wagers" || final.stage === "answering" ? (
          <ul
            className="host-checklist"
            aria-label={final.stage === "wagers" ? "Wagers in" : "Answers in"}
          >
            {final.eligiblePlayerIds.map((id) => {
              const done = (
                final.stage === "wagers" ? final.wagerSubmittedIds : final.answerSubmittedIds
              ).includes(id);
              return (
                <li key={id} className={done ? "is-done" : undefined}>
                  <span aria-hidden="true">{done ? "✓" : "○"}</span>
                  <span className="name">{nameOf(view.players, id)}</span>
                  <span className="muted">
                    {done ? (final.stage === "wagers" ? "wagered" : "answered") : "waiting"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <ol ref={responsesRef} className="host-responses" aria-label="Responses in reveal order">
            {final.responses.map((r) => (
              <li
                key={r.playerId}
                className={`host-response host-response--${r.status} ${r.playerId === final.nextResponderId ? "is-next" : ""}`}
              >
                <div className="host-response__who">
                  <strong className="name">{nameOf(view.players, r.playerId)}</strong>
                  <span className="muted">
                    {r.status === "hidden"
                      ? "not revealed yet"
                      : r.status === "revealed"
                        ? "on screen"
                        : r.correct
                          ? "correct"
                          : "incorrect"}
                    {r.wager !== null ? ` · wager ${formatScore(r.wager)}` : ""}
                  </span>
                </div>
                <p className="host-response__said">{r.answer ? `“${r.answer}”` : "(no answer)"}</p>
                {r.delta !== null ? (
                  <span className="num host-response__delta">{formatDelta(r.delta)}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="host-clue__actions">
        <ActionStatus timer={timer} clockOffsetMs={clockOffsetMs}>
          {step === "showClue" ? (
            `${final.wagerSubmittedIds.length} of ${final.eligiblePlayerIds.length} wagers in. Missing wagers count as 0.`
          ) : step === "lock" ? (
            `${final.answerSubmittedIds.length} of ${final.eligiblePlayerIds.length} answers in. ${
              timer ? "Answers lock when time runs out." : "Lock them once everyone has answered."
            }`
          ) : step === "reveal" ? (
            <>
              Next up: <strong className="name">{nextName}</strong>. Reveal their response, then
              judge it.
            </>
          ) : step === "judge" ? (
            <>
              Judge <strong className="name">{nextName}</strong>:{" "}
              {next?.answer ? `“${next.answer}”` : "(no answer)"}
            </>
          ) : (
            "Every response is judged. The answer is on the big screen."
          )}
        </ActionStatus>
        <div className="row">
          {step === "showClue" ? (
            <ActionButton
              label="Show final clue"
              hint="S"
              tone="btn--primary"
              enabled={canShowClue}
              busy={actions.pending === "showFinalClue"}
              onClick={showClue}
            />
          ) : step === "lock" ? (
            <ActionButton
              label="Lock answers"
              hint="L"
              tone="btn--primary"
              enabled={canLock}
              busy={actions.pending === "lockFinalAnswers"}
              onClick={lock}
            />
          ) : step === "reveal" ? (
            <ActionButton
              label={`Reveal ${nextName}'s response`}
              hint="R"
              tone="btn--primary"
              enabled={canReveal}
              busy={actions.pending === "revealFinalResponse"}
              onClick={revealNext}
            />
          ) : step === "judge" ? (
            <>
              <ActionButton
                label={`Correct ${nextWager !== null ? formatDelta(nextWager) : ""}`}
                hint="C"
                tone="btn--good"
                enabled={canJudge}
                busy={actions.pending === "judgeFinal"}
                onClick={() => judgeNext(true)}
              />
              <ActionButton
                label={`Incorrect ${nextWager !== null ? formatDelta(-nextWager) : ""}`}
                hint="X"
                tone="btn--bad"
                enabled={canJudge}
                busy={actions.pending === "judgeFinal"}
                onClick={() => judgeNext(false)}
              />
            </>
          ) : (
            <ActionButton
              label="Show results"
              hint="F"
              tone="btn--primary"
              enabled={canFinish}
              busy={actions.pending === "finishGame"}
              onClick={finish}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function HostResults({ view, actions }: { view: HostView; actions: HostActions }) {
  const results = view.results;
  if (!results) return null;
  const winners = results.standings
    .filter((s) => results.winnerIds.includes(s.playerId))
    .map((s) => s.name);
  return (
    <section className="panel host-results" aria-labelledby="host-results-title">
      <span className="stamp stamp--red">Game over</span>
      <h2 id="host-results-title" className="host-results__title">
        {winners.length > 1
          ? `Shared win: ${listNames(winners)}`
          : `${winners[0] ?? "Nobody"} wins!`}
      </h2>
      <ol className="host-standings">
        {results.standings.map((s) => (
          <li
            key={s.playerId}
            className={results.winnerIds.includes(s.playerId) ? "is-winner" : undefined}
          >
            <span className="num">{ordinal(s.rank)}</span>
            <span className="name">{s.name}</span>
            <span className={`score ${s.score < 0 ? "score--neg" : ""}`}>
              {formatScore(s.score)}
            </span>
          </li>
        ))}
      </ol>
      <div className="row">
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={!actions.can("playAgain")}
          onClick={() => actions.run({ type: "playAgain" })}
        >
          Play again
        </button>
        <span className="muted">Everyone goes back to the lobby with scores reset.</span>
      </div>
    </section>
  );
}
