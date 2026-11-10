import { describe, expect, it } from "vitest";
import { validateQuestionPack } from "@/features/content";
import pack from "@/features/content/samples/sample-pack-3x3.json";
import { engine } from "./engine";
import type { Actor, Command } from "./contract";

function game(started = true) {
  let state = engine.createGame({ roomCode: "BCDFG", seed: 1, now: 0 });
  const apply = (cmd: Command, now = 0, actor: Actor = { kind: "host" }) => {
    const result = engine.apply(state, actor, cmd, now);
    if (!result.ok) throw new Error(`${cmd.type}: ${result.rejection.code}`);
    state = result.state;
  };
  const parsed = validateQuestionPack(pack);
  if (!parsed.ok) throw new Error("Bad fixture");
  apply({ type: "setPack", pack: parsed.data });
  apply({ type: "updateSettings", patch: { wagerClues: [0, 0] } });
  for (const playerId of ["a", "b", "c"])
    apply({ type: "addPlayer", playerId, name: playerId }, 0, { kind: "system" });
  if (started) {
    apply({ type: "startGame" });
    apply({ type: "continue" });
    const clueId = state.boards[0].categories[0].cells[0].clueId;
    apply({ type: "selectClue", clueId });
    apply({ type: "openBuzzers", clueId, leadMs: 200 }, 1000);
  }
  return {
    get state() {
      return state;
    },
    apply,
  };
}

describe("restored command", () => {
  it("announces the pause after a restart of a game in progress", () => {
    const g = game();
    expect(g.state.clue?.stage).toBe("open");
    expect(g.state.timer).toMatchObject({ endsAt: 11200, remainingMs: 10000 });
    const restored = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
    expect(restored).not.toBeNull();
    expect(restored.paused?.reason).toBe("restored");
    expect(restored.timer).toMatchObject({ endsAt: null, remainingMs: 10000 });

    const result = engine.apply(restored, { kind: "system" }, { type: "restored" }, 4500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.revision).toBe(restored.revision + 1);
    expect(result.state.paused).toEqual(restored.paused);
    expect(result.state.timer).toEqual(restored.timer);
    expect(result.state.lastEvent).toEqual({
      revision: restored.revision + 1,
      event: { kind: "paused", reason: "restored" },
    });
    for (const player of result.state.players) expect(player.connected).toBe(false);
    expect(result.state.hostConnected).toBe(false);
  });

  it("does nothing but count a revision in the lobby", () => {
    const g = game(false);
    expect(g.state.phase).toBe("lobby");
    const restored = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
    expect(restored).not.toBeNull();

    const result = engine.apply(restored, { kind: "system" }, { type: "restored" }, 4500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.paused).toBeNull();
    expect(result.state.lastEvent).toEqual(restored.lastEvent);
    expect(result.state.revision).toBe(restored.revision + 1);
  });

  it("keeps the original pause time when the game was already paused", () => {
    const g = game();
    g.apply({ type: "pause" }, 1100);
    expect(g.state.paused).toEqual({ reason: "host", since: 1100 });
    const restored = engine.restore(JSON.parse(JSON.stringify(g.state)))!;
    expect(restored).not.toBeNull();

    const result = engine.apply(restored, { kind: "system" }, { type: "restored" }, 4500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.paused).toEqual({ reason: "restored", since: 1100 });
  });
});
