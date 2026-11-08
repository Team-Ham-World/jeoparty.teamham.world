/** WCAG 2.x relative luminance and contrast ratio for #rrggbb colors. */
export function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--name: #hex;` tokens from the first `:root { … }` block of a CSS file. */
export function readTokens(css: string): Record<string, string> {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const tokens: Record<string, string> = {};
  for (const match of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g))
    tokens[match[1]] = match[2].toLowerCase();
  return tokens;
}

/**
 * Every text/background pair the screens use, with the WCAG minimum it must
 * meet: 4.5 for body text, 3 for large display text and non-text UI (focus
 * rings, borders that carry meaning).
 */
export const CONTRAST_PAIRS: { fg: string; bg: string; min: number; use: string }[] = [
  { fg: "ink", bg: "paper", min: 4.5, use: "body text" },
  { fg: "ink", bg: "surface", min: 4.5, use: "panel text" },
  { fg: "ink", bg: "shade", min: 4.5, use: "sunken panel / disabled buzzer" },
  { fg: "ink", bg: "highlight", min: 4.5, use: "answers, warnings, 'you'" },
  { fg: "ink", bg: "hot", min: 4.5, use: "Hot HAM / wager stamps" },
  { fg: "ink", bg: "blue-tint", min: 4.5, use: "hover, answering row" },
  { fg: "ink", bg: "good-tint", min: 4.5, use: "correct row" },
  { fg: "ink", bg: "bad-tint", min: 4.5, use: "incorrect row" },
  { fg: "muted", bg: "good-tint", min: 4.5, use: "ping beside the answering player (host)" },
  { fg: "muted", bg: "paper", min: 4.5, use: "secondary text" },
  { fg: "muted", bg: "surface", min: 4.5, use: "secondary text on panels" },
  { fg: "muted", bg: "shade", min: 4.5, use: "disabled buzzer label" },
  { fg: "muted", bg: "highlight", min: 4.5, use: "'Waiting' on your own final-round row" },
  { fg: "blue", bg: "paper", min: 4.5, use: "links" },
  { fg: "blue", bg: "surface", min: 4.5, use: "links on panels" },
  { fg: "ink", bg: "hot-tint", min: 4.5, use: "host wager cell" },
  { fg: "muted", bg: "hot-tint", min: 4.5, use: "host wager cell while selecting is off" },
  { fg: "surface", bg: "blue", min: 4.5, use: "primary buttons, buzz" },
  { fg: "surface", bg: "blue-press", min: 4.5, use: "primary button hover" },
  { fg: "surface", bg: "good", min: 4.5, use: "Correct button / stamp" },
  { fg: "surface", bg: "good-press", min: 4.5, use: "Correct button hover" },
  { fg: "surface", bg: "bad", min: 4.5, use: "Incorrect button / stamp" },
  { fg: "surface", bg: "bad-press", min: 4.5, use: "Incorrect button hover" },
  { fg: "surface", bg: "ink", min: 4.5, use: "ink headers, stamps" },
  { fg: "good", bg: "paper", min: 4.5, use: "correct text" },
  { fg: "bad", bg: "paper", min: 4.5, use: "negative scores, errors" },
  { fg: "bad", bg: "surface", min: 4.5, use: "errors on panels" },
  { fg: "bad", bg: "bad-tint", min: 4.5, use: "error banner text" },
  { fg: "blue", bg: "paper", min: 3, use: "focus ring (non-text)" },
  { fg: "stage-text", bg: "stage", min: 4.5, use: "TV text" },
  { fg: "stage-text", bg: "stage-raise", min: 4.5, use: "TV score tiles" },
  { fg: "stage-muted", bg: "stage", min: 4.5, use: "TV secondary text" },
  { fg: "stage-muted", bg: "stage-raise", min: 4.5, use: "away player tile" },
  { fg: "stage-faint", bg: "stage", min: 4.5, use: "completed board cells" },
  { fg: "stage-bad", bg: "stage-raise", min: 4.5, use: "TV negative scores" },
  { fg: "ink", bg: "stage-blue", min: 4.5, use: "'Picks' tag" },
  { fg: "stage-text", bg: "blue", min: 4.5, use: "answering tile, active cell" },
  { fg: "stage-blue", bg: "stage", min: 3, use: "TV focus/outline (non-text)" },
];
