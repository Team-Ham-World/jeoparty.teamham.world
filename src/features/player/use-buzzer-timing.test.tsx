// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBuzzerTiming } from "./use-buzzer-timing";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const options = {
  opensAt: 1200,
  active: true,
  clockOffsetMs: 100,
  lockoutEnabled: true,
  clueId: "clue",
};
const readingOptions: Parameters<typeof useBuzzerTiming>[0] = {
  ...options,
  active: false,
  opensAt: null,
};
function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

describe("buzzer timing", () => {
  it("lights on the synced opening and measures reaction from the committed light", () => {
    vi.setSystemTime(1000);
    const { result, unmount } = renderHook(() => useBuzzerTiming(options));
    expect(result.current.lit).toBe(false);
    advance(99);
    expect(result.current.lit).toBe(false);
    advance(1);
    expect(result.current.lit).toBe(true);
    advance(73);
    expect(result.current.reactionMs()).toBe(73);
    unmount();
  });
  it("starts reaction at actual lighting for a late view", () => {
    vi.setSystemTime(2000);
    const { result, unmount } = renderHook(() => useBuzzerTiming(options));
    advance(0);
    advance(40);
    expect(result.current.reactionMs()).toBe(40);
    unmount();
  });
  it.each([null, 500])(
    "preserves a false start through mashing while a delayed open view still has opensAt=%s",
    (opensAt) => {
      vi.setSystemTime(1000);
      const { result, rerender, unmount } = renderHook((props) => useBuzzerTiming(props), {
        initialProps: { ...options, active: false, opensAt },
      });
      act(() => result.current.recordEarlyTap()); // Server time 1100, before opening at 1200.
      for (let tap = 0; tap < 100; tap++) {
        advance(100);
        act(() => result.current.recordEarlyTap()); // At or after the scheduled opening.
      }
      expect(result.current.lit).toBe(false);
      rerender(options);
      advance(0);
      expect(result.current).toMatchObject({ lit: true, falseStart: true, lockedOut: true });
      expect(result.current.reactionMs()).toBe(0);
      advance(249);
      expect(result.current.lockedOut).toBe(true);
      advance(1);
      expect(result.current).toMatchObject({ falseStart: true, lockedOut: false });
      expect(result.current.reactionMs()).toBe(250);
      unmount();
    },
  );
  it.each([
    { taps: [1000, 2000], falseStart: true },
    { taps: [999, 2000], falseStart: false },
    { taps: [2000], falseStart: false },
    { taps: [2001, 2100], falseStart: false },
    { taps: [0, 1900, 2000, 2801], falseStart: true },
  ])("checks retained taps $taps against the scheduled second", ({ taps, falseStart }) => {
    vi.setSystemTime(0);
    const { result, rerender, unmount } = renderHook(useBuzzerTiming, {
      initialProps: { ...readingOptions, clockOffsetMs: 0 },
    });
    let now = 0;
    for (const at of taps) {
      advance(at - now);
      act(() => result.current.recordEarlyTap());
      now = at;
    }
    advance(3000 - now);
    rerender({ ...options, opensAt: 2000, clockOffsetMs: 0 });
    advance(0);
    expect(result.current).toMatchObject({ lit: true, falseStart, lockedOut: falseStart });
    unmount();
  });
  it("ignores retained taps from another clue", () => {
    vi.setSystemTime(1000);
    const { result, rerender, unmount } = renderHook(useBuzzerTiming, {
      initialProps: readingOptions,
    });
    act(() => result.current.recordEarlyTap());
    advance(200);
    rerender({ ...options, clueId: "next-clue" });
    advance(0);
    expect(result.current).toMatchObject({ lit: true, falseStart: false, lockedOut: false });
    unmount();
  });
  it("checks a fresh opening against retained taps and starts a fresh lockout", () => {
    vi.setSystemTime(1000);
    const { result, rerender, unmount } = renderHook(useBuzzerTiming, {
      initialProps: readingOptions,
    });
    act(() => result.current.recordEarlyTap());
    rerender(options);
    advance(100);
    advance(250);
    expect(result.current).toMatchObject({ falseStart: true, lockedOut: false });
    rerender({ ...options, active: false });
    act(() => result.current.recordEarlyTap());
    rerender({ ...options, opensAt: 1600 });
    advance(150);
    expect(result.current).toMatchObject({ lit: true, falseStart: true, lockedOut: true });
    expect(result.current.reactionMs()).toBe(0);
    unmount();
  });
  it("locks an early tap for 250 ms without resetting the reaction clock", () => {
    vi.setSystemTime(1000);
    const { result, unmount } = renderHook(() => useBuzzerTiming(options));
    act(() => result.current.recordEarlyTap());
    advance(100);
    expect(result.current).toMatchObject({ lit: true, lockedOut: true, falseStart: true });
    advance(249);
    expect(result.current.lockedOut).toBe(true);
    advance(1);
    expect(result.current.lockedOut).toBe(false);
    expect(result.current.reactionMs()).toBe(250);
    unmount();
  });
  it.each([
    { fairBuzzing: true, lockoutEnabled: false, falseStart: false },
    { fairBuzzing: false, lockoutEnabled: true, falseStart: false },
    { fairBuzzing: true, lockoutEnabled: true, falseStart: true },
  ])(
    "honors fairBuzzing=$fairBuzzing and lockoutEnabled=$lockoutEnabled for a delayed view",
    ({ fairBuzzing, lockoutEnabled, falseStart }) => {
      vi.setSystemTime(1000);
      const { result, rerender, unmount } = renderHook(useBuzzerTiming, {
        initialProps: { ...readingOptions, fairBuzzing, lockoutEnabled },
      });
      act(() => result.current.recordEarlyTap());
      advance(1001);
      rerender({ ...options, fairBuzzing, lockoutEnabled });
      advance(0);
      expect(result.current).toMatchObject({ lit: true, falseStart, lockedOut: falseStart });
      unmount();
    },
  );
  it("ignores taps over a second early and supports disabling lockout", () => {
    vi.setSystemTime(0);
    const { result, rerender, unmount } = renderHook((props) => useBuzzerTiming(props), {
      initialProps: options,
    });
    act(() => result.current.recordEarlyTap());
    advance(1100);
    expect(result.current.falseStart).toBe(false);
    rerender({ ...options, opensAt: 1400, lockoutEnabled: false });
    act(() => result.current.recordEarlyTap());
    advance(200);
    expect(result.current).toMatchObject({ lit: true, lockedOut: false, falseStart: false });
    unmount();
  });
  it("remembers reading taps, resets on a fresh opening and cancels on pause", () => {
    vi.setSystemTime(1000);
    const { result, rerender, unmount } = renderHook((props) => useBuzzerTiming(props), {
      initialProps: readingOptions,
    });
    act(() => result.current.recordEarlyTap());
    rerender(options);
    advance(100);
    expect(result.current.falseStart).toBe(true);
    rerender({ ...options, active: false });
    expect(result.current.lit).toBe(false);
    rerender({ ...options, opensAt: 2200 });
    advance(1000);
    expect(result.current).toMatchObject({ lit: true, lockedOut: false, falseStart: false });
    unmount();
  });
});

