"use client";

import { Fragment } from "react";
import type {
  ClueView,
  DisplayView,
  FinalView,
  PromptView,
  PublicPlayer,
} from "@/features/engine/contract";
import type { RoomConnection } from "@/features/network/connection";
import { BoardGrid } from "@/features/board/board-grid";
import { HotHam } from "@/features/ui/brand";
import { CluePicture } from "@/features/ui/clue-picture";
import { closedCopy } from "@/features/ui/connection-status";
import { useOpeningLit } from "@/features/ui/clock";
import { Countdown } from "@/features/ui/countdown";
import { describeEvent, pauseMessage } from "@/features/ui/events";
import {
  answeringMargin,
  formatDelta,
  formatScore,
  nameOf,
  namedInEvents,
  ordinal,
} from "@/features/ui/format";
import { QrCode } from "@/features/ui/qr-code";
import { useFreshEvent } from "@/features/ui/use-fresh-event";
import { DisplayTitle } from "./display-masthead";

/** The shared TV renders only the public view and never sends commands. */
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
        <DisplayTitle />
        <span className="tv-eyebrow">Screen disconnected</span>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main id="main-content" className="tv tv--notice">
        <DisplayTitle />
        <h1>
          Connecting the big screen
          <span className="loading-dots" />
        </h1>
      </main>
    );
  }

  const stale = status !== "live";
  const announcement = fresh ? describeEvent(fresh.event, namedInEvents(view)) : null;
  const judged =
    fresh && (fresh.event.kind === "judged" || fresh.event.kind === "finalJudged") ? fresh : null;
  const showScores = view.phase !== "lobby" && view.phase !== "results";
  const station = view.paused
    ? "Stand by"
    : view.phase === "lobby"
      ? "Green room"
      : view.phase === "results"
        ? "Off air"
        : "On air";
  const title =
    view.phase === "lobby"
      ? `Room ${view.roomCode}`
      : view.phase === "final"
        ? "Final round"
        : view.phase === "results"
          ? "End of broadcast"
          : (view.round?.title ?? view.pack?.title ?? "Game night");

  return (
    <div className={`tv tv--${view.phase} ${stale ? "tv--stale" : ""}`}>
      <header className="tv-head">
        <div className="tv-station">
          <span className="tv-station__network">HAM Network</span>
          <span className="tv-station__status">
            {stale ? (
              <span role="status">{status === "connecting" ? "Connecting…" : "Reconnecting…"}</span>
            ) : !view.hostConnected && !view.paused && view.phase !== "lobby" ? (
              <span role="status">Host offline</span>
            ) : (
              station
            )}
          </span>
        </div>
        <div className="tv-masthead">
          <div className="tv-masthead__title">
            <p className="tv-eyebrow">{title}</p>
            <DisplayTitle />
          </div>
          <div className="tv-masthead__aside">
            <span className="tv-planet" aria-hidden="true">
              <span className="tv-planet__globe" />
            </span>
            {view.phase !== "lobby" ? (
              <p className="tv-masthead__note name">
                Join at <strong>{shortUrl(joinUrl)}</strong>
              </p>
            ) : view.buzzing.fairBuzzing ? (
              <p className="tv-masthead__note">
                <strong>Fair buzzing on</strong> · fastest reaction wins
              </p>
            ) : null}
          </div>
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
            <span className="tv-eyebrow">Paused</span>
            <h2>{pauseMessage(view.paused.reason).headline}</h2>
            <p>{pauseMessage(view.paused.reason).body}</p>
          </div>
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

/**
 * A player name with line-break chances after ".", "_" and "-", so a long
 * username like "bartholomew.featherstonehaugh" wraps between its parts
 * instead of mid-word. The text itself is unchanged.
 */
export function Name({ name }: { name: string }) {
  const parts = name.match(/[^._-]*[._-]|[^._-]+$/g) ?? [name];
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
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
        <section className="tv-panel tv-intro" aria-labelledby="tv-intro-title">
          <span className="tv-eyebrow">
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
          <h1 className="sr-only">Game board</h1>
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
      <div className="tv-panel tv-lobby__invite">
        <div className="tv-lobby__how">
          <p className="tv-eyebrow">Join on your phone</p>
          <h1 id="tv-lobby-title" className="tv-code" aria-label={`Room code ${code.join(" ")}`}>
            {view.roomCode}
          </h1>
          <p className="tv-lobby__url name">{shortUrl(joinUrl)}</p>
          <p>Sign in with HAM and wait for the host to start.</p>
        </div>
        <div className="tv-lobby__qr">
          <QrCode value={joinUrl} label={`QR code: join room ${view.roomCode}`} />
          <span className="tv-lobby__qrlabel">Scan to join</span>
        </div>
      </div>
      <div className="tv-lobby__players">
        <h2 className="tv-eyebrow">
          {view.players.length === 0
            ? "Nobody here yet"
            : `${view.players.length} of 6 seats filled`}
        </h2>
        <ul className="tv-tags">
          {view.players.map((player) => (
            <li key={player.id} className={`tv-tag ${player.connected ? "" : "tv-tag--wait"}`}>
              <span className="name">
                <Name name={player.name} />
              </span>
              {player.connected ? null : <span className="tv-tag__state">Away</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function promptSize(prompt: string, besidePicture: boolean): string {
  const fullWidthLength = prompt.length * (besidePicture ? 2 : 1);
  if (fullWidthLength <= 70) return "tv-prompt--xl";
  if (fullWidthLength <= 140) return "tv-prompt--l";
  if (fullWidthLength <= 220) return "tv-prompt--m";
  if (fullWidthLength <= 540) return "tv-prompt--s";
  return "tv-prompt--xs";
}

function TvPrompt({ shown }: { shown: PromptView }) {
  const prompt = shown.prompt ?? "";
  if (!shown.picture) return <p className={`tv-prompt ${promptSize(prompt, false)}`}>{prompt}</p>;
  return (
    <div className="tv-media">
      <CluePicture picture={shown.picture} className="tv-picture" />
      <p className={`tv-prompt ${promptSize(prompt, true)}`}>{prompt}</p>
    </div>
  );
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
  const lit = useOpeningLit(clue.opensAt, clockOffsetMs);
  const margin = answeringMargin(clue);
  const lastAttempt = clue.attempts[clue.attempts.length - 1] ?? null;
  const controller = nameOf(view.players, view.controllerId);

  if (clue.stage === "wager") {
    return (
      <section className="tv-panel tv-intro tv-hot" aria-labelledby="tv-hot-title">
        <p className="tv-eyebrow">
          {clue.categoryTitle} · <span className="num">{formatScore(clue.value)}</span>
        </p>
        <h1 id="tv-hot-title" className="tv-intro__title">
          <HotHam />
        </h1>
        <p className="tv-intro__sub">
          <strong className="name">{controller}</strong> is placing a wager. Only they can answer.
        </p>
      </section>
    );
  }

  return (
    <section className={`tv-panel tv-clue tv-clue--${clue.stage}`} aria-labelledby="tv-clue-cat">
      <header className="tv-clue__head">
        <h1 id="tv-clue-cat" className="name">
          {clue.categoryTitle}
        </h1>
        <span className="tv-clue__value num">
          {clue.kind === "wager" ? (
            <>
              {/* The stake is the drama: it gets the same size as a normal clue value. */}
              <span className="stamp stamp--hot stamp--flat">
                {clue.wager !== null ? "Wager" : "Wager clue"}
              </span>
              {clue.wager !== null ? <span>{formatScore(clue.wager)}</span> : null}
            </>
          ) : (
            formatScore(clue.value)
          )}
        </span>
      </header>
      <TvPrompt shown={clue} />

      {clue.stage === "revealed" && clue.answer !== null ? <TvAnswer answer={clue.answer} /> : null}

      <footer className="tv-clue__foot">
        {clue.stage === "reading" || (clue.stage === "open" && !lit) ? (
          <p className="tv-cue tv-cue--wait">Listen up. Buzzers open soon.</p>
        ) : clue.stage === "open" ? (
          <>
            <p className="tv-cue tv-cue--open">Buzz now!</p>
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
              {margin ? (
                <>
                  {" "}
                  <span className="tv-margin">first {margin}</span>
                </>
              ) : null}
            </p>
            {lastAttempt?.timedOut ? (
              <span className="tv-eyebrow tv-time-up">Time&apos;s up</span>
            ) : view.timer ? (
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

function TvAnswer({ answer }: { answer: string }) {
  return (
    <div className="tv-answer">
      <span className="tv-eyebrow">Answer</span>
      <p className={promptSize(answer, false)}>{answer}</p>
    </div>
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
      <section
        className="tv-panel tv-intro tv-final tv-final--wagers"
        aria-labelledby="tv-final-cat"
      >
        <span className="tv-eyebrow">Final round</span>
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

  // Judging and done fit every response on screen: up to three per row, so
  // four make two rows of two and five or six make two rows of three.
  // Two rows ("dense") get tighter type.
  const count = final.responses.length;
  const columns = count <= 3 ? Math.max(count, 1) : Math.ceil(count / 2);
  const dense = final.stage !== "answering" && count >= 4;

  return (
    <section
      className={`tv-panel tv-clue tv-final tv-final--${final.stage} ${dense ? "tv-final--dense" : ""}`}
      aria-labelledby="tv-final-cat"
    >
      <header className="tv-clue__head">
        <h1 id="tv-final-cat" className="name">
          Final round · {final.categoryTitle}
        </h1>
      </header>
      {final.stage === "answering" ? (
        <TvPrompt shown={final} />
      ) : (
        <p className="tv-prompt tv-prompt--recap">{final.prompt}</p>
      )}

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
          <ol className="tv-responses" style={{ "--cols": columns } as React.CSSProperties}>
            {final.responses.map((r) => (
              <li
                key={r.playerId}
                className={`tv-response tv-response--${r.status} ${r.status === "judged" ? (r.correct ? "is-good" : "is-bad") : ""}`}
              >
                <span className="tv-response__who name">
                  <Name name={nameOf(view.players, r.playerId)} />
                </span>
                <span className="tv-response__said">
                  {r.status === "hidden" ? "?" : r.answer ? `“${r.answer}”` : "(no answer)"}
                </span>
                {r.status === "judged" ? (
                  <span className="tv-response__result">
                    <span
                      className={`stamp stamp--flat ${r.correct ? "stamp--good" : "stamp--bad"}`}
                    >
                      {r.correct ? "Correct" : "Incorrect"}
                    </span>{" "}
                    <span className="tv-response__delta num">{formatDelta(r.delta ?? 0)}</span>{" "}
                    <span className="tv-response__wager">
                      wager <span className="num">{formatScore(r.wager ?? 0)}</span>
                    </span>
                  </span>
                ) : (
                  <span className="tv-response__result">
                    {r.status === "revealed" ? "Judging…" : "Not yet revealed"}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {final.stage === "done" && final.answer !== null ? (
            <TvAnswer answer={final.answer} />
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

/** The longest run of characters in a name that has no space or break chance. */
function longestPart(name: string): number {
  return Math.max(0, ...name.split(/[\s._-]+/).map((part) => part.length));
}

/**
 * Winner names step down in size so they fit the slip: long names, or names
 * with a long unbroken part (usernames like "bartholomew.featherstonehaugh"),
 * get smaller type instead of running off the edge. Long names may take two
 * or three lines; only an unbroken part too wide for one line at 2.1em gets
 * the smallest size. Co-winners share the size their longest name needs, so
 * nobody's slip looks like second place.
 */
export function podiumNameSize(names: string[]): string {
  if (names.some((name) => longestPart(name) > 18)) return "tv-podium__name--xlong";
  if (names.some((name) => name.length > 14 || longestPart(name) > 12))
    return "tv-podium__name--long";
  return "";
}

function DisplayResults({ view }: { view: DisplayView }) {
  const results = view.results;
  if (!results) return null;
  const winners = results.standings.filter((s) => results.winnerIds.includes(s.playerId));
  const rest = results.standings.filter((s) => !results.winnerIds.includes(s.playerId));
  const nameSize = podiumNameSize(winners.map((w) => w.name));
  return (
    <section className="tv-results" aria-labelledby="tv-results-title">
      <h1 id="tv-results-title" className="tv-eyebrow">
        {winners.length > 1 ? "Shared win" : "Winner"}
      </h1>
      <ul
        className={`tv-podium ${winners.length >= 3 ? "tv-podium--crowd" : ""}`}
        aria-label={winners.length > 1 ? "Co-winners" : "Winner"}
      >
        {winners.map((w) => (
          <li key={w.playerId} className="tv-panel tv-podium__slip">
            <span className="tv-podium__rank">{ordinal(w.rank)}</span>
            <span className={`tv-podium__name ${nameSize}`}>
              <Name name={w.name} />
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
              <span className="name">
                <Name name={s.name} />
              </span>
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
    <footer
      className={`tv-scores ${view.players.length >= 5 ? "tv-scores--dense" : ""}`}
      aria-label="Scores"
    >
      <ul style={{ "--n": view.players.length } as React.CSSProperties}>
        {view.players.map((player) => {
          const isAnswering = player.id === answering;
          const score = formatScore(player.score);
          const scoreSize: React.CSSProperties & { "--value-length": number } = {
            "--value-length": score.length,
          };
          const picks =
            player.id === view.controllerId &&
            (view.phase === "board" || view.phase === "roundIntro");
          return (
            <li
              key={player.id === pulseId ? `${player.id}-${pulseKey}` : player.id}
              className={`tv-score ${isAnswering ? "tv-score--answering" : ""} ${picks ? "tv-score--picks" : ""} ${!player.connected ? "tv-score--away" : ""} ${locked.includes(player.id) ? "tv-score--locked" : ""} ${player.id === pulseId ? "tv-score--pulse" : ""}`}
            >
              <span className="tv-score__name name">
                <Name name={player.name} />
              </span>
              <span
                className={`tv-score__pts num ${player.score < 0 ? "is-neg" : ""}`}
                style={scoreSize}
              >
                {score}
              </span>
              <span className="tv-score__tag">
                {[
                  isAnswering ? "Answering" : picks ? "Picks" : null,
                  locked.includes(player.id) ? "Locked out" : null,
                  !player.connected ? "Away" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          );
        })}
      </ul>
    </footer>
  );
}
