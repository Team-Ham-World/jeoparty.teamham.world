"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from "react";
import type { ClueView, PlayerView } from "@/features/engine/contract";
import type { CommandOutcome } from "@/features/network/connection";
import type { ClientCommand } from "@/features/network/protocol";
import { answeringMargin, nameOf } from "@/features/ui/format";
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
    case "answering": {
      const who = nameOf(view.players, clue.answeringPlayerId);
      const margin = answeringMargin(clue);
      return {
        label: "Hold",
        help: margin ? `${who} got there first ${margin}.` : `${who} got there first.`,
      };
    }
    case "closed":
      return { label: "Closed", help: "No more buzzes on this clue." };
    default:
      return { label: "Closed", help: "Buzzing is closed." };
  }
}

/** The false-start lockout: the buzzer lit, but this phone tapped in the second before. */
const TOO_EARLY_COPY = {
  label: "Too early!",
  help: "Locked for a moment: you tapped before it lit.",
} as const;

/** Once the lockout lifts, the button is a normal "Buzz!" and the help says why it was late. */
const AFTER_EARLY_HELP = "Go! You were held back for tapping early.";

/**
 * Previews only: holds the buzzer in a timing state that lasts a moment in
 * play (the 250 ms "Too early!" lockout), so it can be looked at. Play never
 * provides it.
 */
export const PinnedBuzzerTiming = createContext<{
  lit: boolean;
  lockedOut: boolean;
  falseStart: boolean;
} | null>(null);

/** The buzzer is drawn as a circle, so the empty corners of its box don't count as a tap. */
function insideBuzzer(bounds: DOMRect, x: number, y: number) {
  const dx = (x - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
  const dy = (y - (bounds.top + bounds.height / 2)) / (bounds.height / 2);
  return dx * dx + dy * dy <= 1;
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** How to take back the early tap each finger is still holding down. */
  const earlyTapUndo = useRef(new Map<number, () => void>());
  const [sentFor, setSentFor] = useState<string | null>(null);
  const measured = useBuzzerTiming({
    opensAt: clue.opensAt,
    active: clue.stage === "open" && !view.paused && !stale,
    clockOffsetMs,
    fairBuzzing: view.buzzing.fairBuzzing,
    lockoutEnabled: view.buzzing.falseStartLockout,
    clueId: clue.clueId,
  });
  const pinned = useContext(PinnedBuzzerTiming);
  const timing = pinned ? { ...measured, ...pinned } : measured;
  const visiblyLit = view.can.buzz && !stale && !view.paused && timing.lit;
  // Locked for a false start: lit like everyone else's, but not pressable yet.
  const early = visiblyLit && timing.lockedOut;
  const enabled = visiblyLit && !timing.lockedOut;
  const openingKey = `${clue.clueId}:${clue.opensAt}`;
  const sent = sentFor === openingKey && clue.stage === "open";
  const copy =
    stale || view.paused
      ? buzzCopy(view, clue, stale)
      : early
        ? TOO_EARLY_COPY
        : view.can.buzz && !timing.lit
          ? { label: "Wait", help: "Buzzers are about to open." }
          : enabled && timing.falseStart
            ? { label: "Buzz!", help: AFTER_EARLY_HELP }
            : buzzCopy(view, clue, stale);

  // A short double pulse in the hand says "locked" without looking down.
  useEffect(() => {
    if (early && !pinned) vibrate([30, 40, 30]);
  }, [early, pinned]);

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
      if (!outcome?.ok) setSentFor((current) => (current === openingKey ? null : current));
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
      onPointerDownCapture={(event) => {
        earlyTapUndo.current.delete(event.pointerId);
        if (stale || view.paused || event.button !== 0) return;
        // Disabled buttons pass pointer events to the wrapper, including taps outside the button.
        const bounds = buttonRef.current?.getBoundingClientRect();
        if (bounds && insideBuzzer(bounds, event.clientX, event.clientY))
          earlyTapUndo.current.set(event.pointerId, timing.recordEarlyTap());
      }}
      onPointerUpCapture={(event) => earlyTapUndo.current.delete(event.pointerId)}
      // The browser cancels a touch that turns into a scroll, so it was never a tap.
      onPointerCancelCapture={(event) => {
        earlyTapUndo.current.get(event.pointerId)?.();
        earlyTapUndo.current.delete(event.pointerId);
      }}
    >
      {/* The base under the live button; it glows while buzzing is open. Decoration only. */}
      {visiblyLit ? (
        <span
          className={`buzz-halo ${sent || early ? "buzz-halo--still" : ""}`}
          aria-hidden="true"
        />
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className={`buzz ${early ? "buzz--early" : visiblyLit ? "buzz--live" : ""} ${sent ? "buzz--sent" : ""}`}
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
