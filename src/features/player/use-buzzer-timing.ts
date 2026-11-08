"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Timing only. The engine still decides whether a buzz is accepted. */
export function useBuzzerTiming({
  opensAt,
  active,
  clockOffsetMs,
  lockoutEnabled,
  clueId,
  fairBuzzing = true,
}: {
  opensAt: number | null;
  active: boolean;
  clockOffsetMs: number;
  lockoutEnabled: boolean;
  clueId: string;
  fairBuzzing?: boolean;
}) {
  const key = `${clueId}:${opensAt}`;
  const earlyTap = useRef<{ clueId: string; at: number; serverAt: number } | null>(null);
  const litAt = useRef<{ key: string; at: number } | null>(null);
  const [light, setLight] = useState<{ key: string; falseStart: boolean } | null>(null);
  const [unlockedKey, setUnlockedKey] = useState<string | null>(null);
  const lit = active && light?.key === key;
  const falseStart = lit && light.falseStart;
  const lockedOut = falseStart && unlockedKey !== key;

  useLayoutEffect(() => {
    if (!active || litAt.current?.key === key) return;
    const timer = setTimeout(
      () => {
        const tap = earlyTap.current;
        setLight({
          key,
          falseStart:
            lockoutEnabled &&
            tap?.clueId === clueId &&
            (fairBuzzing && opensAt !== null
              ? tap.serverAt >= opensAt - 1000 && tap.serverAt < opensAt
              : performance.now() - tap.at <= 1000),
        });
      },
      Math.max(0, (opensAt ?? 0) - Date.now() - clockOffsetMs),
    );
    return () => clearTimeout(timer);
  }, [active, opensAt, clockOffsetMs, key, lockoutEnabled, clueId, fairBuzzing]);

  useLayoutEffect(() => {
    if (!lit) {
      litAt.current = null;
      return;
    }
    // The lit class has committed to the DOM. Start reaction timing here, never at view arrival.
    if (litAt.current?.key !== key) litAt.current = { key, at: performance.now() };
    if (!falseStart) return;
    const timer = setTimeout(() => setUnlockedKey(key), 250);
    return () => clearTimeout(timer);
  }, [lit, key, falseStart]);

  return {
    lit,
    lockedOut,
    falseStart,
    recordEarlyTap() {
      const serverAt = Date.now() + clockOffsetMs;
      // A late view must not let post-opening mashing erase a preceding false start.
      if (!lit && (!fairBuzzing || !active || opensAt === null || serverAt < opensAt))
        earlyTap.current = { clueId, at: performance.now(), serverAt };
    },
    reactionMs() {
      return litAt.current?.key === key ? Math.max(0, performance.now() - litAt.current.at) : 0;
    },
  };
}
