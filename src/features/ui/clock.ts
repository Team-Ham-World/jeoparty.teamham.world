"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { TimerView } from "@/features/engine/contract";

/*
  One shared ticking clock for every countdown on the page. Components read it
  with useSyncExternalStore, so rendering stays pure (no Date.now() in render)
  and the server render shows the view's own `remainingMs` instead.
*/

const TICK_MS = 200;
let now = 0;
const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (interval === null) {
    now = Date.now();
    interval = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };
}

/** Local epoch ms, refreshed five times a second; 0 before hydration. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}

/**
 * Remaining milliseconds on a server timer. Paused timers (`endsAt === null`)
 * and the first server render use the view's frozen `remainingMs`.
 */
export function remainingMs(timer: TimerView, localNow: number, clockOffsetMs: number): number {
  if (timer.endsAt === null || localNow === 0) return Math.max(0, timer.remainingMs);
  return Math.max(0, Math.min(timer.durationMs, timer.endsAt - (localNow + clockOffsetMs)));
}

export function useRemaining(timer: TimerView | null, clockOffsetMs: number): number | null {
  const localNow = useNow();
  if (!timer) return null;
  return remainingMs(timer, localNow, clockOffsetMs);
}

/** Schedule a single render at the opening, rather than waiting for the countdown tick. */
export function useOpeningLit(opensAt: number | null, clockOffsetMs: number): boolean {
  const [litOpening, setLitOpening] = useState<number | null>(null);
  useEffect(() => {
    if (opensAt === null) return;
    const timer = setTimeout(
      () => setLitOpening(opensAt),
      Math.max(0, opensAt - Date.now() - clockOffsetMs),
    );
    return () => clearTimeout(timer);
  }, [opensAt, clockOffsetMs]);
  return opensAt !== null && litOpening === opensAt;
}
