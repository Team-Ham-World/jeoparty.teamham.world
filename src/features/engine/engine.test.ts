import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuestionPackJson, type QuestionPack } from "@/features/content";
import { engine } from "./engine";
import type { Actor, Command, RejectionCode, SettingsPatch } from "./contract";

function pack(name = "sample-pack-3x3"): QuestionPack {
  const result = parseQuestionPackJson(
    readFileSync(new URL(`../content/samples/${name}.json`, import.meta.url), "utf8"),
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.data;
}
const host: Actor = { kind: "host" };
const system: Actor = { kind: "system" };
const alice: Actor = { kind: "player", playerId: "a" };
const bob: Actor = { kind: "player", playerId: "b" };
function buzzCommand(clueId: string): Extract<Command, { type: "buzz" }> {
  return {
    type: "buzz",
    clueId,
    reactionMs: 0,
    falseStart: false,
    arrivalMs: 0,
    uplinkBoundMs: 150,
    maxOtherUplinkMs: 150,
  };
}
function game(seed = 123) {
  let s = engine.createGame({ roomCode: "HAM123", seed, now: 0 });
  const run = (command: Command, actor = host, now = s.updatedAt) => {
    const before = structuredClone(s);
    const result = engine.apply(s, actor, command, now);
    expect(s).toEqual(before);
    if (!result.ok) throw new Error(`${command.type}: ${result.rejection.code}`);
    expect(result.state.revision).toBe(s.revision + 1);
    s = result.state;
    expect(
      engine.restore(JSON.parse(JSON.stringify(s))),
      `restore after ${command.type}`,
    ).not.toBeNull();
    return s;
  };
  const reject = (command: Command, code: RejectionCode, actor = host, now = s.updatedAt) => {
    const before = structuredClone(s);
    const result = engine.apply(s, actor, command, now);
    expect(result).toEqual({ ok: false, rejection: { code, message: expect.any(String) } });
    expect(s).toEqual(before);
  };
  const lobby = (p = pack(), patch: SettingsPatch = {}) => {
    run({ type: "setPack", pack: p });
    for (const [playerId, name] of [
      ["a", "Alice"],
      ["b", "Bob"],
    ])
      run({ type: "addPlayer", playerId, name }, system);
    run({ type: "updateSettings", patch: { fairBuzzing: false, ...patch } });
  };
  const start = (p = pack(), patch: SettingsPatch = {}) => {
    lobby(p, patch);
    run({ type: "startGame" });
    run({ type: "continue" });
  };
  const cells = () => engine.hostView(s, 100).board!.categories.flatMap((c) => c.cells);
  const select = (wager = false) => {
    const cell = cells().find((c) => c.wager === wager && c.state === "available")!;
    run({ type: "selectClue", clueId: cell.clueId });
    return cell.clueId;
  };
  const judge = (correct = true) =>
    run({ type: "judge", clueId: s.clue!.clueId, attemptId: s.clue!.attempts.at(-1)!.id, correct });
  const finishClue = () => {
    const clueId = s.clue!.clueId;
    if (s.clue!.stage === "wager") run({ type: "endAttempts", clueId });
    run({ type: "reveal", clueId });
    run({ type: "returnToBoard", clueId });
  };
  return {
    get s() {
      return s;
    },
    run,
    reject,
    lobby,
    start,
    cells,
    select,
    judge,
    finishClue,
  };
}

describe("lobby, settings and permissions", () => {
  it("creates a JSON state with safe empty views and blockers", () => {
    const g = game();
    expect(g.s.revision).toBe(0);
    expect(engine.nextDeadline(g.s)).toBeNull();
    expect(engine.hostView(g.s, 42)).toMatchObject({
      serverNow: 42,
      board: null,
      startBlockers: ["Choose a pack.", "At least two players must join."],
      allowedCommands: ["setPack"],
    });
    expect(engine.playerView(g.s, "absent", 42)).toBeNull();
    expect(engine.restore(JSON.parse(JSON.stringify(g.s)))).not.toBeNull();
    g.reject({ type: "startGame" }, "noPack");
    g.reject({ type: "updateSettings", patch: {} }, "noPack");
    g.reject({ type: "resume" }, "notPaused");
    g.reject({ type: "endGame" }, "wrongPhase");
    g.reject({ type: "adjustScore", playerId: "a", delta: 1, reason: "x" }, "wrongPhase");
  });
  it("uses defaults based on pack size and resets on a pack change", () => {
    const g = game();
    g.lobby();
    expect(g.s.settings).toEqual({
      categoriesPerRound: 3,
      rounds: 1,
      wagerClues: [1, 2],
      finalRound: true,
      fairBuzzing: false,
      falseStartLockout: true,
      timers: { enabled: true, buzzWindowMs: 10000, answerWindowMs: 10000, finalAnswerMs: 45000 },
    });
    g.run({ type: "updateSettings", patch: { finalRound: false, timers: { enabled: false } } });
    g.run({ type: "setPack", pack: pack("ham-starter-pack") });
    expect(g.s.settings).toMatchObject({
      categoriesPerRound: 6,
      rounds: 2,
      finalRound: true,
      timers: { enabled: true },
    });
    const tiny = pack();
    tiny.categories = tiny.categories.slice(0, 1);
    tiny.categories[0].clues = tiny.categories[0].clues.slice(0, 1);
    tiny.dimensions = { categories: 1, cluesPerCategory: 1 };
    const settings = engine.defaultSettings(tiny);
    expect(settings.wagerClues).toEqual([1, 1]);
    g.run({ type: "setPack", pack: tiny });
    g.run({ type: "startGame" });
  });
  it.each<SettingsPatch>([
    { rounds: 2 },
    { categoriesPerRound: 0 },
    { categoriesPerRound: 4 },
    { categoriesPerRound: 1.5 },
    { wagerClues: [-1, 0] },
    { wagerClues: [4, 0] },
    { wagerClues: [0, 1.5] },
    { timers: { buzzWindowMs: 2999 } },
    { timers: { buzzWindowMs: 60001 } },
    { timers: { answerWindowMs: 2999 } },
    { timers: { answerWindowMs: 60001 } },
    { timers: { finalAnswerMs: 9999 } },
    { timers: { finalAnswerMs: 180001 } },
  ])("rejects invalid settings %j without mutation", (patch) => {
    const g = game();
    g.lobby();
    g.reject({ type: "updateSettings", patch }, "invalidSettings");
  });
  it("accepts bounds and constrains wager counts to actual cells", () => {
    const g = game();
    g.lobby();
    g.run({
      type: "updateSettings",
      patch: {
        categoriesPerRound: 1,
        wagerClues: [3, 3],
        timers: { buzzWindowMs: 3000, answerWindowMs: 60000, finalAnswerMs: 180000 },
      },
    });
    const p = pack();
    p.categories.forEach((c) => {
      c.clues = c.clues.slice(0, 1);
    });
    p.dimensions.cluesPerCategory = 1;
    g.run({ type: "setPack", pack: p });
    g.reject(
      { type: "updateSettings", patch: { categoriesPerRound: 1, wagerClues: [2, 0] } },
      "invalidSettings",
    );
  });
  it("validates names, duplicates, seats, renames, lobby removals and presence", () => {
    const g = game();
    for (const name of ["", " ", "x".repeat(33)])
      g.reject({ type: "addPlayer", playerId: "a", name }, "invalidName", system);
    g.run({ type: "addPlayer", playerId: "a", name: " Alice " }, system);
    g.run({ type: "renamePlayer", playerId: "a", name: "Ali" }, system);
    g.reject({ type: "renamePlayer", playerId: "a", name: "" }, "invalidName", system);
    g.reject({ type: "renamePlayer", playerId: "missing", name: "X" }, "unknownPlayer", system);
    g.reject({ type: "removePlayer", playerId: "missing" }, "unknownPlayer");
    g.reject({ type: "removeMember", playerId: "missing" }, "unknownPlayer", system);
    g.reject({ type: "addPlayer", playerId: "a", name: "A" }, "alreadyJoined", system);
    for (let i = 0; i < 5; i++)
      g.run({ type: "addPlayer", playerId: `p${i}`, name: `P${i}` }, system);
    g.reject({ type: "addPlayer", playerId: "extra", name: "Extra" }, "gameFull", system);
    g.run(
      { type: "setPresence", target: { role: "player", playerId: "a" }, connected: false },
      system,
    );
    expect(g.s.players[0]).toMatchObject({ name: "Ali", connected: false });
    g.reject(
      { type: "setPresence", target: { role: "player", playerId: "missing" }, connected: false },
      "unknownPlayer",
      system,
    );
    g.run({ type: "removePlayer", playerId: "a" });
    g.run({ type: "removeMember", playerId: "p0" }, system);
    expect(g.s.players).toHaveLength(4);
  });
  it("needs two players; protects host, player and system command boundaries", () => {
    const g = game();
    g.run({ type: "setPack", pack: pack() });
    g.reject({ type: "startGame" }, "notEnoughPlayers");
    g.run({ type: "addPlayer", playerId: "a", name: "A" }, system);
    g.reject({ type: "startGame" }, "notEnoughPlayers");
    g.reject({ type: "startGame" }, "forbidden", alice);
    g.reject({ type: "startGame" }, "forbidden", system);
    g.reject({ type: "addPlayer", playerId: "b", name: "B" }, "forbidden");
    g.reject(buzzCommand("x"), "forbidden");
    g.reject(buzzCommand("x"), "unknownPlayer", bob);
    g.reject({ type: "submitFinalWager", amount: 0 }, "forbidden");
    const invalid = { ...pack(), schemaVersion: "2.0.0" };
    // Deliberately bypass the compile-time command boundary to test bad external data.
    const result = engine.apply(
      g.s,
      host,
      { type: "setPack", pack: invalid } as unknown as Command,
      100,
    );
    expect(result).toMatchObject({ ok: false, rejection: { code: "invalidSettings" } });
  });
});

describe("boards, control, ordinary clues and wagers", () => {
  it("is deterministic, uses pack tiers and protects the running pack from edits", () => {
    const a = game(17);
    const b = game(17);
    const p = pack("ham-starter-pack");
    a.start(p);
    b.start(p);
    expect(a.s).toEqual(b.s);
    expect(
      a.s.boards.map(
        (board) => board.categories.flatMap((c) => c.cells).filter((c) => c.wager).length,
      ),
    ).toEqual([1, 2]);
    for (const board of a.s.boards) {
      for (const c of board.categories) {
        expect(c.cells.map((cell) => cell.value)).toEqual(
          board.roundIndex ? [200, 400, 600, 800, 1000] : [100, 200, 300, 400, 500],
        );
        expect(c.cells[0].wager).toBe(false);
      }
    }
    p.categories[0].clues[0].answer = "Mutated saved pack";
    expect(a.s.pack!.categories[0].clues[0].answer).not.toBe("Mutated saved pack");
    const outcomes = new Set(
      Array.from({ length: 10 }, (_, seed) => {
        const g = game(seed);
        g.start();
        return JSON.stringify([g.s.controllerId, g.s.boards]);
      }),
    );
    expect(outcomes.size).toBeGreaterThan(1);
  });
  it("sorts clues by tier with stable ties and doubles the default when no other round exists", () => {
    const p = pack();
    p.categories[0].clues.reverse();
    p.categories[0].clues[1].tier = p.categories[0].clues[2].tier;
    const g = game();
    g.start(p, { categoriesPerRound: 1, rounds: 2, wagerClues: [3, 3] });
    expect(g.s.boards[0].categories[0].cells.map((c) => c.clueId)).toEqual([
      p.categories[0].clues[1].id,
      p.categories[0].clues[2].id,
      p.categories[0].clues[0].id,
    ]);
    expect(g.s.boards[0].categories[0].cells.every((c) => c.wager)).toBe(true);
    expect(g.s.boards[1].categories[0].cells.map((c) => c.value)).toEqual([400, 800, 1200]);
  });
  it("runs reading, buzzing, incorrect lockout, reopening, correct control and completion", () => {
    const g = game();
    g.start();
    const original = g.s.controllerId;
    const id = g.select();
    g.reject(buzzCommand(id), "buzzersClosed", alice);
    g.reject({ type: "reveal", clueId: "old" }, "staleClue");
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 });
    g.reject(buzzCommand("old"), "staleClue", alice);
    g.run(buzzCommand(id), alice);
    g.reject(buzzCommand(id), "buzzersClosed", bob);
    g.reject({ type: "judge", clueId: id, attemptId: "old", correct: true }, "staleAttempt");
    g.reject({ type: "endAttempts", clueId: id }, "mustJudgeFirst");
    g.reject({ type: "reveal", clueId: id }, "mustJudgeFirst");
    g.judge(false);
    expect(g.s.players[0].score).toBe(-g.s.clue!.value);
    expect(g.s.controllerId).toBe(original);
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 });
    g.reject(buzzCommand(id), "alreadyAttempted", alice);
    g.run(buzzCommand(id), bob);
    g.judge();
    expect(g.s.controllerId).toBe("b");
    expect(g.s.players[1].score).toBe(g.s.clue!.value);
    g.reject({ type: "openBuzzers", clueId: id, leadMs: 0 }, "wrongPhase");
    g.finishClue();
    g.reject({ type: "selectClue", clueId: id }, "clueCompleted");
    g.reject({ type: "selectClue", clueId: "missing" }, "unknownClue");
    expect(g.s.scoreLog.map((e) => e.kind)).toEqual(["clue", "clue"]);
  });
  it("exhausts eligible players and can end attempts or reveal without a buzz", () => {
    const g = game();
    g.start();
    const id = g.select();
    for (const actor of [alice, bob]) {
      g.run({ type: "openBuzzers", clueId: id, leadMs: 0 });
      g.run(buzzCommand(id), actor);
      g.judge(false);
    }
    g.reject({ type: "openBuzzers", clueId: id, leadMs: 0 }, "noEligiblePlayers");
    g.finishClue();
    const next = g.select();
    g.run({ type: "endAttempts", clueId: next });
    g.reject({ type: "openBuzzers", clueId: next, leadMs: 0 }, "wrongPhase");
    g.finishClue();
  });
  it("limits wagers to the controller, handles negative scores, judging and cancel", () => {
    const g = game();
    g.start();
    const controller = g.s.controllerId!;
    g.run({ type: "adjustScore", playerId: controller, delta: -100, reason: "Correction" });
    const id = g.select(true);
    const bounds = engine.hostView(g.s, 100).wagerBounds!;
    expect(bounds).toEqual({ min: 5, max: 600 });
    g.reject({ type: "submitWager", clueId: id, amount: 5 }, "notController", {
      kind: "player",
      playerId: controller === "a" ? "b" : "a",
    });
    for (const amount of [4, 601, 5.5, NaN])
      g.reject({ type: "submitWager", clueId: id, amount }, "invalidWager");
    g.run(
      { type: "submitWager", clueId: id, amount: 600 },
      { kind: "player", playerId: controller },
    );
    expect(g.s.clue!.attempts).toHaveLength(1);
    g.judge(false);
    expect(g.s.players.find((p) => p.id === controller)!.score).toBe(-700);
    expect(g.s.controllerId).toBe(controller);
    g.finishClue();
    const p = pack();
    const h = game();
    h.start(p, { wagerClues: [2, 0] });
    const cancel = h.select(true);
    h.run({ type: "endAttempts", clueId: cancel });
    h.finishClue();
    expect(h.s.scoreLog).toHaveLength(0);
    const another = h.select(true);
    h.run({ type: "submitWager", clueId: another, amount: 5 });
    h.judge(true);
    h.finishClue();
    expect(h.s.players.some((p) => p.score === 5)).toBe(true);
  });
});

