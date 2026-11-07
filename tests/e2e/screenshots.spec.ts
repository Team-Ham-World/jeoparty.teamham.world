/**
 * Refreshes docs/screenshots/ from the real app (not /preview). Opt-in:
 *
 *   npm run screenshots
 *
 * Each file is named <screen>-<state>-<width>x<height>.png and shows the
 * first screenful at that size: phones 390×844 and 360×740, laptop
 * 1366×768, TV 1920×1080. Motion is reduced so every capture is stable.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  LAPTOP,
  PHONE,
  SMALL_PHONE,
  TV,
  createGame,
  device,
  displayLink,
  joinAsPlayer,
  openDisplay,
  pickClue,
  revealAndReturn,
  saveSettings,
  setTimers,
  signIn,
  type Person,
} from "./helpers";

test.skip(!process.env.E2E_SCREENSHOTS, "Run with `npm run screenshots` to refresh docs/screenshots.");

const OUT = process.env.E2E_SCREENSHOTS_DIR ?? path.join(process.cwd(), "docs", "screenshots");

/** `flash`: keep one-shot feedback (Correct!/Incorrect) on screen instead of fast-forwarding it away. */
async function snap(page: Page, name: string, { flash = false } = {}) {
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width - 1, height - 1); // Park the pointer in a corner: no hover state from the last click.
  await page.waitForTimeout(flash ? 150 : 350); // Let fonts settle.
  await page.screenshot({ path: path.join(OUT, `${name}-${width}x${height}.png`), animations: flash ? "allow" : "disabled", caret: "hide" });
}

