"use client";

import { useRef, useState } from "react";
import { CopyField } from "@/features/ui/copy-field";
import { QrCode } from "@/features/ui/qr-code";

/**
 * Makes a fresh TV link (POST /api/rooms/:code/display-link). The key lives
 * in the link's #fragment; making a new link disconnects older displays.
 *
 * `link` is the newest link the host page remembers. `confirmFirst` asks for a
 * second click before replacing a link, for when a game is on the TV.
 */
export function DisplayLinkPanel({
  onCreate,
  link = null,
  confirmFirst = false,
}: {
  onCreate: () => Promise<string>;
  link?: string | null;
  confirmFirst?: boolean;
}) {
  const [state, setState] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    url?: string;
    message?: string;
  }>({ status: "idle" });
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Hidden while a new link is being made: the old one is about to stop working.
  const url = state.status === "loading" ? null : (state.url ?? link);

  async function create() {
    setConfirming(false);
    setState({ status: "loading" });
    try {
      const created = await onCreate();
      setState({ status: "ready", url: created });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Couldn't make a display link.",
      });
    }
  }

  function request() {
    if (confirmFirst) setConfirming(true);
    else void create();
  }

  function cancel() {
    setConfirming(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="stack">
      <p className="muted">
        Open the board on a TV or projector. The link works without signing in, so only share it
        with the screen.
      </p>
      {url ? (
        <div className="host-display-link">
          <QrCode
            value={url}
            label="QR code for the display link"
            className="host-display-link__qr"
          />
          <div className="stack stack--tight">
            <CopyField value={url} label="Display link" />
            <div className="row">
              <a className="btn btn--small" href={url} target="_blank" rel="noopener">
                Open on this device
              </a>
              <button
                ref={triggerRef}
                type="button"
                className="btn btn--quiet btn--small"
                onClick={request}
              >
                Make a new link
              </button>
            </div>
            <p className="field__hint">Making a new link disconnects screens using the old one.</p>
          </div>
        </div>
      ) : (
        <>
          <p>
            <strong>Already on a screen?</strong> A new link disconnects any screen using the old
            one.
          </p>
          <div className="row">
            <button
              ref={triggerRef}
              type="button"
              className="btn btn--primary"
              onClick={request}
              aria-busy={state.status === "loading" || undefined}
              disabled={state.status === "loading"}
            >
              {state.status === "loading" ? "Making link…" : "Get display link"}
            </button>
          </div>
        </>
      )}
      {confirming ? (
        <div className="stack stack--tight">
          <p role="alert">
            <strong>Replace the TV link now?</strong> A screen showing the game drops off until you
            open the new link on it.
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={cancel} autoFocus>
              Cancel
            </button>
            <button type="button" className="btn btn--bad" onClick={() => void create()}>
              Yes, make a new link
            </button>
          </div>
        </div>
      ) : null}
      {state.status === "error" ? (
        <p className="field__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
