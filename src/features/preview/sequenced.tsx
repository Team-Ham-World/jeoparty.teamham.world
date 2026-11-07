"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { RoomConnection } from "@/features/network/connection";
import { mockConnection } from "./mock-connection";

type Revisioned = { revision: number; lastEvent: { revision: number; event: unknown } | null };

/** The same view with a new revision, so one-shot effects treat its lastEvent as fresh. */
export function atRevision<V extends Revisioned>(view: V, revision: number): V {
  return { ...view, revision, lastEvent: view.lastEvent ? { ...view.lastEvent, revision } : null };
}

/**
 * Plays views in order (e.g. "closed" then "judged") so effects that only
 * fire for new events can be previewed. Delays are in ms after mount.
 */
export function Sequenced<V extends Revisioned>({
  steps,
  clockOffsetMs = 0,
  children,
}: {
  steps: { at: number; view: V }[];
  clockOffsetMs?: number;
  children: (connection: RoomConnection<V>) => ReactNode;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timers = steps
      .slice(1)
      .map((step, i) => window.setTimeout(() => setIndex(i + 1), step.at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [steps]);
  return <>{children(mockConnection(steps[index].view, { clockOffsetMs }))}</>;
}
