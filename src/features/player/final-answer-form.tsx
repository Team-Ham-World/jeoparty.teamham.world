"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MAX_FINAL_ANSWER_LENGTH } from "@/features/engine/contract";

// Limit automatic sends to about one every 0.7 seconds.
const AUTOSAVE_DELAY_MS = 700;

/** Typed final-round answer. Editable until the host locks answers. */
export function FinalAnswerForm({
  submitted,
  disabled,
  busy,
  autosave,
  onSubmit,
}: {
  submitted: string | null;
  disabled: boolean;
  busy: boolean;
  /** True in the last seconds before answers lock; typed text is then sent without pressing the button. */
  autosave: boolean;
  onSubmit: (text: string, auto: boolean) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(submitted ?? "");
  const dirty = draft.trim() !== (submitted ?? "").trim();
  const left = MAX_FINAL_ANSWER_LENGTH - draft.length;
  const latest = useRef({ draft, onSubmit });
  useEffect(() => {
    latest.current = { draft, onSubmit };
  });

  const unsaved = dirty && draft.trim() !== "";
  const autosaving = autosave && !disabled && !busy && unsaved;
  // Typing must not restart the delay, so this effect depends only on autosaving.
  useEffect(() => {
    if (!autosaving) return;
    const timer = setTimeout(() => {
      const text = latest.current.draft.trim();
      if (text) latest.current.onSubmit(text, true);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autosaving]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSubmit(draft.trim(), false);
  }

  return (
    <form className="stack stack--tight" onSubmit={submit}>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-answer`}>
          Your answer
        </label>
        <textarea
          id={`${id}-answer`}
          className="input"
          maxLength={MAX_FINAL_ANSWER_LENGTH}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
          placeholder="What is…"
          aria-describedby={`${id}-count`}
        />
        <span id={`${id}-count`} className="field__hint num" aria-live="polite">
          {left} characters left
        </span>
      </div>
      {autosave && unsaved ? (
        <p className="final-status" role="status">
          Time is almost up. Saving what you typed.
        </p>
      ) : submitted !== null ? (
        <p className="final-status" role="status">
          <span className="stamp stamp--good stamp--flat">Submitted</span>
          <span>
            {dirty ? "You have unsaved changes." : "You can still change it until answers lock."}
          </span>
        </p>
      ) : null}
      <button
        type="submit"
        className="btn btn--primary btn--big btn--block"
        disabled={disabled || !draft.trim() || (submitted !== null && !dirty)}
        aria-busy={busy || undefined}
      >
        {submitted === null ? "Submit answer" : "Update answer"}
      </button>
    </form>
  );
}
