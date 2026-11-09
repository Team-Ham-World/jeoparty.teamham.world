import { describe, expect, it } from "vitest";
import { validateQuestionPack } from "@/features/content";
import pack from "@/features/content/samples/sample-pack-3x3.json";
import { engine } from "./engine";
import type { Actor, Command, GameState } from "./contract";

function game(fairBuzzing = true, falseStartLockout = true) {
  let state = engine.createGame({ roomCode: "BCDFG", seed: 1, now: 0 });
  const apply = (cmd: Command, now = 0, actor: Actor = { kind: "host" }) => {
    const result = engine.apply(state, actor, cmd, now);
    if (result.ok) {
      state = result.state;
      expect(engine.restore(JSON.parse(JSON.stringify(state)))).not.toBeNull();
    }
    return result;
  };
  const parsed = validateQuestionPack(pack);
  if (!parsed.ok) throw new Error("Bad fixture");
  apply({ type: "setPack", pack: parsed.data });
  apply({ type: "updateSettings", patch: { fairBuzzing, falseStartLockout, wagerClues: [0, 0] } });
  for (const playerId of ["a", "b", "c"])
    apply({ type: "addPlayer", playerId, name: playerId }, 0, { kind: "system" });
  apply({ type: "startGame" });
  apply({ type: "continue" });
  const clueId = state.boards[0].categories[0].cells[0].clueId;
  apply({ type: "selectClue", clueId });
  apply({ type: "openBuzzers", clueId, leadMs: 200 }, 1000);
  const buzz = (
    playerId: string,
    reactionMs: number,
    arrivalMs: number,
    uplinkBoundMs = 150,
    falseStart = false,
    processAt = arrivalMs,
    maxOtherUplinkMs = 150,
  ) =>
    apply(
      { type: "buzz", clueId, reactionMs, falseStart, arrivalMs, uplinkBoundMs, maxOtherUplinkMs },
      processAt,
      { kind: "player", playerId },
    );
  const decide = () => {
    const d = engine.nextDeadline(state)!;
    return apply({ type: "timerExpired", timerId: d.timerId }, d.at, { kind: "system" });
  };
  return {
    get state() {
      return state;
    },
    set state(s: GameState) {
      state = s;
    },
    apply,
    buzz,
    decide,
    clueId,
  };
}

