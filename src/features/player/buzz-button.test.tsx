// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandOutcome } from "@/features/network/connection";
import type { ClientCommand } from "@/features/network/protocol";
import { SPECS, playerOf, type Spec } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { ToastProvider } from "@/features/ui/toasts";
import { useCommand } from "@/features/ui/use-command";
import { BuzzButton } from "./buzz-button";
import { PlayerScreen } from "./player-screen";

const unsuccessfulOutcomes = [
  { reason: "a null result", outcome: null },
  {
    reason: "a failed command",
    outcome: { ok: false, error: "timeout", message: "The server didn't answer." },
  },
] satisfies { reason: string; outcome: CommandOutcome | null }[];

function mockButtonBounds(button: HTMLElement) {
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 200, 200, 200));
}

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
    await act(async () => {
      fireEvent.pointerDown(button, { button: 0 });
      fireEvent.click(button, { detail: 1 });
      fireEvent.click(button, { detail: 0 });
    });
    expect(sent).toHaveLength(1);
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

  it.each(unsuccessfulOutcomes)("allows retrying after $reason", async ({ outcome }) => {
    const view = playerOf(SPECS.open, "p-medchu", { can: { buzz: true } });
    const run = vi.fn().mockResolvedValueOnce(outcome).mockResolvedValue({ ok: true, revision: 1 });
    render(<BuzzButton view={view} clue={view.clue!} stale={false} run={run} />);
    const button = await screen.findByRole("button", { name: "Buzz!" });
    await act(async () => fireEvent.pointerDown(button, { button: 0 }));
    expect(screen.getByRole("button", { name: "Buzz!" })).toBeEnabled();
    await act(async () => fireEvent.pointerDown(button, { button: 0 }));
    expect(run).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Sent!" })).toHaveAttribute("aria-disabled", "true");
    await act(async () => fireEvent.click(button, { detail: 0 }));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("offers the buzzer again if a new opening's press is ignored while an older buzz is in flight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    try {
      const view = playerOf(SPECS.open, "p-medchu", { can: { buzz: true } });
      view.clue!.opensAt = 1000;
      const old = Promise.withResolvers<CommandOutcome>();
      const send = vi
        .fn<(cmd: ClientCommand) => Promise<CommandOutcome>>()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue({ ok: true, revision: 2 });
      const connection = { ...mockConnection(view), send };
      // The real useCommand, which refuses a second send while the first is pending.
      function RealCommandBuzzer({ clue }: { clue: typeof view.clue }) {
        const { run } = useCommand(connection);
        return <BuzzButton view={view} clue={clue!} stale={false} run={run} />;
      }
      const buzzer = (clue: typeof view.clue) => (
        <ToastProvider>
          <RealCommandBuzzer clue={clue} />
        </ToastProvider>
      );
      const press = () =>
        act(async () =>
          fireEvent.pointerDown(screen.getByRole("button", { name: "Buzz!" }), { button: 0 }),
        );
      const { rerender } = render(buzzer(view.clue));
      act(() => vi.advanceTimersByTime(0));
      await press();
      expect(screen.getByRole("button", { name: "Sent!" })).toBeInTheDocument();
      rerender(buzzer({ ...view.clue!, opensAt: 1200 }));
      act(() => vi.advanceTimersByTime(200));
      await press();
      expect(send).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Buzz!" })).toBeEnabled();
      await act(async () =>
        old.resolve({ ok: false, error: "timeout", message: "The server didn't answer." }),
      );
      await press();
      expect(send).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Sent!" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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
    const button = screen.getByRole("button", { name: "Wait" });
    mockButtonBounds(button);
    fireEvent.pointerDown(button, { button: 0, isPrimary: true, clientX: 200, clientY: 300 });
    rerender(<BuzzButton view={open} clue={open.clue!} stale={false} run={run} />);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("button", { name: "Locked" })).not.toHaveClass("buzz--early");
  } finally {
    vi.useRealTimers();
  }
});

