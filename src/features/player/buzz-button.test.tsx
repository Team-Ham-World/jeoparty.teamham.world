// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientCommand } from "@/features/network/protocol";
import { SPECS, playerOf, type Spec } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { BuzzButton } from "./buzz-button";
import { PlayerScreen } from "./player-screen";

function renderPlayer(
  canBuzz: boolean,
  status: "live" | "reconnecting" = "live",
  spec: Spec = SPECS.open,
) {
  const sent: ClientCommand[] = [];
  const view = playerOf(spec, "p-medchu", { can: { buzz: canBuzz } });
  const onSend = vi.fn((cmd: ClientCommand) => sent.push(cmd));
  render(<PlayerScreen code="BCDFG" connection={mockConnection(view, { status, onSend })} />);
  return { sent, onSend };
}

describe("buzz button", () => {
  it("sends { type: 'buzz', clueId } on press when the view allows it", async () => {
    const { sent } = renderPlayer(true);
    const button = await screen.findByRole("button", { name: "Buzz!" });
    expect(button).toBeEnabled();
    await act(async () => {
      fireEvent.pointerDown(button, { button: 0 });
    });
    expect(sent).toEqual([
      { type: "buzz", clueId: "clue-0-3-2", reactionMs: expect.any(Number), falseStart: false },
    ]);
    expect(screen.getByRole("button", { name: "Sent!" })).toBeInTheDocument();
  });

  it("works from the keyboard (Enter/Space click) without double-sending pointer presses", async () => {
    const { sent } = renderPlayer(true);
    const button = await screen.findByRole("button", { name: "Buzz!" });
    await act(async () => {
      fireEvent.click(button, { detail: 0 });
    });
    expect(sent).toEqual([
      { type: "buzz", clueId: "clue-0-3-2", reactionMs: expect.any(Number), falseStart: false },
    ]);
  });

  it("is disabled and sends nothing when can.buzz is false", async () => {
    const { onSend } = renderPlayer(false, "live", SPECS.reading);
    const button = screen.getByRole("button", { name: "Wait" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Buzzers open when the host finishes reading.")).toBeVisible();
    await act(async () => {
      fireEvent.pointerDown(button, { button: 0 });
      fireEvent.click(button, { detail: 0 });
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("is disabled while the connection is stale, even if the last view allowed buzzing", async () => {
    const { onSend } = renderPlayer(true, "reconnecting");
    const button = screen.getByRole("button", { name: "Offline" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Connection lost/)).toBeVisible();
    await act(async () => {
      fireEvent.pointerDown(button, { button: 0 });
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("says who won the race, and by how much", () => {
    const view = playerOf(SPECS.answeringRace, "p-ivvy");
    render(<PlayerScreen code="BCDFG" connection={mockConnection(view)} />);
    expect(screen.getByRole("button", { name: "Hold" })).toHaveAccessibleDescription(
      "Medchu got there first by 0.04 s.",
    );
  });

  it("keeps the plain sentence when nobody else buzzed", () => {
    const view = playerOf(SPECS.answering, "p-ivvy");
    render(<PlayerScreen code="BCDFG" connection={mockConnection(view)} />);
    expect(screen.getByRole("button", { name: "Hold" })).toHaveAccessibleDescription(
      "Medchu got there first.",
    );
  });

  it("explains a lockout instead of offering the button", () => {
    const view = playerOf(SPECS.closed, "p-scarlet");
    render(<PlayerScreen code="BCDFG" connection={mockConnection(view)} />);
    expect(screen.getByRole("button", { name: "Locked" })).toBeDisabled();
    expect(screen.getByText("You already had a go at this clue.")).toBeVisible();
  });
});

it("doesn't call an early tap 'Too early!' for a phone that can't buzz this clue anyway", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  try {
    const reading = playerOf(SPECS.reading, "p-scarlet");
    // Scarlet already had a go: the reopened clue lights, but not for her.
    const open = playerOf(
      { ...SPECS.open, clue: { ...SPECS.open.clue, lockedOutPlayerIds: ["p-scarlet"] } },
      "p-scarlet",
    );
    open.clue!.opensAt = 1200;
    const run = vi.fn();
    const { rerender } = render(
      <BuzzButton view={reading} clue={reading.clue!} stale={false} run={run} />,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Wait" }), { button: 0 });
    rerender(<BuzzButton view={open} clue={open.clue!} stale={false} run={run} />);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("button", { name: "Locked" })).not.toHaveClass("buzz--early");
  } finally {
    vi.useRealTimers();
  }
});

it("captures early button taps, lights while locked, and sends the penalty with a measured reaction", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  try {
    const reading = playerOf(SPECS.reading, "p-medchu");
    const open = playerOf(SPECS.open, "p-medchu", { can: { buzz: true } });
    open.clue!.opensAt = 1200;
    const run = vi.fn().mockResolvedValue({ ok: true, revision: 1 });
    const { rerender } = render(
      <BuzzButton view={reading} clue={reading.clue!} stale={false} run={run} />,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Wait" }), { button: 0 });
    rerender(<BuzzButton view={open} clue={open.clue!} stale={false} run={run} />);
    act(() => vi.advanceTimersByTime(200));
    const locked = screen.getByRole("button", { name: "Too early!" });
    expect(locked).toBeDisabled();
    // Lit with everyone else, but in its own held-down look, never the pressable blue.
    expect(locked).toHaveClass("buzz--early");
    expect(locked).not.toHaveClass("buzz--live");
    expect(locked).toHaveAccessibleDescription("Locked for a moment: you tapped before it lit.");
    act(() => vi.advanceTimersByTime(249));
    expect(run).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    const live = screen.getByRole("button", { name: "Buzz!" });
    expect(live).toHaveClass("buzz--live");
    expect(live).toHaveAccessibleDescription("Go! You were held back for tapping early.");
    await act(async () => fireEvent.pointerDown(live, { button: 0 }));
    expect(run).toHaveBeenCalledWith(
      { type: "buzz", clueId: open.clue!.clueId, reactionMs: 250, falseStart: true },
      expect.anything(),
    );
  } finally {
    vi.useRealTimers();
  }
});
