// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomConnection } from "./use-room-connection";

class FakeSocket {
  static CONNECTING = 0;
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
  hello(role = "host", protocol = 3) {
    this.receive({
      t: "hello",
      protocol,
      role,
      serverNow: Date.now() + 100,
    });
  }
  view(revision: number, audience = "host") {
    this.receive({ t: "view", view: { audience, revision } });
  }
}
const lastSocket = () => FakeSocket.sockets.at(-1)!;
const fetchRoom = vi.fn<() => Promise<Response>>();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const roomSummary = (myRole: string | null) =>
  json(200, {
    code: "BCDFG",
    status: "playing",
    hostName: "Host",
    playerCount: 2,
    maxPlayers: 6,
    myRole,
  });
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.sockets = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  fetchRoom.mockReset();
  fetchRoom.mockImplementation(() => Promise.resolve(roomSummary("host")));
  vi.stubGlobal("fetch", fetchRoom);
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
/** Let async work finish, and run any backoff timer that is due. */
async function wait(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
/** Run the backoff until the next socket starts. Stopping there avoids its connect timeout. */
async function nextSocket() {
  const before = FakeSocket.sockets.length;
  await act(async () => {
    for (let ms = 0; ms < 20_000 && FakeSocket.sockets.length === before; ms += 100)
      await vi.advanceTimersByTimeAsync(100);
  });
}
/** `count` sockets in a row close without a hello, and the next one starts connecting. */
async function refuse(count: number) {
  for (let i = 0; i < count; i++) {
    act(() => lastSocket().close());
    await nextSocket();
  }
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

describe("refused connections", () => {
  it.each([
    {
      name: "a closed room",
      role: "host",
      answer: () => json(404, { error: "notFound", message: "x" }),
      reason: "roomClosed",
    },
    {
      name: "an expired session",
      role: "player",
      answer: () => json(401, { error: "unauthorized", message: "x" }),
      reason: "authExpired",
    },
    {
      name: "a removed player",
      role: "player",
      answer: () => roomSummary(null),
      reason: "removed",
    },
    {
      name: "a host who lost the room",
      role: "host",
      answer: () => roomSummary("player"),
      reason: "removed",
    },
  ] as const)("stops on $name after three refusals", async ({ role, answer, reason }) => {
    fetchRoom.mockImplementation(() => Promise.resolve(answer()));
    const { result, unmount } = renderHook(() => useRoomConnection({ code: "BCDFG", role }));
    await initial();
    await refuse(2);
    expect(fetchRoom).not.toHaveBeenCalled();
    act(() => lastSocket().close());
    await wait();
    expect(fetchRoom).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ status: "closed", closeReason: reason, stale: true });
    const sockets = FakeSocket.sockets.length;
    await wait(60_000);
    expect(FakeSocket.sockets).toHaveLength(sockets);
    unmount();
  });
  it("fails commands still waiting when it stops", async () => {
    fetchRoom.mockImplementation(() =>
      Promise.resolve(json(404, { error: "notFound", message: "x" })),
    );
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    let outcome!: ReturnType<typeof result.current.send>;
    act(() => {
      outcome = result.current.send({ type: "pause" });
    });
    act(() => lastSocket().close());
    await nextSocket();
    await refuse(2);
    act(() => lastSocket().close());
    await wait();
    expect(await outcome).toMatchObject({ ok: false, error: "offline" });
    unmount();
  });
  it.each([
    { name: "a server error", answer: () => Promise.resolve(json(500, {})) },
    {
      name: "a proxy's plain 404",
      answer: () => Promise.resolve(new Response("nope", { status: 404 })),
    },
    { name: "a network failure", answer: () => Promise.reject(new TypeError("offline")) },
    { name: "a summary that still fits", answer: () => Promise.resolve(roomSummary("host")) },
  ])("keeps retrying after $name", async ({ answer }) => {
    fetchRoom.mockImplementation(answer);
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    await refuse(4);
    expect(fetchRoom).toHaveBeenCalled();
    expect(result.current.status).toBe("reconnecting");
    live();
    expect(result.current.status).toBe("live");
    unmount();
  });
  it("accepts a waiting player's summary as a fit", async () => {
    fetchRoom.mockImplementation(() => Promise.resolve(roomSummary("waiting")));
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "player" }),
    );
    await initial();
    await refuse(3);
    expect(result.current.status).toBe("reconnecting");
    unmount();
  });
  it("asks one question at a time", async () => {
    const answer = Promise.withResolvers<Response>();
    fetchRoom.mockImplementation(() => answer.promise);
    const { unmount } = renderHook(() => useRoomConnection({ code: "BCDFG", role: "host" }));
    await initial();
    await refuse(5);
    expect(fetchRoom).toHaveBeenCalledTimes(1);
    answer.resolve(roomSummary("host"));
    await wait();
    await refuse(1);
    expect(fetchRoom).toHaveBeenCalledTimes(2);
    unmount();
  });
  it("ignores the answer if a hello arrived while waiting for it", async () => {
    const answer = Promise.withResolvers<Response>();
    fetchRoom.mockImplementation(() => answer.promise);
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    await refuse(3);
    live();
    answer.resolve(json(404, { error: "notFound", message: "x" }));
    await wait();
    expect(result.current.status).toBe("live");
    unmount();
  });
  it("ignores the answer after unmounting", async () => {
    const answer = Promise.withResolvers<Response>();
    fetchRoom.mockImplementation(() => answer.promise);
    const { unmount } = renderHook(() => useRoomConnection({ code: "BCDFG", role: "host" }));
    await initial();
    await refuse(3);
    unmount();
    const sockets = FakeSocket.sockets.length;
    answer.resolve(json(404, { error: "notFound", message: "x" }));
    await wait(60_000);
    expect(FakeSocket.sockets).toHaveLength(sockets);
  });
  it("starts counting again after a hello", async () => {
    const { unmount } = renderHook(() => useRoomConnection({ code: "BCDFG", role: "host" }));
    await initial();
    await refuse(2);
    act(() => {
      lastSocket().open();
      lastSocket().hello();
    });
    await refuse(1); // This socket said hello, so it doesn't count.
    await refuse(2);
    expect(fetchRoom).not.toHaveBeenCalled();
    unmount();
  });
  it("stops, without retrying, on a protocol mismatch", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    act(() => {
      lastSocket().open();
      lastSocket().hello("host", 1);
    });
    expect(result.current).toMatchObject({ status: "closed", closeReason: null });
    await wait(60_000);
    expect(FakeSocket.sockets).toHaveLength(1);
    unmount();
  });
});

