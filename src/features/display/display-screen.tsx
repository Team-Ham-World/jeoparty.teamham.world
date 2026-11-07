"use client";

import type { ClueView, DisplayView, FinalView, PublicPlayer } from "@/features/engine/contract";
import type { RoomConnection } from "@/features/network/connection";
import { BoardGrid } from "@/features/board/board-grid";
import { HotHam, Lockup } from "@/features/ui/brand";
import { closedCopy } from "@/features/ui/connection-status";
import { Countdown } from "@/features/ui/countdown";
import { describeEvent, pauseMessage } from "@/features/ui/events";
import { formatDelta, formatScore, listNames, nameOf, ordinal, plural } from "@/features/ui/format";
import { QrCode } from "@/features/ui/qr-code";
import { useFreshEvent } from "@/features/ui/use-fresh-event";

/*
  The shared TV / projector. Read-only: it renders the public DisplayView and
  never sends commands. Answers appear only when the view contains them.
  Everything is sized in em from `.tv`'s font-size, which scales with the
  viewport, so 1366×768 and 1920×1080 get the same composition.
*/

const STARBURST = (() => {
  const points: string[] = [];
  const spikes = 16;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? 50 : 41;
    const angle = (Math.PI * i) / spikes;
    points.push(
      `${(50 + radius * Math.cos(angle)).toFixed(2)}% ${(50 + radius * Math.sin(angle)).toFixed(2)}%`,
    );
  }
  return `polygon(${points.join(", ")})`;
})();