function toFinal(g: ReturnType<typeof game>, p = pack(), scores: [number, number] = [1000, 1000]) {
  g.start(p, { wagerClues: [0, 0] });
  for (const [i, playerId] of ["a", "b"].entries())
    if (scores[i])
      g.run({ type: "adjustScore", playerId, delta: scores[i], reason: "Setup scores" });
  while (g.s.phase === "board" || g.s.phase === "roundIntro") {
    if (g.s.phase === "roundIntro") g.run({ type: "continue" });
    g.select();
    g.finishClue();
  }
}

describe("final round, results and complete games", () => {
  it.each(["sample-pack-3x3", "ham-starter-pack"])(
    "completes %s including every clue, rounds and final",
    (name) => {
      const g = game();
      const p = pack(name);
      toFinal(g, p, [500, 1500]);
      expect(g.s.phase).toBe("final");
      expect(
        g.s.boards
          .flatMap((b) => b.categories.flatMap((c) => c.cells))
          .filter((c) => c.state === "completed"),
      ).toHaveLength(name === "ham-starter-pack" ? 60 : 9);
      expect(g.s.final!.eligiblePlayerIds).toEqual(["a", "b"]);
      g.run({ type: "submitFinalWager", amount: 500 }, alice);
      g.run({ type: "submitFinalWager", amount: 500 }, bob);
      g.run({ type: "showFinalClue" });
      g.run({ type: "submitFinalAnswer", text: "Alice final response" }, alice);
      g.run({ type: "submitFinalAnswer", text: "Bob final response" }, bob);
      g.run({ type: "lockFinalAnswers" });
      expect(g.s.final!.responses.map((r) => r.playerId)).toEqual(["a", "b"]);
      g.reject({ type: "judgeFinal", playerId: "a", correct: true }, "outOfOrder");
      g.reject({ type: "revealFinalResponse", playerId: "b" }, "outOfOrder");
      g.run({ type: "revealFinalResponse", playerId: "a" });
      g.reject({ type: "revealFinalResponse", playerId: "a" }, "outOfOrder");
      g.run({ type: "judgeFinal", playerId: "a", correct: true });
      g.run({ type: "revealFinalResponse", playerId: "b" });
      g.run({ type: "judgeFinal", playerId: "b", correct: false });
      expect(g.s.final!.stage).toBe("done");
      expect(engine.displayView(g.s, 100).final!.answer).toBe(g.s.final!.answer);
      g.run({ type: "finishGame" });
      expect(engine.displayView(g.s, 100).results).toEqual({
        standings: [
          { playerId: "a", name: "Alice", score: 1000, rank: 1 },
          { playerId: "b", name: "Bob", score: 1000, rank: 1 },
        ],
        winnerIds: ["a", "b"],
      });
      expect(g.s.scoreLog.filter((e) => e.kind === "final")).toHaveLength(2);
      expect(engine.restore(JSON.parse(JSON.stringify(g.s)))).not.toBeNull();
    },
  );
  it("later rounds start with the lowest score and earliest join wins ties", () => {
    for (const delta of [0, -5]) {
      const g = game();
      g.start(pack("ham-starter-pack"), { wagerClues: [0, 0] });
      if (delta) g.run({ type: "adjustScore", playerId: "b", delta, reason: "Correction" });
      while (g.s.phase === "board") {
        g.select();
        g.finishClue();
      }
      expect(g.s.phase).toBe("roundIntro");
      expect(g.s.controllerId).toBe(delta ? "b" : "a");
    }
  });
  it("uses the first unused category final clue, with deterministic fallback when all are used", () => {
    const g = game();
    const p = pack();
    g.start(p, { categoriesPerRound: 1, wagerClues: [0, 0] });
    g.run({ type: "adjustScore", playerId: "a", delta: 10, reason: "Correction" });
    while (g.s.phase === "board") {
      g.select();
      g.finishClue();
    }
    expect(g.s.final!.prompt).toBe(p.categories[1].finalClue.prompt);
    const a = game(888);
    const b = game(888);
    toFinal(a);
    toFinal(b);
    expect(a.s.final).toEqual(b.s.final);
  });
  it("eligibility is fixed; submissions are editable; locks use zero and empty defaults; tied scores reveal later join first", () => {
    const g = game();
    toFinal(g);
    g.run({ type: "addPlayer", playerId: "wait", name: "Waiting" }, system);
    g.reject({ type: "submitFinalWager", amount: 0 }, "unknownPlayer", {
      kind: "player",
      playerId: "wait",
    });
    for (const amount of [-1, 1001, 1.5])
      g.reject({ type: "submitFinalWager", amount }, "invalidWager", alice);
    g.run({ type: "submitFinalWager", amount: 333 }, alice);
    g.run({ type: "submitFinalWager", amount: 222 }, alice);
    g.run({
      type: "adjustScore",
      playerId: "a",
      delta: -2000,
      reason: "Correction after eligibility",
    });
    expect(engine.playerView(g.s, "a", 100)!.can.finalWager).toEqual({ min: 0, max: 1000 });
    g.run({ type: "showFinalClue" });
    g.reject({ type: "submitFinalWager", amount: 0 }, "submissionsLocked", alice);
    g.reject({ type: "submitFinalAnswer", text: "x".repeat(201) }, "forbidden", alice);
    g.run({ type: "submitFinalAnswer", text: "x".repeat(200) }, alice);
    g.run({ type: "submitFinalAnswer", text: "Edited" }, alice);
    g.run({ type: "lockFinalAnswers" });
    g.reject({ type: "submitFinalAnswer", text: "Late" }, "submissionsLocked", alice);
    expect(g.s.final!.responses.map((r) => [r.playerId, r.wager, r.answer])).toEqual([
      ["b", 0, ""],
      ["a", 222, "Edited"],
    ]);
    g.run({ type: "revealFinalResponse", playerId: "b" });
    g.run({ type: "judgeFinal", playerId: "b", correct: false });
    g.run({ type: "revealFinalResponse", playerId: "a" });
    g.run({ type: "judgeFinal", playerId: "a", correct: true });
  });
  it("excludes non-positive scores and skips final when no one is eligible or it is disabled", () => {
    const g = game();
    toFinal(g, pack(), [100, -1]);
    expect(g.s.final!.eligiblePlayerIds).toEqual(["a"]);
    g.reject({ type: "submitFinalWager", amount: 0 }, "notEligible", bob);
    const h = game();
    toFinal(h, pack(), [0, -1]);
    expect(h.s.phase).toBe("results");
    const k = game();
    k.start(pack(), { finalRound: false, wagerClues: [0, 0] });
    k.run({ type: "adjustScore", playerId: "a", delta: 10, reason: "Correction" });
    while (k.s.phase === "board") {
      k.select();
      k.finishClue();
    }
    expect(k.s.phase).toBe("results");
  });
  it("uses shared competition ranks and permits zero or negative shared winners and results corrections", () => {
    const g = game();
    g.start();
    g.run({ type: "endGame" });
    expect(engine.displayView(g.s, 100).results!.winnerIds).toEqual(["a", "b"]);
    for (const playerId of ["a", "b"])
      g.run({ type: "adjustScore", playerId, delta: -100, reason: "Correction" });
    expect(engine.displayView(g.s, 100).results!.winnerIds).toEqual(["a", "b"]);
    g.run({ type: "playAgain" });
    g.run({ type: "addPlayer", playerId: "c", name: "C" }, system);
    g.run({ type: "startGame" });
    g.run({ type: "adjustScore", playerId: "a", delta: 10, reason: "Correction" });
    g.run({ type: "adjustScore", playerId: "b", delta: 10, reason: "Correction" });
    g.run({ type: "endGame" });
    expect(engine.displayView(g.s, 100).results!.standings.map((p) => p.rank)).toEqual([1, 1, 3]);
  });
  it("accepts waiting accounts, removes waiting members, and promotes only available seats on play again", () => {
    const g = game();
    g.start();
    for (let i = 0; i < 6; i++)
      g.run({ type: "addPlayer", playerId: `w${i}`, name: `Wait ${i}` }, system);
    g.run({ type: "renamePlayer", playerId: "w0", name: "New name" }, system);
    g.run(
      { type: "setPresence", target: { role: "player", playerId: "w0" }, connected: false },
      system,
    );
    const v = engine.playerView(g.s, "w0", 100)!;
    expect(v.me).toMatchObject({ name: "New name", status: "waiting" });
    expect(v.can).toEqual({ buzz: false, wager: null, finalWager: null, finalAnswer: false });
    g.run({ type: "removeMember", playerId: "w5" }, system);
    expect(engine.playerView(g.s, "w5", 100)).toBeNull();
    g.run({ type: "adjustScore", playerId: "a", delta: 99, reason: "Correction" });
    g.run({ type: "endGame" });
    g.run({ type: "playAgain" });
    expect(g.s.players).toHaveLength(6);
    expect(g.s.players.every((p) => p.score === 0)).toBe(true);
    expect(g.s.waitingPlayers.map((p) => p.id)).toEqual(["w4"]);
    expect(g.s.scoreLog).toEqual([]);
    expect(g.s.boards).toEqual([]);
    expect(engine.restore(JSON.parse(JSON.stringify(g.s)))).not.toBeNull();
  });
});

