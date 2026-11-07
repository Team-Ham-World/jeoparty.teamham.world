// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientCommand } from "@/features/network/protocol";
import { PACKS, hostFixture } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { HostScreen } from "./host-screen";

function renderHost(id: Parameters<typeof hostFixture>[0], status: "live" | "reconnecting" = "live") {
  const onSend = vi.fn<(cmd: ClientCommand) => void>();
  render(
    <HostScreen
      code="BCDFG"
      connection={mockConnection(hostFixture(id), { status, onSend })}
      packs={PACKS}
      joinUrl="https://quiz.example/r/BCDFG"
      onCreateDisplayLink={async () => "https://quiz.example/display/BCDFG#key=k"}
    />,
  );
  return onSend;
}

describe("host judging", () => {
  it("judges the current attempt by clueId and attemptId", async () => {
    const onSend = renderHost("answering");
    expect(screen.getByText("What is Lynx?")).toBeVisible(); // host sees the answer
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Correct \+600/ }));
    });
    expect(onSend).toHaveBeenCalledWith({ type: "judge", clueId: "clue-0-3-2", attemptId: "att-2", correct: true });
  });

  it("sends incorrect for the same attempt, also from the X shortcut", async () => {
    const onSend = renderHost("answering");
    await act(async () => {
      fireEvent.keyDown(window, { key: "x" });
    });
    expect(onSend).toHaveBeenCalledWith({ type: "judge", clueId: "clue-0-3-2", attemptId: "att-2", correct: false });
  });

  it("disables judging while stale", () => {
    const onSend = renderHost("answering", "reconnecting");
    const correct = screen.getByRole("button", { name: /Correct \+600/ });
    expect(correct).toBeDisabled();
    fireEvent.keyDown(window, { key: "c" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("only enables commands listed in allowedCommands", () => {
    renderHost("reading");
    expect(screen.getByRole("button", { name: /Open buzzers/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Correct/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Pause/ })).toBeEnabled();
  });

  it("lists start blockers and keeps Start disabled", () => {
    renderHost("lobbyAlone");
    expect(screen.getByText("At least 2 players need to join.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();
  });

  it("marks wager cells on the host board only", () => {
    renderHost("board");
    expect(screen.getByRole("button", { name: "Kitchen Science for 600, wager clue (Hot HAM)" })).toBeEnabled();
  });
});
