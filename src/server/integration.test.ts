import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { engine } from "@/features/engine";
import type { AnyView, ClientCommand, ServerMessage } from "@/features/network/protocol";
import snack from "@/features/content/samples/sample-pack-3x3.json";
import starter from "@/features/content/samples/ham-starter-pack.json";
import { Browser, harness, type Harness } from "./test-harness";
import { connect, finishClue, start, table, type Wire } from "./integration-harness";

let h: Harness | undefined;
async function server(database = ":memory:", now?: () => number) {
  h = await harness(database, { engine, port: 0, now });
  return h;
}
afterEach(async () => {
  await h?.stop();
  h = undefined;
  vi.useRealTimers();
});

const cells = (a: Wire) => a.host.board!.categories.flatMap(c => c.cells);
const scores = (v: AnyView) => Object.fromEntries(v.players.map(p => [p.id, p.score]));
async function converged(a: Wire, clients: Wire[]) {
  const host = a.host;
  for (const client of clients) {
    const view = await client.waitView(v => v.revision === host.revision);
    expect(scores(view)).toEqual(scores(host));
    expect(view.phase).toBe(host.phase);
    expect(view.controllerId).toBe(host.controllerId);
    expect(view.clue?.attempts).toEqual(host.clue?.attempts);
    expect(view.clue?.answeringPlayerId).toBe(host.clue?.answeringPlayerId);
  }
}

/** Audit EVERY received frame, with the host's view at that revision as the oracle. */
function privateFrames(a: Wire, clients: Wire[], pack: typeof snack | typeof starter = snack) {
  const hostViews = new Map(a.messages.flatMap(m => m.t === "view" ? [[m.view.revision, m.view] as const] : []));
  const answers = pack.categories.flatMap(c => [...c.clues.map(clue => clue.answer), c.finalClue.answer]);
  for (const client of clients) {
    const publicAnswers = new Set<string>();
    for (const raw of client.raw) {
      const message: ServerMessage = JSON.parse(raw);
      expect(raw).not.toContain('"audience":"host"');
      expect(raw).not.toContain('"settings":');
      expect(raw).not.toContain('"scoreLog":');
      if (message.t === "view") {
        const v = message.view;
        expect(v.audience).not.toBe("host");
        const hv = hostViews.get(v.revision);
        expect(hv, `Missing host oracle for revision ${v.revision}`).toBeDefined();
        if (v.clue?.stage === "revealed") publicAnswers.add(v.clue.answer!);
        if (v.final?.stage === "done") publicAnswers.add(v.final.answer!);
        if (hv?.clue && hv.clue.stage !== "revealed") expect(v.clue?.answer).toBeNull();
        if (hv?.clue?.stage === "wager") expect(raw).not.toContain(hv.clue.prompt!);
        if (hv?.final?.stage === "wagers") expect(raw).not.toContain(hv.final.prompt!);
        for (const cell of v.board?.categories.flatMap(c => c.cells) ?? []) expect(cell).not.toHaveProperty("wager");
        if (v.final) {
          expect(v.final.answer).toBe(v.final.stage === "done" ? hv?.final?.answer : null);
          for (const response of v.final.responses) {
            const source = hv?.final?.responses.find(r => r.playerId === response.playerId);
            expect(response.answer).toBe(response.status === "hidden" ? null : source?.answer);
            expect(response.wager).toBe(response.status === "judged" ? source?.wager : null);
          }
          // Unique submitted texts must not appear anywhere else in the serialized frame.
          for (const submission of hv?.final?.responses ?? []) {
            const own = v.audience === "player" && v.me.id === submission.playerId;
            const response = v.final.responses.find(r => r.playerId === submission.playerId);
            if (!own && submission.answer && (!response || response.status === "hidden"))
              expect(raw).not.toContain(submission.answer);
            if (!own && submission.wager !== null && (!response || response.status !== "judged"))
              expect(raw).not.toMatch(new RegExp(`[:,\\[]${submission.wager}[,}\\]]`));
          }
          if (v.audience === "player") {
            const own = hv?.final?.responses.find(r => r.playerId === v.me.id);
            expect(v.myFinal).toEqual(own ? { wager: own.wager, answer: own.answer } : null);
          } else expect(v).not.toHaveProperty("myFinal");
        }
      }
      for (const answer of answers) if (!publicAnswers.has(answer)) expect(raw).not.toContain(JSON.stringify(answer).slice(1, -1));
    }
  }
}

