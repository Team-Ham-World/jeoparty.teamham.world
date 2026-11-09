"use client";

import { useState } from "react";
import type { GameEvent, ViewCommon } from "@/features/engine/contract";

/**
 * The view's `lastEvent`, but only when it happened after this screen first
 * received a view. A reconnect or first snapshot never replays an old effect.
 */
export function useFreshEvent(
  view: ViewCommon | null,
): { revision: number; event: GameEvent } | null {
  const [baseline, setBaseline] = useState<number | null>(null);
  if (view && baseline === null) {
    // Adjusting state during render is React's pattern for "remember the first value".
    setBaseline(view.lastEvent?.revision ?? view.revision);
    return null;
  }
  const last = view?.lastEvent ?? null;
  if (!last || baseline === null || last.revision <= baseline) return null;
  return last;
}
