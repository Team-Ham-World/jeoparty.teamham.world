import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Browser, harness, type Harness } from "./test-harness";

let h: Harness;
let directory: string | undefined;
afterEach(async () => {
  await h?.stop();
  if (directory) {
    rmSync(directory, { recursive: true });
    directory = undefined;
  }
});
async function setup() {
  h = await harness();
  const host = new Browser(h);
  await host.signIn("host");
  const code = await host.createRoom();
  return { code, room: h.app.rooms.get(code)! };
}

describe("room idle clock", () => {
  it("restart bookkeeping does not touch the idle clock", async () => {
    const { code, room } = await setup();
    const updatedAt = room.updatedAt;
    const before = h.app.db.get<{ updated_at: number }>(
      "SELECT updated_at FROM rooms WHERE code = ?",
      code,
    )!.updated_at;
    h.advance(1000);
    await room.system({ type: "restored" }, false);
    expect(room.updatedAt).toBe(updatedAt);
    expect(
      h.app.db.get<{ updated_at: number }>("SELECT updated_at FROM rooms WHERE code = ?", code)
        ?.updated_at,
    ).toBe(before);

    await room.system({ type: "restored" });
    expect(room.updatedAt).toBe(updatedAt + 1000);
    expect(
      h.app.db.get<{ updated_at: number }>("SELECT updated_at FROM rooms WHERE code = ?", code)
        ?.updated_at,
    ).toBe(before + 1000);
  });
  it("shutdown does not touch the idle clock", async () => {
    const { code, room } = await setup();
    const before = h.app.db.get<{ updated_at: number }>(
      "SELECT updated_at FROM rooms WHERE code = ?",
      code,
    )!.updated_at;
    h.advance(1000);
    await room.shutdown();
    expect(
      h.app.db.get<{ updated_at: number }>("SELECT updated_at FROM rooms WHERE code = ?", code)
        ?.updated_at,
    ).toBe(before);
  });
  it("a restart keeps a room's idle clock", async () => {
    directory = mkdtempSync(path.join(os.tmpdir(), "quiz-"));
    const databasePath = path.join(directory, "quiz.sqlite");
    let clock = Date.now();
    h = await harness(databasePath, { now: () => clock });
    const host = new Browser(h);
    await host.signIn("host");
    const code = await host.createRoom();
    clock += 1000;
    const before = h.app.db.get<{ updated_at: number }>(
      "SELECT updated_at FROM rooms WHERE code = ?",
      code,
    )!.updated_at;
    await h.stop();
    clock += 1000;
    h = await harness(databasePath, { now: () => clock });
    expect(
      h.app.db.get<{ updated_at: number }>("SELECT updated_at FROM rooms WHERE code = ?", code)
        ?.updated_at,
    ).toBe(before);
    expect(h.app.rooms.get(code)!.updatedAt).toBe(before);
  });
  it("an unused room still expires 12 hours after its last activity, across a restart", async () => {
    directory = mkdtempSync(path.join(os.tmpdir(), "quiz-"));
    const databasePath = path.join(directory, "quiz.sqlite");
    let clock = Date.now();
    h = await harness(databasePath, { now: () => clock });
    const host = new Browser(h);
    await host.signIn("host");
    const code = await host.createRoom();
    clock += 10 * 3_600_000;
    await h.stop();
    h = await harness(databasePath, { now: () => clock });
    clock += 2 * 3_600_000 + 1;
    await h.app.tick();
    expect(h.app.rooms.has(code)).toBe(false);
  });
});
