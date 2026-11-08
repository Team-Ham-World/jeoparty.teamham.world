// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimerView } from "@/features/engine/contract";
import { Countdown, describeCountdown, formatCountdown } from "./countdown";

function timer(remainingMs: number, durationMs: number, endsAt: number | null): TimerView {
  return { id: "t-1", kind: "finalAnswer", durationMs, endsAt, remainingMs } as TimerView;
}

describe("countdown text", () => {
  it.each([
    [0, "0s"],
    [7, "7s"],
    [59, "59s"],
    [60, "1:00"],
    [61, "1:01"],
    [119, "1:59"],
    [179, "2:59"],
    [180, "3:00"],
  ])("shows %i seconds as %s", (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text);
  });

  it.each([
    [0, "Time's up"],
    [1, "1 second left"],
    [7, "7 seconds left"],
    [60, "1 minute left"],
    [61, "1 minute 1 second left"],
    [120, "2 minutes left"],
    [179, "2 minutes 59 seconds left"],
  ])("reads %i seconds as %s", (seconds, text) => {
    expect(describeCountdown(seconds)).toBe(text);
  });
});

describe("Countdown", () => {
  const NOW = 1_800_000_000_000;
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows m:ss for a long timer and gives screen readers the spoken form", () => {
    render(<Countdown timer={timer(179_000, 180_000, NOW + 179_000)} clockOffsetMs={0} />);
    expect(screen.getByText("2:59")).toBeVisible();
    const bar = screen.getByRole("progressbar", { name: "Answers lock in" });
    expect(bar).toHaveAttribute("aria-valuetext", "2 minutes 59 seconds left");
    expect(bar).toHaveAttribute("aria-valuenow", "179");
    expect(bar).toHaveAttribute("aria-valuemax", "180");
  });

  it("keeps whole seconds under a minute and says when it is paused", () => {
    render(<Countdown timer={timer(6_200, 10_000, null)} clockOffsetMs={0} />);
    expect(screen.getByText("Paused · 7s")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Paused, 7 seconds left",
    );
  });

  it("says time is up at zero", () => {
    render(<Countdown timer={timer(0, 10_000, NOW - 500)} clockOffsetMs={0} />);
    expect(screen.getByText("Time's up")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Time's up");
  });
});
