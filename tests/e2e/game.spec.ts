/**
 * A complete game on the 3×3 "Ham Snack" pack, with a host laptop, a TV and
 * three phones (plus a late joiner), each in its own browser context.
 */
import { expect, test } from "@playwright/test";
import {
  LAPTOP,
  TV,
  byName,
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

test("host, TV and three phones play a full game with wagers, a final round and play again", async ({
  browser,
}) => {
  const host = await device(browser, "g-host", LAPTOP);
  const tv = await device(browser, "tv", TV);
  const players = await Promise.all(
    ["g-alice", "g-bea", "g-carlo"].map((name) => device(browser, name)),
  );
  const [alice, bea, carlo] = players;
  const H = host.page;

  // --- Lobby ---------------------------------------------------------------
  const code = await createGame(H, host.name, "Ham Snack");
  await expect(H.getByText("In use:")).toContainText("Ham Snack");
  // Three wager clues (player wager, host enters one, host skips one); long timers so a slow machine can't expire them.
  await saveSettings(H, async (page) => {
    await page.getByLabel("Wager clues, round 1").selectOption("3");
    await setTimers(page, { buzz: 60, answer: 60, final: 180 });
  });

  await openDisplay(tv.page, await displayLink(H));
  await expect(tv.page.getByLabel(`Room code ${code.split("").join(" ")}`)).toBeVisible();

  for (const player of players) await joinAsPlayer(player, code);
  await expect(tv.page.locator(".tv-tags")).toContainText("g-carlo");
  await expect(H.locator(".host-roster li")).toHaveCount(3);
  await expect(H.getByText("Ready")).toBeVisible();

  // --- Round intro → board -------------------------------------------------
  await H.getByRole("button", { name: "Start game" }).click();
  await expect(tv.page.getByRole("heading", { name: "Round 1" })).toBeVisible();
  for (const player of players) await expect(player.page.getByText("Round 1 of 1")).toBeVisible();
  await H.getByRole("button", { name: "Show the board" }).click();
  await expect(tv.page.locator(".board--stage")).toBeVisible();

  // --- Standard clue: concurrent buzz race, incorrect, reopen, correct -----
  await pickClue(H, "standard");
  const prompt1 = (await H.locator(".host-prompt p").innerText()).trim();
  await expect(tv.page.getByText(prompt1)).toBeVisible();
  await expect(alice.page.getByRole("button", { name: "Wait" })).toBeDisabled();
  await H.getByRole("button", { name: /^Open buzzers/ }).click();
  const aliceBuzz = alice.page.getByRole("button", { name: "Buzz!" });
  const beaBuzz = bea.page.getByRole("button", { name: "Buzz!" });
  await expect(aliceBuzz).toBeEnabled();
  await expect(beaBuzz).toBeEnabled();
  // Both phones tap at once. `force` skips Playwright's wait-until-enabled: the slower tap may
  // land after the server has already closed buzzing, which is a normal way to lose the race.
  await Promise.all([aliceBuzz.click({ force: true }), beaBuzz.click({ force: true })]);

  // Exactly one winner: one "You're up!", one attempt on the host's list.
  await expect(H.locator(".host-attempts li")).toHaveCount(1);
  const raceWinner = (await H.locator(".host-attempts li .name").innerText()).trim();
  const winner = byName(players, raceWinner);
  const loser = raceWinner === alice.name ? bea : alice;
  await expect(winner.page.getByText("You're up!", { exact: true })).toBeVisible();
  await expect(loser.page.getByText(`${winner.name} got there first.`)).toBeVisible();
  await expect(loser.page.locator(".toast")).toHaveCount(0); // Losing a race is not an error.
  await expect(tv.page.getByText(`${winner.name} buzzed in!`)).toBeVisible();

  await H.getByRole("button", { name: /^Incorrect/ }).click();
  await expect(winner.page.getByRole("button", { name: "Locked" })).toBeDisabled();
  await expect(phoneScore(winner.page)).toHaveText(/^−\d/);
  await H.getByRole("button", { name: /^Reopen buzzers/ }).click();
  await loser.page.getByRole("button", { name: "Buzz!" }).click();
  await expect(loser.page.getByText("You're up!", { exact: true })).toBeVisible();
  await H.getByRole("button", { name: /^Correct/ }).click();
  await expect(H.getByText(`${loser.name} got it.`)).toBeVisible();
  await expect(H.getByRole("button", { name: /^Reopen buzzers/ })).toHaveCount(0);
  await H.getByRole("button", { name: /^Reveal answer/ }).click();
  await expect(tv.page.locator(".tv-answer")).toBeVisible();
  await H.getByRole("button", { name: /^Back to board/ }).click();
  await expect(H.locator(".host-picker")).toContainText(`${loser.name} picks`);

  // --- Wager clue A: the controller wagers on their phone ------------------
  await pickClue(H, "wager");
  const hiddenPrompt = (await H.locator(".host-prompt p").innerText()).trim();
  await expect(tv.page.getByText(`${loser.name} is placing a wager`)).toBeVisible();
  await expect(tv.page.getByText(hiddenPrompt)).toHaveCount(0); // Prompt stays private until the wager is in.
  await expect(carlo.page.getByText("is placing a wager")).toBeVisible();
  await expect(carlo.page.getByText(hiddenPrompt)).toHaveCount(0);
  await loser.page.getByRole("button", { name: /^All in/ }).click();
  await loser.page.getByRole("button", { name: "Lock in wager" }).click();
  await expect(tv.page.getByText(hiddenPrompt)).toBeVisible();
  await expect(tv.page.locator(".tv-clue__value")).toContainText("Wager");
  await H.getByRole("button", { name: /^Correct/ }).click();
  await revealAndReturn(H);

  // --- Wager clue B: the host enters the wager for the controller ---------
  await pickClue(H, "wager");
  await H.getByLabel(`${loser.name}'s wager`).fill("5");
  await H.getByRole("button", { name: `Lock in for ${loser.name}` }).click();
  await expect(H.locator(".host-note")).toHaveText(`${loser.name} wagered 5.`);
  await H.getByRole("button", { name: /^Incorrect −5/ }).click();
  await revealAndReturn(H);

  // --- Wager clue C: the host skips it ------------------------------------
  const before = await phoneScore(loser.page).innerText();
  await pickClue(H, "wager");
  await H.getByRole("button", { name: "Skip this clue (no score change)" }).click();
  await expect(tv.page.getByText("Skipped · no score change")).toBeVisible();
  await expect(
    loser.page.getByText("The host skipped this wager clue. No score change."),
  ).toBeVisible();
  await expect(phoneScore(loser.page)).toHaveText(before);
  await revealAndReturn(H);

  // --- A late joiner waits on the bench -----------------------------------
  const dani = await device(browser, "g-dani");
  await joinAsPlayer(dani, code, { nextGame: true });

  // --- Remaining standard clues: carlo gets one, the race winner the rest --
  for (let i = 0; await H.locator(".board--host").isVisible(); i++) {
    await pickClue(H, "standard");
    const answerer = i === 0 ? carlo : winner;
    await H.getByRole("button", { name: /^Open buzzers/ }).click();
    await answerer.page.getByRole("button", { name: "Buzz!" }).click();
    await H.getByRole("button", { name: /^Correct/ }).click();
    await H.getByRole("button", { name: /^Reveal answer/ }).click();
    await H.getByRole("button", { name: /^Back to board/ }).click();
    await expect(H.locator(".board--host, .host-final").first()).toBeVisible();
  }

  // --- Final round: private wagers --------------------------------------
  await expect(H.locator(".host-final")).toBeVisible();
  await expect(tv.page.getByText("Players are wagering.")).toBeVisible();
  const finalPrompt = (await H.locator(".host-prompt p").innerText()).trim();
  await expect(tv.page.getByText(finalPrompt)).toHaveCount(0);
  for (const player of players) {
    await expect(
      player.page.getByRole("heading", { name: "Place your final wager" }),
    ).toBeVisible();
    await player.page.getByRole("button", { name: "Half" }).click();
    await player.page.getByRole("button", { name: "Lock in wager" }).click();
    await expect(player.page.getByText("Locked in")).toBeVisible();
  }
  await expect(tv.page.getByText("Wagers in: 3 of 3")).toBeVisible();
  await expect(tv.page.locator(".tv-final")).not.toContainText(/wager \d/i); // Amounts stay private.
  await H.getByRole("button", { name: "Show final clue" }).click();

  // --- Final round: private answers --------------------------------------
  await expect(tv.page.getByText(finalPrompt)).toBeVisible();
  const answers = new Map([
    [alice.name, "What is answer A?"],
    [bea.name, "What is answer B?"],
    [carlo.name, "What is answer C?"],
  ]);
  for (const player of players) {
    await player.page.getByLabel("Your answer").fill(answers.get(player.name)!);
    await player.page.getByRole("button", { name: "Submit answer" }).click();
    await expect(player.page.getByText("Submitted")).toBeVisible();
  }
  await expect(tv.page.getByText("Answers in: 3 of 3")).toBeVisible();
  for (const text of answers.values()) await expect(tv.page.getByText(text)).toHaveCount(0);
  await H.getByRole("button", { name: "Lock answers" }).click();

  // --- Judging: reveal, then judge, one response at a time ---------------
  const judged: string[] = [];
  await expect(H.getByRole("button", { name: /^Reveal .*'s response$/ })).toBeVisible();
  while (await H.getByRole("button", { name: /^Reveal .*'s response$/ }).isVisible()) {
    const label = (
      await H.getByRole("button", { name: /^Reveal .*'s response$/ }).innerText()
    ).trim();
    const name = /^Reveal (.*)'s response$/.exec(label)![1];
    await H.getByRole("button", { name: label }).click();
    await expect(tv.page.getByText(`“${answers.get(name)}”`)).toBeVisible();
    await H.getByRole("button", { name: name === loser.name ? /^Correct/ : /^Incorrect/ }).click();
    judged.push(name);
    await expect(
      H.getByRole("button", { name: /^(Reveal .*'s response|Show results)$/ }),
    ).toBeVisible();
  }
  expect(judged.sort()).toEqual([...answers.keys()].sort());
  await H.getByRole("button", { name: "Show results" }).click();

  // --- Results -------------------------------------------------------------
  const headline = (await H.locator("#host-results-title").innerText()).trim();
  expect(headline).toMatch(/wins!$|^Shared win/);
  await expect(tv.page.locator(".tv-results")).toBeVisible();
  const winners = await Promise.all(
    players.map(async (p) => /You won!|Shared win!/.test(await p.page.locator("h1").innerText())),
  );
  expect(winners.filter(Boolean).length).toBeGreaterThanOrEqual(1);
  await expect(dani.page.getByText("This game just finished.")).toBeVisible();

  // --- Play again: everyone back in the lobby, the late joiner gets a seat --
  await H.getByRole("button", { name: "Play again" }).click();
  await expect(H.getByRole("heading", { name: "Set up the game" })).toBeVisible();
  await expect(H.locator(".host-roster li")).toHaveCount(4);
  await expect(
    dani.page.getByRole("heading", { name: "Waiting for the host to start" }),
  ).toBeVisible();
  await expect(phoneScore(winner.page)).toHaveText("0");
  await expect(tv.page.getByText("4 players in")).toBeVisible();

  const errors = [host, tv, ...players, dani].flatMap((p) => p.errors);
  expect(errors).toEqual([]);
});
