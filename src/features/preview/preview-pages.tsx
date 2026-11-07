"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Lockup } from "@/features/ui/brand";
import { PREVIEWS, findPreview, type PreviewEntry } from "./registry";

const noop = () => () => {};

/** Previews render only in the browser, so random ids and clocks never mismatch the server HTML. */
function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const SIZES: Record<PreviewEntry["viewport"], string> = {
  phone: "390×844",
  laptop: "1366×768",
  tv: "1920×1080",
};

export function PreviewIndex() {
  const groups = ["Home", "Player", "Host", "Display", "Packs"] as const;
  return (
    <>
      <header className="topbar">
        <Lockup href="/" />
        <div className="topbar__mid">
          <span className="stamp stamp--dashed">Dev only · mock data</span>
        </div>
      </header>
      <main id="main-content" className="page preview-index">
        <h1 className="marker">Screen gallery</h1>
        <p className="muted">
          Every screen and state, rendered from typed fixture views with a mock connection. Commands
          are logged to the console.
        </p>
        {groups.map((group) => (
          <section key={group} aria-labelledby={`g-${group}`} className="stack stack--tight">
            <h2 id={`g-${group}`}>{group}</h2>
            <ul className="preview-list">
              {PREVIEWS.filter((p) => p.group === group).map((p) => (
                <li key={p.id}>
                  <Link href={`/preview/${p.id}`}>{p.title}</Link>
                  <span className="muted"> · {SIZES[p.viewport]}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}

export function PreviewFrame({ id }: { id: string }) {
  const mounted = useMounted();
  const entry = findPreview(id);
  if (!entry) {
    return (
      <main id="main-content" className="notice">
        <h1>No preview called “{id}”</h1>
        <Link href="/preview">All previews</Link>
      </main>
    );
  }
  return mounted ? <>{entry.render()}</> : null;
}
