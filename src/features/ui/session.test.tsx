// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionInfo } from "@/features/network/protocol";
import { useSession } from "./session";

const SESSION_SIGNED_OUT: SessionInfo = { signedIn: false, authMode: "fixture" };
const SESSION_SIGNED_IN: SessionInfo = {
  signedIn: true,
  authMode: "fixture",
  user: { id: "u-test", name: "quiz.player" },
  csrfToken: "csrf-test",
};
const UNAUTHORIZED = {
  error: "unauthorized",
  message: "HAM authorization could not be verified.",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSession", () => {
  it("loads the signed-out session after an initial 401", async () => {
    const fetchSession = vi
      .fn()
      .mockResolvedValueOnce(json(UNAUTHORIZED, 401))
      .mockResolvedValueOnce(json(SESSION_SIGNED_OUT));
    vi.stubGlobal("fetch", fetchSession);

    const { result } = renderHook(() => useSession());

    await waitFor(() =>
      expect(result.current).toMatchObject({ status: "ready", session: SESSION_SIGNED_OUT }),
    );
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });

  it("reports an error after two 401 responses", async () => {
    const fetchSession = vi
      .fn()
      .mockResolvedValueOnce(json(UNAUTHORIZED, 401))
      .mockResolvedValueOnce(json(UNAUTHORIZED, 401));
    vi.stubGlobal("fetch", fetchSession);

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });

  it("reports a 503 error without retrying", async () => {
    const fetchSession = vi
      .fn()
      .mockResolvedValueOnce(
        json(
          { error: "authUnavailable", message: "HAM authorization could not be verified." },
          503,
        ),
      );
    vi.stubGlobal("fetch", fetchSession);

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(fetchSession).toHaveBeenCalledTimes(1);
  });

  it("loads a signed-in session without retrying", async () => {
    const fetchSession = vi.fn().mockResolvedValueOnce(json(SESSION_SIGNED_IN));
    vi.stubGlobal("fetch", fetchSession);

    const { result } = renderHook(() => useSession());

    await waitFor(() =>
      expect(result.current).toMatchObject({ status: "ready", session: SESSION_SIGNED_IN }),
    );
    expect(fetchSession).toHaveBeenCalledTimes(1);
  });
});
