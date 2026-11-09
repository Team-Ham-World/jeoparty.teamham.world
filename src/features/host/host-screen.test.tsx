// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostView } from "@/features/engine/contract";
import type { ClientCommand, PackSummary } from "@/features/network/protocol";
import { PACKS, PINGS_MIXED, hostFixture } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { HostScreen } from "./host-screen";

function renderView(
  view: HostView,
  pings: Record<string, number | null> = {},
  packs: PackSummary[] = PACKS,
) {
  const onSend = vi.fn<(cmd: ClientCommand) => void>();
  render(
    <HostScreen
      code="BCDFG"
      connection={mockConnection(view, { onSend, pings })}
      packs={packs}
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

describe("host lobby board shape", () => {
  function lobbyOn(pack: PackSummary, settings: Partial<HostView["settings"]>) {
    const view = hostFixture("lobby");
    return renderView(
      {
        ...view,
        pack: { id: pack.id, title: pack.title },
        settings: { ...view.settings, ...settings },
      },
      {},
      [pack],
    );
  }
  const optionValues = (label: string) =>
    within(screen.getByLabelText(label))
      .getAllByRole("option")
      .map((option) => Number(option.getAttribute("value")));

  async function saved() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    });
  }

  it("shrinks the category count when a second round no longer fits it", async () => {
    const onSend = lobbyOn(PACKS[2], { rounds: 1, categoriesPerRound: 6 }); // 6 categories in all
    expect(optionValues("Categories per round")).toEqual([1, 2, 3, 4, 5, 6]);

    fireEvent.click(screen.getByRole("button", { name: "2 rounds" }));

    expect(screen.getByLabelText("Categories per round")).toHaveValue("3");
    expect(optionValues("Categories per round")).toEqual([1, 2, 3]);
    await saved();
    expect(onSend).toHaveBeenCalledWith({
      type: "updateSettings",
      patch: expect.objectContaining({ rounds: 2, categoriesPerRound: 3 }),
    });
  });

  it("shrinks wager clues to the cells a smaller board has", async () => {
    const onSend = lobbyOn(
      { ...PACKS[2], cluesPerCategory: 1 },
      { rounds: 1, categoriesPerRound: 3, wagerClues: [3, 2] },
    );

    fireEvent.change(screen.getByLabelText("Categories per round"), { target: { value: "1" } });

    expect(screen.getByLabelText("Wager clues, round 1")).toHaveValue("1");
    expect(optionValues("Wager clues, round 1")).toEqual([0, 1]);
    await saved();
    expect(onSend).toHaveBeenCalledWith({
      type: "updateSettings",
      patch: expect.objectContaining({ categoriesPerRound: 1, wagerClues: [1, 1] }),
    });
  });

  it("doesn't offer two rounds when the pack has a single category", () => {
    lobbyOn(
      { ...PACKS[2], categories: 1 },
      { rounds: 1, categoriesPerRound: 1, wagerClues: [1, 1] },
    );
    expect(screen.getByRole("button", { name: "2 rounds" })).toBeDisabled();
  });
});

describe("reloading the pack in use", () => {
  const lobbyUsing = (pack: PackSummary) =>
    renderView({ ...hostFixture("lobby"), pack: { id: pack.id, title: pack.title } });

  it("re-sends the saved pack and says the settings reset", async () => {
    const onSend = lobbyUsing(PACKS[2]);
    const reload = screen.getByRole("button", { name: "Reload this pack" });
    expect(reload).toHaveAccessibleDescription(/resets the settings/);

    await act(async () => {
      fireEvent.click(reload);
    });

    expect(onSend).toHaveBeenCalledWith({ type: "choosePack", packId: PACKS[2].id });
  });

  it("isn't offered for a built-in pack", () => {
    lobbyUsing(PACKS[0]);
    expect(screen.queryByRole("button", { name: "Reload this pack" })).toBeNull();
  });

  it("gives way while another pack is picked", () => {
    lobbyUsing(PACKS[2]);
    fireEvent.change(screen.getByLabelText("Question pack"), { target: { value: PACKS[0].id } });
    expect(screen.queryByRole("button", { name: "Reload this pack" })).toBeNull();
  });
});