describe("timers, pause, presence and recovery", () => {
  it("starts buzz and answer timers, rejects stale or early expiry and leaves timeout judging to the host", () => {
    const g = game();
    g.start();
    const id = g.select();
    expect(engine.nextDeadline(g.s)).toBeNull();
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 }, host, 1000);
    const buzz = engine.nextDeadline(g.s)!;
    expect(buzz.at).toBe(11000);
    expect(engine.displayView(g.s, 2000).timer!.remainingMs).toBe(9000);
    g.reject({ type: "timerExpired", timerId: buzz.timerId }, "staleTimer", system, 10999);
    g.run({ type: "timerExpired", timerId: buzz.timerId }, system, 11000);
    expect(g.s.clue!.stage).toBe("closed");
    g.reject({ type: "timerExpired", timerId: buzz.timerId }, "staleTimer", system, 12000);
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 }, host, 12000);
    g.run(buzzCommand(id), alice, 13000);
    const answer = engine.nextDeadline(g.s)!;
    expect(answer.at).toBe(23000);
    g.reject({ type: "timerExpired", timerId: buzz.timerId }, "staleTimer", system, 23000);
    g.run({ type: "timerExpired", timerId: answer.timerId }, system, 23000);
    expect(g.s.clue!.attempts[0].timedOut).toBe(true);
    expect(g.s.clue!.stage).toBe("answering");
    g.judge(false);
    expect(engine.nextDeadline(g.s)).toBeNull();
  });
  it("freezes timers, rotates timer ids on resume, allows maintenance and corrections during pause", () => {
    const g = game();
    g.start();
    const id = g.select();
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 }, host, 1000);
    const old = engine.nextDeadline(g.s)!;
    g.run({ type: "pause" }, host, 4000);
    expect(engine.nextDeadline(g.s)).toBeNull();
    expect(engine.displayView(g.s, 50000).timer).toMatchObject({ endsAt: null, remainingMs: 7000 });
    g.reject({ type: "openBuzzers", clueId: id, leadMs: 0 }, "paused");
    g.reject({ type: "timerExpired", timerId: old.timerId }, "paused", system);
    expect(engine.playerView(g.s, "a", 100)!.can.buzz).toBe(false);
    g.run(
      { type: "setPresence", target: { role: "player", playerId: "a" }, connected: false },
      system,
      5000,
    );
    g.run({ type: "renamePlayer", playerId: "a", name: "New Alice" }, system, 5000);
    g.run({ type: "adjustScore", playerId: "a", delta: 5, reason: "Manual" }, host, 5000);
    g.run({ type: "resume" }, host, 50000);
    expect(engine.nextDeadline(g.s)!.at).toBe(57000);
    expect(engine.nextDeadline(g.s)!.timerId).not.toBe(old.timerId);
    g.reject({ type: "timerExpired", timerId: old.timerId }, "staleTimer", system, 60000);
    g.run({ type: "pause" });
    g.run({ type: "endGame" });
    expect(g.s.phase).toBe("results");
    expect(g.s.paused).toBeNull();
  });
  it("auto-pauses on host loss and never auto-resumes on reconnect; preserves progress when players leave", () => {
    const g = game();
    g.start();
    const id = g.select();
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 });
    g.run(buzzCommand(id), alice);
    g.run({ type: "removeMember", playerId: "a" }, system);
    expect(g.s.players[0].connected).toBe(false);
    g.run({ type: "setPresence", target: { role: "host" }, connected: false }, system, 2000);
    expect(g.s.paused!.reason).toBe("hostOffline");
    g.run({ type: "setPresence", target: { role: "host" }, connected: true }, system, 3000);
    expect(g.s.paused!.reason).toBe("hostOffline");
    g.run({ type: "resume" }, host, 4000);
    g.judge(false);
    const h = game();
    h.run({ type: "setPresence", target: { role: "host" }, connected: false }, system);
    expect(h.s.paused).toBeNull();
  });
  it("disables every timer when configured and enables the wager and final timers at the right stages", () => {
    const g = game();
    g.start(pack(), { timers: { enabled: false } });
    const id = g.select();
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 });
    expect(engine.nextDeadline(g.s)).toBeNull();
    g.run(buzzCommand(id), alice);
    expect(engine.nextDeadline(g.s)).toBeNull();
    const h = game();
    h.start();
    const wager = h.select(true);
    expect(engine.nextDeadline(h.s)).toBeNull();
    h.run({ type: "submitWager", clueId: wager, amount: 5 }, host, 1000);
    expect(engine.nextDeadline(h.s)!.at).toBe(11000);
    const f = game();
    toFinal(f);
    expect(engine.nextDeadline(f.s)).toBeNull();
    f.run({ type: "showFinalClue" }, host, 2000);
    const t = engine.nextDeadline(f.s)!;
    expect(t.at).toBe(47000);
    f.run({ type: "timerExpired", timerId: t.timerId }, system, 47000);
    expect(f.s.final!.stage).toBe("judging");
  });
  it("round-trips JSON into a paused state and preserves remaining time, rng, scores and clue progress", () => {
    const g = game();
    g.start();
    const id = g.select();
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 }, host, 1000);
    g.run({ type: "renamePlayer", playerId: "a", name: "A" }, system, 2500);
    const raw = JSON.parse(JSON.stringify(g.s));
    const restored = engine.restore(raw)!;
    expect(restored).not.toBeNull();
    expect(raw).toEqual(g.s);
    expect(restored.rng).toBe(g.s.rng);
    expect(restored.paused).toEqual({ reason: "restored", since: 2500 });
    expect(restored.timer).toMatchObject({ endsAt: null, remainingMs: 8500 });
    expect(restored.revision).toBe(g.s.revision);
    expect(restored.boards).toEqual(g.s.boards);
    expect(restored.players.every((p) => !p.connected)).toBe(true);
    const result = engine.apply(restored, host, { type: "resume" }, 50000);
    if (!result.ok) throw new Error("Resume failed");
    expect(engine.nextDeadline(result.state)!.at).toBe(58500);
    g.run({ type: "restored" }, system, 90000);
    expect(g.s.timer).toMatchObject({ endsAt: null, remainingMs: 8500 });
    expect(g.s.paused!.reason).toBe("restored");
  });
  it("rejects unusable saved structures and mismatched references", () => {
    const g = game();
    g.start();
    g.select();
    const variants: unknown[] = [
      null,
      {},
      [],
      "json",
      { ...g.s, schema: "old" },
      { ...g.s, revision: -1 },
      { ...g.s, phase: "nonsense" },
      { ...g.s, clue: null },
      { ...g.s, players: [] },
      { ...g.s, controllerId: "missing" },
      { ...g.s, rng: -1 },
      { ...g.s, pack: {} },
      { ...g.s, timer: { id: "t" } },
      { ...g.s, lastEvent: { revision: 1, event: { kind: "resumed", leakedAnswer: "secret" } } },
      { ...g.s, players: [{ ...g.s.players[0], answer: "leak" }, g.s.players[1]] },
      { ...g.s, settings: { ...g.s.settings, rounds: 2 } },
      { ...g.s, boards: [] },
      { ...g.s, players: [g.s.players[0], g.s.players[0]] },
    ];
    for (const value of variants) expect(engine.restore(value), JSON.stringify(value)).toBeNull();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(engine.restore(cyclic)).toBeNull();
  });
});

