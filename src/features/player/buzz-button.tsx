"use client";

import { useState, type PointerEvent, type MouseEvent } from "react";
import type { ClueView, PlayerView } from "@/features/engine/contract";
import type { CommandOutcome } from "@/features/network/connection";
import type { ClientCommand } from "@/features/network/protocol";
import { nameOf } from "@/features/ui/format";
import { vibrate } from "@/features/ui/haptics";
import { useBuzzerTiming } from "./use-buzzer-timing";
import type { RunOptions } from "@/features/ui/use-command";

/** What the big button says and why, from the view alone. */
export function buzzCopy(
  view: PlayerView,
  clue: ClueView,
  stale: boolean,
): { label: string; help: string } {
  if (stale) return { label: "Offline", help: "Reconnecting. Buzzing is off until we catch up." };
  if (view.paused) return { label: "Paused", help: "The game is paused." };
  if (view.can.buzz)
    return {
      label: "Buzz!",
      help: view.buzzing.fairBuzzing
        ? "Fastest reaction wins."
        : "First buzz the server gets wins.",
    };
  if (clue.lockedOutPlayerIds.includes(view.me.id))
    return { label: "Locked", help: "You already had a go at this clue." };
  switch (clue.stage) {
    case "reading":
      return { label: "Wait", help: "Buzzers open when the host finishes reading." };
    case "open":
      return { label: "Wait", help: "You can't buzz on this clue." };
    case "answering":
      return {
        label: "Hold",
        help: `${nameOf(view.players, clue.answeringPlayerId)} got there first.`,
      };
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
  clockOffsetMs = 0,
}: {
  view: PlayerView;
  clue: ClueView;
  stale: boolean;
  clockOffsetMs?: number;
  run: (cmd: ClientCommand, options?: RunOptions) => Promise<CommandOutcome | null>;
}) {
  const [sentFor, setSentFor] = useState<string | null>(null);
  const timing = useBuzzerTiming({
    opensAt: clue.opensAt,
    active: clue.stage === "open" && !view.paused && !stale,
    clockOffsetMs,
    fairBuzzing: view.buzzing.fairBuzzing,
    lockoutEnabled: view.buzzing.falseStartLockout,
    clueId: clue.clueId,
  });
  const visiblyLit = view.can.buzz && !stale && timing.lit;
  const enabled = visiblyLit && !timing.lockedOut;
  const openingKey = `${clue.clueId}:${clue.opensAt}`;
  const sent = sentFor === openingKey && clue.stage === "open";
  const copy =
    stale || view.paused
      ? buzzCopy(view, clue, stale)
      : timing.lockedOut
        ? { label: "Too early!", help: "Wait 250 ms after the light." }
        : view.can.buzz && !timing.lit
          ? { label: "Wait", help: "Buzzers are about to open." }
          : buzzCopy(view, clue, stale);

  function buzz() {
    if (!enabled || sent) return;
    setSentFor(openingKey);
    vibrate(35);
    // Losing the race is normal: the button already says who got there first, so no error toast.
    void run(
      {
        type: "buzz",
        clueId: clue.clueId,
        reactionMs: timing.reactionMs(),
        falseStart: timing.falseStart,
      },
      { quiet: ["buzzersClosed", "alreadyAttempted"] },
    ).then((outcome) => {
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
    <div
      className="buzz-zone"
      onPointerDownCapture={() => {
        if (!stale && !view.paused) timing.recordEarlyTap();
      }}
    >
      {/* The base under the live button; it glows while buzzing is open. Decoration only. */}
      {visiblyLit ? (
        <span className={`buzz-halo ${sent ? "buzz-halo--still" : ""}`} aria-hidden="true" />
      ) : null}
      <button
        type="button"
        className={`buzz ${visiblyLit ? "buzz--live" : ""} ${sent ? "buzz--sent" : ""}`}
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
