"use client";

import { useEffect, useState } from "react";
import { claimDisplay, errorMessage } from "@/features/network/client/api";
import { useRoomConnection } from "@/features/network/client/use-room-connection";
import { Lockup } from "@/features/ui/brand";
import { useOrigin } from "@/features/ui/use-origin";
import { DisplayScreen } from "./display-screen";

/** Reads `key` from a `#key=…` fragment. */
export function readDisplayKey(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const key = params.get("key");
  return key && key.trim() ? key.trim() : null;
}

// One claim per key, even if React runs the effect twice in development.
const claims = new Map<string, Promise<void>>();

/**
 * The TV route. If the URL has `#key=…`, claim the display grant first,
 * then remove the key from the address bar (history.replaceState) so it
 * isn't left on screen or in history, and only then connect.
 * Without a key it connects with any grant cookie it already has.
 */
export function DisplayRoute({ code }: { code: string }) {
  const [state, setState] = useState<{ status: "claiming" | "ready" | "error"; message?: string }>({
    status: "claiming",
  });

  // A new link pasted into this tab differs only by its #fragment, so the
  // browser doesn't load it. Reloading runs the claim below with the new key.
  useEffect(() => {
    const onHashChange = () => {
      if (readDisplayKey(window.location.hash)) window.location.reload();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const key = readDisplayKey(window.location.hash);
    const claim = key ? (claims.get(key) ?? claimDisplay({ code, key })) : Promise.resolve();
    if (key) claims.set(key, claim);

    const stripKey = () => {
      if (key && window.location.hash) {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
      }
    };
    claim.then(
      () => {
        stripKey();
        if (!cancelled) setState({ status: "ready" });
      },
      (error: unknown) => {
        stripKey();
        if (!cancelled) setState({ status: "error", message: errorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state.status === "error") {
    return (
      <main id="main-content" className="tv tv--notice">
        <Lockup className="tv-notice__lockup" />
        <span className="stamp stamp--warn tv-stamp">Display link didn&apos;t work</span>
        <h1>Ask the host for a new display link</h1>
        <p>{state.message} Display links stop working when the host makes a new one.</p>
      </main>
    );
  }

  if (state.status === "claiming") {
    return (
      <main id="main-content" className="tv tv--notice">
        <Lockup className="tv-notice__lockup" />
        <h1>
          Setting up the big screen
          <span className="loading-dots" />
        </h1>
      </main>
    );
  }

  return <DisplayLive code={code} />;
}

function DisplayLive({ code }: { code: string }) {
  const connection = useRoomConnection({ code, role: "display" });
  const origin = useOrigin();
  return <DisplayScreen connection={connection} joinUrl={`${origin}/r/${code}`} />;
}
