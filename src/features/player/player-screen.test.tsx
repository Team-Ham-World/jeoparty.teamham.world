// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlayerView } from "@/features/engine/contract";
import type { ClientCommand } from "@/features/network/protocol";
import { SPECS, playerOf } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { PlayerScreen } from "./player-screen";

function renderView(view: PlayerView | null, onSend?: (cmd: ClientCommand) => void) {
  return render(
    <PlayerScreen code="BCDFG" connection={mockConnection(view, { onSend })} onLeave={() => {}} />,
  );
}

const homeLink = () => screen.queryByRole("link", { name: /^HAM ?Quiz$/ });

describe("player screen", () => {
  it("shows the paper top bar and a busy notice while connecting", () => {
    renderView(null);
    expect(screen.getByRole("heading", { name: /Connecting/ })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(homeLink()).toHaveAttribute("href", "/");
  });

  it("links the logo home only in the lobby, on results and on the bench", () => {
    const { unmount } = renderView(playerOf(SPECS.lobby, "p-medchu"));
    expect(homeLink()).toHaveAttribute("href", "/");
    unmount();

    renderView(playerOf(SPECS.results, "p-medchu"));
    expect(homeLink()).toHaveAttribute("href", "/");
  });

  it("does not link the logo home during play, so a stray tap can't leave the buzzer", () => {
    for (const spec of [SPECS.open, SPECS.board, SPECS.finalWagers]) {
      const { unmount } = renderView(playerOf(spec, "p-medchu", { can: { buzz: true } }));
      expect(homeLink()).toBeNull();
      expect(screen.getByLabelText("HAM")).toBeInTheDocument(); // the lockup is still drawn
      unmount();
    }
  });

  it("puts the 'Your pick' stamp under the player's own name", () => {
    renderView(playerOf(SPECS.board, "p-ivvy"));
    const you = screen.getByRole("region", { name: "You" });
    const who = you.querySelector(".pl-me__who") as HTMLElement;
    expect(within(who).getByText("Ivvy")).toBeInTheDocument();
    expect(within(who).getByText("Your pick")).toBeInTheDocument();
  });

  it("final wager: says 'Save wager', then 'Wager saved' with 'Change wager'", async () => {
    const sent: ClientCommand[] = [];
    const bounds = { can: { finalWager: { min: 0, max: 1200 } } };
    const { unmount } = renderView(playerOf(SPECS.finalWagers, "p-ivvy", bounds), (cmd) =>
      sent.push(cmd),
    );
    expect(screen.queryByText("Wager saved")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Half/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save wager" }));
    });
    expect(sent).toEqual([{ type: "submitFinalWager", amount: 600 }]);
    unmount();

    renderView(
      playerOf(SPECS.finalWagers, "p-ivvy", { ...bounds, myFinal: { wager: 500, answer: null } }),
    );
    expect(screen.getByText("Wager saved").closest("p")).toHaveTextContent(
      /^Wager saved\s*Your wager: 500\. You can change it until the host shows the clue\.$/,
    );
    expect(screen.getByRole("button", { name: "Change wager" })).toBeInTheDocument();
    expect(screen.queryByText(/Locked in/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Lock in wager" })).toBeNull();
  });

  it("wager clue: keeps 'Lock in wager', because that wager is final", () => {
    renderView(playerOf(SPECS.wager, "p-ivvy", { can: { wager: { min: 5, max: 1200 } } }));
    expect(screen.getByRole("button", { name: "Lock in wager" })).toBeInTheDocument();
  });

  it("final reveal list: Waiting, Judging…, then a Correct/Incorrect stamp and the change", () => {
    const { unmount } = renderView(
      playerOf(SPECS.finalJudging, "p-ivvy", {
        myFinal: { wager: 1200, answer: "What is HAL 9000?" },
      }),
    );
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector(".pl-verdict")?.textContent)).toEqual([
      "Correct+800",
      "Judging…",
      "Waiting",
    ]);
    expect(within(rows[0]).getByText("Correct")).toHaveClass("stamp", "stamp--good", "stamp--flat");
    expect(screen.queryByText("…")).toBeNull();
    unmount();

    renderView(playerOf(SPECS.finalDone, "p-medchu"));
    const done = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(within(done[1]).getByText("Incorrect")).toHaveClass("stamp", "stamp--bad");
    expect(done[1]).toHaveTextContent("−1,200");
  });

  it("live buzzer: draws the breathing base, and stills it once the buzz is sent", async () => {
    const onSend = vi.fn();
    const { container } = renderView(
      playerOf(SPECS.open, "p-medchu", { can: { buzz: true } }),
      onSend,
    );
    const halo = container.querySelector(".buzz-halo");
    expect(halo).toHaveAttribute("aria-hidden", "true");
    expect(halo).not.toHaveClass("buzz-halo--still");
    await act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "Buzz!" }), { button: 0 });
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".buzz-halo")).toHaveClass("buzz-halo--still");
  });

  it("idle buzzer: no breathing base", () => {
    const { container } = renderView(playerOf(SPECS.reading, "p-medchu"));
    expect(screen.getByRole("button", { name: "Wait" })).toBeDisabled();
    expect(container.querySelector(".buzz-halo")).toBeNull();
  });
});
