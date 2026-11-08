import { describe, expect, it } from "vitest";
import type { ClueView } from "@/features/engine/contract";
import { SPECS } from "@/features/preview/fixtures";
import { answeringMargin, formatMargin } from "./format";

describe("formatMargin", () => {
  it("hides the margin when nobody else buzzed", () => {
    expect(formatMargin(null)).toBeNull();
  });

  it.each([
    [0, "by a hair"], // an exact tie, broken by arrival order
    [4, "by a hair"],
    [9.9, "by a hair"],
  ])("says %s ms is by a hair, not a rounded 0.00 or 0.01 s", (ms, text) => {
    expect(formatMargin(ms)).toBe(text);
  });

  it.each([
    [10, "by 0.01 s"],
    [14, "by 0.01 s"],
    [15, "by 0.02 s"], // rounds half up without float drift (0.015 → 0.02)
    [40, "by 0.04 s"],
    [250, "by 0.25 s"],
    [994, "by 0.99 s"],
  ])("shows %s ms in hundredths of a second", (ms, text) => {
    expect(formatMargin(ms)).toBe(text);
  });

  it.each([
    [995, "by 1.0 s"],
    [1234, "by 1.2 s"],
  ])("switches to tenths from a second up (%s ms)", (ms, text) => {
    expect(formatMargin(ms)).toBe(text);
  });
});

describe("answeringMargin", () => {
  const race = SPECS.answeringRace.clue as ClueView;

  it("shows the margin for the player answering the race they won", () => {
    expect(answeringMargin(race)).toBe("by 0.04 s");
  });

  it("hides it with a single contender", () => {
    expect(
      answeringMargin({
        ...race,
        buzzResult: { winnerId: "p-medchu", marginMs: null, contenderCount: 1 },
      }),
    ).toBeNull();
  });

  it("hides it once the answer is judged", () => {
    expect(answeringMargin({ ...race, stage: "closed", answeringPlayerId: null })).toBeNull();
  });

  it("never pins a stale result on a different answerer", () => {
    expect(answeringMargin({ ...race, answeringPlayerId: "p-ivvy" })).toBeNull();
  });

  it("is absent when the view has no buzz result (fair buzzing off, or a wager clue)", () => {
    expect(answeringMargin({ ...race, buzzResult: null })).toBeNull();
  });
});
