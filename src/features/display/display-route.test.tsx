// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayRoute, readDisplayKey } from "./display-route";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("display claim", () => {
  it("reads the key from the fragment", () => {
    expect(readDisplayKey("#key=abc123")).toBe("abc123");
    expect(readDisplayKey("")).toBeNull();
  });

  it("claims with the fragment key, then strips the fragment before connecting", async () => {
    window.history.replaceState(null, "", "/display/BCDFG#key=one-time-secret");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DisplayRoute code="BCDFG" />);

    await waitFor(() => expect(screen.getByText(/Connecting the big screen/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/display/claim");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ code: "BCDFG", key: "one-time-secret" });
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain("one-time-secret");
    expect(window.location.pathname).toBe("/display/BCDFG");
  });

  it("still strips the fragment and explains when the claim fails", async () => {
    window.history.replaceState(null, "", "/display/BCDFG#key=stale-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "forbidden", message: "That display link has expired." }), { status: 403 })),
    );
    render(<DisplayRoute code="BCDFG" />);
    expect(await screen.findByText("Ask the host for a new display link")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});
