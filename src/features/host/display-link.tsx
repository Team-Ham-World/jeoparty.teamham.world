"use client";

import { useState } from "react";
import { CopyField } from "@/features/ui/copy-field";
import { QrCode } from "@/features/ui/qr-code";

/**
 * Makes a fresh TV link (POST /api/rooms/:code/display-link). The key lives
 * in the link's #fragment; making a new link disconnects older displays.
 */
export function DisplayLinkPanel({ onCreate }: { onCreate: () => Promise<string> }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; url?: string; message?: string }>({ status: "idle" });

  async function create() {
    setState({ status: "loading" });
    try {
      const url = await onCreate();
      setState({ status: "ready", url });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Couldn't make a display link." });
    }
  }

  return (
    <div className="stack">
      <p className="muted">Open the board on a TV or projector. The link works without signing in, so only share it with the screen.</p>
      {state.status === "ready" && state.url ? (
        <div className="host-display-link">
          <QrCode value={state.url} label="QR code for the display link" className="host-display-link__qr" />
          <div className="stack stack--tight">
            <CopyField value={state.url} label="Display link" />
            <div className="row">
              <a className="btn btn--small" href={state.url} target="_blank" rel="noopener">
                Open on this device
              </a>
              <button type="button" className="btn btn--quiet btn--small" onClick={create}>
                Make a new link
              </button>
            </div>
            <p className="field__hint">Making a new link disconnects screens using the old one.</p>
          </div>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={create} aria-busy={state.status === "loading" || undefined} disabled={state.status === "loading"}>
            {state.status === "loading" ? "Making link…" : "Get display link"}
          </button>
        </div>
      )}
      {state.status === "error" ? (
        <p className="field__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
