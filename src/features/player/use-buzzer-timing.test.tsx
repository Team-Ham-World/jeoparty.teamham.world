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
      initialProps: { ...options, active: false, opensAt: null as number | null },
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
