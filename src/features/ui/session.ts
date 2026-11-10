"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, errorMessage, getSession } from "@/features/network/client/api";
import type { SessionInfo } from "@/features/network/protocol";

export type SessionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: SessionInfo };

/**
 * The first request after HAM ended the session elsewhere answers 401 and
 * marks the session signed out. Asking once more then gets the signed-out
 * answer, which pages can show as the sign-in screen.
 */
async function loadSession(): Promise<SessionInfo> {
  try {
    return await getSession();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return getSession();
    throw error;
  }
}

/** Loads GET /api/session once on mount. `reload` fetches it again. */
export function useSession(): SessionState & { reload: () => void } {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSession().then(
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
