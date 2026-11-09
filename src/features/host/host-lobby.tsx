"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  MAX_PLAYERS,
  type GameSettings,
  type HostView,
  type PlayerId,
} from "@/features/engine/contract";
import type { PackSummary } from "@/features/network/protocol";
import { ConfirmDialog } from "@/features/ui/dialog";
import { plural } from "@/features/ui/format";
import { QrCode } from "@/features/ui/qr-code";
import { CopyField } from "@/features/ui/copy-field";
import type { HostActions } from "./host-screen";
import { DisplayLinkPanel } from "./display-link";
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
  const canStart = actions.can("startGame") && !settingsDirty;
  const blocked = settingsDirty || view.startBlockers.length > 0;
  const anySlowPing = view.players.some(
    (player) => player.connected && pingStatus(pings[player.id] ?? null).kind === "slow",
  );

  return (
    <>
      <div className="host-lobby">
        <section className="panel host-lobby__players" aria-labelledby="lobby-players">
          <div className="panel__title">
            <h2 id="lobby-players">Players</h2>
            <span className="eyebrow num">
              {view.players.length} of {MAX_PLAYERS}
            </span>
          </div>
          {view.players.length === 0 ? (
            <p className="muted">Nobody yet. Share the room code and they&apos;ll pop in here.</p>
          ) : (
            <ul className="host-roster">
              {view.players.map((player) => (
                <li key={player.id}>
                  <span className="name">{player.name}</span>
                  {!player.connected ? <span className="host-away">away</span> : null}
                  <PingChip ms={pings[player.id]} connected={player.connected} />
                  <button
                    type="button"
                    className="btn btn--small"
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
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              Waiting for a seat: {view.waitingPlayers.map((w) => w.name).join(", ")}
            </p>
          ) : null}
        </section>

        <section className="panel host-lobby__invite" aria-labelledby="lobby-invite">
          <div className="panel__title">
            <h2 id="lobby-invite">Invite players</h2>
          </div>
          <div className="host-invite">
            <div className="host-invite__code">
              <span className="eyebrow">Room code</span>
              <strong className="room-code host-invite__letters">{view.roomCode}</strong>
              <p className="muted">
                Players sign in with HAM, then scan the code or enter it on the home page.
              </p>
            </div>
            <QrCode
              value={joinUrl}
              label={`QR code to join room ${view.roomCode}`}
              className="host-invite__qr"
            />
          </div>
          <CopyField value={joinUrl} label="Join link" />
        </section>

        <section className="panel host-lobby__display" aria-labelledby="lobby-display">
          <div className="panel__title">
            <h2 id="lobby-display">Big screen</h2>
          </div>
          <DisplayLinkPanel onCreate={onCreateDisplayLink} link={displayLink} />
        </section>

        <section className="panel host-lobby__setup" aria-labelledby="lobby-setup">
          <div className="panel__title">
            <h2 id="lobby-setup">Pack &amp; settings</h2>
          </div>
          <PackChooser view={view} packs={packs} actions={actions} />
          <SettingsEditor
            key={JSON.stringify(view.settings) + (view.pack?.id ?? "")}
            formId={settingsFormId}
            onDirtyChange={setSettingsDirty}
            settings={view.settings}
            pack={packs.find((p) => p.id === view.pack?.id) ?? null}
            disabled={!actions.can("updateSettings")}
            busy={actions.pending === "updateSettings"}
            onSave={(patch) => actions.run({ type: "updateSettings", patch })}
          />
        </section>
      </div>

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
            <span className="stamp stamp--good stamp--flat">Ready</span>{" "}
            {plural(view.players.length, "player")} in. Start when everyone can see the big screen.
          </p>
        )}
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={!canStart}
          aria-busy={actions.pending === "startGame" || undefined}
          onClick={() => actions.run({ type: "startGame" })}
        >
          Start game
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

type Draft = {
  rounds: 1 | 2;
  categoriesPerRound: number;
  wager1: number;
  wager2: number;
  finalRound: boolean;
  fairBuzzing: boolean;
  falseStartLockout: boolean;
  timersEnabled: boolean;
  buzzS: string;
  answerS: string;
  finalS: string;
};

function toDraft(s: GameSettings): Draft {
  return {
    rounds: s.rounds,
    categoriesPerRound: s.categoriesPerRound,
    wager1: s.wagerClues[0],
    wager2: s.wagerClues[1],
    finalRound: s.finalRound,
    fairBuzzing: s.fairBuzzing,
    falseStartLockout: s.falseStartLockout,
    timersEnabled: s.timers.enabled,
    buzzS: String(Math.round(s.timers.buzzWindowMs / 1000)),
    answerS: String(Math.round(s.timers.answerWindowMs / 1000)),
    finalS: String(Math.round(s.timers.finalAnswerMs / 1000)),
  };
}

const SECONDS = {
  buzzS: { min: 3, max: 60, label: "Buzz window" },
  answerS: { min: 3, max: 60, label: "Answer time" },
  finalS: { min: 10, max: 180, label: "Final answer time" },
} as const;
type SecondsKey = keyof typeof SECONDS;
const SECONDS_KEYS = Object.keys(SECONDS) as SecondsKey[];

/** The two buzz rules (docs/RULES.md, "Fair buzzing"), each with a plain explanation. */
const BUZZ_OPTIONS = [
  {
    key: "fairBuzzing",
    label: "Fair buzzing",
    hint: "Evens out phone lag: buzzers light up together and the fastest reaction wins, not the fastest connection.",
  },
  {
    key: "falseStartLockout",
    label: "False-start lockout",
    hint: "Tapping before your buzzer lights locks you out for a quarter of a second.",
  },
] as const satisfies readonly { key: keyof Draft; label: string; hint: string }[];

function maxCategoriesPerRound(rounds: number, pack: PackSummary | null): number {
  return Math.max(1, Math.min(6, pack ? Math.floor(pack.categories / rounds) : 6));
}

function maxWagerClues(categoriesPerRound: number, pack: PackSummary | null): number {
  return Math.min(3, pack ? categoriesPerRound * pack.cluesPerCategory : 3);
}

/** Shrinks the category and wager counts to what the board's shape can hold. */
function fitBoard(draft: Draft, pack: PackSummary | null): Draft {
  const categoriesPerRound = Math.min(
    draft.categoriesPerRound,
    maxCategoriesPerRound(draft.rounds, pack),
  );
  const maxWagers = maxWagerClues(categoriesPerRound, pack);
  return {
    ...draft,
    categoriesPerRound,
    wager1: Math.min(draft.wager1, maxWagers),
    wager2: Math.min(draft.wager2, maxWagers),
  };
}

/** 0, 1, … up to and including `last`. */
function countTo(last: number): number[] {
  return Array.from({ length: last + 1 }, (_, i) => i);
}

function validSeconds(key: SecondsKey, value: string): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= SECONDS[key].min && n <= SECONDS[key].max;
}

/**
 * Lobby settings within the bounds in docs/RULES.md. The inputs limit the
 * obvious ranges; the server validates the patch and explains any rejection.
 */
function SettingsEditor({
  formId,
  onDirtyChange,
  settings,
  pack,
  disabled,
  busy,
  onSave,
}: {
  /** Lets the start bar's "Save changes" button submit this form. */
  formId: string;
  /** Tells the lobby whether there are unsaved changes. */
  onDirtyChange: (dirty: boolean) => void;
  settings: GameSettings;
  /** The list entry for the pack in use; null until the list has it. */
  pack: PackSummary | null;
  disabled: boolean;
  busy: boolean;
  onSave: (patch: Partial<GameSettings>) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<Partial<Record<SecondsKey, string>>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings));

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  // fitBoard keeps the draft within these limits. A draft can only start above
  // them when the pack was edited after the room loaded it, and the selects
  // still include that saved value so they don't show the wrong number.
  const categoryChoices = countTo(
    Math.max(maxCategoriesPerRound(draft.rounds, pack), draft.categoriesPerRound),
  ).slice(1);
  const wagerChoices = countTo(
    Math.max(maxWagerClues(draft.categoriesPerRound, pack), draft.wager1, draft.wager2),
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setBoard(patch: Partial<Pick<Draft, "rounds" | "categoriesPerRound">>) {
    setDraft((d) => fitBoard({ ...d, ...patch }, pack));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    // With timers off the fields are hidden, so they aren't checked; an
    // invalid hidden value keeps its saved setting instead (see `ms` below).
    if (draft.timersEnabled) {
      for (const key of SECONDS_KEYS) {
        if (!validSeconds(key, draft[key]))
          nextErrors[key] = `Use ${SECONDS[key].min}–${SECONDS[key].max} seconds.`;
      }
    }
    setErrors(nextErrors);
    const firstInvalid = SECONDS_KEYS.find((key) => nextErrors[key]);
    if (firstInvalid) {
      // The save may have come from the start bar, far from the field.
      document.getElementById(`${id}-${firstInvalid}`)?.focus();
      return;
    }
    const ms = (key: SecondsKey, savedMs: number) =>
      validSeconds(key, draft[key]) ? Number(draft[key]) * 1000 : savedMs;
    onSave({
      rounds: draft.rounds,
      categoriesPerRound: draft.categoriesPerRound,
      wagerClues: [draft.wager1, draft.wager2],
      finalRound: draft.finalRound,
      fairBuzzing: draft.fairBuzzing,
      falseStartLockout: draft.falseStartLockout,
      timers: {
        enabled: draft.timersEnabled,
        buzzWindowMs: ms("buzzS", settings.timers.buzzWindowMs),
        answerWindowMs: ms("answerS", settings.timers.answerWindowMs),
        finalAnswerMs: ms("finalS", settings.timers.finalAnswerMs),
      },
    });
  }

  return (
    <form
      id={formId}
      className="host-settings"
      onSubmit={submit}
      aria-label="Game settings"
      noValidate
    >
      <fieldset className="host-settings__group" disabled={disabled}>
        <legend className="field__label">Rounds</legend>
        <div className="segmented" role="group" aria-label="Rounds">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={draft.rounds === n}
              disabled={n === 2 && pack !== null && pack.categories < 2}
              onClick={() => setBoard({ rounds: n })}
            >
              {n === 1 ? "1 round" : "2 rounds"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="host-settings__grid">
        <div className="field">
          <label className="field__label" htmlFor={`${id}-cats`}>
            Categories per round
          </label>
          <select
            id={`${id}-cats`}
            className="input"
            value={draft.categoriesPerRound}
            disabled={disabled}
            onChange={(event) => setBoard({ categoriesPerRound: Number(event.target.value) })}
          >
            {categoryChoices.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-w1`}>
            Wager clues, round 1
          </label>
          <select
            id={`${id}-w1`}
            className="input"
            value={draft.wager1}
            disabled={disabled}
            onChange={(event) => set("wager1", Number(event.target.value))}
          >
            {wagerChoices.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-w2`}>
            Wager clues, round 2
          </label>
          <select
            id={`${id}-w2`}
            className="input"
            value={draft.wager2}
            disabled={disabled || draft.rounds === 1}
            onChange={(event) => set("wager2", Number(event.target.value))}
          >
            {wagerChoices.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="host-settings__group" disabled={disabled}>
        <legend className="field__label">Buzzing</legend>
        <div className="host-options">
          {BUZZ_OPTIONS.map((option) => (
            <div className="host-option" key={option.key}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft[option.key]}
                  aria-describedby={`${id}-${option.key}-hint`}
                  onChange={(event) => set(option.key, event.target.checked)}
                />
                {option.label}
              </label>
              <p id={`${id}-${option.key}-hint`} className="field__hint">
                {option.hint}
              </p>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="row">
        <label className="check">
          <input
            type="checkbox"
            checked={draft.finalRound}
            disabled={disabled}
            onChange={(event) => set("finalRound", event.target.checked)}
          />
          Final round
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.timersEnabled}
            disabled={disabled}
            onChange={(event) => set("timersEnabled", event.target.checked)}
          />
          Timers
        </label>
      </div>

      {draft.timersEnabled ? (
        <div className="host-settings__grid">
          {SECONDS_KEYS.map((key) => (
            <div className="field" key={key}>
              <label className="field__label" htmlFor={`${id}-${key}`}>
                {SECONDS[key].label} (s)
              </label>
              <input
                id={`${id}-${key}`}
                className="input num"
                inputMode="numeric"
                value={draft[key]}
                disabled={disabled}
                aria-invalid={errors[key] ? true : undefined}
                aria-describedby={`${id}-${key}-hint`}
                onChange={(event) => set(key, event.target.value.replace(/[^0-9]/g, ""))}
              />
              <span
                id={`${id}-${key}-hint`}
                className={errors[key] ? "field__error" : "field__hint"}
              >
                {errors[key] ?? `${SECONDS[key].min}–${SECONDS[key].max} seconds`}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="row">
        <button
          type="submit"
          className="btn"
          disabled={disabled || !dirty}
          aria-busy={busy || undefined}
        >
          Save settings
        </button>
        {dirty ? (
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => setDraft(toDraft(settings))}
          >
            Undo changes
          </button>
        ) : (
          <span className="field__hint">Saved</span>
        )}
      </div>
    </form>
  );
}
