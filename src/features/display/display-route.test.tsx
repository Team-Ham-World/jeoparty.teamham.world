// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  describe("when a new link is pasted into this tab", () => {
    async function openedTab() {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 204 })),
      );
      render(<DisplayRoute code="BCDFG" />);
      await screen.findByText(/Connecting the big screen/);
    }
    function changeHash(hash: string) {
      const reload = vi.fn();
      vi.stubGlobal("location", { hash, reload });
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return reload;
    }

    it("reloads so the new key gets claimed", async () => {
      await openedTab();
      expect(changeHash("#key=new-key")).toHaveBeenCalledTimes(1);
    });

    it("ignores a fragment with no key", async () => {
      await openedTab();
      expect(changeHash("#something-else")).not.toHaveBeenCalled();
    });
  });

  it("retries a temporary failure with the original link", async () => {
    window.history.replaceState(null, "", "/display/BCDFG#key=retry-key");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Offline"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DisplayRoute code="BCDFG" />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(window.location.hash).toBe("#key=retry-key");
    fireEvent.click(retry);

    await screen.findByText(/Connecting the big screen/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(window.location.hash).toBe("");
  });

  it("strips the fragment and explains when the link is invalid", async () => {
    window.history.replaceState(null, "", "/display/BCDFG#key=stale-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: "forbidden", message: "That display link has expired." }),
            { status: 403 },
          ),
      ),
    );
    render(<DisplayRoute code="BCDFG" />);
    expect(await screen.findByText("Ask the host for a new display link")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});
