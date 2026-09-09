// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import DisplayPage from "@/app/display/page";
import PlayPage from "@/app/play/page";
import HostPage from "@/app/host/page";
import EditorPage from "@/app/editor/page";
import EngineWorkbenchPage from "@/app/workbench/engine/page";
import NetworkWorkbenchPage from "@/app/workbench/network/page";
import { team, teamAreas } from "@/lib/team";

describe("scaffold navigation", () => {
  it("renders the landing page with a link to every member's area", () => {
    render(<HomePage />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    const links = screen.getAllByRole("link");
    for (const area of teamAreas) {
      expect(links.some((link) => link.getAttribute("href") === area.href)).toBe(true);
    }
  });

  it.each([
    { Page: DisplayPage, area: team.board },
    { Page: PlayPage, area: team.player },
    { Page: HostPage, area: team.host },
    { Page: EditorPage, area: team.content },
    { Page: EngineWorkbenchPage, area: team.engine },
    { Page: NetworkWorkbenchPage, area: team.network },
  ])("renders the $area.owner starting page without gameplay controls", ({ Page, area }) => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(area.title);
    expect(screen.getByText(area.sourcePath)).toBeVisible();
    expect(screen.getByText(area.guidePath)).toBeVisible();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/")).toBe(true);
  });
});