describe("fair buzzing", () => {
  it("starts the buzz window at opensAt and exposes it to all audiences", () => {
    const g = game();
    expect(g.state.clue?.opensAt).toBe(1200);
    expect(g.state.timer).toMatchObject({ endsAt: 11200, remainingMs: 10000, durationMs: 10000 });
    for (const view of [
      engine.hostView(g.state, 1050),
      engine.displayView(g.state, 1050),
      engine.playerView(g.state, "a", 1050)!,
    ]) {
      expect(view.clue?.opensAt).toBe(1200);
      expect(view.timer?.remainingMs).toBe(10000);
    }
  });
  it("lets a faster reaction on a slower network win, even after slow verification", () => {
    const g = game();
    expect(g.buzz("a", 200, 1420, 20, false, 2000).ok).toBe(true);
    expect(engine.nextDeadline(g.state)?.at).toBe(1590);
    expect(g.buzz("b", 150, 1500, 150, false, 2200).ok).toBe(true);
    g.decide();
    expect(g.state.clue?.answeringPlayerId).toBe("b");
    expect(g.state.clue?.buzzResult).toEqual({ winnerId: "b", marginMs: 50, contenderCount: 2 });
    for (const view of [
      engine.hostView(g.state, 2200),
      engine.displayView(g.state, 2200),
      engine.playerView(g.state, "a", 2200)!,
    ]) {
      expect(view.clue?.buzzResult).toEqual(g.state.clue?.buzzResult);
      expect(JSON.stringify(view)).not.toMatch(
        /effectiveMs|arrivalMs|reactionMs|candidates|uplink/,
      );
    }
  });
  it("clamps impossible early and late claims and caps compensation", () => {
    const g = game();
    g.buzz("a", 0, 1500, 20);
    expect(g.state.clue?.collection?.candidates[0].effectiveMs).toBe(1440);
    g.buzz("b", 99999, 1520, 250);
    expect(g.state.clue?.collection?.candidates[1].effectiveMs).toBe(1520);
    g.buzz("c", 0, 1530, 5000);
    expect(g.state.clue?.collection?.candidates[2].effectiveMs).toBe(1240);
  });
  it("uses deterministic collection length with a hard 250 ms maximum", () => {
    const g = game();
    g.buzz("a", 200, 1400, 20, false, 1400, 250);
    expect(engine.nextDeadline(g.state)?.at).toBe(1650);
    const d = engine.nextDeadline(g.state)!;
    expect(
      g.apply({ type: "timerExpired", timerId: d.timerId }, d.at - 1, { kind: "system" }).ok,
    ).toBe(false);
    expect(g.buzz("b", 150, 1651).ok).toBe(false);
    g.decide();
    expect(g.buzz("c", 100, 1660).ok).toBe(false);
    expect(g.state.clue?.buzzResult?.marginMs).toBeNull();
  });
  it("accepts the deadline boundary, rejects duplicates and breaks ties by arrival order", () => {
    const g = game();
    g.buzz("b", 200, 1420);
    const at = engine.nextDeadline(g.state)!.at;
    expect(g.buzz("b", 100, 1450).ok).toBe(false);
    g.buzz("a", 200, at, 250);
    g.decide();
    expect(g.state.clue?.buzzResult).toEqual({ winnerId: "b", marginMs: 0, contenderCount: 2 });
  });
  it("enforces the false-start floor only when enabled", () => {
    const g = game();
    expect(g.buzz("a", 0, 1449, 150, true).ok).toBe(false);
    g.buzz("a", 0, 1450, 150, true);
    expect(g.state.clue?.collection?.candidates[0].effectiveMs).toBe(1450);
    const off = game(true, false);
    off.buzz("a", 0, 1300, 150, true);
    expect(off.state.clue?.collection?.candidates[0].effectiveMs).toBe(1200);
  });
  it("rejects early arrivals and future transport timestamps", () => {
    const g = game();
    expect(g.buzz("a", 0, 1159).ok).toBe(false);
    expect(g.buzz("b", 0, 1180).ok).toBe(true);
    expect(g.state.clue?.collection?.candidates[0].effectiveMs).toBe(1180);
    expect(g.buzz("a", 0, 1400, 150, false, 1399).ok).toBe(false);
  });
  it("keeps first-processed behavior with fair buzzing off, independent of lockout", () => {
    const g = game(false);
    expect(g.state.clue?.opensAt).toBe(1000);
    g.buzz("a", 999, 1300, 0, true);
    expect(g.state.clue?.answeringPlayerId).toBe("a");
    expect(g.buzz("b", 0, 1290).ok).toBe(false);
    expect(g.state.clue?.collection).toBeNull();
  });
  it("retains disconnected candidates and decides on resume or restart", () => {
    for (const restart of [false, true]) {
      const g = game();
      g.buzz("a", 200, 1420);
      g.buzz("b", 150, 1500);
      g.apply(
        { type: "setPresence", target: { role: "player", playerId: "b" }, connected: false },
        1501,
        { kind: "system" },
      );
      g.apply({ type: "pause" }, 1510);
      if (restart) g.state = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
      expect(engine.nextDeadline(g.state)).toBeNull();
      expect(g.buzz("c", 100, 1520).ok).toBe(false);
      g.apply({ type: "resume" }, 5000);
      expect(g.state.clue?.answeringPlayerId).toBe("b");
      expect(g.state.timer?.endsAt).toBe(15000);
    }
  });
  it("makes the buzz result the last event when resume decides a collection", () => {
    const g = game();
    g.buzz("a", 200, 1420);
    g.apply({ type: "pause" }, 1510);
    const result = g.apply({ type: "resume" }, 5000);
    expect(result.ok && result.events.map((e) => e.kind)).toEqual(["resumed", "buzzAccepted"]);
    expect(g.state.lastEvent?.event).toMatchObject({ kind: "buzzAccepted", playerId: "a" });
    expect(g.state.timer).toMatchObject({ endsAt: 15000, remainingMs: 10000 });
  });
  it("still reports resumed when there is no collection to decide", () => {
    const g = game();
    g.apply({ type: "pause" }, 1100);
    g.apply({ type: "resume" }, 5000);
    expect(g.state.lastEvent?.event.kind).toBe("resumed");
  });
  it("keeps a live room restorable when candidate arrival times go backward", () => {
    const g = game();
    g.buzz("a", 200, 1420);
    // game() asserts that every applied state restores.
    expect(g.buzz("b", 150, 1410, 150, false, 1421).ok).toBe(true);
    const arrivals = g.state.clue?.collection?.candidates.map((c) => c.arrivalMs);
    expect(arrivals).toEqual([1420, 1410]);
    expect(engine.restore(JSON.parse(JSON.stringify(g.state)))).not.toBeNull();
    g.decide();
    expect(g.state.clue?.answeringPlayerId).toBe("b");
  });
  it("migrates an old paused save so resume does not read the gap as lead", () => {
    const g = game();
    g.apply({ type: "pause" }, 1100);
    g.apply({ type: "adjustScore", playerId: "a", delta: 1, reason: "correction" }, 3000);
    const legacy = JSON.parse(JSON.stringify(g.state));
    delete legacy.clue.opensAt;
    g.state = engine.restore(legacy)!;
    expect(g.state.clue?.opensAt).toBe(1100);
    g.apply({ type: "resume" }, 5000);
    expect(g.state.clue?.opensAt).toBe(5000);
  });
  it("migrates an old unpaused save to its last saved time", () => {
    const g = game();
    const legacy = JSON.parse(JSON.stringify(g.state));
    delete legacy.clue.opensAt;
    expect(engine.restore(legacy)?.clue?.opensAt).toBe(legacy.updatedAt);
  });
  it("freezes opening lead and buzz time through pause and restore", () => {
    const g = game();
    g.apply({ type: "pause" }, 1100);
    g.state = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
    g.apply({ type: "adjustScore", playerId: "a", delta: 1, reason: "correction" }, 3000);
    g.state = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
    g.apply({ type: "restored" }, 4500, { kind: "system" });
    g.apply({ type: "resume" }, 5000);
    expect(g.state.clue?.opensAt).toBe(5100);
    expect(g.state.timer?.endsAt).toBe(15100);
  });
  it("restores an unpaused lead and collection and migrates old saved games", () => {
    const g = game();
    const restored = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
    expect(restored.paused?.reason).toBe("restored");
    expect(restored.timer?.remainingMs).toBe(10000);
    g.buzz("a", 100, 1350);
    const collecting = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
    expect(collecting.clue?.collection).toEqual(g.state.clue?.collection);
    const legacy = JSON.parse(JSON.stringify(restored));
    delete legacy.settings.fairBuzzing;
    delete legacy.settings.falseStartLockout;
    delete legacy.clue.opensAt;
    delete legacy.clue.collection;
    delete legacy.clue.buzzResult;
    expect(engine.restore(legacy)?.settings.fairBuzzing).toBe(true);
    const invalid = structuredClone(g.state);
    invalid.clue!.collection!.candidates[0].playerId = "outsider";
    expect(engine.restore(invalid)).toBeNull();
  });
});

it("defaults both settings on and validates a fractional lead through pause and restore", () => {
  const fresh = engine.createGame({ roomCode: "BCDFG", seed: 1, now: 0 });
  expect(fresh.settings).toMatchObject({ fairBuzzing: true, falseStartLockout: true });
  const g = game();
  g.apply({ type: "endAttempts", clueId: g.clueId }, 1000);
  g.apply({ type: "reveal", clueId: g.clueId }, 1000);
  g.apply({ type: "returnToBoard", clueId: g.clueId }, 1000);
  const next = g.state.boards[0].categories[0].cells[1].clueId;
  g.apply({ type: "selectClue", clueId: next }, 1000);
  g.apply({ type: "openBuzzers", clueId: next, leadMs: 200.5 }, 1000);
  g.apply({ type: "pause" }, 1300);
  expect(g.state.timer?.remainingMs).toBe(9900.5);
  expect(engine.restore(JSON.parse(JSON.stringify(g.state)))).not.toBeNull();
});
