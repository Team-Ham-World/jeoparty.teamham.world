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

/** Reads hex colors and their aliases from the first `:root` block. */
export function readTokens(css: string): Record<string, string> {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const tokens: Record<string, string> = {};
  for (const match of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g))
    tokens[match[1]] = match[2].toLowerCase();
  for (const [, name, target] of root.matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\);/g)) {
    if (tokens[target]) tokens[name] = tokens[target];
  }
  return tokens;
}

/**
 * Shared foreground and background pairs. Keep body text at 4.5:1 and large
 * type, meaningful control borders, and focus rings at 3:1 or higher.
 */
export const CONTRAST_PAIRS: { fg: string; bg: string; min: number; use: string }[] = [
  { fg: "ink", bg: "paper", min: 4.5, use: "body text" },
  { fg: "ink", bg: "surface", min: 4.5, use: "panel text" },
  { fg: "ink", bg: "shade", min: 4.5, use: "sunken panel / disabled buzzer" },
  { fg: "ink", bg: "highlight", min: 4.5, use: "answers, warnings, 'you'" },
  { fg: "ink", bg: "hot", min: 4.5, use: "Hot HAM / wager stamps" },
  { fg: "ink", bg: "peach", min: 4.5, use: "primary buttons and peach tags" },
  { fg: "ink", bg: "peach-press", min: 4.5, use: "primary button hover" },
  { fg: "ink", bg: "lilac", min: 4.5, use: "account avatar and lilac tags" },
  { fg: "ink", bg: "violet-tint", min: 4.5, use: "quiet button hover and info banner" },
  { fg: "ink", bg: "good-tint", min: 4.5, use: "correct row" },
  { fg: "ink", bg: "bad-tint", min: 4.5, use: "incorrect row" },
  { fg: "ink", bg: "hot-tint", min: 4.5, use: "host wager cell" },
  { fg: "muted", bg: "good-tint", min: 4.5, use: "ping beside the answering player (host)" },
  { fg: "muted", bg: "paper", min: 4.5, use: "secondary text" },
  { fg: "muted", bg: "surface", min: 4.5, use: "secondary text on panels" },
  { fg: "muted", bg: "shade", min: 4.5, use: "disabled buttons and failed picture label" },
  { fg: "muted", bg: "highlight", min: 4.5, use: "'Waiting' on your own final-round row" },
  { fg: "muted", bg: "hot-tint", min: 4.5, use: "host wager cell while selecting is off" },
  { fg: "violet", bg: "paper", min: 4.5, use: "links" },
  { fg: "violet", bg: "surface", min: 4.5, use: "links on panels" },
  { fg: "violet", bg: "violet-tint", min: 4.5, use: "studio tags" },
  { fg: "surface", bg: "violet", min: 4.5, use: "selected control" },
  { fg: "surface", bg: "violet-press", min: 4.5, use: "violet control hover" },
  { fg: "paper", bg: "ink", min: 4.5, use: "ink buttons" },
  { fg: "paper", bg: "stage-raise", min: 4.5, use: "ink button hover" },
  { fg: "surface", bg: "ink", min: 4.5, use: "ink headers and tags" },
  { fg: "surface", bg: "good", min: 4.5, use: "Correct button" },
  { fg: "surface", bg: "good-press", min: 4.5, use: "Correct button hover" },
  { fg: "surface", bg: "bad", min: 4.5, use: "Incorrect button" },
  { fg: "surface", bg: "bad-press", min: 4.5, use: "Incorrect button hover" },
  { fg: "good", bg: "paper", min: 4.5, use: "correct text" },
  { fg: "good", bg: "good-tint", min: 4.5, use: "correct tag" },
  { fg: "bad", bg: "paper", min: 4.5, use: "negative scores, errors" },
  { fg: "bad", bg: "surface", min: 4.5, use: "errors on panels" },
  { fg: "bad", bg: "bad-tint", min: 4.5, use: "error tag and error banner text" },
  { fg: "control-rule", bg: "paper", min: 3, use: "quiet button border" },
  { fg: "control-rule", bg: "surface", min: 3, use: "field border" },
  { fg: "control-rule", bg: "shade", min: 3, use: "countdown track border" },
  { fg: "focus", bg: "paper", min: 3, use: "focus ring on paper" },
  { fg: "focus", bg: "surface", min: 3, use: "focus ring on a panel" },
  { fg: "focus", bg: "shade", min: 3, use: "focus ring on a recessed panel" },
  { fg: "focus", bg: "violet-tint", min: 3, use: "focus ring on a tinted panel" },
  { fg: "stage-text", bg: "stage", min: 4.5, use: "TV text" },
  { fg: "stage-text", bg: "stage-raise", min: 4.5, use: "TV score tiles, toasts and TV notices" },
  { fg: "stage-muted", bg: "stage", min: 4.5, use: "TV secondary text" },
  { fg: "stage-muted", bg: "stage-raise", min: 4.5, use: "away player tile" },
  { fg: "stage-faint", bg: "stage", min: 4.5, use: "completed board cells" },
  { fg: "stage-bad", bg: "stage-raise", min: 4.5, use: "TV negative scores" },
  { fg: "stage-good", bg: "stage-raise", min: 4.5, use: "TV correct feedback" },
  { fg: "stage-text", bg: "violet", min: 4.5, use: "TV answering tile and clue" },
  { fg: "lilac", bg: "stage", min: 3, use: "TV focus ring" },
  { fg: "lilac", bg: "stage-raise", min: 3, use: "toast and TV notice focus ring" },
  { fg: "lilac", bg: "violet", min: 3, use: "focus ring on a violet stage panel" },
  { fg: "stage-text", bg: "studio-glow", min: 4.5, use: "hero title" },
  { fg: "stage-muted", bg: "studio-glow", min: 4.5, use: "hero description" },
  { fg: "lilac", bg: "studio-glow", min: 4.5, use: "hero eyebrow" },
  { fg: "peach", bg: "studio-glow", min: 3, use: "large hero title emphasis" },
];
