// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DisplayView, FinalView, PublicPlayer } from "@/features/engine/contract";
import { SPECS, displayFixture, hostFixture, type SpecId } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { DisplayScreen, Name, podiumNameSize } from "./display-screen";

const ids = Object.keys(SPECS) as SpecId[];

/** Every answer-like string the host can see for this scenario. */
function privateStrings(id: SpecId): string[] {
  const host = hostFixture(id);
  const strings = [
    host.clue?.answer,
    host.final?.answer,
    ...(host.final?.responses.map((r) => r.answer) ?? []),
  ];
  if (host.clue?.stage === "wager") strings.push(host.clue.prompt);
  if (host.final?.stage === "wagers") strings.push(host.final.prompt);
  return strings.filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** The same strings, if the public view really contains them. */
function publicStrings(id: SpecId): string {
  return JSON.stringify(displayFixture(id));
}

describe("display privacy", () => {
  it.each(ids)("%s: renders no answer or hidden prompt the display view doesn't contain", (id) => {
    const { container } = render(
      <DisplayScreen
        connection={mockConnection(displayFixture(id))}
        joinUrl="https://quiz.example/r/BCDFG"
      />,
    );
    const text = container.textContent ?? "";
    const visible = publicStrings(id);
    for (const secret of privateStrings(id)) {
      if (visible.includes(JSON.stringify(secret))) continue; // the view made it public
      expect(text).not.toContain(secret);
    }
  });

  it("shows the answer once the view reveals it", () => {
    render(
      <DisplayScreen
        connection={mockConnection(displayFixture("revealed"))}
        joinUrl="https://quiz.example/r/BCDFG"
      />,
    );
    expect(screen.getByText("What is Lynx?")).toBeVisible();
  });

  it("has no controls: the TV never sends commands", () => {
    const { container } = render(
      <DisplayScreen
        connection={mockConnection(displayFixture("board"))}
        joinUrl="https://quiz.example/r/BCDFG"
      />,
    );
    expect(container.querySelector("button, input, select, textarea")).toBeNull();
  });

  it("shows join instructions with the room code in the lobby", () => {
    render(
      <DisplayScreen
        connection={mockConnection(displayFixture("lobby"))}
        joinUrl="https://quiz.example/r/BCDFG"
      />,
    );
    expect(screen.getByLabelText("Room code B C D F G")).toBeVisible();
    expect(screen.getByRole("img", { name: /join room BCDFG/ })).toBeVisible();
  });
});

// Six players with the long, unbroken usernames HAM sign-in can return.
const SIX: PublicPlayer[] = [
  { id: "p1", name: "maximiliana.delacruz-santos_jr", score: 0, connected: true },
  { id: "p2", name: "bartholomew.featherstonehaugh", score: 400, connected: true },
  { id: "p3", name: "scarlet_the_magnificent", score: 600, connected: true },
  { id: "p4", name: "ivvy", score: 300, connected: true },
  { id: "p5", name: "medchu", score: 800, connected: true },
  { id: "p6", name: "x", score: 600, connected: true },
];

/** The final round with `count` judged responses (alternately right and wrong). */
function finalWith(stage: "judging" | "done", count: number): DisplayView {
  const base = displayFixture(stage === "done" ? "finalDone" : "finalJudging");
  const players = SIX.slice(0, count);
  const final: FinalView = {
    ...base.final!,
    eligiblePlayerIds: players.map((p) => p.id),
    responses: players.map((p, i) => ({
      playerId: p.id,
      status: "judged",
      answer: `answer ${i}`,
      wager: 200,
      correct: i % 2 === 0,
      delta: i % 2 === 0 ? 200 : -200,
    })),
  };
  return { ...base, players, final };
}

function renderView(view: DisplayView) {
  return render(
    <DisplayScreen connection={mockConnection(view)} joinUrl="https://quiz.example/r/BCDFG" />,
  );
}

describe("display layout", () => {
  it("lets long usernames break between their parts without changing the text", () => {
    const { container } = render(
      <span>
        <Name name="maximiliana.delacruz-santos_jr" />
      </span>,
    );
    expect(container.textContent).toBe("maximiliana.delacruz-santos_jr");
    expect(container.querySelectorAll("wbr")).toHaveLength(3);
  });

  it("sizes podium names by length and longest unbroken part, shared by co-winners", () => {
    expect(podiumNameSize(["Ivvy"])).toBe("");
    expect(podiumNameSize(["Scarlet the Great"])).toBe("tv-podium__name--long");
    expect(podiumNameSize(["featherstonehau"])).toBe("tv-podium__name--long");
    expect(podiumNameSize(["abcdefghijklm"])).toBe("tv-podium__name--long");
    expect(podiumNameSize(["bartholomew.featherstonehaugh"])).toBe("tv-podium__name--long");
    expect(podiumNameSize(["maximilianfeatherstonehaugh"])).toBe("tv-podium__name--xlong");
    expect(podiumNameSize(["Medchu", "maximilianfeatherstonehaugh"])).toBe(
      "tv-podium__name--xlong",
    );
  });

  it("gives co-winners the same name size on the podium", () => {
    const { container } = renderView(displayFixture("results"));
    const names = [...container.querySelectorAll(".tv-podium__name")];
    expect(names).toHaveLength(2);
    for (const name of names) expect(name).toHaveClass("tv-podium__name--long");
  });

  it("uses the dense score strip for five or six players", () => {
    const board = displayFixture("board");
    expect(renderView(board).container.querySelector(".tv-scores")).not.toHaveClass(
      "tv-scores--dense",
    );
    const { container } = renderView({ ...board, players: SIX, controllerId: "p1" });
    expect(container.querySelector(".tv-scores")).toHaveClass("tv-scores--dense");
    const names = [...container.querySelectorAll(".tv-score__name")].map((n) => n.textContent);
    expect(names).toEqual(SIX.map((p) => p.name));
  });

  it("marks a locked-out player's tile, not only its tag", () => {
    const { container } = renderView(displayFixture("closed"));
    const locked = container.querySelector(".tv-score--locked");
    expect(locked).toHaveTextContent("Scarlet");
    expect(locked?.querySelector(".tv-score__tag")).toHaveTextContent("Locked out");
  });

  it.each([
    [2, "2", false],
    [3, "3", false],
    [4, "2", true],
    [5, "3", true],
    [6, "3", true],
  ])("lays out %i final responses in %s columns (dense: %s)", (count, columns, dense) => {
    const { container } = renderView(finalWith("done", count));
    const list = container.querySelector<HTMLElement>(".tv-responses");
    expect(list?.style.getPropertyValue("--cols")).toBe(columns);
    expect(container.querySelector(".tv-final")?.classList.contains("tv-final--dense")).toBe(dense);
    expect(container.querySelectorAll(".tv-response")).toHaveLength(count);
  });

  it("stamps each final verdict and keeps the correct answer on screen", () => {
    const { container } = renderView(finalWith("done", 6));
    const good = [...container.querySelectorAll(".tv-response .stamp--good")];
    const bad = [...container.querySelectorAll(".tv-response .stamp--bad")];
    expect(good.map((s) => s.textContent)).toEqual(["Correct", "Correct", "Correct"]);
    expect(bad.map((s) => s.textContent)).toEqual(["Incorrect", "Incorrect", "Incorrect"]);
    const first = container.querySelector(".tv-response__result");
    expect(first).toHaveTextContent("Correct +200 wager 200");
    expect(container.querySelector(".tv-answer")).toHaveTextContent("What is Deep Blue?");
  });

  it("shows the wager stake at full value size beside a Wager stamp", () => {
    const { container } = renderView(displayFixture("wagerAnswering"));
    const value = container.querySelector(".tv-clue__value");
    expect(value?.querySelector(".stamp")).toHaveTextContent(/^Wager$/);
    expect(value).toHaveTextContent("Wager1,000");
  });

  it("stamps the winning margin beside the player who buzzed in", () => {
    const { container } = renderView(displayFixture("answeringRace"));
    expect(container.querySelector(".tv-cue--answering")).toHaveTextContent(
      "Medchu buzzed in! first by 0.04 s",
    );
    expect(container.querySelector(".tv-margin")).toHaveTextContent(/^first by 0\.04 s$/);
  });

  it("says 'by a hair' for a near tie, and nothing with a single contender", () => {
    expect(
      renderView(displayFixture("answeringRaceClose")).container.querySelector(".tv-margin"),
    ).toHaveTextContent("first by a hair");
    expect(
      renderView(displayFixture("answering")).container.querySelector(".tv-margin"),
    ).toBeNull();
  });

  it("tells the room in the lobby when fair buzzing is on", () => {
    const lobby = displayFixture("lobby");
    expect(renderView(lobby).container.querySelector(".tv-head")).toHaveTextContent(
      "Fair buzzing on · fastest reaction wins",
    );
    const off = { ...lobby, buzzing: { fairBuzzing: false, falseStartLockout: true } };
    expect(renderView(off).container.querySelector(".tv-head")).not.toHaveTextContent(
      "Fair buzzing",
    );
  });

  it("never shows pings, even if a connection carried them", () => {
    for (const id of ["lobby", "board", "answeringRace"] as const) {
      const { container, unmount } = render(
        <DisplayScreen
          connection={mockConnection(displayFixture(id), { pings: { "p-ivvy": 38 } })}
          joinUrl="https://quiz.example/r/BCDFG"
        />,
      );
      expect(container).not.toHaveTextContent(/\b38 ms|\bping\b/i);
      unmount();
    }
  });

  it("drops the header join URL in the lobby, where step 1 already shows it", () => {
    expect(
      renderView(displayFixture("lobby")).container.querySelector(".tv-head"),
    ).not.toHaveTextContent("Join at");
    expect(
      renderView(displayFixture("board")).container.querySelector(".tv-head"),
    ).toHaveTextContent("Join at quiz.example/r/BCDFG");
  });
});
