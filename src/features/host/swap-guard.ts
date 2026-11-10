"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { HostView } from "@/features/engine/contract";

/*
  When a host command is accepted, the buttons in the main area are swapped for
  the next step's buttons in the same place. Without a guard, the second click
  of a double click lands on a different action, such as "Reveal answer" where
  "Incorrect" was. So for a moment after the step changes, the main area
  ignores clicks.
*/

/** How long the main area ignores clicks after its buttons change. */
export const SWAP_GUARD_MS = 400;

/** Names the step the host's main area is showing. It changes exactly when the buttons there change. */
export function hostStepKey(view: HostView | null): string {
  if (!view) return "";
  const { clue, final } = view;
  const status =
    final?.responses.find((response) => response.playerId === final.nextResponderId)?.status ?? "";
  return [
    view.phase,
    view.round?.index ?? "",
    view.paused ? "paused" : "live",
    clue ? `${clue.clueId}:${clue.stage}` : "",
    final ? `${final.stage}:${final.nextResponderId ?? ""}:${status}` : "",
  ].join("|");
}

/** True once `key` has stayed the same for `ms`. A component's first render counts as settled. */
export function useSettled(key: string, ms: number): boolean {
  const [settledKey, setSettledKey] = useState(key);
  useEffect(() => {
    if (settledKey === key) return;
    const timer = setTimeout(() => setSettledKey(key), ms);
    return () => clearTimeout(timer);
  }, [key, settledKey, ms]);
  return settledKey === key;
}

function ignoreClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Props for the area to protect. Until it has settled, pointer clicks pass
 * through it, and the click a browser makes for Enter or Space on a focused
 * button is dropped. Typing, focus and the single-letter shortcuts still work.
 */
export function swapGuardProps(settled: boolean) {
  return settled ? {} : { style: { pointerEvents: "none" as const }, onClickCapture: ignoreClick };
}