export function DisplayScreen({
  connection,
  joinUrl,
}: {
  connection: RoomConnection<DisplayView>;
  joinUrl: string;
}) {
  const { view, status } = connection;
  const fresh = useFreshEvent(view);

  if (status === "closed") {
    const copy = closedCopy(connection.closeReason, "display");
    return (
      <main id="main-content" className="tv tv--notice">
        <Lockup className="tv-notice__lockup" />
        <span className="stamp stamp--ink tv-stamp">Screen disconnected</span>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main id="main-content" className="tv tv--notice">
        <Lockup className="tv-notice__lockup" />
        <h1>
          Connecting the big screen
          <span className="loading-dots" />
        </h1>
      </main>
    );
  }

  const stale = status !== "live";
  const announcement = fresh ? describeEvent(fresh.event, view.players) : null;
  const judged =
    fresh && (fresh.event.kind === "judged" || fresh.event.kind === "finalJudged") ? fresh : null;
  const showScores = view.phase !== "lobby" && view.phase !== "results";

  return (
    <div className={`tv tv--${view.phase} ${stale ? "tv--stale" : ""}`}>
      <header className="tv-head">
        <Lockup className="tv-head__lockup" />
        <div className="tv-head__title">
          {view.phase === "final"
            ? "Final round"
            : view.phase === "results"
              ? "Results"
              : view.round
                ? view.round.title
                : (view.pack?.title ?? "")}
        </div>
        <div className="tv-head__join">
          {stale ? (
            <span className="tv-conn" role="status">
              {status === "connecting" ? "Connecting…" : "Reconnecting… this screen may be behind"}
            </span>
          ) : (
            <>
              <span className="tv-head__label">Join at</span> <strong>{shortUrl(joinUrl)}</strong>
            </>
          )}
        </div>
      </header>

      <main id="main-content" className="tv-main">
        <DisplayPhase view={view} joinUrl={joinUrl} clockOffsetMs={connection.clockOffsetMs} />
        {judged && (judged.event.kind === "judged" || judged.event.kind === "finalJudged") ? (
          <div
            key={judged.revision}
            className={`tv-judged ${judged.event.correct ? "tv-judged--good" : "tv-judged--bad"}`}
            aria-hidden="true"
          >
            <span className="tv-judged__word">
              {judged.event.correct ? "Correct!" : "Incorrect"}
            </span>
            <span className="tv-judged__who">
              {nameOf(view.players, judged.event.playerId)} {formatDelta(judged.event.delta)}
            </span>
          </div>
        ) : null}
      </main>

      {showScores ? (
        <ScoreStrip
          view={view}
          pulseId={fresh?.event.kind === "buzzAccepted" ? fresh.event.playerId : null}
          pulseKey={fresh?.revision ?? 0}
        />
      ) : null}

      {view.paused ? (
        <div className="tv-overlay" role="status">
          <div className="tv-overlay__card">
            <span className="stamp stamp--warn tv-stamp">Paused</span>
            <h2>{pauseMessage(view.paused.reason).headline}</h2>
            <p>{pauseMessage(view.paused.reason).body}</p>
          </div>
        </div>
      ) : !view.hostConnected && view.phase !== "lobby" ? (
        <div className="tv-hostoff" role="status">
          Host offline
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function DisplayPhase({
  view,
  joinUrl,
  clockOffsetMs,
}: {
  view: DisplayView;
  joinUrl: string;
  clockOffsetMs: number;
}) {
  switch (view.phase) {
    case "lobby":
      return <DisplayLobby view={view} joinUrl={joinUrl} />;
    case "roundIntro":
      return (
        <section className="tv-intro" aria-labelledby="tv-intro-title">
          <span className="stamp stamp--red tv-stamp">
            {view.round ? `Round ${view.round.index + 1} of ${view.round.total}` : "Next round"}
          </span>
          <h1 id="tv-intro-title" className="tv-intro__title">
            {view.round?.title ?? "Next round"}
          </h1>
          <p className="tv-intro__sub">
            <strong className="name">{nameOf(view.players, view.controllerId)}</strong> picks first
          </p>
        </section>
      );
    case "board":
      return (
        <section className="tv-board" aria-label="Board">
          <p className="tv-picks">
            <strong className="name">{nameOf(view.players, view.controllerId)}</strong> picks
          </p>
          {view.board ? <BoardGrid board={view.board} variant="stage" /> : null}
        </section>
      );
    case "clue":
      return view.clue ? (
        <DisplayClue view={view} clue={view.clue} clockOffsetMs={clockOffsetMs} />
      ) : null;
    case "final":
      return view.final ? (
        <DisplayFinal view={view} final={view.final} clockOffsetMs={clockOffsetMs} />
      ) : null;
    case "results":
      return <DisplayResults view={view} />;
  }
}

function DisplayLobby({ view, joinUrl }: { view: DisplayView; joinUrl: string }) {
  const code = view.roomCode.split("");
  return (
    <section className="tv-lobby" aria-labelledby="tv-lobby-title">
      <div className="tv-lobby__how">
        <h1 id="tv-lobby-title" className="tv-lobby__title">
          Grab your phone.
          <br />
          You&apos;re the buzzer.
        </h1>
        <ol className="tv-steps">
          <li>
            Go to <strong>{shortUrl(joinUrl)}</strong> or scan the code
          </li>
          <li>Sign in with HAM</li>
          <li>Wait for the host to start</li>
        </ol>
        <div className="tv-code" aria-label={`Room code ${code.join(" ")}`}>
          {code.map((letter, i) => (
            <span key={i} className="tv-code__letter" aria-hidden="true">
              {letter}
            </span>
          ))}
        </div>
      </div>
      <div className="tv-lobby__qr taped">
        <QrCode value={joinUrl} label={`QR code: join room ${view.roomCode}`} />
        <span className="tv-lobby__qrlabel">Scan to join</span>
      </div>
      <div className="tv-lobby__players">
        <h2 className="tv-eyebrow">
          {view.players.length === 0
            ? "Nobody here yet"
            : `${plural(view.players.length, "player")} in`}{" "}
          · up to 6
        </h2>
        <ul className="tv-tags">
          {view.players.map((player, i) => (
            <li
              key={player.id}
              className="tv-tag"
              style={{ "--tilt": `${(i % 3) - 1}deg` } as React.CSSProperties}
            >
              <span className="name">{player.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function promptSize(prompt: string): string {
  const n = prompt.length;
  if (n <= 70) return "tv-prompt--xl";
  if (n <= 140) return "tv-prompt--l";
  if (n <= 220) return "tv-prompt--m";
  return "tv-prompt--s";
}

function DisplayClue({
  view,
  clue,
  clockOffsetMs,
}: {
  view: DisplayView;
  clue: ClueView;
  clockOffsetMs: number;
}) {
  const lastAttempt = clue.attempts[clue.attempts.length - 1] ?? null;
  const controller = nameOf(view.players, view.controllerId);

  if (clue.stage === "wager") {
    return (
      <section className="tv-hot" aria-labelledby="tv-hot-title">
        <div className="tv-hot__stage">
          <div className="tv-hot__burst" style={{ clipPath: STARBURST }} aria-hidden="true" />
          <h1 id="tv-hot-title" className="tv-hot__title">
            <HotHam />
          </h1>
        </div>
        <p className="tv-hot__cat">
          {clue.categoryTitle} · <span className="num">{formatScore(clue.value)}</span>
        </p>
        <p className="tv-hot__sub">
          <strong className="name">{controller}</strong> is placing a wager. Only they can answer.
        </p>
      </section>
    );
  }

  return (
    <section className={`tv-clue tv-clue--${clue.stage}`} aria-labelledby="tv-clue-cat">
      <header className="tv-clue__head">
        <h1 id="tv-clue-cat" className="name">
          {clue.categoryTitle}
        </h1>
        <span className="tv-clue__value num">
          {clue.kind === "wager" ? (
            <span className="stamp stamp--hot stamp--flat">
              {clue.wager !== null ? `Wager ${formatScore(clue.wager)}` : "Wager clue"}
            </span>
          ) : (
            formatScore(clue.value)
          )}
        </span>
      </header>
      <p className={`tv-prompt ${promptSize(clue.prompt ?? "")}`}>{clue.prompt}</p>

      {clue.stage === "revealed" && clue.answer !== null ? (
        <div className="tv-answer">
          <span className="tv-eyebrow tv-eyebrow--ink">Answer</span>
          <p>{clue.answer}</p>
        </div>
      ) : null}

      <footer className="tv-clue__foot">
        {clue.stage === "reading" ? (
          <p className="tv-cue tv-cue--wait">Listen up. Buzzers open soon.</p>
        ) : clue.stage === "open" ? (
          <>
            <p className="tv-cue tv-cue--open">
              <span className="tv-cue__burst">Buzz now!</span>
            </p>
            {view.timer ? (
              <Countdown
                timer={view.timer}
                clockOffsetMs={clockOffsetMs}
                className="tv-countdown"
              />
            ) : null}
          </>
        ) : clue.stage === "answering" ? (
          <>
            <p className="tv-cue tv-cue--answering">
              <strong className="name">{nameOf(view.players, clue.answeringPlayerId)}</strong>
              {clue.kind === "wager" ? " is answering" : " buzzed in!"}
            </p>
            {view.timer ? (
              <Countdown
                timer={view.timer}
                clockOffsetMs={clockOffsetMs}
                className="tv-countdown"
              />
            ) : null}
          </>
        ) : clue.stage === "closed" && clue.kind === "wager" && !lastAttempt ? (
          <p className="tv-cue tv-cue--wait">Skipped · no score change</p>
        ) : clue.stage === "closed" ? (
          <p className="tv-cue tv-cue--wait">
            {clue.kind === "wager" ? null : "Buzzers closed"}
            {lastAttempt && lastAttempt.result !== "pending" ? (
              <>
                {clue.kind === "wager" ? null : " · "}
                <span className="name">{nameOf(view.players, lastAttempt.playerId)}</span>{" "}
                {lastAttempt.result === "correct" ? "got it" : "missed"}
              </>
            ) : null}
          </p>
        ) : clue.stage === "revealed" ? (
          lastAttempt?.result === "correct" ? (
            <p className="tv-cue">
              <span className="stamp stamp--good stamp--flat">Correct</span>{" "}
              <strong className="name">{nameOf(view.players, lastAttempt.playerId)}</strong>{" "}
              {lastAttempt.delta !== null ? formatDelta(lastAttempt.delta) : ""}
            </p>
          ) : (
            <p className="tv-cue tv-cue--wait">
              {clue.kind === "wager" && !lastAttempt
                ? "Skipped · no score change"
                : "Nobody got this one"}
            </p>
          )
        ) : null}
      </footer>
    </section>
  );
}

function DisplayFinal({
  view,
  final,
  clockOffsetMs,
}: {
  view: DisplayView;
  final: FinalView;
  clockOffsetMs: number;
}) {
  if (final.stage === "wagers") {
    return (
      <section className="tv-final tv-final--wagers" aria-labelledby="tv-final-cat">
        <span className="stamp stamp--red tv-stamp">Final round</span>
        <h1 id="tv-final-cat" className="tv-intro__title name">
          {final.categoryTitle}
        </h1>
        <p className="tv-intro__sub">Players are wagering. The clue appears once wagers lock.</p>
        <Progress
          label="Wagers in"
          ids={final.eligiblePlayerIds}
          done={final.wagerSubmittedIds}
          players={view.players}
        />
      </section>
    );
  }

  return (
    <section className={`tv-clue tv-final tv-final--${final.stage}`} aria-labelledby="tv-final-cat">
      <header className="tv-clue__head">
        <h1 id="tv-final-cat" className="name">
          Final round · {final.categoryTitle}
        </h1>
      </header>
      <p
        className={`tv-prompt ${final.stage === "answering" ? promptSize(final.prompt ?? "") : "tv-prompt--s"}`}
      >
        {final.prompt}
      </p>

      {final.stage === "answering" ? (
        <footer className="tv-clue__foot">
          <Progress
            label="Answers in"
            ids={final.eligiblePlayerIds}
            done={final.answerSubmittedIds}
            players={view.players}
          />
          {view.timer ? (
            <Countdown timer={view.timer} clockOffsetMs={clockOffsetMs} className="tv-countdown" />
          ) : null}
        </footer>
      ) : (
        <>
          <ol className="tv-responses">
            {final.responses.map((r) => (
              <li
                key={r.playerId}
                className={`tv-response tv-response--${r.status} ${r.status === "judged" ? (r.correct ? "is-good" : "is-bad") : ""}`}
              >
                <span className="tv-response__who name">{nameOf(view.players, r.playerId)}</span>
                <span className="tv-response__said">
                  {r.status === "hidden" ? "?" : r.answer ? `“${r.answer}”` : "(no answer)"}
                </span>
                <span className="tv-response__result">
                  {r.status === "judged"
                    ? `${r.correct ? "Correct" : "Incorrect"} · wager ${formatScore(r.wager ?? 0)} · ${formatDelta(r.delta ?? 0)}`
                    : r.status === "revealed"
                      ? "Judging…"
                      : "Not yet revealed"}
                </span>
              </li>
            ))}
          </ol>
          {final.stage === "done" && final.answer !== null ? (
            <div className="tv-answer">
              <span className="tv-eyebrow tv-eyebrow--ink">Answer</span>
              <p>{final.answer}</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Progress({
  label,
  ids,
  done,
  players,
}: {
  label: string;
  ids: string[];
  done: string[];
  players: PublicPlayer[];
}) {
  return (
    <div className="tv-progress">
      <span className="tv-eyebrow">
        {label}: {done.length} of {ids.length}
      </span>
      <ul className="tv-tags">
        {ids.map((id) => (
          <li key={id} className={`tv-tag ${done.includes(id) ? "tv-tag--done" : "tv-tag--wait"}`}>
            <span aria-hidden="true">{done.includes(id) ? "✓ " : ""}</span>
            <span className="name">{nameOf(players, id)}</span>
            <span className="sr-only">{done.includes(id) ? " submitted" : " waiting"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DisplayResults({ view }: { view: DisplayView }) {
  const results = view.results;
  if (!results) return null;
  const winners = results.standings.filter((s) => results.winnerIds.includes(s.playerId));
  const rest = results.standings.filter((s) => !results.winnerIds.includes(s.playerId));
  return (
    <section className="tv-results" aria-labelledby="tv-results-title">
      <span className="stamp stamp--red tv-stamp">
        {winners.length > 1 ? "Shared win" : "Winner"}
      </span>
      <h1 id="tv-results-title" className="sr-only">
        {winners.length > 1
          ? `Shared win: ${listNames(winners.map((w) => w.name))}`
          : `Winner: ${winners[0]?.name ?? "nobody"}`}
      </h1>
      <ul className="tv-podium" aria-hidden="true">
        {winners.map((w, i) => (
          <li
            key={w.playerId}
            className="tv-podium__slip"
            style={{ "--tilt": `${i % 2 === 0 ? -1.5 : 1.5}deg` } as React.CSSProperties}
          >
            <span className="tv-podium__rank">{ordinal(w.rank)}</span>
            <span
              className={`tv-podium__name ${w.name.length > 14 ? "tv-podium__name--long" : ""}`}
            >
              {w.name}
            </span>
            <span className="tv-podium__score num">{formatScore(w.score)}</span>
          </li>
        ))}
      </ul>
      {rest.length > 0 ? (
        <ol className="tv-standings">
          {rest.map((s) => (
            <li key={s.playerId}>
              <span className="num">{ordinal(s.rank)}</span>
              <span className="name">{s.name}</span>
              <span className="num">{formatScore(s.score)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ScoreStrip({
  view,
  pulseId,
  pulseKey,
}: {
  view: DisplayView;
  pulseId: string | null;
  pulseKey: number;
}) {
  const answering = view.clue?.stage === "answering" ? view.clue.answeringPlayerId : null;
  // "Locked out" only matters while someone could still buzz: not once the clue is solved or revealed.
  const solved = view.clue?.attempts.some((attempt) => attempt.result === "correct") ?? false;
  const locked =
    view.clue && view.clue.stage !== "revealed" && !solved ? view.clue.lockedOutPlayerIds : [];
  return (
    <footer className="tv-scores" aria-label="Scores">
      <ul style={{ "--n": view.players.length } as React.CSSProperties}>
        {view.players.map((player) => {
          const isAnswering = player.id === answering;
          const picks =
            player.id === view.controllerId &&
            (view.phase === "board" || view.phase === "roundIntro");
          return (
            <li
              key={player.id === pulseId ? `${player.id}-${pulseKey}` : player.id}
              className={`tv-score ${isAnswering ? "tv-score--answering" : ""} ${picks ? "tv-score--picks" : ""} ${!player.connected ? "tv-score--away" : ""} ${locked.includes(player.id) ? "tv-score--locked" : ""} ${player.id === pulseId ? "tv-score--pulse" : ""}`}
            >
              <span className="tv-score__name name">{player.name}</span>
              <span className={`tv-score__pts num ${player.score < 0 ? "is-neg" : ""}`}>
                {formatScore(player.score)}
              </span>
              <span className="tv-score__tag">
                {isAnswering
                  ? "Answering"
                  : picks
                    ? "Picks"
                    : locked.includes(player.id)
                      ? "Locked out"
                      : !player.connected
                        ? "Away"
                        : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </footer>
  );
}
