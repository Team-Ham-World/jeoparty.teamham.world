// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientCommand } from "@/features/network/protocol";
import { SPECS, playerOf, type Spec } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
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
    const button = screen.getByRole("button", { name: "Buzz!" });
    expect(button).toBeEnabled();
    await act(async () => {
      fireEvent.pointerDown(button, { button: 0 });
    });
    expect(sent).toEqual([{ type: "buzz", clueId: "clue-0-3-2" }]);
    expect(screen.getByRole("button", { name: "Sent!" })).toBeInTheDocument();
  });

  it("works from the keyboard (Enter/Space click) without double-sending pointer presses", async () => {
    const { sent } = renderPlayer(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Buzz!" }), { detail: 0 });
    });
    expect(sent).toEqual([{ type: "buzz", clueId: "clue-0-3-2" }]);
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

  it("explains a lockout instead of offering the button", () => {
    const view = playerOf(SPECS.closed, "p-scarlet");
    render(<PlayerScreen code="BCDFG" connection={mockConnection(view)} />);
    expect(screen.getByRole("button", { name: "Locked" })).toBeDisabled();
    expect(screen.getByText("You already had a go at this clue.")).toBeVisible();
  });
});
