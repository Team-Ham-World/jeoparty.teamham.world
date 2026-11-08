import { afterEach, describe, expect, it, vi } from "vitest";
import { engine } from "@/features/engine";
import type { Command } from "@/features/engine/contract";
import pack from "@/features/content/samples/sample-pack-3x3.json";
import { harness, type Harness } from "./test-harness";
import { start, table, type Wire } from "./integration-harness";
import { Latency } from "./rooms/latency";
import { parseClientMessage } from "./validation";

let h: Harness | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await h?.stop();
  h = undefined;
  vi.useRealTimers();
});

function lastProbe(wire: Wire) {
  const probe = wire.messages.findLast((m) => m.t === "probe");
  if (!probe || probe.t !== "probe") throw new Error("No probe");
  return probe;
}

describe("server fair buzzing", () => {
  it("tracks ten RTTs, median, p90, defaults, replay protection and the cap", () => {
    const latency = new Latency();
    expect(latency.median).toBeNull();
    expect(latency.p90).toBe(300);
    expect(latency.uplinkBound).toBe(150);
    for (let i = 0; i < 11; i++) {
      const at = i * 2000;
      const probe = latency.probe(at)!;
      expect(latency.probe(at + 100)).toBeNull();
      expect(latency.acknowledge("wrong", at + 1)).toBe(false);
      expect(latency.acknowledge(probe.id, at + (i + 1) * 100)).toBe(true);
      expect(latency.acknowledge(probe.id, at + 100)).toBe(false);
    }
    expect(latency.median).toBe(650);
    expect(latency.p90).toBe(1000);
    expect(latency.uplinkBound).toBe(250);
    const slow = new Latency();
    const first = slow.probe(0)!;
    slow.probe(2000);
    expect(slow.acknowledge(first.id, 2500)).toBe(true);
    expect(slow.median).toBe(2500);
    expect(slow.uplinkBound).toBe(250);
  });
  it("validates probes and settings and rejects client-owned transport fields", () => {
    expect(parseClientMessage({ t: "probeAck", id: "probe" })).toEqual({
      t: "probeAck",
      id: "probe",
    });
    expect(parseClientMessage({ t: "probeAck", id: "probe", at: 0 })).toBeNull();
    const message = (cmd: unknown) => ({
      t: "cmd",
      id: "8f02cd25-6c4a-40ba-9d72-b75961bbf160",
      cmd,
    });
    const buzz = { type: "buzz", clueId: "clue", reactionMs: 12, falseStart: false };
    expect(parseClientMessage(message(buzz))).not.toBeNull();
    for (const extra of [
      { arrivalMs: 0 },
      { uplinkBoundMs: 999 },
      { maxOtherUplinkMs: 999 },
      { reactionMs: -1 },
      { reactionMs: Infinity },
      { falseStart: 1 },
    ])
      expect(parseClientMessage(message({ ...buzz, ...extra }))).toBeNull();
    expect(
      parseClientMessage(message({ type: "openBuzzers", clueId: "clue", leadMs: 999 })),
    ).toBeNull();
    expect(
      parseClientMessage(
        message({ type: "updateSettings", patch: { fairBuzzing: true, falseStartLockout: false } }),
      ),
    ).not.toBeNull();
    expect(
      parseClientMessage(message({ type: "updateSettings", patch: { fairBuzzing: 1 } })),
    ).toBeNull();
  });
  it("measures probes outside the queue, sends host-only pings, and computes bounded leads", async () => {
    let now = 1_000_000;
    h = await harness(":memory:", { engine, now: () => now });
    const { a, players, d, code } = await table(h, 2);
    const room = h.app.rooms.get(code)!;
    expect(a.messages.findLast((m) => m.t === "pings")).toMatchObject({
      pings: { [players[0].player.me.id]: null, [players[1].player.me.id]: null },
    });
    await start(a, pack.id, { fairBuzzing: true });
    const initialClue = a.host.board!.categories[0].cells[0].clueId;
    await a.ok({ type: "selectClue", clueId: initialClue });
    await a.ok({ type: "openBuzzers", clueId: initialClue });
    expect(a.host.clue?.opensAt).toBe(now + 210); // Unsampled connections use 300 ms RTT.
    await a.ok({ type: "endAttempts", clueId: initialClue });
    await a.ok({ type: "reveal", clueId: initialClue });
    await a.ok({ type: "returnToBoard", clueId: initialClue });
    const sample = async (player: Wire, rtt: number) => {
      const probe = lastProbe(player);
      now = probe.at + rtt;
      player.ws.send(JSON.stringify({ t: "probeAck", id: probe.id }));
      await a.until(() =>
        a.messages.findLast((m) => m.t === "pings" && m.pings[player.player.me.id] === rtt),
      );
    };
    await sample(players[0], 40);
    await sample(players[1], 900);
    const clueId = a.host.board!.categories[0].cells[1].clueId;
    await a.ok({ type: "selectClue", clueId });
    await a.ok({ type: "openBuzzers", clueId });
    expect(a.host.clue?.opensAt).toBe(now + 400);
    // A queued actor cannot hold up a transport RTT sample.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocked = room.run(() => gate);
    now += 2000;
    room.probe();
    await players[0].until(() => (lastProbe(players[0]).at === now ? true : undefined));
    const probe = lastProbe(players[0]);
    now += 60;
    players[0].ws.send(JSON.stringify({ t: "probeAck", id: probe.id }));
    await a.until(() =>
      a.messages.findLast((m) => m.t === "pings" && m.pings[players[0].player.me.id] === 50),
    );
    release();
    await blocked;
    for (const wire of [...players, d.wire]) {
      for (const raw of wire.raw)
        expect(raw).not.toMatch(/"pings"|"reactionMs"|"effectiveMs"|"uplinkBoundMs"|"candidates"/);
    }
    await a.ok({ type: "pause" });
    await players[1].close();
    await room.run(() => undefined);
    await a.ok({ type: "resume" });
    await a.ok({ type: "endAttempts", clueId });
    // Reopening a fresh clue with only the fast connection uses the 120 ms floor.
    await a.ok({ type: "reveal", clueId });
    await a.ok({ type: "returnToBoard", clueId });
    const next = a.host.board!.categories[0].cells[2].clueId;
    await a.ok({ type: "selectClue", clueId: next });
    await a.ok({ type: "openBuzzers", clueId: next });
    expect(a.host.clue?.opensAt).toBe(now + 120);
  });
  it("captures actual socket arrival before a slow HAM verification and room queue", async () => {
    let now = 2_000_000;
    const applied: Extract<Command, { type: "buzz" }>[] = [];
    const apply = engine.apply;
    const observed = {
      ...engine,
      apply: (...args: Parameters<typeof apply>) => {
        if (args[2].type === "buzz") applied.push(args[2]);
        return apply(...args);
      },
    };
    h = await harness(":memory:", { engine: observed, now: () => now });
    const { a, players, browsers, d } = await table(h, 2);
    for (const [i, rtt] of [20, 300].entries()) {
      const probe = lastProbe(players[i]);
      now = probe.at + rtt;
      players[i].ws.send(JSON.stringify({ t: "probeAck", id: probe.id }));
      await a.until(() =>
        a.messages.findLast((m) => m.t === "pings" && m.pings[players[i].player.me.id] === rtt),
      );
    }
    await start(a, pack.id, { fairBuzzing: true });
    const clueId = a.host.board!.categories[0].cells[0].clueId;
    await a.ok({ type: "selectClue", clueId });
    await a.ok({ type: "openBuzzers", clueId });
    const opensAt = a.host.clue!.opensAt!;
    expect(opensAt).toBe(now + 210);
    const hash = h.app.auth.sessionFromCookieHeader(browsers[0].cookie)!.session_hash;
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const verify = h.app.auth.verify.bind(h.app.auth);
    vi.spyOn(h.app.auth, "verify").mockImplementation(async (session, options) => {
      if (session === hash) {
        entered();
        await gate;
      }
      return verify(session, options);
    });
    now = opensAt + 220;
    const first = players[0].ok({ type: "buzz", clueId, reactionMs: 200, falseStart: false });
    await waiting;
    now = opensAt + 300;
    const second = players[1].ok({ type: "buzz", clueId, reactionMs: 150, falseStart: false });
    // A resync on the same socket proves its buzz handler has run while the queue is blocked.
    const count = players[1].messages.filter((m) => m.t === "view").length;
    players[1].ws.send(JSON.stringify({ t: "resync" }));
    await players[1].until(() =>
      players[1].messages.filter((m) => m.t === "view").length > count ? true : undefined,
    );
    now = opensAt + 1000;
    release();
    await Promise.all([first, second]);
    await a.waitView((v) => v.clue?.stage === "answering");
    expect(applied.map((c) => c.arrivalMs)).toEqual([opensAt + 220, opensAt + 300]);
    expect(a.host.clue?.answeringPlayerId).toBe(players[1].player.me.id);
    expect(a.host.clue?.buzzResult).toEqual({
      winnerId: players[1].player.me.id,
      marginMs: 50,
      contenderCount: 2,
    });
    for (const wire of [...players, d.wire])
      for (const raw of wire.raw)
        expect(raw).not.toMatch(/"pings"|"reactionMs"|"effectiveMs"|"arrivalMs"|"candidates"/);
  });
});

