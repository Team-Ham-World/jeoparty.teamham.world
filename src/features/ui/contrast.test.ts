import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTRAST_PAIRS, contrastRatio, readTokens } from "./contrast";

const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
const tokens = readTokens(css);

describe("color tokens meet WCAG contrast", () => {
  it("uses the broadcast studio palette", () => {
    expect(tokens).toMatchObject({
      paper: "#faf4e9",
      ink: "#191621",
      violet: "#504388",
      lilac: "#c6b8ff",
      peach: "#ff9864",
      stage: "#191621",
    });
    expect(css).toMatch(/--font-mono:\s*ui-monospace\b/);
  });

  it.each(CONTRAST_PAIRS)("$fg on $bg ($use) ≥ $min", ({ fg, bg, min }) => {
    expect(tokens[fg], `missing --${fg}`).toBeDefined();
    expect(tokens[bg], `missing --${bg}`).toBeDefined();
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
  });

  it("keeps decorative red off text: it fails 4.5 on paper, so no pair above uses it", () => {
    expect(contrastRatio(tokens.red, tokens.paper)).toBeLessThan(4.5);
    expect(CONTRAST_PAIRS.some((p) => p.fg === "red")).toBe(false);
  });
});
