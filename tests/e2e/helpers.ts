/**
 * Shared steps for the HAM Quiz end-to-end tests. Every "person" is a
 * separate browser context (own cookies), like a separate device.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

export const PHONE = { width: 390, height: 844 };
export const SMALL_PHONE = { width: 360, height: 740 };
export const LAPTOP = { width: 1366, height: 768 };
export const TV = { width: 1920, height: 1080 };

export interface Person {
  name: string;
  context: BrowserContext;
  page: Page;
}

function baseURL(): string {
  const url = test.info().project.use.baseURL;
  if (!url) throw new Error("baseURL is not configured");
  return url;
}

/** A new device. Console errors from the page are collected for assertions. */
export async function device(
  browser: Browser,
  name: string,
  viewport = PHONE,
): Promise<Person & { errors: string[] }> {
  const context = await browser.newContext({
    baseURL: baseURL(),
    viewport,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
  return { name, context, page, errors };
}

/**
 * Signs in through the local HAM fixture's consent page with a custom test
 * username, then lands back on `returnTo`. Usernames are lowercase.
 */
export async function signIn(page: Page, username: string, returnTo = "/"): Promise<void> {
  await page.goto(`/api/auth/login?return_to=${encodeURIComponent(returnTo)}`);
  await expect(page.getByText("This is not HAM")).toBeVisible();
  await page.locator("#custom").fill(username);
  await page.getByRole("button", { name: "Continue with custom name" }).click();
  await page.waitForURL((url) => url.pathname === returnTo);
}

/** Signs in on the home page and creates a game with the pack whose title starts with `packTitle`. Returns the room code. */
export async function createGame(host: Page, username: string, packTitle: string): Promise<string> {
  await signIn(host, username, "/");
  const select = host.getByLabel("Question pack");
  await expect(select.locator("option", { hasText: packTitle }).first()).toBeAttached();
  const label = (await select.locator("option").allInnerTexts()).find((text) =>
    text.startsWith(packTitle),
  );
  if (!label) throw new Error(`No pack starting with ${packTitle}`);
  await select.selectOption({ label });
  await host.getByRole("button", { name: "Create game" }).click();
  await host.waitForURL(/\/host\/[A-Z]{5}$/);
  await expect(host.getByRole("heading", { name: "Set up the game" })).toBeVisible();
  return host.url().split("/").pop()!;
}

/** Host lobby: make a display link and return it. */
export async function displayLink(host: Page): Promise<string> {
  const make = host.getByRole("button", { name: "Get display link" });
  if (await make.isVisible()) await make.click();
  const field = host.getByRole("textbox", { name: "Display link" });
  await expect(field).toHaveValue(/\/display\/[A-Z]{5}#key=/);
  return field.inputValue();
}

/** Opens a TV link: the screen claims the key, strips it from the address bar, then connects. */
export async function openDisplay(tv: Page, link: string): Promise<void> {
  await tv.goto(link);
  await expect(tv.locator(".tv-head")).toBeVisible();
  expect(new URL(tv.url()).hash).toBe("");
}

/** A player signs in from the room link and joins. */
export async function joinAsPlayer(
  player: Person,
  code: string,
  { nextGame = false } = {},
): Promise<void> {
  await signIn(player.page, player.name, `/r/${code}`);
  await player.page
    .getByRole("button", { name: nextGame ? "Join the next game" : "Join game" })
    .click();
  await expect(
    player.page.getByRole("heading", {
      name: nextGame ? "You're in for the next game" : "Waiting for the host to start",
    }),
  ).toBeVisible();
}

/** Lobby settings form helpers. */
export async function saveSettings(
  host: Page,
  changes: (host: Page) => Promise<void>,
): Promise<void> {
  await changes(host);
  await host.getByRole("button", { name: "Save settings" }).click();
  await expect(
    host.getByRole("form", { name: "Game settings" }).getByText("Saved", { exact: true }),
  ).toBeVisible();
}

export async function setTimers(
  host: Page,
  seconds: { buzz?: number; answer?: number; final?: number },
): Promise<void> {
  if (seconds.buzz)
    await host.getByLabel("Buzz window (s)", { exact: true }).fill(String(seconds.buzz));
  if (seconds.answer)
    await host.getByLabel("Answer time (s)", { exact: true }).fill(String(seconds.answer));
  if (seconds.final)
    await host.getByLabel("Final answer time (s)", { exact: true }).fill(String(seconds.final));
}

/** Available host board cells, optionally only wager or only standard ones. */
export function boardCells(host: Page, kind: "any" | "wager" | "standard" = "any"): Locator {
  const cells = host.locator(".board--host button.board__cell");
  if (kind === "wager") return cells.filter({ has: host.locator(".board__hot") });
  if (kind === "standard") return cells.filter({ hasNot: host.locator(".board__hot") });
  return cells;
}

/** The host's panel for the current board clue (not the final round). */
export function hostCluePanel(host: Page): Locator {
  return host.locator('section[aria-labelledby="host-clue-title"]');
}

/** Host picks a clue; resolves once the clue panel shows. */
export async function pickClue(host: Page, kind: "wager" | "standard"): Promise<void> {
  await boardCells(host, kind).first().click();
  await expect(hostCluePanel(host)).toBeVisible();
}

/** Host reveals the answer and returns to the board (or to whatever comes next). */
export async function revealAndReturn(host: Page): Promise<void> {
  await host.getByRole("button", { name: /^Reveal answer/ }).click();
  await host.getByRole("button", { name: /^Back to board/ }).click();
  await expect(hostCluePanel(host)).toBeHidden();
}

/** Name of the player the host's screen says picks next. */
export async function controllerName(host: Page): Promise<string> {
  return (await host.locator(".host-picker strong.name").innerText()).trim();
}

/** The phone's own score as shown in its header. */
export function phoneScore(page: Page): Locator {
  return page.locator(".pl-me__score .score");
}

export function byName<T extends { name: string }>(people: readonly T[], name: string): T {
  const person = people.find((p) => p.name === name);
  if (!person) throw new Error(`No person named ${name}`);
  return person;
}