describe("the display link panel", () => {
  it("warns before the first link is made in the lobby", () => {
    renderHost("lobby");
    const warning = screen.getByText(/disconnects any screen using the old one/);
    const button = screen.getByRole("button", { name: "Get display link" });
    expect(warning.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("makes the lobby link in one click", async () => {
    renderHost("lobby");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Get display link" }));
    });
    expect(screen.getByRole("textbox", { name: "Display link" })).toBeInTheDocument();
  });

  function openInGame(onCreate: () => Promise<string>, displayLink: string | null = null) {
    render(
      <HostScreen
        code="BCDFG"
        connection={mockConnection(hostFixture("board"))}
        packs={PACKS}
        joinUrl="https://quiz.example/r/BCDFG"
        onCreateDisplayLink={onCreate}
        displayLink={displayLink}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "TV link" }));
  }

  it("asks again before replacing a link during a game", async () => {
    const onCreate = vi.fn(async () => "https://quiz.example/display/BCDFG#key=k");
    openInGame(onCreate);

    fireEvent.click(screen.getByRole("button", { name: "Get display link" }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Replace the TV link now?");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, make a new link" }));
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("leaves the link alone when the host cancels", () => {
    const onCreate = vi.fn(async () => "new");
    openInGame(onCreate, "https://quiz.example/display/BCDFG#key=old");

    const trigger = screen.getByRole("button", { name: "Make a new link" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Display link" })).toHaveValue(
      "https://quiz.example/display/BCDFG#key=old",
    );
  });

  it("shows the failure and keeps the known link", async () => {
    const onCreate = vi.fn(async () => {
      throw new Error("No luck.");
    });
    openInGame(onCreate, "https://quiz.example/display/BCDFG#key=old");
    fireEvent.click(screen.getByRole("button", { name: "Make a new link" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, make a new link" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("No luck.");
    expect(screen.getByRole("textbox", { name: "Display link" })).toHaveValue(
      "https://quiz.example/display/BCDFG#key=old",
    );
  });
});

describe("host announcements", () => {
  it("names a late joiner who is on the waiting list", () => {
    const base = hostFixture("board");
    const props = {
      code: "BCDFG",
      packs: PACKS,
      joinUrl: "https://quiz.example/r/BCDFG",
      onCreateDisplayLink: async () => "x",
    };
    const { rerender } = render(<HostScreen {...props} connection={mockConnection(base)} />);
    const revision = base.revision + 1;
    rerender(
      <HostScreen
        {...props}
        connection={mockConnection({
          ...base,
          revision,
          lastEvent: { revision, event: { kind: "playerJoined", playerId: "p-john" } },
        })}
      />,
    );
    expect(screen.getByText("John joined.")).toBeInTheDocument();
    expect(screen.queryByText("A player who left joined.")).toBeNull();
  });
});

describe("host lobby buzzing settings", () => {
  const fair = () => screen.getByRole("checkbox", { name: "Fair buzzing" });
  const lockout = () => screen.getByRole("checkbox", { name: "False-start lockout" });

  it("labels each rule and explains it in plain words", () => {
    renderHost("lobby");
    expect(screen.getByRole("group", { name: "Buzzing" })).toContainElement(fair());
    expect(fair()).toBeChecked();
    expect(fair()).toHaveAccessibleDescription(
      "Evens out phone lag: buzzers light up together and the fastest reaction wins, not the fastest connection.",
    );
    expect(lockout()).toBeChecked();
    expect(lockout()).toHaveAccessibleDescription(
      "Tapping before your buzzer lights locks you out for a quarter of a second.",
    );
  });

  it("blocks Start until a changed rule is saved or undone", () => {
    renderHost("lobby");
    const start = screen.getByRole("button", { name: "Start game" });
    fireEvent.click(lockout());
    expect(lockout()).not.toBeChecked();
    expect(start).toBeDisabled();
    expect(screen.getByRole("list", { name: "Before you can start" })).toHaveTextContent(
      "Save or undo your settings changes first.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo changes" }));
    expect(lockout()).toBeChecked();
    expect(start).toBeEnabled();
  });

  it("saves both rules with the other settings", async () => {
    const onSend = renderHost("lobby");
    fireEvent.click(fair());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(onSend).toHaveBeenCalledWith({
      type: "updateSettings",
      patch: expect.objectContaining({ fairBuzzing: false, falseStartLockout: true }),
    });
  });

  it("can't be changed when settings can't be updated", () => {
    renderView({ ...hostFixture("lobby"), allowedCommands: ["startGame"] });
    expect(fair()).toBeDisabled();
    expect(lockout()).toBeDisabled();
  });
});

describe("host pings", () => {
  it("shows each phone's ping in the lobby, flags slow ones in words and explains them", () => {
    renderView(hostFixture("lobby"), PINGS_MIXED);
    const rows = screen.getAllByRole("listitem");
    const row = (name: string) => rows.find((li) => li.textContent?.startsWith(name))!;
    expect(row("Ivvy")).toHaveTextContent("38 ms");
    expect(row("Medchu")).toHaveTextContent("measuring…");
    expect(row("Scarlet")).toHaveTextContent("312 ms · slow");
    expect(row("Maximilian")).not.toHaveTextContent(/ms|measuring/); // away: no number
    expect(screen.getByText(/fair buzzing can only make up for so much lag/)).toBeVisible();
  });

  it("leaves out the slow-ping note when every phone is fine", () => {
    renderView(hostFixture("lobby"), { "p-ivvy": 38, "p-medchu": 64, "p-scarlet": 112 });
    expect(screen.queryByText(/Slow ping/)).toBeNull();
  });

  it("shows pings beside names in the score sidebar", () => {
    renderView(hostFixture("board"), PINGS_MIXED);
    const scores = screen.getByRole("complementary", { name: "Scores" });
    expect(within(scores).getByText("Ping 38 ms")).toBeInTheDocument();
    expect(within(scores).getByText("Ping 312 ms, slow")).toBeInTheDocument();
    expect(within(scores).getByText("Ping: measuring")).toBeInTheDocument();
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

  it("says how far ahead the answering player buzzed", () => {
    renderHost("answeringRace");
    expect(document.querySelector(".host-callout")).toHaveTextContent(
      "Medchu is answering · first by 0.04 s.",
    );
  });

  it("leaves the margin out when only one player buzzed", () => {
    const view = hostFixture("answeringRace");
    renderView({
      ...view,
      clue: {
        ...view.clue!,
        buzzResult: { winnerId: "p-medchu", marginMs: null, contenderCount: 1 },
      },
    });
    expect(document.querySelector(".host-callout")).toHaveTextContent(/^Medchu is answering\.$/);
  });

  it("drops the separate wager stamp while the wager is placed", () => {
    renderHost("wager");
    expect(screen.getByText("Placing wager")).toBeVisible();
    expect(screen.queryByText("Wager clue")).toBeNull();
  });
});

describe("host clue with no more attempts", () => {
  const closedClue = (view: HostView) => ({
    ...view.clue!,
    stage: "closed" as const,
    answeringPlayerId: null,
    attempts: [],
  });

  it("says the game is paused, not that everyone had a go", () => {
    const view = hostFixture("closed");
    renderView({
      ...view,
      clue: closedClue(view),
      paused: { reason: "host", since: 0 },
      allowedCommands: [],
    });
    expect(document.querySelector(".host-callout")).toHaveTextContent(
      "The game is paused. Resume it to carry on.",
    );
    expect(screen.queryByText(/Everyone has had a go/)).toBeNull();
  });

  it("stays neutral after End attempts when nobody tried", () => {
    const view = hostFixture("closed");
    renderView({ ...view, clue: closedClue(view), allowedCommands: ["reveal", "pause"] });
    expect(document.querySelector(".host-callout")).toHaveTextContent(
      "No more attempts on this clue. Reveal the answer.",
    );
  });

  it("still offers a reopen while the rules allow one", () => {
    const view = hostFixture("closed");
    renderView({ ...view, clue: closedClue(view), allowedCommands: ["openBuzzers", "reveal"] });
    expect(document.querySelector(".host-callout")).toHaveTextContent(
      "Reopen for players who haven't tried, or reveal the answer.",
    );
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
