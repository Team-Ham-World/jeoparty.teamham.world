"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface EarlyTap {
  clueId: string;
  at: number;
  serverAt: number;
}

/** Whether taps on this clue, oldest first, count as a false start for this opening. */
function tappedEarly(taps: EarlyTap[], opensAt: number | null, fairBuzzing: boolean) {
  if (!fairBuzzing || opensAt === null) return taps.some((t) => performance.now() - t.at <= 1000);
  // Taps at most a second apart cover one continuous range of possible openings.
  // Mashing extends that range, preserving false starts even before opensAt is known.
  let runStart = taps[0];
  for (const [index, tap] of taps.entries()) {
    const previous = taps[index - 1];
    if (previous && (tap.serverAt < previous.serverAt || tap.serverAt - previous.serverAt > 1000))
      runStart = tap;
    if (tap.serverAt >= opensAt - 1000 && runStart.serverAt < opensAt) return true;
  }
  return false;
}

/** Timing only. The engine still decides whether a buzz is accepted. */
export function useBuzzerTiming({
  opensAt,
  openingId,
  active,
  clockOffsetMs,
  lockoutEnabled,
  clueId,
  fairBuzzing = true,
}: {
  opensAt: number | null;
  openingId: number | null;
  active: boolean;
  clockOffsetMs: number;
  lockoutEnabled: boolean;
  clueId: string;
  fairBuzzing?: boolean;
}) {
  const earlyTaps = useRef<EarlyTap[]>([]);
  const litAt = useRef<{ openingId: number; at: number } | null>(null);
  const [light, setLight] = useState<{ openingId: number; falseStart: boolean } | null>(null);
  const [unlockedOpening, setUnlockedOpening] = useState<number | null>(null);
  const lit = active && light?.openingId === openingId;
  const falseStart = lit && light.falseStart;
  const lockedOut = falseStart && unlockedOpening !== openingId;

  useLayoutEffect(() => {
    if (!active || openingId === null || litAt.current?.openingId === openingId) return;
    const timer = setTimeout(
      () => {
        setLight({
          openingId,
          falseStart:
            lockoutEnabled &&
            tappedEarly(
              earlyTaps.current.filter((tap) => tap.clueId === clueId),
              opensAt,
              fairBuzzing,
            ),
        });
      },
      Math.max(0, (opensAt ?? 0) - Date.now() - clockOffsetMs),
    );
    return () => clearTimeout(timer);
  }, [active, opensAt, clockOffsetMs, openingId, lockoutEnabled, clueId, fairBuzzing]);

  useLayoutEffect(() => {
    if (!lit || openingId === null) {
      litAt.current = null;
      return;
    }
    // The lit class has committed to the DOM. Start reaction timing here, never at view arrival.
    if (litAt.current?.openingId !== openingId)
      litAt.current = { openingId, at: performance.now() };
    if (!falseStart) return;
    const timer = setTimeout(() => setUnlockedOpening(openingId), 250);
    return () => clearTimeout(timer);
  }, [lit, openingId, falseStart]);

  return {
    lit,
    lockedOut,
    falseStart,
    /** Remembers an early tap. Returns a function that takes it back, e.g. if it became a scroll. */
    recordEarlyTap() {
      const serverAt = Date.now() + clockOffsetMs;
      if (lit || (fairBuzzing && active && opensAt !== null && serverAt >= opensAt))
        return () => {};
      const tap: EarlyTap = { clueId, at: performance.now(), serverAt };
      // Only this clue's taps matter, and the bound is far more than anyone can mash in a second.
      earlyTaps.current = [
        ...earlyTaps.current.filter((other) => other.clueId === clueId).slice(-255),
        tap,
      ];
      return () => {
        earlyTaps.current = earlyTaps.current.filter((other) => other !== tap);
      };
    },
    reactionMs() {
      return litAt.current?.openingId === openingId
        ? Math.max(0, performance.now() - litAt.current.at)
        : 0;
    },
  };
}
