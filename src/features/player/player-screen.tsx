"use client";

import { useEffect, useState } from "react";
import {
  MAX_PLAYERS,
  type ClueView,
  type FinalResponseView,
  type FinalView,
  type PlayerView,
  type PromptView,
  type PublicPlayer,
} from "@/features/engine/contract";
import type { RoomConnection } from "@/features/network/connection";
import { errorMessage } from "@/features/network/client/api";
import { BoardGrid } from "@/features/board/board-grid";
import { HotHam } from "@/features/ui/brand";
import { useRemaining } from "@/features/ui/clock";
import { CluePicture } from "@/features/ui/clue-picture";
import { ClosedNotice, StaleBanner } from "@/features/ui/connection-status";
import { Countdown } from "@/features/ui/countdown";
import { describeEvent, pauseMessage } from "@/features/ui/events";
import {
  answeringMargin,
  formatDelta,
  formatScore,
  listNames,
  nameOf,
  namedInEvents,
  ordinal,
  plural,
} from "@/features/ui/format";
import { vibrate } from "@/features/ui/haptics";
import { ToastProvider, useToast } from "@/features/ui/toasts";
import { useCommand } from "@/features/ui/use-command";
import { useFreshEvent } from "@/features/ui/use-fresh-event";
import { WagerForm } from "@/features/ui/wager-form";
import { BuzzButton } from "./buzz-button";
import { FinalAnswerForm } from "./final-answer-form";
import { PlayerHandset, PlayerHeader } from "./player-handset";

type Run = ReturnType<typeof useCommand<PlayerView>>["run"];
type Pending = ReturnType<typeof useCommand<PlayerView>>["pending"];

/** In the last seconds before final answers lock, phones send typed text by themselves. */
const FINAL_AUTOSAVE_WINDOW_MS = 5_000;

/**
 * The player's phone. Renders the PlayerView and asks for commands; every
 * "can I?" comes from `view.can`, never from local rules.
 */
export function PlayerScreen({
  code,
  connection,
  onLeave,
}: {
  code: string;
  connection: RoomConnection<PlayerView>;
  /** Leaves the room and this page; rejects if it couldn't. */
  onLeave?: () => Promise<void>;
}) {
  return (
    <ToastProvider>
      <PlayerBody code={code} connection={connection} onLeave={onLeave} />
    </ToastProvider>
  );
}

