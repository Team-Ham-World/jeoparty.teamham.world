import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTRAST_PAIRS, contrastRatio, readTokens } from "./contrast";

const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
const tokens = readTokens(css);

describe("color tokens meet WCAG contrast", () => {
  it("reads the brand tokens from globals.css", () => {
    expect(tokens.paper).toBe("#f6f1e5");
    expect(tokens.ink).toBe("#1c1a17");
    expect(tokens.blue).toBe("#1d4ed8");
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
