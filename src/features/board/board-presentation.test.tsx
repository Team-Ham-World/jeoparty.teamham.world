// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardPresentation } from "./board-presentation";
import { BoardStarter } from "./board-starter";
import { previewFixtures } from "./preview-fixtures";
import type { ProposedDisplayView } from "./presentation-types";

function fixture(id: string): ProposedDisplayView {
  const example = previewFixtures.find((entry) => entry.id === id);
  if (!example) throw new Error(`Missing fixture: ${id}`);
  return example.view;
}

describe("read-only public presentation", () => {
  it.each(previewFixtures)("renders $id without game controls", ({ view }) => {
    const { container } = render(<BoardPresentation view={view} />);
    expect(screen.getByRole("heading", { level: 1, name: "Quiz night" })).toBeVisible();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(container.querySelector("button, input, select, textarea, a, [tabindex], [role=button]")).toBeNull();
  });

  it("renders the supplied 3 × 3 board, completed clues and negative scores", () => {
    render(<BoardPresentation view={fixture("board")} />);
    const board = within(screen.getByRole("region", { name: "Clue board" }));
    expect(board.getAllByRole("heading", { level: 2 })).toHaveLength(3);
    expect(board.getAllByRole("listitem")).toHaveLength(9);
    expect(board.getAllByText("Completed")).toHaveLength(2);
    expect(board.getAllByText("Available")).toHaveLength(7);
    expect(screen.getByText("-200")).toBeVisible();
    fireEvent.click(board.getAllByText("400")[0]);
    expect(screen.getByRole("region", { name: "Clue board" })).toBeVisible();
  });

  it.each(["reading", "open", "answering"])("keeps the %s input and DOM free of answers", (id) => {
    const view = fixture(id);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/"answer"\s*:/);
    expect(serialized).not.toContain("Pacific");
    render(<BoardPresentation view={view} />);
    expect(screen.getByText(/This ocean covers/)).toBeVisible();
    expect(screen.queryByText(/Pacific/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Revealed answer" })).not.toBeInTheDocument();
  });

  it.each([
    ["reading", "Reading · buzzers closed"],
    ["open", "Buzzers open"],
    ["answering", "Robin is answering · buzzers closed"],
    ["reveal", "Answer revealed · buzzers closed"],
  ])("communicates %s in words", (id, status) => {
    render(<BoardPresentation view={fixture(id)} />);
    expect(screen.getByRole("status")).toHaveTextContent(status);
  });

  it("renders only the supplied revealed answer", () => {
    const revealed = fixture("reveal");
    if (revealed.phase !== "reveal") throw new Error("Expected reveal");
    const { rerender } = render(<BoardPresentation view={revealed} />);
    expect(screen.getByRole("heading", { name: "Revealed answer" })).toBeVisible();
    expect(screen.getByText("The Pacific Ocean")).toBeVisible();
    rerender(<BoardPresentation view={{ ...revealed, answer: "A different supplied answer" }} />);
    expect(screen.getByText("A different supplied answer")).toBeVisible();
    expect(screen.queryByText("The Pacific Ocean")).not.toBeInTheDocument();
  });

  it("shows supplied tied winners without sorting or calculating results", () => {
    const results = fixture("results");
    if (results.phase !== "results") throw new Error("Expected results");
    const { rerender } = render(<BoardPresentation view={results} />);
    const resultRegion = within(screen.getByRole("region", { name: "Final results" }));
    expect(resultRegion.getByText("Tied winners")).toBeVisible();
    expect(resultRegion.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Ada", "Sam"]);
    expect(screen.getByText("-200")).toBeVisible();
    // Deliberately inconsistent example proves scores do not determine winners here.
    rerender(<BoardPresentation view={{ ...results, winners: [{ id: "robin", name: "Robin" }] }} />);
    expect(resultRegion.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Robin"]);
    const scoreRegion = within(screen.getByRole("region", { name: "Final scores" }));
    expect(scoreRegion.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Ada1,600 points", "Robin-200 points", "Sam1,600 points",
    ]);
  });

  it.each([["offline", "Offline —"], ["stale", "Stale view —"]])("warns about %s rather than promising current data", (id, warning) => {
    render(<BoardPresentation view={fixture(id)} />);
    expect(screen.getByRole("status")).toHaveTextContent(warning);
    expect(screen.getByRole("status")).toHaveTextContent("Last supplied status:");
    expect(screen.queryByText("Buzz in on your phone")).not.toBeInTheDocument();
  });

  it("removes the stale warning when a fresh supplied view arrives", () => {
    const { rerender } = render(<BoardPresentation view={fixture("stale")} />);
    rerender(<BoardPresentation view={fixture("open")} />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Buzzers open$/);
  });

  it("preserves long prompts, names and large negative scores in full", () => {
    const view = fixture("long");
    if (view.phase !== "answering") throw new Error("Expected answering");
    render(<BoardPresentation view={view} />);
    expect(screen.getByText(view.clue.prompt)).toBeVisible();
    expect(screen.getAllByText(view.answeringPlayer)).toHaveLength(2);
    expect(screen.getByText("-123,456,789")).toBeVisible();
    expect(screen.getByText("ChristopherWithAnUnusuallyLongUnbrokenDisplayName")).toBeVisible();
  });
});

describe("separate local preview chooser", () => {
  it("switches all examples, keeps focus and leaves the original fixture unchanged", () => {
    const original = JSON.stringify(previewFixtures);
    render(<BoardStarter />);
    expect(screen.getByText("Example views only. No live game is connected.")).toBeVisible();
    const chooser = screen.getByRole("combobox", { name: "Preview example" });
    chooser.focus();
    for (const example of previewFixtures) {
      fireEvent.change(chooser, { target: { value: example.id } });
      expect(chooser).toHaveValue(example.id);
      expect(chooser).toHaveFocus();
      expect(screen.getByRole("region", { name: "Team Ham presentation" })).toBeVisible();
    }
    fireEvent.change(chooser, { target: { value: "reveal" } });
    expect(screen.getByText("The Pacific Ocean")).toBeVisible();
    fireEvent.change(chooser, { target: { value: "reading" } });
    expect(screen.queryByText("The Pacific Ocean")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Reading · buzzers closed");
    expect(JSON.stringify(previewFixtures)).toBe(original);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: /Back home/ })).toHaveAttribute("href", "/");
  });
});
