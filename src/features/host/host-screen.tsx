"use client";

import { useCallback, useId, useMemo, useState, type FormEvent } from "react";
import {
  MAX_ADJUSTMENT_DELTA,
  MAX_ADJUSTMENT_REASON_LENGTH,
  type HostCommandType,
  type HostView,
  type PlayerId,
} from "@/features/engine/contract";
import type { RoomConnection } from "@/features/network/connection";
import type { ClientCommand, ClientHostCommand, PackSummary } from "@/features/network/protocol";
import { BoardGrid } from "@/features/board/board-grid";
import { Lockup } from "@/features/ui/brand";
import { ClosedNotice, ConnectionPill, StaleBanner } from "@/features/ui/connection-status";
import { ConfirmDialog, Dialog } from "@/features/ui/dialog";
import { describeEvent, pauseMessage } from "@/features/ui/events";
import { formatDelta, formatScore, nameOf } from "@/features/ui/format";
import { ToastProvider } from "@/features/ui/toasts";
import { useCommand } from "@/features/ui/use-command";
import { useFreshEvent } from "@/features/ui/use-fresh-event";
import { DisplayLinkPanel } from "./display-link";
import { HostClue, HostFinal, HostResults } from "./host-clue";
import { HostLobby } from "./host-lobby";

export interface HostActions {
  /** True when the view allows this command right now and the connection is fresh. */
  can: (type: HostCommandType) => boolean;
  run: (cmd: ClientHostCommand) => void;
  pending: ClientCommand["type"] | null;
}

/**
 * The host's control room. Shows the private HostView (answers, wager
 * cells) and only enables commands listed in `allowedCommands`.
 */
export function HostScreen(props: {
  code: string;
  connection: RoomConnection<HostView>;
  packs: PackSummary[];
  joinUrl: string;
  onCreateDisplayLink: () => Promise<string>;
}) {
  return (
    <ToastProvider>
      <HostBody {...props} />
    </ToastProvider>
  );
}

