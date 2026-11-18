"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { GameSettings } from "@/features/engine/contract";
import type { PackSummary } from "@/features/network/protocol";
import "./lobby-settings.css";

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

type GameFormat = Pick<GameSettings, "rounds" | "categoriesPerRound" | "finalRound">;

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
export function SettingsEditor({
  formId,
  onDirtyChange,
  settings,
  pack,
  disabled,
  busy,
  onSave,
  hideActions = false,
  onFormatChange,
  onInvalid,
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
  hideActions?: boolean;
  onFormatChange?: (format: GameFormat) => void;
  /** Reveal a collapsed form before the first invalid field receives focus. */
  onInvalid?: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<Partial<Record<SecondsKey, string>>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings));

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const { rounds, categoriesPerRound, finalRound } = draft;
  useEffect(() => {
    onFormatChange?.({ rounds, categoriesPerRound, finalRound });
  }, [rounds, categoriesPerRound, finalRound, onFormatChange]);
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
    if (disabled || busy) return;
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
      onInvalid?.();
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

      {!hideActions ? (
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
      ) : null}
    </form>
  );
}