describe("a display that can't reach its room", () => {
  const displayLive = (revision: number) =>
    act(() => {
      lastSocket().open();
      lastSocket().hello("display");
      lastSocket().view(revision, "display");
    });
  it("shows the notice after four refusals with no view, keeps retrying, and recovers", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "display" }),
    );
    await initial();
    await refuse(3);
    expect(result.current.status).toBe("reconnecting");
    await refuse(1);
    expect(result.current).toMatchObject({ status: "closed", closeReason: null });
    await refuse(2); // Further failures must not flip it back to reconnecting.
    expect(result.current).toMatchObject({ status: "closed", closeReason: null });
    expect(fetchRoom).not.toHaveBeenCalled();
    displayLive(3);
    expect(result.current).toMatchObject({ status: "live", stale: false });
    unmount();
  });
  it("keeps the notice up if a socket says hello but drops before any view", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "display" }),
    );
    await initial();
    await refuse(4);
    act(() => {
      lastSocket().open();
      lastSocket().hello("display");
      lastSocket().close();
    });
    expect(result.current).toMatchObject({ status: "closed", closeReason: null });
    unmount();
  });
  it("waits for eight refusals when a view is already on screen", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "display" }),
    );
    await initial();
    displayLive(3);
    act(() => lastSocket().close());
    await nextSocket();
    await refuse(7);
    expect(result.current.status).toBe("reconnecting");
    await refuse(1);
    expect(result.current).toMatchObject({ status: "closed", closeReason: null });
    expect(result.current.view?.revision).toBe(3);
    displayLive(4);
    expect(result.current.status).toBe("live");
    unmount();
  });
  it("rides out a server restart with the board up and reconnects", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "display" }),
    );
    await initial();
    displayLive(3);
    act(() => lastSocket().receive({ t: "closing", reason: "serverShutdown" }));
    expect(result.current).toMatchObject({ status: "reconnecting", closeReason: null });
    expect(result.current.view?.revision).toBe(3);
    await nextSocket();
    expect(FakeSocket.sockets).toHaveLength(2);
    displayLive(4);
    expect(result.current.status).toBe("live");
    unmount();
  });
  it.each(["roomClosed", "displayRevoked"])("still stops for good on %s", async (reason) => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "display" }),
    );
    await initial();
    displayLive(3);
    act(() => lastSocket().receive({ t: "closing", reason }));
    expect(result.current).toMatchObject({ status: "closed", closeReason: reason });
    await wait(60_000);
    expect(FakeSocket.sockets).toHaveLength(1);
    unmount();
  });
});

