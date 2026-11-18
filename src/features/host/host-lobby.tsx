"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { MAX_PLAYERS, type HostView, type PlayerId } from "@/features/engine/contract";
import type { PackSummary } from "@/features/network/protocol";
import { ConfirmDialog } from "@/features/ui/dialog";
import { plural } from "@/features/ui/format";
import { QrCode } from "@/features/ui/qr-code";
import { CopyField } from "@/features/ui/copy-field";
import type { HostActions } from "./host-screen";
import { DisplayLinkPanel } from "./display-link";
import { SettingsEditor } from "./lobby-settings";
import { PingChip, pingStatus } from "./ping";

export function HostLobby({
  view,
  packs,
  joinUrl,
  pings,
  actions,
  onCreateDisplayLink,
  displayLink,
}: {
  view: HostView;
  packs: PackSummary[];
  joinUrl: string;
  /** Server-measured median ping per player (host only). */
  pings: Record<string, number | null>;
  actions: HostActions;
  onCreateDisplayLink: () => Promise<string>;
  displayLink: string | null;
}) {
  const [removing, setRemoving] = useState<{ id: PlayerId; name: string } | null>(null);
  // Unsaved settings would be dropped by Start, so they block it until saved or undone.
  const [settingsDirty, setSettingsDirty] = useState(false);
  const settingsFormId = useId();
  const setup = useRef<HTMLDetailsElement>(null);
  const [setupOpen, setSetupOpen] = useState(view.pack === null);
  const canStart = actions.can("startGame") && !settingsDirty;
  const blocked = settingsDirty || view.startBlockers.length > 0;
  const anySlowPing = view.players.some(
    (player) => player.connected && pingStatus(pings[player.id] ?? null).kind === "slow",
  );

  return (
    <>
      <div className="host-lobby">
        <LobbyInvitation
          code={view.roomCode}
          joinUrl={joinUrl}
          displayLink={displayLink}
          onCreateDisplayLink={onCreateDisplayLink}
        />
        <section className="panel host-lobby__players" aria-labelledby="lobby-players">
          <div className="panel__title">
            <h2 id="lobby-players">Players</h2>
            <span className="host-kicker host-chip">
              {view.players.length} / {MAX_PLAYERS}
              <span className="sr-only"> seats filled</span>
            </span>
          </div>
          {view.players.length === 0 ? (
            <p className="muted">Seats fill as players join on their phones.</p>
          ) : (
            <ul className="host-roster">
              {view.players.map((player) => (
                <li key={player.id}>
                  <span className="host-avatar" aria-hidden="true">
                    {Array.from(player.name)[0]?.toLocaleUpperCase()}
                  </span>
                  <span className="name">{player.name}</span>
                  {!player.connected ? <span className="host-away">away</span> : null}
                  <PingChip ms={pings[player.id]} connected={player.connected} />
                  <button
                    type="button"
                    className="btn btn--small host-text-action"
                    disabled={!actions.can("removePlayer")}
                    onClick={() => setRemoving({ id: player.id, name: player.name })}
                    aria-label={`Remove ${player.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {anySlowPing ? (
            <p className="host-ping-note">
              <strong>Slow ping:</strong> fair buzzing can only make up for so much lag. Moving
              closer to the Wi-Fi helps.
            </p>
          ) : null}
          {view.waitingPlayers.length > 0 ? (
            <p className="muted host-waiting">
              Waiting for a seat: {view.waitingPlayers.map((w) => w.name).join(", ")}
            </p>
          ) : null}
        </section>
      </div>

      <details
        ref={setup}
        className="host-lobby__setup"
        open={setupOpen}
        onToggle={(event) => setSetupOpen(event.currentTarget.open)}
      >
        <summary className="host-setup__summary">
          <span className="host-setup__format">
            <strong className="name">{view.pack?.title ?? "Choose a question pack"}</strong>
            <span className="muted">
              {plural(view.settings.rounds, "round")} ·{" "}
              {plural(view.settings.categoriesPerRound, "category", "categories")} per round
            </span>
          </span>
          <span className="host-text-action">Edit setup</span>
        </summary>
        <section className="host-setup__editor" aria-label="Pack and settings">
          <PackChooser key={view.pack?.id} view={view} packs={packs} actions={actions} />
          <SettingsEditor
            key={JSON.stringify([view.pack, view.settings])}
            formId={settingsFormId}
            onDirtyChange={setSettingsDirty}
            settings={view.settings}
            pack={view.pack?.dimensions ?? null}
            disabled={!actions.can("updateSettings")}
            busy={actions.pending === "updateSettings"}
            onSave={(patch) => actions.run({ type: "updateSettings", patch })}
            onInvalid={() => {
              if (setup.current) setup.current.open = true;
            }}
          />
        </section>
      </details>

      <section className="host-start" aria-labelledby="lobby-start">
        <h2 id="lobby-start" className="sr-only">
          Start
        </h2>
        {blocked ? (
          <ul className="host-blockers" aria-label="Before you can start">
            {settingsDirty ? (
              <li className="host-blockers__unsaved">
                Save or undo your settings changes first.{" "}
                <button
                  type="submit"
                  form={settingsFormId}
                  className="btn btn--small"
                  disabled={!actions.can("updateSettings")}
                  aria-busy={actions.pending === "updateSettings" || undefined}
                >
                  Save changes
                </button>
              </li>
            ) : null}
            {view.startBlockers.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="host-ready">
            <span className="host-kicker host-chip">Ready</span>
            {plural(view.players.length, "player")} in.
          </p>
        )}
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={!canStart}
          aria-busy={actions.pending === "startGame" || undefined}
          onClick={() => actions.run({ type: "startGame" })}
        >
          Start game <span aria-hidden="true">→</span>
        </button>
      </section>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? "player"}?`}
        description="They leave the lobby and can rejoin with the room code."
        confirmLabel="Remove"
        cancelLabel="Keep them"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) actions.run({ type: "removePlayer", playerId: removing.id });
          setRemoving(null);
        }}
      />
    </>
  );
}

function LobbyInvitation({
  code,
  joinUrl,
  displayLink,
  onCreateDisplayLink,
}: {
  code: string;
  joinUrl: string;
  displayLink: string | null;
  onCreateDisplayLink: () => Promise<string>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Room code copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setFeedback("Room code selected. Copy it from the field.");
    }
  }

  return (
    <section className="host-lobby__invite" aria-labelledby="lobby-invite">
      <div className="host-invite">
        <div className="host-invite__code">
          <h2 id="lobby-invite" className="host-kicker">
            Room code
          </h2>
          <input
            ref={input}
            className="room-code host-invite__letters"
            value={code}
            readOnly
            aria-label="Room code"
            onFocus={(event) => event.currentTarget.select()}
          />
          <p>Scan to join or enter the code on the home page.</p>
        </div>
        <QrCode
          value={joinUrl}
          label={`QR code to join room ${code}`}
          className="host-invite__qr"
        />
      </div>
      <DisplayLinkPanel onCreate={onCreateDisplayLink} link={displayLink} lobby>
        <button type="button" className="btn" onClick={() => void copy()}>
          Copy code
        </button>
        <span className="host-copy-status" role="status">
          {feedback}
        </span>
      </DisplayLinkPanel>
      <CopyField value={joinUrl} label="Join link" />
    </section>
  );
}

function PackChooser({
  view,
  packs,
  actions,
}: {
  view: HostView;
  packs: PackSummary[];
  actions: HostActions;
}) {
  const id = useId();
  // With no pack in use, the select starts on a placeholder rather than
  // showing a pack that isn't actually chosen.
  const [choice, setChoice] = useState(view.pack?.id ?? "");
  const chosen = packs.find((p) => p.id === choice) ?? null;
  const changed = chosen !== null && chosen.id !== view.pack?.id;
  const builtIn = packs.filter((p) => p.source === "builtIn");
  const mine = packs.filter((p) => p.source === "mine");
  // The pack in use can be missing from the list (still loading, or it failed to load).
  const inUseUnlisted = view.pack !== null && !packs.some((p) => p.id === view.pack?.id);
  // The room keeps its own copy of a pack, so edits to a saved one need a reload.
  const reloadable = changed
    ? null
    : packs.find((p) => p.id === view.pack?.id && p.source === "mine");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (changed) actions.run({ type: "choosePack", packId: choice });
  }

  return (
    <form className="host-pack" onSubmit={submit}>
      <div className="field">
        <label className="field__label" htmlFor={id}>
          Question pack
        </label>
        <select
          id={id}
          className="input"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          disabled={!actions.can("setPack")}
        >
          {view.pack === null ? (
            <option value="" disabled>
              {packs.length === 0 ? "No packs available" : "Choose a pack…"}
            </option>
          ) : null}
          {inUseUnlisted && view.pack ? (
            <option value={view.pack.id}>{view.pack.title}</option>
          ) : null}
          {builtIn.length > 0 ? (
            <optgroup label="Built in">
              {builtIn.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.title} ({pack.categories}×{pack.cluesPerCategory})
                </option>
              ))}
            </optgroup>
          ) : null}
          {mine.length > 0 ? (
            <optgroup label="My packs">
              {mine.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.title} ({pack.categories}×{pack.cluesPerCategory})
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <span className="field__hint">
          {view.pack ? (
            <>
              In use: <strong>{view.pack.title}</strong>.{" "}
            </>
          ) : (
            "No pack chosen yet. "
          )}
          Changing the pack resets the settings to its defaults.
        </span>
      </div>
      {changed ? (
        <button
          type="submit"
          className="btn"
          disabled={!actions.can("setPack")}
          aria-busy={actions.pending === "choosePack" || undefined}
        >
          Use “{chosen.title}”
        </button>
      ) : null}
      {reloadable ? (
        <div className="host-pack__reload">
          <button
            type="button"
            className="btn"
            disabled={!actions.can("setPack")}
            aria-busy={actions.pending === "choosePack" || undefined}
            aria-describedby={`${id}-reload`}
            onClick={() => actions.run({ type: "choosePack", packId: reloadable.id })}
          >
            Reload this pack
          </button>
          <span id={`${id}-reload`} className="field__hint">
            Picks up your latest edits. This resets the settings to the pack&apos;s defaults.
          </span>
        </div>
      ) : null}
    </form>
  );
}
