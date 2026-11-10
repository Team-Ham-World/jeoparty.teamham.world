"use client";

import { useCallback, useRef, useState } from "react";
import type { CommandOutcome, RoomConnection } from "@/features/network/connection";
import type { AckError, ClientCommand } from "@/features/network/protocol";
import { useToast } from "./toasts";

const FALLBACK: Partial<Record<string, string>> = {
  offline: "You're offline. Try again once the connection is back.",
  timeout: "The server didn't answer in time. Check the screen, then try again.",
  rateLimited: "Slow down a little and try again.",
};

export interface RunOptions {
  /** Rejections the screen already explains in place, so no toast is needed (e.g. a lost buzz race). */
  quiet?: readonly (AckError | "offline" | "timeout")[];
  /** Never show a toast for this command. For sends the person did not ask for. */
  silent?: boolean;
}

/**
 * Sends commands for a screen and turns rejections into a toast. `pending`
 * holds the command type in flight so its button can show a busy state and
 * ignore double clicks.
 */
export function useCommand<V>(connection: RoomConnection<V>) {
  const toast = useToast();
  const [pending, setPending] = useState<ClientCommand["type"] | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (cmd: ClientCommand, options: RunOptions = {}): Promise<CommandOutcome | null> => {
      if (connection.stale || inFlight.current) return null;
      inFlight.current = true;
      setPending(cmd.type);
      try {
        const outcome = await connection.send(cmd);
        if (!outcome.ok && !options.silent && !options.quiet?.includes(outcome.error))
          toast(FALLBACK[outcome.error] ?? outcome.message);
        return outcome;
      } catch {
        if (!options.silent) toast("That didn't send. Try again.");
        return null;
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [connection, toast],
  );

  return { run, pending };
}