describe("privacy, views, and defensive input handling", () => {
  function publicViews(g: ReturnType<typeof game>) {
    return [
      engine.displayView(g.s, 100),
      engine.playerView(g.s, "a", 100)!,
      engine.playerView(g.s, "b", 100)!,
    ];
  }
  it("omits answer-bearing pack fields and wager-cell flags from public payloads", () => {
    const g = game();
    g.start();
    for (const v of publicViews(g)) {
      const json = JSON.stringify(v);
      for (const c of g.s.pack!.categories)
        for (const clue of [...c.clues, c.finalClue]) expect(json).not.toContain(clue.answer);
      for (const category of v.board!.categories)
        for (const cell of category.cells)
          expect(Object.keys(cell)).toEqual(["clueId", "value", "state"]);
      expect(json).not.toContain("pointsByTier");
      expect(json).not.toContain("finalClue");
    }
    const id = g.select(true);
    const prompt = g.s.clue!.prompt;
    const answer = g.s.clue!.answer;
    for (const v of publicViews(g)) {
      expect(v.clue!.prompt).toBeNull();
      expect(JSON.stringify(v)).not.toContain(prompt);
      expect(JSON.stringify(v)).not.toContain(answer);
    }
    expect(engine.hostView(g.s, 100).clue).toMatchObject({ prompt, answer });
    const controller = g.s.controllerId!;
    expect(engine.playerView(g.s, controller, 100)!.can.wager).toEqual({ min: 5, max: 600 });
    g.run({ type: "submitWager", clueId: id, amount: 5 });
    for (const v of publicViews(g)) {
      expect(v.clue!.prompt).toBe(prompt);
      expect(v.clue!.wager).toBe(5);
      expect(JSON.stringify(v)).not.toContain(answer);
    }
    g.judge();
    g.run({ type: "reveal", clueId: id });
    for (const v of publicViews(g)) expect(v.clue!.answer).toBe(answer);
  });
  it("keeps other final submissions private until reveal and wagers private until judgment", () => {
    const g = game();
    toFinal(g, pack(), [1000, 2000]);
    const prompt = g.s.final!.prompt;
    const answer = g.s.final!.answer;
    g.run({ type: "submitFinalWager", amount: 137 }, alice);
    g.run({ type: "submitFinalWager", amount: 263 }, bob);
    for (const v of publicViews(g)) {
      expect(v.final!.responses).toEqual([]);
      expect(v.final!.wagerSubmittedIds).toEqual(["a", "b"]);
      const json = JSON.stringify(v);
      expect(json).not.toContain(prompt);
      expect(json).not.toContain(answer);
      if (v.audience !== "player" || v.me.id !== "a") expect(json).not.toContain("137");
      if (v.audience !== "player" || v.me.id !== "b") expect(json).not.toContain("263");
    }
    expect(engine.hostView(g.s, 100).final!.responses.map((r) => r.wager)).toEqual([137, 263]);
    g.run({ type: "showFinalClue" });
    g.run({ type: "submitFinalAnswer", text: "PRIVATE_ALICE_RESPONSE" }, alice);
    g.run({ type: "submitFinalAnswer", text: "PRIVATE_BOB_RESPONSE" }, bob);
    expect(engine.hostView(g.s, 100).final!.responses[0].answer).toBe("PRIVATE_ALICE_RESPONSE");
    g.run({ type: "lockFinalAnswers" });
    expect(engine.hostView(g.s, 100).final!.responses.map((r) => r.answer)).toEqual([
      "PRIVATE_ALICE_RESPONSE",
      "PRIVATE_BOB_RESPONSE",
    ]);
    expect(engine.playerView(g.s, "a", 100)!.myFinal).toEqual({
      wager: 137,
      answer: "PRIVATE_ALICE_RESPONSE",
    });
    for (const v of publicViews(g)) {
      for (const r of v.final!.responses)
        expect(r).toMatchObject({ status: "hidden", answer: null, wager: null });
      const json = JSON.stringify(v);
      if (v.audience !== "player" || v.me.id !== "a")
        expect(json).not.toContain("PRIVATE_ALICE_RESPONSE");
      if (v.audience !== "player" || v.me.id !== "b")
        expect(json).not.toContain("PRIVATE_BOB_RESPONSE");
      expect(json).not.toContain(answer);
    }
    g.run({ type: "revealFinalResponse", playerId: "a" });
    for (const v of publicViews(g))
      expect(v.final!.responses[0]).toMatchObject({
        answer: "PRIVATE_ALICE_RESPONSE",
        wager: null,
      });
    g.run({ type: "judgeFinal", playerId: "a", correct: true });
    for (const v of publicViews(g))
      expect(v.final!.responses[0]).toMatchObject({ wager: 137, correct: true, delta: 137 });
    expect(engine.restore(JSON.parse(JSON.stringify(g.s)))).not.toBeNull();
  });
  it("returns detached views with exact can flags and allowed host commands", () => {
    const g = game();
    g.lobby();
    expect(engine.hostView(g.s, 100).startBlockers).toEqual([]);
    expect(engine.hostView(g.s, 100).allowedCommands).toContain("startGame");
    g.run({ type: "startGame" });
    expect(engine.hostView(g.s, 100).allowedCommands).toContain("continue");
    g.run({ type: "continue" });
    const id = g.select();
    expect(engine.hostView(g.s, 100).allowedCommands).toContain("openBuzzers");
    expect(engine.playerView(g.s, "a", 100)!.can.buzz).toBe(false);
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 });
    expect(engine.playerView(g.s, "a", 100)!.can.buzz).toBe(true);
    g.run(buzzCommand(id), alice);
    const v = engine.hostView(g.s, 100);
    expect(v.allowedCommands).toContain("judge");
    expect(v.allowedCommands).not.toContain("reveal");
    v.players[0].score = 12345;
    v.clue!.attempts[0].playerId = "corrupt";
    expect(g.s.players[0].score).toBe(0);
    expect(g.s.clue!.attempts[0].playerId).toBe("a");
    g.judge(false);
    g.run({ type: "openBuzzers", clueId: id, leadMs: 0 });
    expect(engine.playerView(g.s, "a", 100)!.can.buzz).toBe(false);
    expect(engine.playerView(g.s, "b", 100)!.can.buzz).toBe(true);
    expect(engine.displayView(g.s, 100).lastEvent).toMatchObject({
      revision: g.s.revision,
      event: { kind: "buzzersOpened" },
    });
  });
  it.each([0, 0.5, 100001, -100001, NaN, Infinity])("rejects invalid score delta %s", (delta) => {
    const g = game();
    g.start();
    g.reject({ type: "adjustScore", playerId: "a", delta, reason: "Reason" }, "invalidAdjustment");
  });
  it.each(["", " ", "x".repeat(121)])("rejects invalid adjustment reasons", (reason) => {
    const g = game();
    g.start();
    g.reject({ type: "adjustScore", playerId: "a", delta: 1, reason }, "invalidAdjustment");
  });
  it("requires a playing score target and logs boundary adjustments without undoing progress", () => {
    const g = game();
    g.start();
    const id = g.select();
    g.finishClue();
    g.reject({ type: "adjustScore", playerId: "missing", delta: 1, reason: "X" }, "unknownPlayer");
    g.run({ type: "adjustScore", playerId: "a", delta: 100000, reason: "x".repeat(120) });
    g.run({ type: "adjustScore", playerId: "a", delta: -100000, reason: "Correction" });
    expect(engine.hostView(g.s, 100).scoreLog).toHaveLength(2);
    g.reject({ type: "selectClue", clueId: id }, "clueCompleted");
  });
  it("rejects malformed runtime commands without mutation or exceptions", () => {
    const g = game();
    g.start();
    const before = structuredClone(g.s);
    for (const command of [
      null,
      {},
      { type: "invented" },
      { type: "updateSettings", patch: null },
      { type: "setPresence" },
      { type: "addPlayer", name: null },
      { type: "submitFinalAnswer", text: {} },
    ]) {
      expect(engine.apply(g.s, system, command as Command, 100).ok).toBe(false);
      expect(g.s).toEqual(before);
    }
    expect(engine.apply(g.s, host, { type: "pause" }, NaN).ok).toBe(false);
  });
  it("rejects stage-sensitive host commands in the wrong phase", () => {
    const g = game();
    for (const command of [
      { type: "continue" },
      { type: "selectClue", clueId: "x" },
      { type: "pause" },
      { type: "playAgain" },
      { type: "showFinalClue" },
      { type: "lockFinalAnswers" },
      { type: "finishGame" },
      { type: "judgeFinal", playerId: "a", correct: true },
      { type: "revealFinalResponse", playerId: "a" },
    ] satisfies Command[])
      g.reject(command, "wrongPhase");
    g.start();
    g.reject({ type: "setPack", pack: pack() }, "wrongPhase");
    g.reject({ type: "updateSettings", patch: {} }, "wrongPhase");
    g.reject({ type: "removePlayer", playerId: "a" }, "wrongPhase");
    g.reject({ type: "startGame" }, "wrongPhase");
    g.reject({ type: "submitFinalWager", amount: 0 }, "wrongPhase", alice);
    const id = g.select();
    g.reject({ type: "returnToBoard", clueId: id }, "wrongPhase");
    g.reject({ type: "submitWager", clueId: id, amount: 5 }, "wrongPhase");
    g.reject({ type: "judge", clueId: id, attemptId: "x", correct: true }, "wrongPhase");
    g.run({ type: "reveal", clueId: id });
    g.reject({ type: "reveal", clueId: id }, "wrongPhase");
    g.reject({ type: "endAttempts", clueId: id }, "wrongPhase");
  });
});