it("undoing one tap leaves the others and re-splits the taps around it", () => {
  vi.setSystemTime(0);
  const { result, rerender, unmount } = renderHook(useBuzzerTiming, {
    initialProps: { ...readingOptions, clockOffsetMs: 0 },
  });
  // Taps at 0, 800 and 1600 chain into one run that straddles an opening at 1500. Without the
  // middle one, 0 is too long before it and 1600 is after it, so neither is a false start.
  act(() => void result.current.recordEarlyTap());
  advance(800);
  let undoMiddle = () => {};
  act(() => {
    undoMiddle = result.current.recordEarlyTap();
  });
  advance(800);
  act(() => void result.current.recordEarlyTap());
  undoMiddle();
  rerender({ ...options, opensAt: 1500, clockOffsetMs: 0 });
  advance(0);
  expect(result.current).toMatchObject({ lit: true, falseStart: false, lockedOut: false });
  unmount();
});

it("treats a taken-back tap as if it never happened", () => {
  vi.setSystemTime(1000);
  const { result, rerender, unmount } = renderHook(useBuzzerTiming, {
    initialProps: readingOptions,
  });
  let undo = () => {};
  act(() => {
    undo = result.current.recordEarlyTap();
  });
  undo();
  rerender(options);
  advance(100);
  expect(result.current).toMatchObject({ lit: true, falseStart: false, lockedOut: false });
  unmount();
});

it("enforces client lockout without fair buzzing when the opening view arrives late", () => {
  vi.setSystemTime(1500);
  const { result, rerender, unmount } = renderHook((props) => useBuzzerTiming(props), {
    initialProps: { ...options, active: false, fairBuzzing: false },
  });
  act(() => result.current.recordEarlyTap());
  rerender({ ...options, active: true, fairBuzzing: false });
  advance(0);
  expect(result.current).toMatchObject({ lit: true, falseStart: true, lockedOut: true });
  unmount();
});
