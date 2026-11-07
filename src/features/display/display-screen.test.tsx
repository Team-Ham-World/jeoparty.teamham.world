// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SPECS, displayFixture, hostFixture, type SpecId } from "@/features/preview/fixtures";
import { mockConnection } from "@/features/preview/mock-connection";
import { DisplayScreen } from "./display-screen";

const ids = Object.keys(SPECS) as SpecId[];

/** Every answer-like string the host can see for this scenario. */
function privateStrings(id: SpecId): string[] {
  const host = hostFixture(id);
  const strings = [host.clue?.answer, host.final?.answer, ...(host.final?.responses.map((r) => r.answer) ?? [])];
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
    const { container } = render(<DisplayScreen connection={mockConnection(displayFixture(id))} joinUrl="https://quiz.example/r/BCDFG" />);
    const text = container.textContent ?? "";
    const visible = publicStrings(id);
    for (const secret of privateStrings(id)) {
      if (visible.includes(JSON.stringify(secret))) continue; // the view made it public
      expect(text).not.toContain(secret);
    }
  });

  it("shows the answer once the view reveals it", () => {
    render(<DisplayScreen connection={mockConnection(displayFixture("revealed"))} joinUrl="https://quiz.example/r/BCDFG" />);
    expect(screen.getByText("What is Lynx?")).toBeVisible();
  });

  it("has no controls: the TV never sends commands", () => {
    const { container } = render(<DisplayScreen connection={mockConnection(displayFixture("board"))} joinUrl="https://quiz.example/r/BCDFG" />);
    expect(container.querySelector("button, input, select, textarea")).toBeNull();
  });

  it("shows join instructions with the room code in the lobby", () => {
    render(<DisplayScreen connection={mockConnection(displayFixture("lobby"))} joinUrl="https://quiz.example/r/BCDFG" />);
    expect(screen.getByLabelText("Room code B C D F G")).toBeVisible();
    expect(screen.getByRole("img", { name: /join room BCDFG/ })).toBeVisible();
  });
});
