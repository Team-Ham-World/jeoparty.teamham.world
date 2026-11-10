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
    <PlayerScreen
      code="BCDFG"
      connection={mockConnection(view, { onSend })}
      onLeave={async () => {}}
    />,
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
    const button = await screen.findByRole("button", { name: "Buzz!" });
    const halo = container.querySelector(".buzz-halo");
    expect(halo).toHaveAttribute("aria-hidden", "true");
    expect(halo).not.toHaveClass("buzz-halo--still");
    await act(async () => {
      fireEvent.pointerDown(button, { button: 0 });
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".buzz-halo")).toHaveClass("buzz-halo--still");
  });

  it("idle buzzer: no breathing base", () => {
    const { container } = renderView(playerOf(SPECS.reading, "p-medchu"));
    expect(screen.getByRole("button", { name: "Wait" })).toBeDisabled();
    expect(container.querySelector(".buzz-halo")).toBeNull();
  });

  it("tells the race winner how far ahead they were", () => {
    renderView(playerOf(SPECS.answeringRace, "p-medchu"));
    expect(screen.getByText("You're up!").closest(".pl-up")).toHaveTextContent(
      "You're up!Say your answer out loud to the host.You got there first by 0.04 s.",
    );
  });

  it("leaves the winner's margin out when nobody else buzzed", () => {
    renderView(playerOf(SPECS.answering, "p-medchu"));
    expect(screen.queryByText(/You got there first/)).toBeNull();
  });

  it("warns about early taps in the lobby only while the lockout is on", () => {
    const view = playerOf(SPECS.lobby, "p-medchu");
    const { unmount } = renderView(view);
    expect(screen.getByText("Wait for the light.")).toBeVisible();
    unmount();
    renderView({ ...view, buzzing: { fairBuzzing: true, falseStartLockout: false } });
    expect(screen.queryByText("Wait for the light.")).toBeNull();
  });

  describe("while paused", () => {
    const paused = (view: PlayerView): PlayerView => ({
      ...view,
      paused: { reason: "host", since: 0 },
    });
    const screenFor = (view: PlayerView) => (
      <PlayerScreen code="BCDFG" connection={mockConnection(view)} />
    );

    it("freezes a typed final answer and gives it back on resume", () => {
      const view = playerOf(SPECS.finalAnswering, "p-ivvy", { can: { finalAnswer: true } });
      const { rerender } = render(screenFor(view));
      fireEvent.change(screen.getByLabelText("Your answer"), {
        target: { value: "What is HAL 9000?" },
      });
      rerender(screenFor(paused(view)));
      expect(screen.getByLabelText("Your answer")).toBeDisabled();
      expect(screen.getByLabelText("Your answer")).toHaveValue("What is HAL 9000?");
      expect(screen.getByRole("button", { name: "Submit answer" })).toBeDisabled();
      expect(screen.queryByText("Answers are locked.")).toBeNull();
      rerender(screenFor(view));
      expect(screen.getByLabelText("Your answer")).toBeEnabled();
      expect(screen.getByLabelText("Your answer")).toHaveValue("What is HAL 9000?");
    });

    it.each([
      {
        name: "wager clue",
        spec: SPECS.wager,
        can: { wager: { min: 5, max: 1200 } },
        submit: "Lock in wager",
      },
      {
        name: "final wager",
        spec: SPECS.finalWagers,
        can: { finalWager: { min: 0, max: 1200 } },
        submit: "Save wager",
      },
    ])("freezes a typed $name and gives it back on resume", ({ spec, can, submit }) => {
      const view = playerOf(spec, "p-ivvy", { can });
      const { rerender } = render(screenFor(view));
      fireEvent.change(screen.getByLabelText("Your wager"), { target: { value: "300" } });
      rerender(screenFor(paused(view)));
      expect(screen.getByLabelText("Your wager")).toBeDisabled();
      expect(screen.getByLabelText("Your wager")).toHaveValue("300");
      expect(screen.getByRole("button", { name: submit })).toBeDisabled();
      rerender(screenFor(view));
      expect(screen.getByLabelText("Your wager")).toBeEnabled();
      expect(screen.getByLabelText("Your wager")).toHaveValue("300");
    });

    it("never tells the wager player that they themselves are placing a wager", () => {
      const view = playerOf(SPECS.wager, "p-ivvy");
      const me = view.players.find((player) => player.id === view.me.id)!;
      render(screenFor(paused({ ...view, controllerId: me.id })));
      expect(screen.queryByText(/is placing a/)).toBeNull();
      expect(screen.getByText("This wager is yours. Only you answer this one.")).toBeVisible();
    });

    it("still tells an ineligible player what is going on in the final round", () => {
      const view = playerOf(SPECS.finalAnswering, "p-ivvy");
      const final = { ...view.final!, eligiblePlayerIds: ["p-medchu"] };
      render(screenFor(paused({ ...view, final })));
      expect(screen.getByText(/sitting this one out/)).toBeVisible();
      expect(screen.queryByLabelText("Your answer")).toBeNull();
    });

    it("shows a saved answer, not a false lock, to a player with no answer form", () => {
      const view = playerOf(SPECS.finalAnswering, "p-ivvy", {
        myFinal: { wager: 100, answer: "What is HAL 9000?" },
      });
      render(screenFor(view));
      expect(screen.queryByText("Answers are locked.")).toBeNull();
      expect(screen.getByText("What is HAL 9000?")).toBeVisible();
    });
  });

  it("names a late joiner in the screen-reader announcement", () => {
    const view = {
      ...playerOf(SPECS.board, "p-ivvy"),
      waitingPlayers: [{ id: "p-late", name: "Latecomer" }],
    };
    const event = {
      revision: view.revision + 1,
      event: { kind: "playerJoined", playerId: "p-late" },
    };
    const { rerender } = render(<PlayerScreen code="BCDFG" connection={mockConnection(view)} />);
    rerender(
      <PlayerScreen
        code="BCDFG"
        connection={mockConnection({
          ...view,
          revision: view.revision + 1,
          lastEvent: event as PlayerView["lastEvent"],
        })}
      />,
    );
    expect(screen.getByText("Latecomer joined.")).toBeInTheDocument();
  });

  it("says plainly that you left the room", () => {
    render(
      <PlayerScreen
        code="BCDFG"
        connection={mockConnection(playerOf(SPECS.lobby, "p-ivvy"), {
          status: "closed",
          closeReason: "left",
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "You left this room" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
  });

  it("never shows pings, even if a connection carried them", () => {
    for (const spec of [SPECS.lobby, SPECS.board, SPECS.answeringRace]) {
      const { container, unmount } = render(
        <PlayerScreen
          code="BCDFG"
          connection={mockConnection(playerOf(spec, "p-medchu"), {
            pings: { "p-ivvy": 38, "p-medchu": 312 },
          })}
        />,
      );
      expect(container).not.toHaveTextContent(/\b(38|312) ms|\bping\b/i);
      unmount();
    }
  });
});
