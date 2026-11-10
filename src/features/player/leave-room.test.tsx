// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/network/client/api";
import { SPECS, playerOf } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { PlayerScreen } from "./player-screen";

function renderPlayer(onLeave: () => Promise<void>) {
  return render(
    <PlayerScreen
      code="BCDFG"
      connection={mockConnection(playerOf(SPECS.lobby, "p-medchu"))}
      onLeave={onLeave}
    />,
  );
}

describe("leave room", () => {
  it("shows the error and enables the button again when leaving fails", async () => {
    const onLeave = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(
        new ApiError(503, "authUnavailable", "HAM is unavailable. Try again shortly."),
      );
    renderPlayer(onLeave);

    fireEvent.click(screen.getByRole("button", { name: "Leave room" }));

    expect(
      await screen.findByText("Couldn't leave the room. HAM is unavailable. Try again shortly."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave room" })).toBeEnabled();
  });

  it("disables the button and ignores another click while leaving", async () => {
    const onLeave = vi.fn(() => new Promise<void>(() => {}));
    renderPlayer(onLeave);

    fireEvent.click(screen.getByRole("button", { name: "Leave room" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Leaving…" })).toBeDisabled();
    });
    const button = screen.getByRole("button", { name: "Leaving…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("calls onLeave once and shows no failure message when leaving succeeds", async () => {
    const onLeave = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    renderPlayer(onLeave);

    fireEvent.click(screen.getByRole("button", { name: "Leave room" }));

    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Couldn't leave/)).toBeNull();
  });
});
