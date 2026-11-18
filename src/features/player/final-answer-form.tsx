"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent } from "react";
import { MAX_FINAL_ANSWER_LENGTH } from "@/features/engine/contract";

const AUTOSAVE_INTERVAL_MS = 700;
const LAST_EDITS_WINDOW_MS = 200;
const LAST_EDITS_INTERVAL_MS = 50;

/** Typed final-round answer. Editable until the host locks answers. */
export function FinalAnswerForm({
  submitted,
  revision,
  disabled,
  busy,
  autosaveUntil,
  onSubmit,
}: {
  submitted: string | null;
  revision: number;
  disabled: boolean;
  busy: boolean;
  /** The local-clock deadline, provided only during the autosave window. */
  autosaveUntil: number | null;
  onSubmit: (text: string, auto: boolean) => Promise<number | null>;
}) {
  const id = useId();
  const [accepted, setAccepted] = useState<{ revision: number; text: string } | null>(null);
  // The acknowledgement can arrive before the corresponding room view.
  const saved = accepted && accepted.revision > revision ? accepted.text : submitted;
  const [answer, setAnswer] = useState({ saved, accepted, draft: saved ?? "", edited: false });
  const { draft } = answer;
  const text = draft.trim();
  const savedText = (saved ?? "").trim();
  if (answer.saved !== saved || answer.accepted !== accepted) {
    const matchesSaved = text === savedText;
    const justAccepted = answer.accepted !== accepted && text === accepted?.text;
    const edited = answer.edited && !matchesSaved && !justAccepted;
    setAnswer({
      saved,
      accepted,
      draft: edited || matchesSaved ? draft : (saved ?? ""),
      edited,
    });
  }
  const dirty = answer.edited && text !== savedText;
  const left = MAX_FINAL_ANSWER_LENGTH - draft.length;
  const lastSentAt = useRef(-Infinity);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const sending = busy || pendingText !== null;

  function send(auto: boolean) {
    if (disabled || sending || !dirty || !text) return;
    lastSentAt.current = Date.now();
    setPendingText(text);
    void onSubmit(text, auto).then((revision) => {
      if (revision !== null) setAccepted({ revision, text });
      setPendingText(null);
    });
  }

  const unsaved = dirty && text !== "";
  const autosaving = !disabled && !sending && unsaved;
  const sendAutomatically = useEffectEvent(() => {
    if (autosaveUntil !== null && Date.now() < autosaveUntil) send(true);
  });
  useEffect(() => {
    if (!autosaving || autosaveUntil === null) return;
    // Reserve the last 200 ms for up to four closer-spaced updates as someone finishes typing.
    const last = lastSentAt.current;
    const finalWindow = autosaveUntil - LAST_EDITS_WINDOW_MS;
    const sendAt =
      last < finalWindow
        ? Math.min(last + AUTOSAVE_INTERVAL_MS, finalWindow)
        : Math.min(last + LAST_EDITS_INTERVAL_MS, autosaveUntil - 1);
    const now = Date.now();
    if (sendAt >= autosaveUntil || now >= autosaveUntil) return;
    if (sendAt <= now) {
      sendAutomatically();
      return;
    }
    const timer = setTimeout(sendAutomatically, sendAt - now);
    return () => clearTimeout(timer);
  }, [autosaving, autosaveUntil, text]);

  function submit(event: FormEvent) {
    event.preventDefault();
    send(false);
  }

  return (
    <form className="stack stack--tight pl-answer-form" onSubmit={submit}>
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
          onChange={(event) => {
            const draft = event.target.value;
            const text = draft.trim();
            setAnswer({
              ...answer,
              draft,
              edited: text !== savedText || (pendingText !== null && text !== pendingText),
            });
          }}
          disabled={disabled}
          placeholder="What is…"
          aria-describedby={`${id}-count`}
        />
        <span id={`${id}-count`} className="field__hint num" aria-live="polite">
          {left} characters left
        </span>
      </div>
      {autosaveUntil !== null && !disabled && unsaved ? (
        <p className="final-status" role="status">
          Time is almost up. Saving what you typed.
        </p>
      ) : saved !== null ? (
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
        disabled={disabled || sending || !unsaved}
        aria-busy={sending || undefined}
      >
        {saved === null ? "Submit answer" : "Update answer"}
      </button>
    </form>
  );
}
