"use client";

import { useId, useRef, useState } from "react";

/** A read-only link with a Copy button. Falls back to selecting the text. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      input.current?.select();
    }
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="copy-field">
        <input ref={input} id={id} className="input" readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="btn" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
