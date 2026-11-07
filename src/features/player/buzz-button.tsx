"use client";

import { useState, type PointerEvent, type MouseEvent } from "react";
import type { ClueView, PlayerView } from "@/features/engine/contract";
import type { CommandOutcome } from "@/features/network/connection";
import type { ClientCommand } from "@/features/network/protocol";
import { vibrate } from "@/features/ui/haptics";

/** What the big button says and why, from the view alone. */
export function buzzCopy(view: PlayerView, clue: ClueView, stale: boolean): { label: string; help: string } {
  if (stale) return { label: "Offline", help: "Reconnecting. Buzzing is off until we catch up." };
  if (view.paused) return { label: "Paused", help: "The game is paused." };
  if (view.can.buzz) return { label: "Buzz!", help: "First buzz the server gets wins." };
  if (clue.lockedOutPlayerIds.includes(view.me.id)) return { label: "Locked", help: "You already had a go at this clue." };
  switch (clue.stage) {
    case "reading":
      return { label: "Wait", help: "Buzzers open when the host finishes reading." };
    case "open":
      return { label: "Wait", help: "You can't buzz on this clue." };
    case "answering":
      return { label: "Hold", help: "Someone else is answering." };
    case "closed":
      return { label: "Closed", help: "No more buzzes on this clue." };
    default:
      return { label: "Closed", help: "Buzzing is closed." };
  }
}

/**
 * The phone buzzer. Fires on pointer-down for the fastest possible send
 * (and on click for keyboards). It only sends when the view says `can.buzz`
 * and the connection is fresh.
 */
export function BuzzButton({
  view,
  clue,
  stale,
  run,
}: {
  view: PlayerView;
  clue: ClueView;
  stale: boolean;
  run: (cmd: ClientCommand) => Promise<CommandOutcome | null>;
}) {
  const [sentFor, setSentFor] = useState<string | null>(null);
  const enabled = view.can.buzz && !stale;
  const sent = sentFor === clue.clueId && clue.stage === "open";
  const copy = buzzCopy(view, clue, stale);

  function buzz() {
    if (!enabled || sent) return;
    setSentFor(clue.clueId);
    vibrate(35);
    void run({ type: "buzz", clueId: clue.clueId }).then((outcome) => {
      if (outcome && !outcome.ok) setSentFor(null);
    });
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    buzz();
  }

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    // Pointer presses were already handled on pointer-down; this covers Enter/Space.
    if (event.detail === 0) buzz();
  }

  return (
    <div className="buzz-zone">
      <button
        type="button"
        className={`buzz ${enabled ? "buzz--live" : ""} ${sent ? "buzz--sent" : ""}`}
        disabled={!enabled}
        aria-disabled={sent || undefined}
        onPointerDown={onPointerDown}
        onClick={onClick}
        aria-describedby="buzz-help"
      >
        <span className="buzz__label">{sent ? "Sent!" : copy.label}</span>
      </button>
      <p id="buzz-help" className="buzz-help">
        {sent ? "Buzz sent. Waiting for the server…" : copy.help}
      </p>
    </div>
  );
}
