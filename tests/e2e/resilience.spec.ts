/**
 * Host tools and recovery on the starter pack: removing a lobby player,
 * rotating the TV link, pause/resume, a phone refresh mid-clue, a phone going
 * offline, the host's tab closing (auto-pause), score correction, a second
 * round, ending the game and signing out.
 */
import { expect, test } from "@playwright/test";
import {
  LAPTOP,
  SMALL_PHONE,
  boardCells,
  createGame,
  device,
  displayLink,
  joinAsPlayer,
  openDisplay,
  phoneScore,
  pickClue,
  revealAndReturn,
  saveSettings,
  setTimers,
} from "./helpers";

test("lobby tools, pause, reconnects, host leaving, score correction, round 2 and sign out", async ({ browser }) => {
  const host = await device(browser, "r-host", LAPTOP);
  const tv = await device(browser, "tv", LAPTOP);
  const alice = await device(browser, "r-alice");
  const bea = await device(browser, "r-bea");
  const carlo = await device(browser, "r-carlo", SMALL_PHONE);
  const dani = await device(browser, "r-dani", SMALL_PHONE);
  const H = host.page;

  const code = await createGame(H, host.name, "HAM Starter Pack");
  const firstLink = await displayLink(H);
  await openDisplay(tv.page, firstLink);
  for (const player of [alice, bea, carlo, dani]) await joinAsPlayer(player, code);

  // --- Remove a lobby player ----------------------------------------------
  await H.getByRole("button", { name: "Remove r-dani" }).click();
  await H.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(dani.page.getByRole("heading", { name: "You were removed from this room" })).toBeVisible();
  await expect(H.locator(".host-roster li")).toHaveCount(3);
  await expect(tv.page.locator(".tv-tags")).not.toContainText("r-dani");

  // --- Rotate the TV link: the old screen is revoked, the old key is dead --
  await H.getByRole("button", { name: "Make a new link" }).click();
  await expect(tv.page.getByRole("heading", { name: "This screen was disconnected" })).toBeVisible();
  const newLink = await displayLink(H);
  expect(newLink).not.toBe(firstLink);
  const tv2 = await device(browser, "tv2", LAPTOP);
  await openDisplay(tv2.page, newLink);
  await expect(tv2.page.getByText("3 players in")).toBeVisible();
  const stale = await device(browser, "old-tv", LAPTOP);
  await stale.page.goto(firstLink);
  await expect(stale.page.getByRole("heading", { name: "Ask the host for a new display link" })).toBeVisible();
  expect(new URL(stale.page.url()).hash).toBe(""); // The key never stays in the address bar.

  // --- Two short rounds: one category each, no wager clues -----------------
  await saveSettings(H, async (page) => {
    await page.getByRole("button", { name: "2 rounds" }).click();
    await page.getByLabel("Categories per round").selectOption("1");
    await page.getByLabel("Wager clues, round 1").selectOption("0");
    await page.getByLabel("Wager clues, round 2").selectOption("0");
    await setTimers(page, { buzz: 60, answer: 60 });
  });
  await H.getByRole("button", { name: "Start game" }).click();
  await H.getByRole("button", { name: "Show the board" }).click();
  await pickClue(H, "standard");
  await H.getByRole("button", { name: /^Open buzzers/ }).click();
  await expect(bea.page.getByRole("button", { name: "Buzz!" })).toBeEnabled();

  // --- Pause / resume ------------------------------------------------------
  await H.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(H.getByRole("button", { name: "Resume game" })).toBeVisible();
  await expect(tv2.page.getByRole("heading", { name: "Quick break" })).toBeVisible();
  await expect(bea.page.getByRole("button", { name: "Paused" })).toBeDisabled();
  await expect(bea.page.locator(".countdown")).toContainText("Paused");
  await H.getByRole("button", { name: "Resume game" }).click();
  await expect(tv2.page.getByRole("heading", { name: "Quick break" })).toBeHidden();

  // --- A phone refreshes mid-clue: same identity, can still buzz, score kept --
  await bea.page.reload();
  await expect(bea.page.locator(".pl-me .name")).toHaveText("r-bea");
  await bea.page.getByRole("button", { name: "Buzz!" }).click();
  await expect(bea.page.getByText("You're up!", { exact: true })).toBeVisible();
  await H.getByRole("button", { name: /^Correct/ }).click();
  await expect(phoneScore(bea.page)).toHaveText("100");
  await bea.page.reload();
  await expect(phoneScore(bea.page)).toHaveText("100");
  await revealAndReturn(H);

  // --- A phone goes offline: stale banner, buzzing off, then recovery -----
  await pickClue(H, "standard");
  await H.getByRole("button", { name: /^Open buzzers/ }).click();
  await expect(carlo.page.getByRole("button", { name: "Buzz!" })).toBeEnabled();
  await carlo.context.setOffline(true);
  await expect(carlo.page.getByText("Connection lost. Reconnecting…")).toBeVisible();
  await expect(carlo.page.getByRole("button", { name: "Offline" })).toBeDisabled();
  await expect(carlo.page.locator(".conn")).toHaveText("Reconnecting");
  await carlo.context.setOffline(false);
  await expect(carlo.page.locator(".conn")).toHaveText("Live");
  await expect(carlo.page.getByText("Connection lost. Reconnecting…")).toBeHidden();
  await carlo.page.getByRole("button", { name: "Buzz!" }).click();
  await H.getByRole("button", { name: /^Incorrect/ }).click();
  await expect(phoneScore(carlo.page)).toHaveText("−200");

  // --- The host's tab closes: everyone sees the auto-pause; the host returns --
  await H.close();
  await expect(alice.page.getByText("Paused: host offline")).toBeVisible();
  await expect(tv2.page.getByRole("heading", { name: "Waiting for the host" })).toBeVisible();
  await expect(alice.page.getByRole("button", { name: "Paused" })).toBeDisabled();
  const H2 = await host.context.newPage();
  await H2.goto(`/host/${code}`);
  await expect(H2.getByText("Paused: host offline")).toBeVisible();
  await H2.getByRole("button", { name: "Resume game" }).click();
  await expect(alice.page.getByText("Paused: host offline")).toBeHidden();
  await expect(tv2.page.getByRole("heading", { name: "Waiting for the host" })).toBeHidden();

  // --- Score correction with a reason -------------------------------------
  await H2.getByRole("button", { name: "Adjust r-alice's score" }).click();
  const dialog = H2.getByRole("dialog", { name: "Adjust a score" });
  await dialog.getByRole("button", { name: "Apply" }).click(); // Empty form: explains what's missing.
  await expect(dialog.getByText("Say why, so everyone can see it in the score log.")).toBeVisible();
  await dialog.getByPlaceholder("Points").fill("50");
  await dialog.getByLabel("Reason").fill("Accepted a misspelling");
  await dialog.getByRole("button", { name: "Add 50" }).click();
  await expect(dialog).toBeHidden();
  await expect(H2.locator(".host-log")).toContainText("Adjusted: Accepted a misspelling");
  await expect(phoneScore(alice.page)).toHaveText("50");

  // --- Finish round 1, then round 2 ---------------------------------------
  await revealAndReturn(H2);
  const playOutRound = async () => {
    await expect(H2.locator(".board--host")).toBeVisible();
    // After each clue the clue panel is gone, so the count reflects the new view.
    while ((await boardCells(H2).count()) > 0) {
      await pickClue(H2, "standard");
      await revealAndReturn(H2);
    }
  };
  await playOutRound();
  await expect(tv2.page.getByText("Round 2 of 2")).toBeVisible();
  await expect(alice.page.getByText("Round 2 of 2")).toBeVisible();
  await H2.getByRole("button", { name: "Show the board" }).click();
  await expect(H2.locator(".board--host .board__value").first()).toHaveText("200"); // Round 2 uses the pack's second scoring round.
  await playOutRound();
  await expect(H2.locator(".host-final")).toBeVisible();

  // --- End the game early, then sign out ----------------------------------
  await H2.getByRole("button", { name: "End game", exact: true }).click();
  await H2.getByRole("dialog").getByRole("button", { name: "End game" }).click();
  await expect(H2.locator("#host-results-title")).toHaveText("r-bea wins!");
  await expect(bea.page.getByRole("heading", { name: "You won!" })).toBeVisible();

  await H2.goto("/");
  await H2.getByRole("button", { name: "Sign out" }).click();
  await expect(H2.getByRole("heading", { name: "Sign in to host or play" })).toBeVisible();
  await H2.goto(`/host/${code}`);
  await expect(H2.getByRole("heading", { name: `Host room ${code}` })).toBeVisible();
  await expect(H2.getByRole("link", { name: "Sign in with HAM" })).toBeVisible();

  const errors = [host, tv, alice, bea, carlo, dani, tv2, stale].flatMap((p) => p.errors);
  expect(errors).toEqual([]);
});
