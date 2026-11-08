// Offline composition: npm run render:og. No app server or image generation needed.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] || path.join(root, "public/og"));
const template = await readFile(path.join(root, "design/og/card.html"), "utf8");
// Read the actual identity asset each time so the composition cannot drift.
const wordmarkSource = await readFile(path.join(root, "src/features/ui/ham-wordmark.tsx"), "utf8");
const wordmarkPath = wordmarkSource.match(/<path d="([^"]+)"/);
assert.ok(wordmarkPath, "Expected the traced HAM wordmark path");
const ham = `<svg viewBox="0 0 1000 445.64" fill="currentColor" fill-rule="evenodd" role="img" aria-label="HAM"><path d="${wordmarkPath[1]}" /></svg>`;
const lockup = `<span class="lockup">${ham}<span>Quiz</span></span>`;
const fonts = {
  displayFont:
    "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2",
  bodyFont: "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2",
  boldFont: "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2",
};
const variables = {};
for (const [key, file] of Object.entries(fonts)) {
  variables[key] =
    `data:font/woff2;base64,${(await readFile(path.join(root, "node_modules", file))).toString("base64")}`;
}
const cache = path.join(
  process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(homedir(), ".cache/ms-playwright"),
);
const cachedShell = existsSync(cache)
  ? readdirSync(cache)
      .filter((dir) => dir.startsWith("chromium_headless_shell-"))
      .sort()
      .reverse()
      .flatMap((dir) =>
        readdirSync(path.join(cache, dir)).map((sub) =>
          path.join(cache, dir, sub, "chrome-headless-shell"),
        ),
      )
      .find((file) => existsSync(file))
  : undefined;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || cachedShell,
  args: ["--no-sandbox"],
});
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  for (const kind of ["home", "invite"]) {
    const artPath =
      process.env[`OG_${kind.toUpperCase()}_ART`] || path.join(root, `design/og/${kind}-art.jpg`);
    const art = await sharp(artPath)
      .resize(1200, 630, { fit: "fill" })
      .jpeg({ quality: 95 })
      .toBuffer();
    const content =
      kind === "home"
        ? `<div class="brand">${lockup}</div><h1><span class="line">Pick a clue.</span><span class="line">Beat your friends</span><span class="line">to the <span class="marked">buzzer.</span></span></h1><div class="note">A party quiz for 2–6 players.</div>`
        : `<div class="stamp">YOU'RE INVITED</div><h1><span class="line">Join the game</span><span class="join-brand">on ${lockup}</span></h1><p class="instructions">Sign in with ${ham} and buzz in<br />from your phone.</p><div class="address">quiz.teamham.world</div>`;
    const values = {
      ...variables,
      kind,
      content,
      art: `data:image/jpeg;base64,${art.toString("base64")}`,
    };
    const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      assert.ok(key in values, `Missing template value: ${key}`);
      return values[key];
    });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".art").evaluate((img) => img.decode());
    const screenshot = await page.screenshot();
    await sharp(screenshot)
      .png({ palette: true, quality: 85, colours: 64, dither: 0, compressionLevel: 9 })
      .toFile(path.join(output, `${kind}.png`));
    if (process.argv[2]) {
      await sharp(screenshot)
        .resize(400, 210)
        .png()
        .toFile(path.join(output, `${kind}-small.png`));
      await writeFile(path.join(output, `${kind}.html`), html);
    }
    const { width, height } = await sharp(path.join(output, `${kind}.png`)).metadata();
    const { size } = await stat(path.join(output, `${kind}.png`));
    assert.equal(width, 1200);
    assert.equal(height, 630);
    assert.ok(size <= 300_000, `${kind} exceeds 300 KB`);
    console.log(`${kind}.png: ${width}×${height}, ${size} bytes`);
  }
} finally {
  await browser.close();
}
