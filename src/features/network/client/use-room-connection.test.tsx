// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomConnection } from "./use-room-connection";

class FakeSocket {
  static OPEN = 1;
  static sockets: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(readonly url: URL) {
    FakeSocket.sockets.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  hello(role = "host") {
    this.receive({
      t: "hello",
      protocol: 1,
      role,
      serverNow: Date.now() + 100,
    });
  }
  view(revision: number, audience = "host") {
    this.receive({ t: "view", view: { audience, revision } });
  }
}
const lastSocket = () => FakeSocket.sockets.at(-1)!;
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.sockets = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function initial() {
  await act(async () => {
    await Promise.resolve();
  });
}
function live() {
  act(() => {
    lastSocket().open();
    lastSocket().hello();
    lastSocket().view(5);
  });
}

describe("useRoomConnection", () => {
  it("waits for a matching hello and view, keeps newest revisions and estimates clock offset", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    expect(result.current.stale).toBe(true);
    live();
    expect(result.current.status).toBe("live");
    act(() => {
      lastSocket().view(9);
      lastSocket().view(6);
    });
    expect(result.current.view?.revision).toBe(9);
    act(() =>
      lastSocket().receive({
        t: "pong",
        at: Date.now() - 20,
        serverNow: Date.now() + 100,
      }),
    );
    expect(result.current.clockOffsetMs).toBe(110);
    unmount();
  });
  it("reconnects with backoff, stays stale, resends unacked commands with identical ids", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    let outcome!: ReturnType<typeof result.current.send>;
    act(() => {
      outcome = result.current.send({ type: "pause" });
    });
    const first = lastSocket(),
      sent = JSON.parse(first.sent.find((s) => JSON.parse(s).t === "cmd")!);
    act(() => first.close());
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.stale).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeSocket.sockets).toHaveLength(2);
    act(() => {
      lastSocket().open();
      lastSocket().hello();
      lastSocket().view(4);
    });
    expect(result.current.stale).toBe(true);
    act(() => lastSocket().view(6));
    expect(result.current.status).toBe("live");
    expect(
      lastSocket()
        .sent.map((s) => JSON.parse(s))
        .filter((m) => m.t === "cmd"),
    ).toEqual([sent]);
    act(() => lastSocket().receive({ t: "ack", id: sent.id, ok: true, revision: 6 }));
    expect(await outcome).toEqual({ ok: true, revision: 6 });
    unmount();
  });
  it.each([
    "signedOut",
    "signedInElsewhere",
    "authExpired",
    "removed",
    "displayRevoked",
    "roomClosed",
    "serverShutdown",
  ])("does not reconnect after closing %s", async (reason) => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    act(() => lastSocket().receive({ t: "closing", reason }));
    expect(result.current).toMatchObject({
      status: "closed",
      stale: true,
      closeReason: reason,
    });
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(FakeSocket.sockets).toHaveLength(1);
    unmount();
  });
  it("times out commands, rejects offline sends and resolves pending commands on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    expect(await result.current.send({ type: "pause" })).toMatchObject({
      error: "offline",
    });
    live();
    let outcome!: ReturnType<typeof result.current.send>;
    act(() => {
      outcome = result.current.send({ type: "pause" });
    });
    await act(async () => {
      vi.advanceTimersByTime(15001);
    });
    expect(await outcome).toMatchObject({ error: "timeout" });
    act(() => {
      outcome = result.current.send({ type: "resume" });
    });
    unmount();
    expect(await outcome).toMatchObject({ error: "offline" });
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(FakeSocket.sockets).toHaveLength(1);
  });
  it("isolates room changes and ignores old socket messages", async () => {
    const { result, rerender, unmount } = renderHook(
      ({ code }) => useRoomConnection({ code, role: "host" }),
      { initialProps: { code: "BCDFG" } },
    );
    await initial();
    live();
    const old = lastSocket();
    rerender({ code: "JKLMN" });
    await initial();
    act(() => old.view(999));
    expect(result.current.view).toBeNull();
    act(() => {
      lastSocket().open();
      lastSocket().hello();
      lastSocket().view(1);
    });
    expect(result.current.view?.revision).toBe(1);
    unmount();
  });
});
