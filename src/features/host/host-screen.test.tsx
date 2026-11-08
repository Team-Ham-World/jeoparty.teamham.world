// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(window, { key });
  });
}

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

describe("host top bar", () => {
  // Leaving mid-game pauses it for the whole room, so the logo isn't a link then.
  it.each([
    ["lobby", 1],
    ["results", 1],
    ["board", 0],
    ["answering", 0],
    ["finalWagers", 0],
    ["paused", 0],
  ] as const)("links the logo home in %s: %i link(s)", (id, links) => {
    renderHost(id);
    const topBar = document.querySelector<HTMLElement>(".host-top")!;
    expect(within(topBar).queryAllByRole("link")).toHaveLength(links);
  });

  it("says which round is on", () => {
    renderHost("board");
    expect(screen.getByText("Round 1 of 2")).toBeVisible();
  });

  it("names the round when the pack gives it its own title", () => {
    const view = hostFixture("board");
    renderView({ ...view, round: { index: 1, total: 2, title: "Lightning" } });
    expect(screen.getByText("Lightning · 2 of 2")).toBeVisible();
  });
});

describe("host clue", () => {
  it("keeps the attempts list below the action buttons", () => {
    renderHost("answering");
    const correct = screen.getByRole("button", { name: /Correct \+600/ });
    const attempts = screen.getByRole("list", { name: "Attempts on this clue" });
    expect(
      correct.compareDocumentPosition(attempts) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("drops the separate wager stamp while the wager is placed", () => {
    renderHost("wager");
    expect(screen.getByText("Placing wager")).toBeVisible();
    expect(screen.queryByText("Wager clue")).toBeNull();
  });
});

describe("host final round", () => {
  const scroll = vi.fn();
  beforeEach(() => {
    // jsdom has no layout, so no scrollIntoView; judging calls it on every change.
    scroll.mockClear();
    Element.prototype.scrollIntoView = scroll;
  });

  it("shows the final clue with S", async () => {
    const onSend = renderHost("finalWagers");
    expect(screen.getByRole("button", { name: "Show final clue" })).toHaveAttribute(
      "aria-keyshortcuts",
      "S",
    );
    await press("s");
    expect(onSend).toHaveBeenCalledWith({ type: "showFinalClue" });
  });

  it("locks answers with L", async () => {
    const onSend = renderHost("finalAnswering");
    await press("l");
    expect(onSend).toHaveBeenCalledWith({ type: "lockFinalAnswers" });
  });

  it("reveals the next response with R, keeping its name free of the key", async () => {
    const base = hostFixture("finalJudging");
    const onSend = renderView({
      ...base,
      final: { ...base.final!, nextResponderId: "p-max" },
      allowedCommands: ["revealFinalResponse", "judgeFinal", "pause", "endGame"],
    });
    const button = screen.getByRole("button", { name: /^Reveal .*'s response$/ });
    expect(button.textContent).toMatch(/'s response$/);
    expect(button).toHaveAttribute("aria-keyshortcuts", "R");
    await press("c"); // Nothing to judge until it's revealed.
    expect(onSend).not.toHaveBeenCalled();
    await press("r");
    expect(onSend).toHaveBeenCalledWith({ type: "revealFinalResponse", playerId: "p-max" });
  });

  it("judges the revealed response with C and X", async () => {
    const onSend = renderHost("finalJudging");
    await press("x");
    expect(onSend).toHaveBeenCalledWith({
      type: "judgeFinal",
      playerId: "p-ivvy",
      correct: false,
    });
  });

  it("shows results with F once every response is judged", async () => {
    const onSend = renderHost("finalDone");
    await press("r");
    expect(onSend).not.toHaveBeenCalled();
    await press("f");
    expect(onSend).toHaveBeenCalledWith({ type: "finishGame" });
  });

  it("scrolls the response being judged into view", () => {
    renderHost("finalJudging");
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
    expect(scroll.mock.contexts[0]).toHaveClass("is-next");
  });
});
