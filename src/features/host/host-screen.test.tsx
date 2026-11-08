// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostView } from "@/features/engine/contract";
import type { ClientCommand } from "@/features/network/protocol";
import { PACKS, hostFixture } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { HostScreen } from "./host-screen";

function renderView(view: HostView) {
  const onSend = vi.fn<(cmd: ClientCommand) => void>();
  render(
    <HostScreen
      code="BCDFG"
      connection={mockConnection(view, { onSend })}
      packs={PACKS}
      joinUrl="https://quiz.example/r/BCDFG"
      onCreateDisplayLink={async () => "https://quiz.example/display/BCDFG#key=k"}
    />,
  );
  return onSend;
}

const renderHost = (id: Parameters<typeof hostFixture>[0]) => renderView(hostFixture(id));

describe("host lobby settings", () => {
  it("blocks Start while settings have unsaved changes", () => {
    renderHost("lobby");
    const start = screen.getByRole("button", { name: "Start game" });
    expect(start).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Buzz window (s)"), { target: { value: "20" } });

    expect(start).toBeDisabled();
    const blockers = screen.getByRole("list", { name: "Before you can start" });
    expect(blockers).toHaveTextContent("Save or undo your settings changes first.");
    // Only one control is named "Save settings", so it stays unambiguous.
    expect(screen.getAllByRole("button", { name: /save settings/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Undo changes" }));
    expect(start).toBeEnabled();
    expect(screen.queryByRole("list", { name: "Before you can start" })).toBeNull();
  });

  it("saves the draft from the start bar", async () => {
    const onSend = renderHost("lobby");
    fireEvent.change(screen.getByLabelText("Buzz window (s)"), { target: { value: "20" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "updateSettings",
        patch: expect.objectContaining({
          timers: expect.objectContaining({ enabled: true, buzzWindowMs: 20_000 }),
        }),
      }),
    );
  });

  it("moves focus to an invalid field instead of saving", async () => {
    const onSend = renderHost("lobby");
    const answer = screen.getByLabelText("Answer time (s)");
    fireEvent.change(answer, { target: { value: "1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(onSend).not.toHaveBeenCalled();
    expect(answer).toHaveFocus();
    expect(answer).toHaveAttribute("aria-invalid", "true");
  });

  it("doesn't let hidden timer fields block a save", async () => {
    const onSend = renderHost("lobby");
    fireEvent.change(screen.getByLabelText("Answer time (s)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Timers" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    });
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "updateSettings",
        patch: expect.objectContaining({
          timers: expect.objectContaining({ enabled: false, answerWindowMs: 10_000 }),
        }),
      }),
    );
  });

  it("starts the pack picker on a placeholder when no pack is chosen", async () => {
    const onSend = renderHost("lobbyAlone");
    const select = screen.getByLabelText("Question pack");
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Choose a pack…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Use / })).toBeNull();

    fireEvent.change(select, { target: { value: PACKS[0].id } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: `Use “${PACKS[0].title}”` }));
    });
    expect(onSend).toHaveBeenCalledWith({ type: "choosePack", packId: PACKS[0].id });
  });
});