test("game screens", async ({ browser }) => {
  const host = await device(browser, "s-host", LAPTOP);
  const tv = await device(browser, "s-tv", TV);
  const tvSmall = await device(browser, "s-tv-small", LAPTOP);
  const ana = await device(browser, "ana", PHONE);
  const ben = await device(browser, "ben", PHONE);
  const cy = await device(browser, "cy", SMALL_PHONE);
  const dee = await device(browser, "dee", SMALL_PHONE);
  const H = host.page;

  await cy.page.goto("/");
  await expect(cy.page.getByRole("heading", { name: "Sign in to host or play" })).toBeVisible();
  await snap(cy.page, "home-signed-out");

  await signIn(H, host.name, "/");
  await expect(H.getByLabel("Question pack").locator("option", { hasText: "Ham Snack" })).toBeAttached();
  await snap(H, "home-signed-in");
  await H.goto("/");
  const code = await createGame(H, host.name, "Ham Snack");
  await saveSettings(H, async (page) => {
    await page.getByLabel("Wager clues, round 1").selectOption("1");
    await setTimers(page, { buzz: 60, answer: 30, final: 120 });
  });
  const link = await displayLink(H);
  await openDisplay(tv.page, link);
  await openDisplay(tvSmall.page, link);
  for (const player of [ana, ben, cy, dee] as Person[]) await joinAsPlayer(player, code);

  await H.getByRole("button", { name: "Remove dee" }).click();
  await H.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(dee.page.getByRole("heading", { name: "You were removed from this room" })).toBeVisible();
  await snap(dee.page, "player-closed-removed");

  await H.evaluate(() => window.scrollTo(0, 0));
  await snap(H, "host-lobby");
  await snap(tv.page, "display-lobby");
  await snap(ana.page, "player-lobby");

  await H.getByRole("button", { name: "Start game" }).click();
  await H.getByRole("button", { name: "Show the board" }).click();
  await expect(tv.page.locator(".board--stage")).toBeVisible();
  await snap(H, "host-board");
  await snap(tv.page, "display-board");
  await snap(tvSmall.page, "display-board");
  await snap(ana.page, "player-board");

  // A standard clue: open → ana answers → correct → revealed.
  await pickClue(H, "standard");
  await H.getByRole("button", { name: /^Open buzzers/ }).click();
  await expect(ana.page.getByRole("button", { name: "Buzz!" })).toBeEnabled();
  await snap(tv.page, "display-open");
  await snap(ana.page, "player-open");
  await ana.page.getByRole("button", { name: "Buzz!" }).click();
  await expect(ana.page.getByText("You're up!", { exact: true })).toBeVisible();
  await snap(H, "host-answering");
  await snap(ana.page, "player-answering-you");
  await H.getByRole("button", { name: /^Correct/ }).click();
  await expect(tv.page.locator(".tv-judged")).toBeVisible();
  await Promise.all([snap(tv.page, "display-judged", { flash: true }), snap(ana.page, "player-judged", { flash: true })]);
  await H.getByRole("button", { name: /^Reveal answer/ }).click();
  await expect(tv.page.locator(".tv-answer")).toBeVisible();
  await snap(tv.page, "display-revealed");

  // Pause on the TV, and a phone that lost its connection.
  await H.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(tv.page.getByRole("heading", { name: "Quick break" })).toBeVisible();
  await snap(tv.page, "display-paused");
  await H.getByRole("button", { name: "Resume game" }).click();
  await H.getByRole("button", { name: /^Back to board/ }).click();
  await pickClue(H, "standard");
  await H.getByRole("button", { name: /^Open buzzers/ }).click();
  await expect(cy.page.getByRole("button", { name: "Buzz!" })).toBeEnabled();
  await cy.context.setOffline(true);
  await expect(cy.page.getByText("Connection lost. Reconnecting…")).toBeVisible();
  await snap(cy.page, "player-stale");
  await cy.context.setOffline(false);
  await expect(cy.page.locator(".conn")).toHaveText("Live");
  await ben.page.getByRole("button", { name: "Buzz!" }).click();
  await H.getByRole("button", { name: /^Correct/ }).click();
  await revealAndReturn(H);

  // The wager clue: ben controls the board now.
  await pickClue(H, "wager");
  await expect(ben.page.getByRole("heading", { name: "Place your wager" })).toBeVisible();
  await snap(H, "host-wager");
  await snap(tv.page, "display-wager");
  await snap(ben.page, "player-wager-you");
  await ben.page.getByRole("button", { name: /^All in/ }).click();
  await ben.page.getByRole("button", { name: "Lock in wager" }).click();
  await H.getByRole("button", { name: /^Correct/ }).click();
  await revealAndReturn(H);

  // Everyone else scores so all three play the final round.
  for (let i = 0; await H.locator(".board--host").isVisible(); i++) {
    await pickClue(H, "standard");
    if (i < 2) {
      await H.getByRole("button", { name: /^Open buzzers/ }).click();
      await (i === 0 ? cy : ana).page.getByRole("button", { name: "Buzz!" }).click();
      await H.getByRole("button", { name: /^Correct/ }).click();
    }
    await H.getByRole("button", { name: /^Reveal answer/ }).click();
    await H.getByRole("button", { name: /^Back to board/ }).click();
    await expect(H.locator(".board--host, .host-final").first()).toBeVisible();
  }

  // Final round.
  for (const player of [ana, ben, cy]) {
    await player.page.getByRole("button", { name: "Half" }).click();
    await player.page.getByRole("button", { name: "Lock in wager" }).click();
  }
  await H.getByRole("button", { name: "Show final clue" }).click();
  const said = { ana: "What is the Milky Way?", ben: "Andromeda", cy: "What is the Milky Way galaxy?" } as const;
  for (const player of [ana, ben, cy]) {
    await player.page.getByLabel("Your answer").fill(said[player.name as keyof typeof said]);
    await player.page.getByRole("button", { name: "Submit answer" }).click();
  }
  await expect(ana.page.getByText("Submitted")).toBeVisible();
  await snap(ana.page, "player-final-answer-submitted");
  await H.getByRole("button", { name: "Lock answers" }).click();
  await H.getByRole("button", { name: /^Reveal .*'s response$/ }).click();
  await H.getByRole("button", { name: /^Incorrect/ }).click();
  await H.getByRole("button", { name: /^Reveal .*'s response$/ }).click();
  await expect(tv.page.locator(".tv-response--revealed")).toBeVisible();
  await snap(H, "host-final-judging");
  await snap(tv.page, "display-final-judging");
  await H.getByRole("button", { name: /^Correct/ }).click();
  await H.getByRole("button", { name: /^Reveal .*'s response$/ }).click();
  await H.getByRole("button", { name: /^Correct/ }).click();
  await H.getByRole("button", { name: "Show results" }).click();
  await expect(tv.page.locator(".tv-results")).toBeVisible();
  await snap(H, "host-results");
  await snap(tv.page, "display-results");
  for (const player of [ana, ben, cy]) {
    if (/You won!|Shared win!/.test(await player.page.locator(".pl-big").first().innerText())) {
      await snap(player.page, "player-results-win");
      break;
    }
  }
});

test("long names and long clues", async ({ browser }) => {
  const host = await device(browser, "s-long-host", PHONE);
  const tv = await device(browser, "s-long-tv", LAPTOP);
  const players = await Promise.all(
    ["maximiliana.delacruz-santos_jr", "bartholomew.featherstonehaugh", "x"].map((name) => device(browser, name, SMALL_PHONE)),
  );
  const H = host.page;
  await signIn(H, host.name, "/");

  // A pack with long titles and prompts, saved through the API like the editor does.
  const session = await (await H.request.get("/api/session")).json();
  const long = JSON.parse(await readFile(path.join(process.cwd(), "src/features/content/samples/sample-pack-3x3.json"), "utf8")) as {
    title: string;
    categories: { title: string; clues: { prompt: string }[] }[];
  };
  long.title = "The Extremely Thorough Office Party Quiz";
  long.categories[0].title = "Famous Inventions of the Nineteenth Century";
  long.categories[0].clues[0].prompt =
    "Patented in 1876 after a famously close race to the patent office, this device turned electrical signals back into the human voice and changed how families, businesses and newsrooms talked to each other forever.";
  long.categories[1].title = "Rivers, Lakes & Other Wet Places";
  const saved = await H.request.post("/api/packs", {
    headers: { origin: new URL(H.url()).origin, "x-quiz-csrf": session.csrfToken },
    data: { pack: long },
  });
  expect(saved.ok()).toBe(true);

  await H.goto("/");
  const code = await createGame(H, host.name, long.title);
  await openDisplay(tv.page, await displayLink(H));
  for (const player of players) await joinAsPlayer(player, code);
  await H.getByRole("button", { name: "Start game" }).click();
  await H.getByRole("button", { name: "Show the board" }).click();
  await H.getByRole("button", { name: /^Famous Inventions of the Nineteenth Century for 200/ }).click();
  await H.getByRole("button", { name: /^Open buzzers/ }).click();
  await players[0].page.getByRole("button", { name: "Buzz!" }).click();
  await expect(players[0].page.getByText("You're up!", { exact: true })).toBeVisible();
  await H.evaluate(() => window.scrollTo(0, 0));
  await snap(H, "host-long");
  await snap(players[1].page, "player-long");
  await snap(tv.page, "display-long");
});

test("pack screens", async ({ browser }) => {
  const author = await device(browser, "s-author", LAPTOP);
  const P = author.page;
  await signIn(P, author.name, "/packs");
  await P.getByRole("button", { name: "Copy to my packs" }).first().click();
  await P.waitForURL(/\/packs\/(?!new$)[^/]+$/);
  await P.goto("/packs");
  await expect(P.locator(".pack-card")).toHaveCount(3);
  await snap(P, "packs-list");
  await P.goto("/packs/new");
  await P.getByLabel("Title", { exact: true }).fill("Friday Night Brain Melt");
  await P.getByLabel("Category title").fill("Internet Lore");
  await P.getByLabel("Clue 1", { exact: true }).fill("This 1990s dancing baby was one of the first viral videos.");
  await P.getByRole("button", { name: "Save pack" }).first().click();
  await expect(P.locator(".ed-errors")).toBeVisible();
  await P.evaluate(() => window.scrollTo(0, 0));
  await snap(P, "packs-editor-errors");
});
