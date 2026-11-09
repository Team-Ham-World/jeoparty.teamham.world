"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, getSession } from "@/features/network/client/api";
import type { SessionInfo } from "@/features/network/protocol";

export type SessionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: SessionInfo };

/** Loads GET /api/session once on mount. `reload` fetches it again. */
export function useSession(): SessionState & { reload: () => void } {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSession().then(
      (session) => {
        if (!cancelled) setState({ status: "ready", session });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
