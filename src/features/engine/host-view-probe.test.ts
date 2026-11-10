import { describe, expect, it } from "vitest";
import { validateQuestionPack } from "@/features/content";
import pack from "@/features/content/samples/sample-pack-3x3.json";
import { engine } from "./engine";
import type { Actor, Command } from "./contract";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function gameStates() {
  let state = engine.createGame({ roomCode: "BCDFG", seed: 1, now: 0 });
  const apply = (command: Command, now = 0, actor: Actor = { kind: "host" }) => {
    const result = engine.apply(state, actor, command, now);
    if (!result.ok) throw new Error(result.rejection.message);
    state = result.state;
  };
  const parsed = validateQuestionPack(pack);
  if (!parsed.ok) throw new Error("Bad fixture");
  apply({ type: "setPack", pack: parsed.data });
  apply({ type: "updateSettings", patch: { wagerClues: [0, 0] } });
  for (const playerId of ["a", "b", "c"])
    apply({ type: "addPlayer", playerId, name: playerId }, 0, { kind: "system" });
  const lobby = state;
  apply({ type: "startGame" });
  apply({ type: "continue" });
  const board = state;
  const clueId = state.boards[0].categories[0].cells[0].clueId;
  apply({ type: "selectClue", clueId });
  const reading = state;
  apply({ type: "openBuzzers", clueId, leadMs: 200 }, 1000);
  return [lobby, board, reading, state];
}

describe("host view probes", () => {
  const now = 1000;

  it("building the host view never writes to the game state or its pack", () => {
    for (const state of gameStates()) {
      const frozen = deepFreeze(structuredClone(state));
      expect(() => engine.hostView(frozen, now)).not.toThrow();
    }
  });

  it("the allowed commands are the same with and without a frozen state", () => {
    for (const state of gameStates()) {
      const frozen = deepFreeze(structuredClone(state));
      expect(engine.hostView(frozen, now).allowedCommands).toEqual(
        engine.hostView(state, now).allowedCommands,
      );
    }
  });

  it("the host view still copies the state", () => {
    for (const state of gameStates()) {
      const view = engine.hostView(state, now);
      if (view.board) expect(view.board).not.toBe(state.boards[state.roundIndex]);
    }
  });
});