describe("forms during a pause", () => {
  const waiter = { type: "addPlayer", playerId: "w", name: "Waiter" } as const;

  it("keeps the wager form for the controller only, and still rejects the wager", () => {
    const g = game();
    g.start();
    g.run(waiter, system);
    const clueId = g.select(true);
    const controller = g.s.controllerId!;
    const other = controller === "a" ? "b" : "a";
    const bounds = engine.hostView(g.s, 100).wagerBounds;
    g.run({ type: "pause" });
    const view = engine.playerView(g.s, controller, 100)!;
    expect(view.paused).not.toBeNull();
    expect(view.can.wager).toEqual(bounds);
    expect(view.can.buzz).toBe(false);
    expect(engine.playerView(g.s, other, 100)!.can.wager).toBeNull();
    expect(engine.playerView(g.s, "w", 100)!.can.wager).toBeNull();
    g.reject({ type: "submitWager", clueId, amount: 5 }, "paused", {
      kind: "player",
      playerId: controller,
    });
    g.reject({ type: "submitWager", clueId, amount: 5 }, "paused");
  });

  it("keeps final-round forms for eligible players only, and still rejects submissions", () => {
    const g = game();
    toFinal(g, pack(), [1000, 0]);
    g.run(waiter, system);
    g.run({ type: "pause" });
    expect(engine.playerView(g.s, "a", 100)!.can.finalWager).toEqual({ min: 0, max: 1000 });
    expect(engine.playerView(g.s, "b", 100)!.can.finalWager).toBeNull();
    expect(engine.playerView(g.s, "w", 100)!.can.finalWager).toBeNull();
    g.reject({ type: "submitFinalWager", amount: 10 }, "paused", alice);
    g.run({ type: "resume" });
    g.run({ type: "showFinalClue" });
    g.run({ type: "pause" });
    expect(engine.playerView(g.s, "a", 100)!.can.finalAnswer).toBe(true);
    expect(engine.playerView(g.s, "a", 100)!.can.finalWager).toBeNull();
    expect(engine.playerView(g.s, "b", 100)!.can.finalAnswer).toBe(false);
    expect(engine.playerView(g.s, "w", 100)!.can.finalAnswer).toBe(false);
    g.reject({ type: "submitFinalAnswer", text: "typed" }, "paused", alice);
  });
});