function PlayerBody({
  code,
  connection,
  onLeave,
}: {
  code: string;
  connection: RoomConnection<PlayerView>;
  onLeave?: () => Promise<void>;
}) {
  const { view, status, stale } = connection;
  const { run, pending } = useCommand(connection);
  const fresh = useFreshEvent(view);
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);

  if (status === "closed") {
    return (
      <PlayerHandset>
        <ClosedNotice reason={connection.closeReason} role="player" returnTo={`/r/${code}`} />
      </PlayerHandset>
    );
  }

  if (!view) {
    return (
      <PlayerHandset>
        <PlayerHeader code={code} />
        <main id="main-content" className="pl-main pl-main--notice" aria-busy="true">
          <h1 className="pl-big">
            {status === "reconnecting" ? "Reconnecting" : "Connecting"}
            <span className="loading-dots" />
          </h1>
          <p className="muted">
            {status === "reconnecting"
              ? "We lost the connection. Keep this page open to rejoin."
              : "Connecting your phone to the game."}
          </p>
        </main>
      </PlayerHandset>
    );
  }

  const announcement = fresh ? describeEvent(fresh.event, namedInEvents(view), view.me.id) : null;
  const isController = view.controllerId === view.me.id;
  // Leaving is safe only when you're not mid-game: the lobby, results, or the bench.
  // During play the logo isn't a link, so a stray tap can't leave the buzzer.
  const canLeave =
    view.phase === "lobby" || view.phase === "results" || view.me.status === "waiting";
  const pause = view.paused ? pauseMessage(view.paused.reason) : null;

  async function leave() {
    if (!onLeave) return;
    setLeaving(true);
    try {
      await onLeave();
    } catch (error) {
      setLeaving(false);
      toast(`Couldn't leave the room. ${errorMessage(error)}`);
    }
  }

  return (
    <PlayerHandset className={`pl--${view.phase}`}>
      <PlayerHeader code={view.roomCode} status={status} homeLink={canLeave} />

      <div className="pl-banners">
        <StaleBanner status={status} />
        {pause ? (
          <div className="banner banner--warn" role="status">
            <span>{pause.title}</span>
            <p>{pause.body}</p>
          </div>
        ) : !view.hostConnected ? (
          <div className="banner banner--info" role="status">
            <span>Host offline</span>
            <p>Waiting for the host to reconnect.</p>
          </div>
        ) : null}
      </div>

      <main id="main-content" className="pl-main">
        <PlayerPhase
          view={view}
          stale={stale}
          run={run}
          pending={pending}
          clockOffsetMs={connection.clockOffsetMs}
        />
      </main>

      <section className="pl-me" aria-label="You">
        <div className="pl-me__who">
          <span className="eyebrow">You</span>
          <strong className="name">{view.me.name}</strong>
          {isController && (view.phase === "board" || view.phase === "roundIntro") ? (
            <span className="stamp stamp--blue">Your pick</span>
          ) : null}
        </div>
        <div className="pl-me__score">
          <span className="eyebrow">Score</span>
          <strong className={`score ${view.me.score < 0 ? "score--neg" : ""}`}>
            {formatScore(view.me.score)}
          </strong>
        </div>
      </section>

      {onLeave && canLeave ? (
        <footer className="pl-foot">
          <button
            type="button"
            className="btn btn--quiet btn--small"
            disabled={leaving}
            aria-busy={leaving || undefined}
            onClick={() => void leave()}
          >
            {leaving ? "Leaving…" : "Leave room"}
          </button>
        </footer>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <JudgedFlash view={view} fresh={fresh} />
    </PlayerHandset>
  );
}

/** A short "Correct!" / "Incorrect" flash for the player who was judged. Never blocks input. */
function JudgedFlash({
  view,
  fresh,
}: {
  view: PlayerView;
  fresh: ReturnType<typeof useFreshEvent>;
}) {
  const event = fresh?.event;
  const mine =
    event &&
    (event.kind === "judged" || event.kind === "finalJudged") &&
    event.playerId === view.me.id;
  const revision = mine ? fresh.revision : null;
  const correct = mine ? event.correct : null;
  useEffect(() => {
    if (revision !== null) vibrate(correct ? [40, 40, 40] : 120);
  }, [revision, correct]);
  if (!mine) return null;
  return (
    <div
      key={fresh.revision}
      className={`pl-flash ${event.correct ? "pl-flash--good" : "pl-flash--bad"}`}
      aria-hidden="true"
    >
      <span>{event.correct ? "Correct!" : "Incorrect"}</span>
      <strong>{formatDelta(event.delta)}</strong>
    </div>
  );
}

function PlayerPhase({
  view,
  stale,
  run,
  pending,
  clockOffsetMs,
}: {
  view: PlayerView;
  stale: boolean;
  run: Run;
  pending: Pending;
  clockOffsetMs: number;
}) {
  if (view.me.status === "waiting") return <WaitingForNextGame view={view} />;

  switch (view.phase) {
    case "lobby":
      return <PlayerLobby view={view} />;
    case "roundIntro":
      return (
        <div className="pl-center stack">
          <span className="pl-kicker">
            {view.round ? `Round ${view.round.index + 1} of ${view.round.total}` : "New round"}
          </span>
          <h1 className="pl-big">{view.round?.title ?? "Next round"}</h1>
          <p className="pl-lede">
            {view.controllerId === view.me.id ? (
              <>
                <strong>You pick first.</strong> Tell the host which clue you want.
              </>
            ) : (
              <>
                <strong className="name">{nameOf(view.players, view.controllerId)}</strong> picks
                first.
              </>
            )}
          </p>
        </div>
      );
    case "board":
      return <PlayerBoard view={view} />;
    case "clue":
      return view.clue ? (
        <PlayerClue
          view={view}
          clue={view.clue}
          stale={stale}
          run={run}
          pending={pending}
          clockOffsetMs={clockOffsetMs}
        />
      ) : null;
    case "final":
      return view.final ? (
        <PlayerFinal
          view={view}
          final={view.final}
          stale={stale}
          run={run}
          pending={pending}
          clockOffsetMs={clockOffsetMs}
        />
      ) : null;
    case "results":
      return <PlayerResults view={view} />;
  }
}

function PlayerList({ players, meId }: { players: readonly PublicPlayer[]; meId: string }) {
  return (
    <ul className="pl-list">
      {players.map((player) => (
        <li key={player.id} className={player.id === meId ? "pl-list__me" : undefined}>
          <span className="name">{player.name}</span>
          {player.id === meId ? <span className="stamp stamp--flat">You</span> : null}
          {!player.connected ? <span className="pl-list__away">away</span> : null}
        </li>
      ))}
    </ul>
  );
}

function PlayerLobby({ view }: { view: PlayerView }) {
  return (
    <div className="stack">
      <div className="stack stack--tight pl-center">
        <span className="pl-kicker">You&apos;re in</span>
        <h1 className="pl-big">Waiting for the host to start</h1>
        <p className="muted">Keep this page open and follow the clues on the big screen.</p>
        {view.buzzing.falseStartLockout ? (
          <p className="pl-tip">
            <strong>Wait for the light.</strong> Tapping before your buzzer lights locks it for a
            moment.
          </p>
        ) : null}
      </div>
      <section className="panel panel--flat" aria-labelledby="lobby-players">
        <h2 id="lobby-players" className="panel__title">
          <span>Players</span>
          <span className="eyebrow num">
            {view.players.length} of {MAX_PLAYERS}
          </span>
        </h2>
        <PlayerList players={view.players} meId={view.me.id} />
      </section>
      {view.pack ? (
        <p className="muted">
          Pack: <strong>{view.pack.title}</strong>
        </p>
      ) : null}
    </div>
  );
}

function WaitingForNextGame({ view }: { view: PlayerView }) {
  const over = view.phase === "results";
  return (
    <div className="stack">
      <div className="stack stack--tight pl-center">
        <span className="pl-kicker">On the bench</span>
        <h1 className="pl-big">You&apos;re in for the next game</h1>
        <p className="muted">
          {over ? "This game just finished." : "A game is already running."} When the host chooses{" "}
          <strong>Play again</strong>, you&apos;ll join automatically if a seat is free.
        </p>
      </div>
      <section className="panel panel--flat" aria-labelledby="bench-scores">
        <h2 id="bench-scores" className="panel__title">
          {over ? "Final scores" : "Current game"}
        </h2>
        <Scoreboard players={view.players} />
      </section>
    </div>
  );
}

function Scoreboard({ players, meId }: { players: readonly PublicPlayer[]; meId?: string }) {
  return (
    <ol className="pl-scores">
      {players.map((player) => (
        <li key={player.id} className={player.id === meId ? "pl-list__me" : undefined}>
          <span className="name">{player.name}</span>
          <span className={`score ${player.score < 0 ? "score--neg" : ""}`}>
            {formatScore(player.score)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PlayerBoard({ view }: { view: PlayerView }) {
  const mine = view.controllerId === view.me.id;
  return (
    <div className="stack">
      <div className={`pl-picker ${mine ? "pl-picker--me" : ""}`}>
        {view.round ? <p className="pl-kicker">{view.round.title}</p> : null}
        {mine ? (
          <>
            <h1 className="pl-big">You pick!</h1>
            <p>Tell the host your category and point value.</p>
          </>
        ) : (
          <>
            <h1 className="pl-big name">{nameOf(view.players, view.controllerId)} picks</h1>
            <p>Follow the board on the big screen.</p>
          </>
        )}
      </div>
      {view.board ? <BoardGrid board={view.board} variant="phone" /> : null}
      <section aria-labelledby="board-scores" className="stack stack--tight">
        <h2 id="board-scores" className="eyebrow">
          Scores
        </h2>
        <Scoreboard players={view.players} meId={view.me.id} />
      </section>
    </div>
  );
}

function ClueCard({
  prompt,
  picture,
  title,
  valueLabel,
  compact = false,
  children,
}: {
  prompt: PromptView["prompt"];
  picture: PromptView["picture"];
  title: string;
  valueLabel: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`pl-clue ${compact ? "pl-clue--compact" : ""}`}
      aria-labelledby="pl-clue-cat"
    >
      <header className="pl-clue__head">
        <h2 id="pl-clue-cat" className="name">
          {title}
        </h2>
        {valueLabel ? <span className="pl-clue__value num">{valueLabel}</span> : null}
      </header>
      {picture ? <CluePicture picture={picture} className="pl-picture" /> : null}
      {prompt ? (
        <p className={`pl-clue__prompt ${prompt.length > 160 ? "pl-clue__prompt--long" : ""}`}>
          {prompt}
        </p>
      ) : null}
      {children}
    </article>
  );
}

function PlayerClue({
  view,
  clue,
  stale,
  run,
  pending,
  clockOffsetMs,
}: {
  view: PlayerView;
  clue: ClueView;
  stale: boolean;
  run: Run;
  pending: Pending;
  clockOffsetMs: number;
}) {
  const answeringMe = clue.answeringPlayerId === view.me.id && clue.stage === "answering";
  const margin = answeringMargin(clue);
  const lastAttempt = clue.attempts[clue.attempts.length - 1];
  const disabled = stale || !!view.paused;

  useEffect(() => {
    if (answeringMe) vibrate([70, 50, 70]);
  }, [answeringMe]);

  if (clue.stage === "wager") {
    const bounds = view.can.wager;
    return (
      <div className="stack">
        <div className="stack stack--tight pl-center">
          <p className="pl-kicker">{clue.categoryTitle} · Wager clue</p>
          <h1 className="pl-big">
            <HotHam className="hot-ham--phone" />
          </h1>
        </div>
        {bounds ? (
          <section className="panel pl-form-card" aria-labelledby="wager-title">
            <h2 id="wager-title">Place your wager</h2>
            <p className="muted">
              Only you answer this one. Right adds your wager, wrong takes it away.
            </p>
            <WagerForm
              min={bounds.min}
              max={bounds.max}
              disabled={disabled}
              busy={pending === "submitWager"}
              submitLabel="Lock in wager"
              onSubmit={(amount) => void run({ type: "submitWager", clueId: clue.clueId, amount })}
            />
          </section>
        ) : view.controllerId === view.me.id ? (
          <p className="pl-waiting">This wager is yours. Only you answer this one.</p>
        ) : (
          <p className="pl-waiting">
            <strong className="name">{nameOf(view.players, view.controllerId)}</strong> is placing a
            wager. Only they answer this one.
          </p>
        )}
      </div>
    );
  }

  const readingOrOpen = clue.stage === "reading" || clue.stage === "open";
  const value = clue.wager !== null ? clue.wager : clue.value;
  return (
    <div className="pl-clue-wrap">
      <ClueCard
        title={clue.categoryTitle}
        valueLabel={`${clue.wager !== null ? "Wager " : ""}${formatScore(value)} pts`}
        prompt={clue.prompt}
        picture={clue.kind === "wager" ? clue.picture : null}
        compact={clue.kind === "standard" && clue.stage !== "revealed"}
      >
        {clue.stage === "revealed" && clue.answer ? (
          <div className="pl-answer">
            <span className="eyebrow">Answer</span>
            <p>{clue.answer}</p>
          </div>
        ) : null}
      </ClueCard>

      {clue.stage === "answering" && view.timer ? (
        <Countdown timer={view.timer} clockOffsetMs={clockOffsetMs} />
      ) : null}
      {readingOrOpen ? (
        <div className="pl-buzz-clock">
          {clue.stage === "open" && view.timer ? (
            <Countdown timer={view.timer} clockOffsetMs={clockOffsetMs} />
          ) : null}
        </div>
      ) : null}

      {answeringMe ? (
        <div className="pl-up" role="status">
          <strong>You&apos;re up!</strong>
          <span>
            {view.paused
              ? "Wait until the host resumes."
              : stale
                ? "Wait until your phone reconnects."
                : lastAttempt?.timedOut
                  ? "Time's up. Wait for the host's decision."
                  : "Say your answer out loud to the host."}
          </span>
          {margin ? <span className="pl-up__margin">You got there first {margin}.</span> : null}
        </div>
      ) : clue.stage === "answering" ? (
        <p className="pl-waiting">
          <strong className="name">{nameOf(view.players, clue.answeringPlayerId)}</strong> is
          answering.
        </p>
      ) : clue.kind === "wager" &&
        !lastAttempt &&
        (clue.stage === "closed" || clue.stage === "revealed") ? (
        <p className="pl-waiting">The host skipped this wager clue. No score change.</p>
      ) : clue.stage === "revealed" || (clue.stage === "closed" && lastAttempt) ? (
        lastAttempt ? (
          <p className={`pl-result pl-result--${lastAttempt.result}`}>
            <span className="name">
              {lastAttempt.playerId === view.me.id
                ? "You"
                : nameOf(view.players, lastAttempt.playerId)}
            </span>
            {lastAttempt.result === "correct"
              ? " got it"
              : lastAttempt.result === "incorrect"
                ? " missed it"
                : " answered"}
            {lastAttempt.delta !== null ? <strong> {formatDelta(lastAttempt.delta)}</strong> : null}
          </p>
        ) : (
          <p className="pl-waiting">Nobody got this one.</p>
        )
      ) : null}

      {clue.kind === "standard" &&
      clue.stage !== "revealed" &&
      !answeringMe &&
      !(clue.stage === "closed" && lastAttempt?.result === "correct") ? (
        <BuzzButton view={view} clue={clue} stale={stale} run={run} clockOffsetMs={clockOffsetMs} />
      ) : null}
    </div>
  );
}

function PlayerFinal({
  view,
  final,
  stale,
  run,
  pending,
  clockOffsetMs,
}: {
  view: PlayerView;
  final: FinalView;
  stale: boolean;
  run: Run;
  pending: Pending;
  clockOffsetMs: number;
}) {
  const remaining = useRemaining(final.stage === "answering" ? view.timer : null, clockOffsetMs);
  const endsAt = view.timer?.endsAt;
  const autosaveUntil =
    endsAt != null && remaining !== null && remaining > 0 && remaining <= FINAL_AUTOSAVE_WINDOW_MS
      ? endsAt - clockOffsetMs
      : null;
  const eligible = final.eligiblePlayerIds.includes(view.me.id);
  const header = (
    <div className="stack stack--tight pl-center">
      <span className="pl-kicker">Final round</span>
      <h1 className="pl-big name">{final.categoryTitle}</h1>
    </div>
  );
  const wager = view.myFinal?.wager;
  const card = (
    <ClueCard
      title="Final clue"
      valueLabel={wager != null ? `Wager ${formatScore(wager)} pts` : ""}
      prompt={final.prompt}
      picture={final.picture}
    >
      {(final.stage === "judging" || final.stage === "done") && final.answer ? (
        <div className="pl-answer">
          <span className="eyebrow">Answer</span>
          <p>{final.answer}</p>
        </div>
      ) : null}
    </ClueCard>
  );

  if (!eligible) {
    return (
      <div className="stack">
        {header}
        <p className="pl-waiting">
          You&apos;re sitting this one out. The final round is for players who had more than 0
          points when it began. Watch the big screen!
        </p>
        {final.prompt ? card : null}
      </div>
    );
  }

  if (final.stage === "wagers") {
    const bounds = view.can.finalWager;
    const submitted = view.myFinal?.wager ?? null;
    return (
      <div className="stack">
        {header}
        <p className="muted pl-center">
          You&apos;ll see the clue after wagers lock. {final.wagerSubmittedIds.length} of{" "}
          {plural(final.eligiblePlayerIds.length, "player")}{" "}
          {final.wagerSubmittedIds.length === 1 ? "has" : "have"} wagered.
        </p>
        {/* "Saved", not "locked": the wager can still change until the clue shows. */}
        {submitted !== null ? (
          <p className="final-status" role="status">
            <span className="stamp stamp--good stamp--flat">Wager saved</span>
            <span>
              Your wager: <strong className="num">{formatScore(submitted)}</strong>. You can change
              it until the host shows the clue.
            </span>
          </p>
        ) : null}
        {bounds ? (
          <section className="panel pl-form-card" aria-labelledby="final-wager-title">
            <h2 id="final-wager-title">
              {submitted === null ? "Place your final wager" : "Change your wager"}
            </h2>
            <WagerForm
              key={submitted ?? "none"}
              min={bounds.min}
              max={bounds.max}
              initial={submitted}
              disabled={stale || !!view.paused}
              busy={pending === "submitFinalWager"}
              submitLabel={submitted === null ? "Save wager" : "Change wager"}
              onSubmit={(amount) => void run({ type: "submitFinalWager", amount })}
            />
          </section>
        ) : null}
      </div>
    );
  }

  if (final.stage === "answering") {
    return (
      <div className="stack">
        {header}
        {card}
        {view.timer ? <Countdown timer={view.timer} clockOffsetMs={clockOffsetMs} /> : null}
        {view.can.finalAnswer ? (
          <FinalAnswerForm
            submitted={view.myFinal?.answer ?? null}
            revision={view.revision}
            disabled={stale || !!view.paused}
            busy={pending !== null}
            autosaveUntil={autosaveUntil}
            onSubmit={async (text, auto) => {
              const outcome = await run({ type: "submitFinalAnswer", text }, { silent: auto });
              return outcome?.ok ? outcome.revision : null;
            }}
          />
        ) : (
          <p className="pl-waiting">
            {view.myFinal?.answer ? (
              <>
                You answered: <strong className="name">{view.myFinal.answer}</strong>
              </>
            ) : (
              "Watch the big screen."
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      {header}
      {card}
      {view.myFinal?.answer ? (
        <p className="muted">
          You answered: <strong className="name">{view.myFinal.answer}</strong>
        </p>
      ) : null}
      <section aria-labelledby="final-reveals" className="stack stack--tight">
        <h2 id="final-reveals" className="eyebrow">
          {final.stage === "done" ? "All responses" : "The host is revealing responses"}
        </h2>
        <ol className="pl-scores">
          {final.responses.map((response) => (
            <li
              key={response.playerId}
              className={response.playerId === view.me.id ? "pl-list__me" : undefined}
            >
              <span className="name">
                {nameOf(view.players, response.playerId)}
                {response.answer !== null ? (
                  <span className="pl-said">“{response.answer}”</span>
                ) : null}
              </span>
              <FinalVerdict response={response} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Where one final response stands: waiting, being judged, or judged with its score change. */
function FinalVerdict({ response }: { response: FinalResponseView }) {
  if (response.status === "hidden") return <span className="pl-verdict muted">Waiting</span>;
  if (response.status === "revealed") return <span className="pl-verdict">Judging…</span>;
  return (
    <span className="pl-verdict">
      <span className={`stamp stamp--flat ${response.correct ? "stamp--good" : "stamp--bad"}`}>
        {response.correct ? "Correct" : "Incorrect"}
      </span>
      {response.delta !== null ? (
        <strong className="score">{formatDelta(response.delta)}</strong>
      ) : null}
    </span>
  );
}

function PlayerResults({ view }: { view: PlayerView }) {
  const results = view.results;
  if (!results) return null;
  const mine = results.standings.find((s) => s.playerId === view.me.id);
  const won = results.winnerIds.includes(view.me.id);
  const shared = won && results.winnerIds.length > 1;
  const winners = results.standings
    .filter((s) => results.winnerIds.includes(s.playerId))
    .map((s) => s.name);
  return (
    <div className="stack">
      <div className="stack stack--tight pl-center">
        <span className="pl-kicker">Game over</span>
        <h1 className="pl-big">
          {won
            ? shared
              ? "Shared win!"
              : "You won!"
            : mine
              ? `You placed ${ordinal(mine.rank)}`
              : "Thanks for playing"}
        </h1>
        <p className="pl-lede">
          {won
            ? shared
              ? `You share the top spot with ${listNames(winners.filter((n) => n !== view.me.name))}.`
              : "Top score. Take a bow."
            : `${shared || winners.length > 1 ? "Winners" : "Winner"}: ${listNames(winners)}`}
        </p>
      </div>
      <ol className="pl-scores pl-scores--results">
        {results.standings.map((standing) => (
          <li
            key={standing.playerId}
            className={standing.playerId === view.me.id ? "pl-list__me" : undefined}
          >
            <span className="pl-rank num">{ordinal(standing.rank)}</span>
            <span className="name">{standing.name}</span>
            <span className={`score ${standing.score < 0 ? "score--neg" : ""}`}>
              {formatScore(standing.score)}
            </span>
          </li>
        ))}
      </ol>
      <p className="muted pl-center">
        The host can start another game from here. Stay on this page to play again.
      </p>
    </div>
  );
}
