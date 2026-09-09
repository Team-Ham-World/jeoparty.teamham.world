import { describe, expect, it } from "vitest";
import { team, teamAreas } from "./team";

describe("member starting areas", () => {
  it("preserves the six named owners and their boundaries", () => {
    expect(Object.fromEntries(teamAreas.map((area) => [area.id, area.owner]))).toEqual({
      engine: "Happy",
      board: "Ivvy",
      player: "Scarlet",
      host: "Medchu",
      content: "Fante",
      network: "John",
    });
    expect(team.engine.summary).toContain("scoring calculations");
    expect(team.player.summary).toContain("score display");
  });

  it("gives each owner a distinct route, source folder, and guide", () => {
    for (const field of ["href", "sourcePath", "guidePath"] as const) {
      expect(new Set(teamAreas.map((area) => area[field])).size).toBe(6);
    }
  });
});