it("fires fractional reaction deadlines without rounding the timer early and getting stuck", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  h = await harness(":memory:", { engine });
  const { a, players } = await table(h, 2);
  await start(a, pack.id, { fairBuzzing: true });
  const clueId = a.host.board!.categories[0].cells[0].clueId;
  await a.ok({ type: "selectClue", clueId });
  await a.ok({ type: "openBuzzers", clueId });
  h.advance(430);
  await vi.advanceTimersByTimeAsync(430);
  await players[0].ok({ type: "buzz", clueId, reactionMs: 200.25, falseStart: false });
  h.advance(170);
  await vi.advanceTimersByTimeAsync(170);
  expect(a.host.clue?.stage).toBe("open");
  h.advance(1);
  await vi.advanceTimersByTimeAsync(1);
  await a.waitView((v) => v.clue?.stage === "answering");
  expect(a.host.clue?.answeringPlayerId).toBe(players[0].player.me.id);
});

it("re-arms a deadline when the timer fires before the clock reaches it", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  h = await harness(":memory:", { engine });
  const { a, players } = await table(h, 2);
  await start(a, pack.id, { fairBuzzing: true });
  const clueId = a.host.board!.categories[0].cells[0].clueId;
  await a.ok({ type: "selectClue", clueId });
  await a.ok({ type: "openBuzzers", clueId });
  h.advance(430);
  await vi.advanceTimersByTimeAsync(430);
  await players[0].ok({ type: "buzz", clueId, reactionMs: 200.25, falseStart: false });
  // The decision is due in 170.25 ms, so the timer is set for 171 ms. It fires with the clock
  // still at 170 ms: the engine refuses it, and without a re-arm the clue would hang.
  h.advance(170);
  await vi.advanceTimersByTimeAsync(171);
  expect(a.host.clue?.stage).toBe("open");
  h.advance(1);
  await vi.advanceTimersByTimeAsync(1);
  await a.waitView((v) => v.clue?.stage === "answering");
  expect(a.host.clue?.answeringPlayerId).toBe(players[0].player.me.id);
});