describe("membership and submission edge cases", () => {
  it("gives a board of tiny values a legal wager of 5", () => {
    const g = game();
    const small = pack();
    for (const round of small.scoring.rounds) round.pointsByTier = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };
    g.start(small);
    const clueId = g.select(true);
    expect(engine.hostView(g.s, 100).wagerBounds).toEqual({ min: 5, max: 5 });
    g.run({ type: "submitWager", clueId, amount: 5 });
    expect(g.s.clue!.wager).toBe(5);
  });

  function fullLobbyWithWaiters() {
    const g = game();
    g.lobby();
    for (const playerId of ["c", "d", "e", "f"])
      g.run({ type: "addPlayer", playerId, name: playerId }, system);
    g.run({ type: "startGame" });
    for (const playerId of ["w1", "w2"])
      g.run({ type: "addPlayer", playerId, name: playerId }, system);
    g.run({ type: "endGame" });
    g.run({ type: "playAgain" });
    expect(g.s.waitingPlayers.map((p) => p.id)).toEqual(["w1", "w2"]);
    return g;
  }

  it("seats the longest-waiting account when the host removes a lobby player", () => {
    const g = fullLobbyWithWaiters();
    g.run({ type: "removePlayer", playerId: "a" });
    expect(g.s.players.map((p) => p.id)).toEqual(["b", "c", "d", "e", "f", "w1"]);
    expect(g.s.waitingPlayers.map((p) => p.id)).toEqual(["w2"]);
    g.reject({ type: "addPlayer", playerId: "new", name: "New" }, "gameFull", system);
  });

  it("seats the longest-waiting account when a lobby player leaves", () => {
    const g = fullLobbyWithWaiters();
    g.run({ type: "removeMember", playerId: "b" }, system);
    expect(g.s.players.map((p) => p.id)).toEqual(["a", "c", "d", "e", "f", "w1"]);
    expect(g.s.waitingPlayers.map((p) => p.id)).toEqual(["w2"]);
  });

  it("does not move the queue when someone on the waiting list leaves", () => {
    const g = fullLobbyWithWaiters();
    g.run({ type: "removeMember", playerId: "w1" }, system);
    expect(g.s.players.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(g.s.waitingPlayers.map((p) => p.id)).toEqual(["w2"]);
  });

  it("retains departed scores through results, then frees seats for waiting players", () => {
    const g = game();
    g.start();
    g.run({ type: "adjustScore", playerId: "a", delta: 100, reason: "Correction" });
    g.run({ type: "addPlayer", playerId: "c", name: "C" }, system);
    g.run({ type: "removeMember", playerId: "a" }, system);
    g.run({ type: "endGame" });
    expect(engine.displayView(g.s, 100).results!.winnerIds).toEqual(["a"]);
    g.run({ type: "playAgain" });
    expect(g.s.players.map((p) => p.id)).toEqual(["b", "c"]);
    expect(engine.playerView(g.s, "a", 100)).toBeNull();
    expect(g.s.departedPlayerIds).toEqual([]);
  });
  it("cancels voluntary departure when the player reconnects before the next game", () => {
    const g = game();
    g.start();
    g.run({ type: "removeMember", playerId: "a" }, system);
    g.run(
      { type: "setPresence", target: { role: "player", playerId: "a" }, connected: true },
      system,
    );
    g.run({ type: "endGame" });
    g.run({ type: "playAgain" });
    expect(g.s.players.map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("treats opaque IDs as data even when they match JavaScript object properties", () => {
    const g = game();
    g.run({ type: "setPack", pack: pack() });
    for (const playerId of ["__proto__", "constructor"])
      g.run({ type: "addPlayer", playerId, name: "Player" }, system);
    g.run({ type: "updateSettings", patch: { wagerClues: [0, 0] } });
    g.run({ type: "startGame" });
    g.run({ type: "continue" });
    for (const playerId of ["__proto__", "constructor"])
      g.run({ type: "adjustScore", playerId, delta: 100, reason: "Correction" });
    while (g.s.phase === "board") {
      g.select();
      g.finishClue();
    }
    expect(engine.hostView(g.s, 100).final!.responses.map((r) => r.wager)).toEqual([null, null]);
    g.run({ type: "submitFinalWager", amount: 50 }, { kind: "player", playerId: "__proto__" });
    g.run({ type: "showFinalClue" });
    g.run(
      { type: "submitFinalAnswer", text: "Opaque ID response" },
      { kind: "player", playerId: "__proto__" },
    );
    g.run({ type: "lockFinalAnswers" });
    expect(g.s.final!.responses.map((r) => [r.playerId, r.wager, r.answer])).toEqual([
      ["constructor", 0, ""],
      ["__proto__", 50, "Opaque ID response"],
    ]);
  });
});

describe("persisted final-state consistency", () => {
  it("rejects duplicate, out-of-order or contradictory final responses", () => {
    const g = game();
    toFinal(g);
    g.run({ type: "showFinalClue" });
    g.run({ type: "lockFinalAnswers" });
    const duplicate = structuredClone(g.s);
    duplicate.final!.responses[1].playerId = duplicate.final!.responses[0].playerId;
    const reversed = structuredClone(g.s);
    reversed.final!.responses.reverse();
    const prematurelyDone = structuredClone(g.s);
    prematurelyDone.final!.stage = "done";
    const forgedAnswer = structuredClone(g.s);
    forgedAnswer.final!.responses[0].answer = "Not the submitted answer";
    const outOfOrder = structuredClone(g.s);
    outOfOrder.final!.responses[1].status = "revealed";
    for (const raw of [duplicate, reversed, prematurelyDone, forgedAnswer, outOfOrder])
      expect(engine.restore(raw)).toBeNull();
  });
  it("rejects non-finite or non-JSON data instead of silently converting it", () => {
    const g = game();
    g.start();
    g.run({ type: "pause" });
    expect(engine.restore({ ...g.s, updatedAt: Infinity })).toBeNull();
    expect(engine.restore({ ...g.s, extra: undefined })).toBeNull();
  });
});
