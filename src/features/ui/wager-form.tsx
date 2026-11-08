"use client";

import { useId, useState, type FormEvent } from "react";
import { formatScore } from "./format";

/**
 * Whole-number wager entry inside bounds the server gave us. Used by players
 * (wager clue, final round) and by the host entering a wager for a player.
 * The bounds come from the view; the server still has the final say.
 */
export function WagerForm({
  min,
  max,
  initial,
  disabled,
  busy,
  submitLabel,
  label = "Your wager",
  onSubmit,
}: {
  min: number;
  max: number;
  initial?: number | null;
  disabled: boolean;
  busy?: boolean;
  submitLabel: string;
  label?: string;
  onSubmit: (amount: number) => void;
}) {
  const id = useId();
  const [text, setText] = useState(initial != null ? String(initial) : "");
  const [error, setError] = useState<string | null>(null);
  const range = `${formatScore(min)} to ${formatScore(max)}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(text.trim());
    if (text.trim() === "" || !Number.isInteger(amount) || amount < min || amount > max) {
      setError(`Enter a whole number from ${range}.`);
      return;
    }
    setError(null);
    onSubmit(amount);
  }

  // Every quick amount says its number, so nobody does maths on the clock.
  const half = Math.max(min, Math.floor(max / 2));
  const quick = [
    { label: `Min ${formatScore(min)}`, value: min },
    { label: `Half ${formatScore(half)}`, value: half },
    { label: `All in ${formatScore(max)}`, value: max },
  ].filter((choice, index, all) => all.findIndex((c) => c.value === choice.value) === index);

  return (
    <form className="wager-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-amount`}>
          {label}
        </label>
        <input
          id={`${id}-amount`}
          className="input input--wager num"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^0-9]/g, ""))}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint ${error ? `${id}-error` : ""}`}
        />
        <span id={`${id}-hint`} className="field__hint">
          {range}
        </span>
        {error ? (
          <span id={`${id}-error`} className="field__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
      <div className="row wager-form__quick" role="group" aria-label="Quick amounts">
        {quick.map((choice) => (
          <button
            key={choice.label}
            type="button"
            className="btn btn--small"
            disabled={disabled}
            onClick={() => {
              setText(String(choice.value));
              setError(null);
            }}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        className="btn btn--primary btn--big btn--block"
        disabled={disabled}
        aria-busy={busy || undefined}
      >
        {submitLabel}
      </button>
    </form>
  );
}
