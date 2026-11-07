"use client";

import { useId, useState, type FormEvent } from "react";
import { MAX_FINAL_ANSWER_LENGTH } from "@/features/engine/contract";

/** Typed final-round answer. Editable until the host locks answers. */
export function FinalAnswerForm({
  submitted,
  disabled,
  busy,
  onSubmit,
}: {
  submitted: string | null;
  disabled: boolean;
  busy: boolean;
  onSubmit: (text: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(submitted ?? "");
  const dirty = draft.trim() !== (submitted ?? "").trim();
  const left = MAX_FINAL_ANSWER_LENGTH - draft.length;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSubmit(draft.trim());
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
      {submitted !== null ? (
        <p className="final-status" role="status">
          <span className="stamp stamp--good stamp--flat">Submitted</span>
          <span>{dirty ? "You have unsaved changes." : "You can still change it until answers lock."}</span>
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
