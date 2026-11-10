// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientCommand } from "@/features/network/protocol";
import { PACKS, hostFixture } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { HostScreen } from "./host-screen";
import { SWAP_GUARD_MS, hostStepKey } from "./swap-guard";

function hostScreen(id: Parameters<typeof hostFixture>[0], onSend?: (cmd: ClientCommand) => void) {
  return (
    <HostScreen
      code="BCDFG"
      connection={mockConnection(hostFixture(id), { onSend })}
      packs={PACKS}
      joinUrl="https://quiz.example/r/BCDFG"
      onCreateDisplayLink={async () => "https://quiz.example/display/BCDFG#key=k"}
    />
  );
}

const OPEN = { type: "openBuzzers", clueId: "clue-0-3-2" };

afterEach(() => vi.useRealTimers());

describe("hostStepKey", () => {
  it("returns an empty key for a null view", () => {
    expect(hostStepKey(null)).toBe("");
  });

  it("changes when the clue stage changes", () => {
    expect(hostStepKey(hostFixture("answering"))).not.toBe(hostStepKey(hostFixture("reading")));
  });

  it("changes when leaving the board for a clue", () => {
    expect(hostStepKey(hostFixture("board"))).not.toBe(hostStepKey(hostFixture("reading")));
  });

  it("ignores revisions and score changes", () => {
    const view = hostFixture("answering");
    expect(
      hostStepKey({
        ...view,
        revision: view.revision + 1,
        players: view.players.map((player, index) =>
          index === 0 ? { ...player, score: player.score + 100 } : player,
        ),
      }),
    ).toBe(hostStepKey(view));
  });

  it("changes when the game is paused", () => {
    const view = hostFixture("board");
    expect(view.paused).toBeNull();
    expect(hostStepKey({ ...view, paused: { reason: "host", since: 0 } })).not.toBe(
      hostStepKey(view),
    );
  });
});

describe("host swap guard", () => {
  it("accepts a click straight after the first render", async () => {
    const onSend = vi.fn<(cmd: ClientCommand) => void>();
    render(hostScreen("reading", onSend));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open buzzers/ }));
    });
    expect(onSend).toHaveBeenCalledWith(OPEN);
  });

  it("ignores clicks in the main area until the new step has settled", async () => {
    vi.useFakeTimers();
    const onSend = vi.fn<(cmd: ClientCommand) => void>();
    const { container, rerender } = render(hostScreen("answering", onSend));
    const main = () => container.querySelector<HTMLElement>("#main-content")!;
    expect(main().style.pointerEvents).toBe("");

    rerender(hostScreen("reading", onSend));
    expect(main().style.pointerEvents).toBe("none");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open buzzers/ }));
    });
    expect(onSend).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SWAP_GUARD_MS);
    });
    expect(main().style.pointerEvents).toBe("");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open buzzers/ }));
    });
    expect(onSend).toHaveBeenCalledExactlyOnceWith(OPEN);
  });

  it("leaves the top bar clickable while the main area settles", async () => {
    vi.useFakeTimers();
    const onSend = vi.fn<(cmd: ClientCommand) => void>();
    const { rerender } = render(hostScreen("answering", onSend));
    rerender(hostScreen("reading", onSend));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    });
    expect(onSend).toHaveBeenCalledWith({ type: "pause" });
  });

  it("keeps single-letter shortcuts working while the main area settles", async () => {
    vi.useFakeTimers();
    const onSend = vi.fn<(cmd: ClientCommand) => void>();
    const { rerender } = render(hostScreen("answering", onSend));

    rerender(hostScreen("reading", onSend));
    await act(async () => {
      fireEvent.keyDown(window, { key: "o" });
    });
    expect(onSend).toHaveBeenCalledWith(OPEN);
  });
});