function HostBody({
  code,
  connection,
  packs,
  joinUrl,
  onCreateDisplayLink,
}: {
  code: string;
  connection: RoomConnection<HostView>;
  packs: PackSummary[];
  joinUrl: string;
  onCreateDisplayLink: () => Promise<string>;
}) {
  const { view, status, stale } = connection;
  const { run, pending } = useCommand(connection);
  const fresh = useFreshEvent(view);
  const [dialog, setDialog] = useState<null | "end" | "display" | { adjust: PlayerId | null }>(null);

  const allowed = view?.allowedCommands;
  const can = useCallback((type: HostCommandType) => !stale && !!allowed?.includes(type), [stale, allowed]);
  const actions = useMemo<HostActions>(() => ({ can, run: (cmd) => void run(cmd), pending }), [can, run, pending]);

  if (status === "closed") return <ClosedNotice reason={connection.closeReason} role="host" returnTo={`/host/${code}`} />;

  if (!view) {
    return (
      <main id="main-content" className="notice">
        <span className="stamp stamp--dashed">Room {code}</span>
        <h1>
          Opening the control room<span className="loading-dots" />
        </h1>
      </main>
    );
  }

  const inGame = view.phase !== "lobby";
  const announcement = fresh ? describeEvent(fresh.event, view.players) : null;

  return (
    <div className={`host host--${view.phase}`}>
      <header className="topbar host-top">
        <Lockup href="/" />
        <div className="topbar__mid">
          <span className="host-top__room">
            Room <span className="room-code">{view.roomCode}</span>
          </span>
          {view.pack ? <span className="host-top__pack name">{view.pack.title}</span> : null}
          {view.round ? (
            <span className="stamp stamp--flat">
              {view.round.title} · {view.round.index + 1}/{view.round.total}
            </span>
          ) : view.phase === "final" ? (
            <span className="stamp stamp--flat">Final round</span>
          ) : null}
        </div>
        <div className="topbar__end">
          <ConnectionPill status={status} />
          {inGame ? (
            <button type="button" className="btn btn--small" onClick={() => setDialog("display")}>
              TV link
            </button>
          ) : null}
          {view.paused ? (
            <button type="button" className="btn btn--small btn--primary" disabled={!can("resume")} onClick={() => actions.run({ type: "resume" })}>
              Resume
            </button>
          ) : inGame && view.phase !== "results" ? (
            <button type="button" className="btn btn--small" disabled={!can("pause")} onClick={() => actions.run({ type: "pause" })}>
              Pause
            </button>
          ) : null}
          {inGame && view.phase !== "results" ? (
            <button type="button" className="btn btn--small" disabled={!can("endGame")} onClick={() => setDialog("end")}>
              End game
            </button>
          ) : null}
        </div>
      </header>

      <div className="host-banners">
        <StaleBanner status={status} />
        {view.paused ? (
          <div className="banner banner--warn" role="status">
            <span>{pauseMessage(view.paused.reason).title}</span>
            <p>{view.paused.reason === "host" ? "Players see a pause screen. Timers are frozen." : "Resume when everyone is ready."}</p>
            <button type="button" className="btn btn--small btn--primary" disabled={!can("resume")} onClick={() => actions.run({ type: "resume" })}>
              Resume game
            </button>
          </div>
        ) : null}
      </div>

      {view.phase === "lobby" ? (
        <main id="main-content" className="host-page">
          <div className="host-intro">
            <h1 className="marker">Set up the game</h1>
            <p className="muted">You run the show: you read clues, judge answers and keep score. You don&apos;t play.</p>
          </div>
          <HostLobby view={view} packs={packs} joinUrl={joinUrl} actions={actions} onCreateDisplayLink={onCreateDisplayLink} />
        </main>
      ) : (
        <div className="host-grid">
          <main id="main-content" className="host-main">
            <HostPhase view={view} actions={actions} clockOffsetMs={connection.clockOffsetMs} />
          </main>
          <aside className="host-side" aria-label="Scores">
            <Scores view={view} canAdjust={can("adjustScore")} onAdjust={(playerId) => setDialog({ adjust: playerId })} />
            <ScoreLog view={view} />
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={dialog === "end"}
        title="End the game now?"
        description="Play stops and everyone sees the results with the current scores. You can play again from there."
        confirmLabel="End game"
        cancelLabel="Keep playing"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          actions.run({ type: "endGame" });
          setDialog(null);
        }}
      />
      <Dialog open={dialog === "display"} onClose={() => setDialog(null)} title="Big screen link" footer={<button type="button" className="btn" onClick={() => setDialog(null)}>Done</button>}>
        <DisplayLinkPanel onCreate={onCreateDisplayLink} />
      </Dialog>
      {typeof dialog === "object" && dialog !== null ? (
        <AdjustDialog view={view} initialPlayer={dialog.adjust} actions={actions} onClose={() => setDialog(null)} />
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

function HostPhase({ view, actions, clockOffsetMs }: { view: HostView; actions: HostActions; clockOffsetMs: number }) {
  const controller = nameOf(view.players, view.controllerId);
  switch (view.phase) {
    case "lobby":
      return null;
    case "roundIntro":
      return (
        <div className="stack">
          <section className="panel host-intro-card">
            <span className="stamp stamp--red">Up next</span>
            <h1>{view.round?.title ?? "Next round"}</h1>
            <p className="host-lede">
              <strong className="name">{controller}</strong> picks first. The big screen is showing the round title.
            </p>
            <div className="row">
              <button type="button" className="btn btn--primary btn--big" disabled={!actions.can("continue")} onClick={() => actions.run({ type: "continue" })}>
                Show the board
              </button>
            </div>
          </section>
          {view.board ? <BoardGrid board={view.board} variant="host" label={`${view.board.roundTitle} board preview`} /> : null}
        </div>
      );
    case "board":
      return (
        <div className="stack">
          <p className="host-picker">
            <span>
              <strong className="name">{controller}</strong> picks. Click the clue they call out.
            </span>
            <span className="host-legend">
              <span className="board__hot board__hot--inline">Hot</span> = wager clue (only you can see these)
            </span>
          </p>
          {view.board ? (
            <BoardGrid
              board={view.board}
              variant="host"
              onSelect={(clueId) => actions.run({ type: "selectClue", clueId })}
              disabled={!actions.can("selectClue")}
            />
          ) : null}
        </div>
      );
    case "clue":
      return view.clue ? <HostClue key={view.clue.clueId} view={view} clue={view.clue} actions={actions} clockOffsetMs={clockOffsetMs} /> : null;
    case "final":
      return view.final ? <HostFinal view={view} final={view.final} actions={actions} clockOffsetMs={clockOffsetMs} /> : null;
    case "results":
      return <HostResults view={view} actions={actions} />;
  }
}

function Scores({ view, canAdjust, onAdjust }: { view: HostView; canAdjust: boolean; onAdjust: (id: PlayerId | null) => void }) {
  return (
    <section className="panel panel--flat host-scores" aria-labelledby="host-scores-title">
      <div className="panel__title">
        <h2 id="host-scores-title">Scores</h2>
        <button type="button" className="btn btn--small" disabled={!canAdjust} onClick={() => onAdjust(null)}>
          Adjust a score
        </button>
      </div>
      <ul className="host-roster host-roster--scores">
        {view.players.map((player) => (
          <li key={player.id} className={player.id === view.clue?.answeringPlayerId ? "is-answering" : undefined}>
            <span className="host-roster__name">
              <span className="name">{player.name}</span>
              <span className="host-roster__tags">
                {player.id === view.controllerId ? <span className="stamp stamp--blue stamp--flat">Picks</span> : null}
                {player.id === view.clue?.answeringPlayerId ? <span className="stamp stamp--good stamp--flat">Answering</span> : null}
                {!player.connected ? <span className="host-away">away</span> : null}
              </span>
            </span>
            <span className={`score ${player.score < 0 ? "score--neg" : ""}`}>{formatScore(player.score)}</span>
            <button type="button" className="btn btn--small host-adjust" disabled={!canAdjust} onClick={() => onAdjust(player.id)} aria-label={`Adjust ${player.name}'s score`} title="Adjust score">
              ±
            </button>
          </li>
        ))}
      </ul>
      {view.waitingPlayers.length > 0 ? (
        <p className="muted host-waiting">Next game: {view.waitingPlayers.map((w) => w.name).join(", ")}</p>
      ) : null}
    </section>
  );
}

function ScoreLog({ view }: { view: HostView }) {
  const entries = [...view.scoreLog].reverse();
  return (
    <section className="host-log" aria-labelledby="host-log-title">
      <h2 id="host-log-title" className="eyebrow">
        Score log
      </h2>
      {entries.length === 0 ? (
        <p className="muted">No points yet.</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={`${entry.revision}-${entry.playerId}`}>
              <span className={`num host-log__delta ${entry.delta < 0 ? "score--neg" : ""}`}>{formatDelta(entry.delta)}</span>
              <span className="name">
                <strong>{nameOf(view.players, entry.playerId)}</strong> · {entry.kind === "adjustment" ? `Adjusted: ${entry.reason}` : entry.reason}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AdjustDialog({
  view,
  initialPlayer,
  actions,
  onClose,
}: {
  view: HostView;
  initialPlayer: PlayerId | null;
  actions: HostActions;
  onClose: () => void;
}) {
  const id = useId();
  const [playerId, setPlayerId] = useState<PlayerId>(initialPlayer ?? view.players[0]?.id ?? "");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const n = Number(amount);
    const next: typeof errors = {};
    if (!Number.isInteger(n) || n < 1 || n > MAX_ADJUSTMENT_DELTA) next.amount = `Enter a whole number from 1 to ${formatScore(MAX_ADJUSTMENT_DELTA)}.`;
    if (!reason.trim()) next.reason = "Say why, so everyone can see it in the score log.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    actions.run({ type: "adjustScore", playerId, delta: direction * n, reason: reason.trim() });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Adjust a score"
      description="Fix a judging mistake. This is logged and doesn't change clue progress."
    >
      <form id={`${id}-form`} className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-player`}>
            Player
          </label>
          <select id={`${id}-player`} className="input" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            {view.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatScore(p.score)})
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <div className="segmented" role="group" aria-label="Add or subtract">
            <button type="button" aria-pressed={direction === 1} onClick={() => setDirection(1)}>
              Add
            </button>
            <button type="button" aria-pressed={direction === -1} onClick={() => setDirection(-1)}>
              Subtract
            </button>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label sr-only" htmlFor={`${id}-amount`}>
              Points
            </label>
            <input
              id={`${id}-amount`}
              className="input num"
              inputMode="numeric"
              placeholder="Points"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={errors.amount ? `${id}-amount-error` : undefined}
            />
          </div>
        </div>
        {errors.amount ? (
          <span id={`${id}-amount-error`} className="field__error">
            {errors.amount}
          </span>
        ) : null}
        <div className="field">
          <label className="field__label" htmlFor={`${id}-reason`}>
            Reason
          </label>
          <input
            id={`${id}-reason`}
            className="input"
            maxLength={MAX_ADJUSTMENT_REASON_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Accepted a misspelling"
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={`${id}-reason-hint`}
          />
          <span id={`${id}-reason-hint`} className={errors.reason ? "field__error" : "field__hint"}>
            {errors.reason ?? `${MAX_ADJUSTMENT_REASON_LENGTH - reason.length} characters left`}
          </span>
        </div>
        <div className="dialog__actions row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!actions.can("adjustScore")}>
            {amount ? `${direction > 0 ? "Add" : "Subtract"} ${formatScore(Number(amount))}` : "Apply"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