describe("waking a phone", () => {
  let visibility: DocumentVisibilityState = "visible";
  beforeEach(() => {
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
  });
  afterEach(() => {
    delete (document as { visibilityState?: unknown }).visibilityState;
  });
  const setVisibility = (next: DocumentVisibilityState) =>
    act(() => {
      visibility = next;
      document.dispatchEvent(new Event("visibilitychange"));
    });
  /** A phone asleep: the clock moves on but its timers don't fire. */
  const sleep = (ms: number) => vi.setSystemTime(Date.now() + ms);
  const sentTypes = () => lastSocket().sent.map((m) => JSON.parse(m).t);

  it("reconnects straight away if the socket is gone", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    setVisibility("hidden");
    act(() => lastSocket().close());
    expect(FakeSocket.sockets).toHaveLength(1);
    setVisibility("visible");
    expect(FakeSocket.sockets).toHaveLength(2);
    live();
    expect(result.current.status).toBe("live");
    await wait(2_000);
    expect(FakeSocket.sockets).toHaveLength(2); // The old backoff timer was cleared.
    unmount();
  });
  it("does not revive a connection closed on purpose", async () => {
    const { unmount } = renderHook(() => useRoomConnection({ code: "BCDFG", role: "host" }));
    await initial();
    live();
    act(() => lastSocket().receive({ t: "closing", reason: "removed" }));
    setVisibility("hidden");
    setVisibility("visible");
    expect(FakeSocket.sockets).toHaveLength(1);
    unmount();
  });
  it("holds a stale buzzer after a long hide until a fresh view, then resends commands", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    let outcome!: ReturnType<typeof result.current.send>;
    act(() => {
      outcome = result.current.send({ type: "pause" });
    });
    const cmd = lastSocket().sent.find((m) => JSON.parse(m).t === "cmd")!;
    setVisibility("hidden");
    sleep(3_001);
    lastSocket().sent = [];
    setVisibility("visible");
    expect(result.current).toMatchObject({ status: "reconnecting", stale: true });
    expect(sentTypes()).toEqual(["resync", "ping"]);
    expect(await result.current.send({ type: "resume" })).toMatchObject({ error: "offline" });
    act(() => lastSocket().view(5));
    expect(result.current).toMatchObject({ status: "live", stale: false });
    expect(lastSocket().sent).toContain(cmd);
    act(() => lastSocket().receive({ t: "ack", id: JSON.parse(cmd).id, ok: true, revision: 6 }));
    expect(await outcome).toEqual({ ok: true, revision: 6 });
    unmount();
  });
  it("leaves a short hide alone", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    setVisibility("hidden");
    sleep(2_999);
    lastSocket().sent = [];
    setVisibility("visible");
    expect(result.current.status).toBe("live");
    expect(sentTypes()).toEqual(["ping"]);
    unmount();
  });
  it("drops a socket left connecting through a long hide and starts a new one", async () => {
    const { unmount } = renderHook(() => useRoomConnection({ code: "BCDFG", role: "host" }));
    await initial();
    const stuck = lastSocket();
    setVisibility("hidden");
    sleep(10_001);
    setVisibility("visible");
    expect(stuck.readyState).toBe(3);
    expect(FakeSocket.sockets).toHaveLength(2);
    unmount();
  });
  it("leaves a fresh handshake alone", async () => {
    const { unmount } = renderHook(() => useRoomConnection({ code: "BCDFG", role: "host" }));
    await initial();
    setVisibility("hidden");
    sleep(5_000);
    setVisibility("visible");
    expect(FakeSocket.sockets).toHaveLength(1);
    expect(lastSocket().readyState).toBe(0);
    unmount();
  });
});

describe("fair buzzing transport", () => {
  it("uses the best of the last ten clock samples and expires old samples", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    const pong = (rtt: number, offset: number) =>
      act(() =>
        lastSocket().receive({
          t: "pong",
          at: Date.now() - rtt,
          serverNow: Date.now() - rtt / 2 + offset,
        }),
      );
    pong(20, 100);
    pong(200, 400);
    expect(result.current).toMatchObject({ clockOffsetMs: 100, rttMs: 20 });
    for (let i = 0; i < 9; i++) pong(100, 200);
    expect(result.current).toMatchObject({ clockOffsetMs: 200, rttMs: 100 });
    unmount();
  });
  it("acks probes immediately, preserves ping liveness, and exposes host pings", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "host" }),
    );
    await initial();
    live();
    act(() => {
      lastSocket().receive({ t: "probe", id: "server-probe", at: 100 });
      lastSocket().receive({ t: "pings", pings: { a: 80, b: null } });
    });
    expect(JSON.parse(lastSocket().sent.at(-1)!)).toEqual({ t: "probeAck", id: "server-probe" });
    expect(result.current.pings).toEqual({ a: 80, b: null });
    expect(result.current.status).toBe("live");
    unmount();
  });
  it("never exposes pings to a player connection", async () => {
    const { result, unmount } = renderHook(() =>
      useRoomConnection({ code: "BCDFG", role: "player" }),
    );
    await initial();
    act(() => {
      lastSocket().open();
      lastSocket().hello("player");
      lastSocket().view(1, "player");
      lastSocket().receive({ t: "pings", pings: { a: 80 } });
    });
    expect(result.current.pings).toEqual({});
    unmount();
  });
});