it.each(["mouse", "touch"])(
  "captures early %s taps inside the disabled button bounds and sends the penalty",
  async (pointerType) => {
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
      const button = screen.getByRole("button", { name: "Wait" });
      mockButtonBounds(button);
      // Disabled buttons use pointer-events: none, so the wrapper is the real target.
      fireEvent.pointerDown(button.parentElement!, {
        button: 0,
        isPrimary: true,
        pointerType,
        clientX: 200,
        clientY: 300,
      });
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
  },
);

it.each([
  { name: "help text", target: "help", clientX: 200, clientY: 450, button: 0, isPrimary: true },
  { name: "blank space left of the button", clientX: 99, clientY: 300, button: 0, isPrimary: true },
  {
    name: "blank space right of the button",
    clientX: 301,
    clientY: 300,
    button: 0,
    isPrimary: true,
  },
  { name: "blank space above the button", clientX: 200, clientY: 199, button: 0, isPrimary: true },
  { name: "blank space below the button", clientX: 200, clientY: 401, button: 0, isPrimary: true },
  {
    name: "a right click inside the button",
    clientX: 200,
    clientY: 300,
    button: 2,
    isPrimary: true,
  },
  {
    name: "the empty corner of the buzzer's square",
    clientX: 105,
    clientY: 205,
    button: 0,
    isPrimary: true,
  },
])("does not record $name as an early button tap", (tap) => {
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
    const button = screen.getByRole("button", { name: "Wait" });
    mockButtonBounds(button);
    const target =
      tap.target === "help"
        ? screen.getByText("Buzzers open when the host finishes reading.")
        : button.parentElement!;
    fireEvent.pointerDown(target, tap);
    expect(run).not.toHaveBeenCalled();
    rerender(<BuzzButton view={open} clue={open.clue!} stale={false} run={run} />);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("button", { name: "Buzz!" })).toBeEnabled();
    expect(button).toHaveAccessibleDescription("Fastest reaction wins.");
  } finally {
    vi.useRealTimers();
  }
});

describe("early taps that aren't real presses", () => {
  function tapThenOpen(gesture: (zone: HTMLElement) => void) {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const reading = playerOf(SPECS.reading, "p-medchu");
    const open = playerOf(SPECS.open, "p-medchu", { can: { buzz: true } });
    open.clue!.opensAt = 1200;
    const run = vi.fn().mockResolvedValue({ ok: true, revision: 1 });
    const { rerender } = render(
      <BuzzButton view={reading} clue={reading.clue!} stale={false} run={run} />,
    );
    const button = screen.getByRole("button", { name: "Wait" });
    mockButtonBounds(button);
    gesture(button.parentElement!);
    rerender(<BuzzButton view={open} clue={open.clue!} stale={false} run={run} />);
    act(() => vi.advanceTimersByTime(200));
  }
  const inside = { button: 0, isPrimary: true, clientX: 200, clientY: 300 };

  afterEach(() => vi.useRealTimers());

  it("takes back a tap the browser cancels because it became a scroll", () => {
    tapThenOpen((zone) => {
      fireEvent.pointerDown(zone, { ...inside, pointerId: 5 });
      fireEvent.pointerCancel(zone, { pointerId: 5 });
    });
    expect(screen.getByRole("button", { name: "Buzz!" })).toBeEnabled();
  });

  it("keeps the tap when a different finger is the one cancelled", () => {
    tapThenOpen((zone) => {
      fireEvent.pointerDown(zone, { ...inside, pointerId: 5 });
      fireEvent.pointerCancel(zone, { pointerId: 6 });
    });
    expect(screen.getByRole("button", { name: "Too early!" })).toBeDisabled();
  });

  it("keeps a completed tap even if that pointer is cancelled later", () => {
    tapThenOpen((zone) => {
      fireEvent.pointerDown(zone, { ...inside, pointerId: 5 });
      fireEvent.pointerUp(zone, { pointerId: 5 });
      fireEvent.pointerCancel(zone, { pointerId: 5 });
    });
    expect(screen.getByRole("button", { name: "Too early!" })).toBeDisabled();
  });

  it("counts a real tap from a second finger while a thumb rests on the screen", () => {
    tapThenOpen((zone) => {
      fireEvent.pointerDown(zone, { ...inside, isPrimary: false, pointerType: "touch" });
    });
    expect(screen.getByRole("button", { name: "Too early!" })).toBeDisabled();
  });
});