async function rejectedSocket(h: Harness, code: string, role: string, browser: Browser, origin = h.app.config.publicOrigin) {
  return new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(`${h.base.replace("http:", "ws:")}/ws?room=${code}&role=${role}`, {
      headers: { cookie: browser.cookie, origin },
    });
    ws.on("unexpected-response", (_, res) => {
      res.resume();
      ws.terminate();
      resolve(res.statusCode!);
    });
    ws.on("error", () => undefined);
    ws.on("open", () => { ws.terminate(); reject(new Error("Unauthorized socket opened")); });
  });
}

async function judge(a: Wire, correct: boolean) {
  const clue = a.host.clue!;
  await a.ok({ type: "judge", clueId: clue.clueId, attemptId: clue.attempts.at(-1)!.id, correct });
}

describe("real engine through HTTP and WebSocket", () => {
  it("plays all nine clues, arbitrates simultaneous buzzes, judges private final responses and plays again", async () => {
    const h = await server();
    const { a, players, d } = await table(h);
    await start(a, snack.id);
    expect(cells(a)).toHaveLength(9);
    const expected = scores(a.host);
    const first = cells(a)[0];
    await a.ok({ type: "selectClue", clueId: first.clueId });
    expect(await players[0].send({ type: "buzz", clueId: first.clueId })).toMatchObject({ ok: false, error: "buzzersClosed" });
    await a.ok({ type: "openBuzzers", clueId: first.clueId });
    const buzzes = await Promise.all(players.slice(0, 2).map(p => p.send({ type: "buzz", clueId: first.clueId })));
    expect(buzzes.filter(ack => ack.ok)).toHaveLength(1);
    expect(buzzes.find(ack => !ack.ok)).toMatchObject({ error: "buzzersClosed" });
    await a.waitView(v => v.clue?.stage === "answering");
    await converged(a, [...players, d.wire]);
    const winnerId = a.host.clue!.answeringPlayerId!;
    const controller = a.host.controllerId;
    await judge(a, false);
    expected[winnerId] -= first.value;
    expect(a.host.controllerId).toBe(controller);
    await a.ok({ type: "openBuzzers", clueId: first.clueId });
    const winner = players.find(p => p.player.me.id === winnerId)!;
    expect(await winner.send({ type: "buzz", clueId: first.clueId })).toMatchObject({ error: "alreadyAttempted" });
    const next = players.find(p => p.player.me.id !== winnerId)!;
    await next.ok({ type: "buzz", clueId: first.clueId });
    await a.waitView(v => v.clue?.attempts.length === 2);
    await judge(a, true);
    expected[next.player.me.id] += first.value;
    expect(a.host.controllerId).toBe(next.player.me.id);
    await finishClue(a);
    expect(cells(a)[0].state).toBe("completed");
    expect(await a.send({ type: "selectClue", clueId: first.clueId })).toMatchObject({ error: "clueCompleted" });
    for (const [i, cell] of cells(a).filter(c => c.state === "available").entries()) {
      h.advance(700); // Model host pacing without sleeping or tripping the real socket limit.
      await a.ok({ type: "selectClue", clueId: cell.clueId });
      await a.ok({ type: "openBuzzers", clueId: cell.clueId });
      const player = players[i % players.length];
      await player.ok({ type: "buzz", clueId: cell.clueId });
      await a.waitView(v => v.clue?.stage === "answering");
      await judge(a, true);
      expected[player.player.me.id] += cell.value;
      await finishClue(a);
    }
    expect(a.host.phase).toBe("final");
    expect(a.host.final?.eligiblePlayerIds).toHaveLength(3);
    const wagers = new Map(players.map((p, i) => [p.player.me.id, 17 + i]));
    for (const [i, p] of players.entries()) {
      await p.ok({ type: "submitFinalWager", amount: wagers.get(p.player.me.id)! });
      await a.waitView(v => v.final?.wagerSubmittedIds.length === i + 1);
    }
    await a.ok({ type: "showFinalClue" });
    for (const [i, p] of players.entries()) {
      await p.ok({ type: "submitFinalAnswer", text: `private-response-${i}` });
      await a.waitView(v => v.final?.answerSubmittedIds.length === i + 1);
    }
    await a.ok({ type: "lockFinalAnswers" });
    const order = [...a.host.players].sort((x, y) => x.score - y.score || a.host.players.indexOf(y) - a.host.players.indexOf(x)).map(p => p.id);
    expect(a.host.final?.responses.map(r => r.playerId)).toEqual(order);
    expect(await a.send({ type: "judgeFinal", playerId: order[0], correct: true })).toMatchObject({ error: "outOfOrder" });
    expect(await a.send({ type: "revealFinalResponse", playerId: order[1] })).toMatchObject({ error: "outOfOrder" });
    for (const [i, playerId] of order.entries()) {
      h.advance(500);
      await a.ok({ type: "revealFinalResponse", playerId });
      await converged(a, [...players, d.wire]);
      for (const p of [...players, d.wire]) expect(p.view.final?.responses.find(r => r.playerId === playerId)).toMatchObject({ status: "revealed", wager: null });
      await a.ok({ type: "judgeFinal", playerId, correct: i !== 0 });
      expected[playerId] += (i !== 0 ? 1 : -1) * wagers.get(playerId)!;
    }
    expect(a.host.final?.stage).toBe("done");
    await a.ok({ type: "finishGame" });
    await converged(a, [...players, d.wire]);
    expect(scores(a.host)).toEqual(expected);
    const sorted = Object.entries(expected).sort((x, y) => y[1] - x[1]);
    expect(a.host.results?.standings.map(p => [p.playerId, p.score])).toEqual(sorted);
    expect(a.host.results?.winnerIds).toEqual(sorted.filter(([, score]) => score === sorted[0][1]).map(([id]) => id));
    await a.ok({ type: "playAgain" });
    await converged(a, [...players, d.wire]);
    expect(a.host.phase).toBe("lobby");
    expect(a.host.players.every(p => p.score === 0)).toBe(true);
    privateFrames(a, [...players, d.wire]);
  });

  it("runs wager bounds, controller and host-on-behalf submissions, and cancellation", async () => {
    const h = await server();
    const { a, players, d } = await table(h);
    await start(a, snack.id, { wagerClues: [3, 0], finalRound: false });
    const wagerCells = cells(a).filter(c => c.wager);
    expect(wagerCells).toHaveLength(3);
    const controller = players.find(p => p.player.me.id === a.host.controllerId)!;
    const other = players.find(p => p !== controller)!;
    for (const [i, cell] of wagerCells.entries()) {
      h.advance(1000);
      await a.ok({ type: "selectClue", clueId: cell.clueId });
      await converged(a, [...players, d.wire]);
      for (const p of [...players, d.wire]) expect(p.view.clue).toMatchObject({ stage: "wager", prompt: null, answer: null });
      expect(await other.send({ type: "submitWager", clueId: cell.clueId, amount: 5 })).toMatchObject({ error: "notController" });
      const bounds = a.host.wagerBounds!;
      expect(bounds).toEqual({ min: 5, max: 600 });
      expect(await controller.send({ type: "submitWager", clueId: cell.clueId, amount: 4 })).toMatchObject({ error: "invalidWager" });
      expect(await a.send({ type: "submitWager", clueId: cell.clueId, amount: 601 })).toMatchObject({ error: "invalidWager" });
      if (i === 2) {
        const before = scores(a.host);
        await a.ok({ type: "endAttempts", clueId: cell.clueId });
        expect(scores(a.host)).toEqual(before);
      } else {
        await (i === 0 ? a : controller).ok({ type: "submitWager", clueId: cell.clueId, amount: i === 0 ? bounds.max : bounds.min });
        await a.waitView(v => v.clue?.stage === "answering");
        expect(a.host.clue?.answeringPlayerId).toBe(controller.player.me.id);
        await judge(a, i === 0);
        expect(a.host.controllerId).toBe(controller.player.me.id);
      }
      await finishClue(a);
    }
    expect(scores(a.host)[controller.player.me.id]).toBe(595);
    await converged(a, [...players, d.wire]);
    privateFrames(a, [...players, d.wire]);
  });

  it("plays the 12-category pack as two rounds with second-round values and lowest-score control", async () => {
    const h = await server();
    const { a, players, d } = await table(h);
    await a.ok({ type: "choosePack", packId: starter.id });
    expect(a.host.settings).toMatchObject({ categoriesPerRound: 6, rounds: 2, wagerClues: [1, 2] });
    await a.ok({ type: "updateSettings", patch: { wagerClues: [0, 0], finalRound: false, timers: { enabled: false } } });
    await a.ok({ type: "startGame" });
    await a.ok({ type: "continue" });
    const expected = scores(a.host);
    await a.ok({ type: "adjustScore", playerId: players[1].player.me.id, delta: -500, reason: "Controller check" });
    expected[players[1].player.me.id] = -500;
    for (let round = 0; round < 2; round++) {
      expect(a.host.board?.categories.map(c => c.id)).toEqual(starter.categories.slice(round * 6, round * 6 + 6).map(c => c.id));
      expect(a.host.board?.categories[0].cells.map(c => c.value)).toEqual(round === 0 ? [100, 200, 300, 400, 500] : [200, 400, 600, 800, 1000]);
      const board = cells(a);
      expect(board).toHaveLength(30);
      for (const [i, cell] of board.entries()) {
        h.advance(400);
        await a.ok({ type: "selectClue", clueId: cell.clueId });
        if (i === 0) {
          await a.ok({ type: "openBuzzers", clueId: cell.clueId });
          await players[2].ok({ type: "buzz", clueId: cell.clueId });
          await a.waitView(v => v.clue?.stage === "answering");
          await judge(a, true);
          expected[players[2].player.me.id] += cell.value;
        }
        await finishClue(a);
      }
      if (round === 0) {
        expect(a.host.phase).toBe("roundIntro");
        expect(a.host.controllerId).toBe(players[1].player.me.id);
        await a.ok({ type: "continue" });
      }
    }
    expect(a.host.phase).toBe("results");
    expect(scores(a.host)).toEqual(expected);
    await converged(a, [...players, d.wire]);
    privateFrames(a, [...players, d.wire], starter);
  }, 20_000); // Two full rounds: slow on small CI machines.

  it("rejects unauthorized roles and privileged payloads and revokes rotated display links", async () => {
    const h = await server();
    const { a, host, code, players, browsers, d } = await table(h);
    const outsider = new Browser(h);
    await outsider.signIn("outsider");
    expect(await rejectedSocket(h, code, "player", outsider)).toBe(403);
    expect(await rejectedSocket(h, code, "host", browsers[0])).toBe(403);
    expect(await rejectedSocket(h, code, "host", host, "https://wrong.invalid")).toBe(403);
    expect(await rejectedSocket(h, code, "display", host)).toBe(401);
    const before = a.host.revision;
    expect(await players[0].send({ type: "startGame" })).toMatchObject({ ok: false, error: "notAllowed" });
    expect(await d.wire.send({ type: "pause" })).toMatchObject({ ok: false, error: "notAllowed" });
    expect(a.host.revision).toBe(before);
    for (const cmd of [{ type: "setPack", pack: snack }, { type: "restored" }, { type: "timerExpired", timerId: "fake" }]) {
      const socket = await connect(h, code, "host", host);
      socket.ws.send(JSON.stringify({ t: "cmd", id: randomUUID(), cmd }));
      expect(await socket.until(() => socket.closeCode ?? undefined)).toBe(1008);
    }
    expect((await host.mutate(`/api/rooms/${code}/display-link`)).status).toBe(200);
    expect(await d.wire.until(() => d.wire.closeCode ?? undefined)).toBe(4010);
    expect(d.wire.messages).toContainEqual({ t: "closing", reason: "displayRevoked" });
    expect((await d.browser.mutate("/api/display/claim", { code, key: d.key })).status).toBe(403);
    expect(await rejectedSocket(h, code, "display", d.browser)).toBe(401);
  });

  it("keeps HTTP answer-bearing packs owner-only while listings contain summaries", async () => {
    const h = await server();
    const { host, browsers, d } = await table(h);
    for (const b of [host, ...browsers, d.browser, new Browser(h)]) {
      for (const pack of [snack, starter]) {
        const res = await b.request(`/api/packs/${pack.id}`);
        expect([401, 404]).toContain(res.status);
        expect(await res.text()).not.toContain('"answer"');
      }
      const list = await b.request("/api/packs");
      expect(await list.text()).not.toContain('"answer"');
    }
    const own = await (await host.mutate(`/api/packs/${snack.id}/duplicate`)).json();
    expect((await host.request(`/api/packs/${own.id}`)).status).toBe(200);
    for (const b of browsers) {
      expect((await b.request(`/api/packs/${own.id}`)).status).toBe(404);
      expect((await b.mutate(`/api/packs/${own.id}/duplicate`)).status).toBe(404);
    }
  });

  it("replays accepted ids after reconnect and re-evaluates rejected ids without repeating scores", async () => {
    const h = await server();
    const { a, host, code, players } = await table(h);
    await start(a, snack.id);
    const cmd: ClientCommand = { type: "adjustScore", playerId: players[0].player.me.id, delta: 123, reason: "Retry check" };
    const id = randomUUID(), rejectedId = randomUUID();
    const original = await a.ok(cmd, id);
    expect(await a.send(cmd, id)).toEqual(original);
    const rejection = await a.send({ type: "startGame" }, rejectedId);
    expect(rejection).toMatchObject({ ok: false, error: "wrongPhase" });
    const second = await connect(h, code, "host", host);
    await a.close();
    const before = second.host.revision;
    expect(await second.send({ ...cmd, delta: 999 }, id)).toEqual(original);
    expect(await second.send({ type: "startGame" }, rejectedId)).toEqual(rejection);
    expect(second.host.revision).toBe(before);
    expect(scores(second.host)[players[0].player.me.id]).toBe(123);
    expect(second.host.scoreLog).toHaveLength(1);
  });

  it("auto-pauses on the last host socket closing and requires explicit resume", async () => {
    const h = await server();
    const { a, host, code, players } = await table(h);
    const second = await connect(h, code, "host", host);
    await start(a, snack.id);
    await a.close();
    expect((await second.waitView(v => v.phase === "board")).paused).toBeNull();
    await second.close();
    for (const p of players) await p.waitView(v => v.paused?.reason === "hostOffline");
    const back = await connect(h, code, "host", host);
    expect(back.host.paused?.reason).toBe("hostOffline");
    expect(await back.send({ type: "selectClue", clueId: cells(back)[0].clueId })).toMatchObject({ error: "paused" });
    await back.ok({ type: "resume" });
    await converged(back, players);
    expect(back.host.paused).toBeNull();
  });

  it("waits late joiners, promotes on play again, and closes removed lobby players", async () => {
    const h = await server();
    const { a, code, players } = await table(h);
    await start(a, snack.id);
    const late = new Browser(h);
    await late.signIn("late");
    expect(await (await late.mutate(`/api/rooms/${code}/join`)).json()).toEqual({ role: "waiting" });
    const waiting = await connect(h, code, "player", late);
    expect(waiting.player.me.status).toBe("waiting");
    await a.ok({ type: "selectClue", clueId: cells(a)[0].clueId });
    await a.ok({ type: "openBuzzers", clueId: a.host.clue!.clueId });
    expect(await waiting.send({ type: "buzz", clueId: a.host.clue!.clueId })).toMatchObject({ error: "unknownPlayer" });
    await a.ok({ type: "endGame" });
    await a.ok({ type: "playAgain" });
    await waiting.waitView(v => v.audience === "player" && v.me.status === "playing");
    expect(a.host.players).toHaveLength(4);
    await a.ok({ type: "removePlayer", playerId: players[0].player.me.id });
    expect(await players[0].until(() => players[0].closeCode ?? undefined)).toBe(4010);
    expect(players[0].messages).toContainEqual({ t: "closing", reason: "removed" });
  });

  it("expires buzz, answer and final timers, freezes pause and continues on resume", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const h = await server();
    const { a, players } = await table(h);
    const advance = async (ms: number) => { h.advance(ms); await vi.advanceTimersByTimeAsync(ms); };
    await start(a, snack.id, { categoriesPerRound: 1, timers: { enabled: true, buzzWindowMs: 3000, answerWindowMs: 3000, finalAnswerMs: 10000 } });
    const first = cells(a)[0];
    await a.ok({ type: "selectClue", clueId: first.clueId });
    await a.ok({ type: "openBuzzers", clueId: first.clueId });
    await advance(1000);
    await a.ok({ type: "pause" });
    expect(a.host.timer).toMatchObject({ remainingMs: 2000, endsAt: null });
    await advance(4000);
    expect(await a.send({ type: "openBuzzers", clueId: first.clueId })).toMatchObject({ error: "paused" });
    await a.ok({ type: "resume" });
    await advance(1999);
    expect(a.host.clue?.stage).toBe("open");
    await advance(1);
    await a.waitView(v => v.clue?.stage === "closed");
    expect(await players[0].send({ type: "buzz", clueId: first.clueId })).toMatchObject({ error: "buzzersClosed" });
    await a.ok({ type: "openBuzzers", clueId: first.clueId });
    await players[0].ok({ type: "buzz", clueId: first.clueId });
    await a.waitView(v => v.clue?.stage === "answering");
    await advance(3000);
    await a.waitView(v => v.clue?.attempts[0].timedOut === true);
    expect(a.host.clue?.stage).toBe("answering");
    await judge(a, true);
    await finishClue(a);
    for (const cell of cells(a).filter(c => c.state === "available")) {
      await a.ok({ type: "selectClue", clueId: cell.clueId });
      await finishClue(a);
    }
    await a.ok({ type: "showFinalClue" });
    await players[0].ok({ type: "submitFinalAnswer", text: "Timer answer" });
    await advance(10000);
    await a.waitView(v => v.final?.stage === "judging");
    expect(a.host.final?.responses[0]).toMatchObject({ answer: "Timer answer", wager: 0, status: "hidden" });
    expect(a.host.timer).toBeNull();
  });

  it("recovers scores, clue progress, retry acks, identities and remaining timer from SQLite", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "quiz-real-"));
    let time = Date.now();
    try {
      const db = path.join(dir, "quiz.sqlite");
      const first = await server(db, () => time);
      const { a, host, code, players, browsers } = await table(first);
      await start(a, snack.id, { timers: { enabled: true } });
      const cell = cells(a)[0];
      await a.ok({ type: "selectClue", clueId: cell.clueId });
      await a.ok({ type: "openBuzzers", clueId: cell.clueId });
      await players[0].ok({ type: "buzz", clueId: cell.clueId });
      await a.waitView(v => v.clue?.stage === "answering");
      await judge(a, true);
      await finishClue(a);
      const id = randomUUID();
      const retry: ClientCommand = { type: "adjustScore", playerId: players[1].player.me.id, delta: 111, reason: "Durable retry" };
      const originalAck = await a.ok(retry, id);
      const next = cells(a).find(c => c.state === "available")!;
      await a.ok({ type: "selectClue", clueId: next.clueId });
      await a.ok({ type: "openBuzzers", clueId: next.clueId });
      time += 2500;
      a.ws.send(JSON.stringify({ t: "resync" }));
      await a.waitView(v => v.timer?.remainingMs === 7500);
      const expected = scores(a.host);
      const ids = players.map(p => p.player.me.id);
      await first.stop();
      time += 60000; // Offline time must not consume the paused timer.
      const second = await server(db, () => time);
      const restored = await connect(second, code, "host", host);
      expect(restored.host.paused?.reason).toBe("restored");
      expect(scores(restored.host)).toEqual(expected);
      expect(cells(restored).find(c => c.clueId === cell.clueId)?.state).toBe("completed");
      expect(restored.host.clue).toMatchObject({ clueId: next.clueId, stage: "open" });
      expect(restored.host.timer).toMatchObject({ endsAt: null, remainingMs: 7500 });
      expect(await restored.send(retry, id)).toEqual(originalAck);
      const reconnected: Wire[] = [];
      for (const [i, b] of browsers.entries()) {
        const player = await connect(second, code, "player", b);
        expect(player.player.me.id).toBe(ids[i]);
        reconnected.push(player);
      }
      await restored.ok({ type: "resume" });
      expect(restored.host.timer?.endsAt).toBe(time + 7500);
      await reconnected[1].ok({ type: "buzz", clueId: next.clueId });
      await restored.waitView(v => v.clue?.stage === "answering");
      await judge(restored, true);
      expect(scores(restored.host)[ids[1]]).toBe(111 + next.value);
      await finishClue(restored);
    } finally {
      await h?.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
