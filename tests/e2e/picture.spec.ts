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
} from "./helpers";

const CLUE_PICTURE = 'img[src^="/api/pictures/"]';

async function drawnPng(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#e4d5b0";
    context.fillRect(0, 0, 640, 480);
    context.fillStyle = "#f4a6b8";
    context.fillRect(80, 140, 200, 200);
    context.fillStyle = "#1d4ed8";
    context.beginPath();
    context.arc(430, 240, 130, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function expectPicturesLoaded(page: Page, count = 1): Promise<void> {
  const pictures = page.locator(CLUE_PICTURE);
  await expect(pictures).toHaveCount(count);
  for (let i = 0; i < count; i++)
    await expect
      .poll(() => pictures.nth(i).evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
}

test("pictures from the editor show with their clues on the TV and host, and on phones without a buzzer", async ({
  browser,
}, testInfo) => {
  const run = `${testInfo.repeatEachIndex}-${testInfo.retry}`;
  const host = await device(browser, `pic-host-${run}`, LAPTOP);
  const tv = await device(browser, "pic-tv", TV);
  const alice = await device(browser, `pic-alice-${run}`, PHONE);
  const bystander = await device(browser, `pic-bea-${run}`, SMALL_PHONE);
  const phones = [alice, bystander];
  const H = host.page;

  await signIn(H, host.name, "/packs/new");
  await H.getByLabel("Title", { exact: true }).fill("Picture Night");
  await H.getByLabel("Category title").fill("Cut Paper");
  for (const n of [5, 4, 3]) await H.getByRole("button", { name: `Remove clue ${n}` }).click();
  await H.getByLabel("Clue 1", { exact: true }).fill("The blue shape in this picture is this.");
  await H.getByLabel("Answer", { exact: true }).nth(0).fill("What is a circle?");
  await H.getByLabel("Clue 2", { exact: true }).fill("The pink shape in this picture is this.");
  await H.getByLabel("Answer", { exact: true }).nth(1).fill("What is a square?");
  await H.getByLabel("Final clue", { exact: true }).fill("This many shapes are in the picture.");
  await H.getByLabel("Final answer", { exact: true }).fill("What is two?");
  const png = await drawnPng(H);
  for (const clue of ["clue 1", "clue 2", "the final clue"]) {
    const [chooser] = await Promise.all([
      H.waitForEvent("filechooser"),
      H.getByRole("button", { name: `Add picture for ${clue}` }).click(),
    ]);
    await chooser.setFiles({ name: "shapes.png", mimeType: "image/png", buffer: png });
    await expect(H.getByRole("button", { name: `Replace picture for ${clue}` })).toBeVisible();
  }
  await H.getByLabel("Picture description").first().fill("A pink square beside a blue circle");
  await expectPicturesLoaded(H, 3);
  await H.getByRole("button", { name: "Save pack" }).first().click();
  await H.waitForURL(/\/packs\/(?!new$)[^/]+$/);
  await expect(H.locator(".ed-bar__status")).toHaveText("Saved");
  await H.reload();
  await expectPicturesLoaded(H, 3);
  await expect(H.getByLabel("Picture description").first()).toHaveValue(
    "A pink square beside a blue circle",
  );

  const code = await createGame(H, host.name, "Picture Night");
  await saveSettings(H, (page) => setTimers(page, { buzz: 60, answer: 60, final: 180 }));
  await openDisplay(tv.page, await displayLink(H));
  for (const phone of phones) await joinAsPlayer(phone, code);
  await H.getByRole("button", { name: "Start game" }).click();
  await H.getByRole("button", { name: "Show the board" }).click();
  await expect(tv.page.locator(".board--stage")).toBeVisible();
  await expect(tv.page.locator(CLUE_PICTURE)).toHaveCount(0);

  await pickClue(H, "standard");
  await expect(tv.page.getByText("The blue shape in this picture is this.")).toBeVisible();
  await expectPicturesLoaded(tv.page);
  await expectPicturesLoaded(H);
  await expect(tv.page.locator(CLUE_PICTURE)).toHaveAttribute(
    "alt",
    "A pink square beside a blue circle",
  );
  await expect(tv.page.getByText("A pink square beside a blue circle")).toHaveCount(0);
  for (const phone of phones) {
    await expect(phone.page.getByRole("button", { name: "Wait" })).toBeVisible();
    await expect(phone.page.locator("img")).toHaveCount(0);
  }
  await H.getByRole("button", { name: /^Open buzzers/ }).click();
  await alice.page.getByRole("button", { name: "Buzz!" }).click();
  await H.getByRole("button", { name: /^Correct/ }).click();
  await revealAndReturn(H);

  await pickClue(H, "wager");
  await expect(tv.page.getByText(`${alice.name} is placing a wager`)).toBeVisible();
  await expectPicturesLoaded(H);
  await expect(tv.page.locator(CLUE_PICTURE)).toHaveCount(0);
  for (const phone of phones) await expect(phone.page.locator(CLUE_PICTURE)).toHaveCount(0);
  await alice.page.getByRole("button", { name: /^Min/ }).click();
  await alice.page.getByRole("button", { name: "Lock in wager" }).click();
  await expect(tv.page.getByText("The pink shape in this picture is this.")).toBeVisible();
  await expectPicturesLoaded(tv.page);
  for (const phone of phones) await expectPicturesLoaded(phone.page);
  await H.getByRole("button", { name: /^Correct/ }).click();
  await revealAndReturn(H);

  await expect(H.locator(".host-final")).toBeVisible();
  await expect(tv.page.getByText("Players are wagering.")).toBeVisible();
  await expectPicturesLoaded(H);
  await expect(tv.page.locator(CLUE_PICTURE)).toHaveCount(0);
  for (const phone of phones) await expect(phone.page.locator(CLUE_PICTURE)).toHaveCount(0);
  await alice.page.getByRole("button", { name: /^Half/ }).click();
  await alice.page.getByRole("button", { name: "Save wager" }).click();
  await expect(alice.page.getByText("Wager saved")).toBeVisible();
  await H.getByRole("button", { name: "Show final clue" }).click();
  await expect(tv.page.getByText("This many shapes are in the picture.")).toBeVisible();
  await expectPicturesLoaded(tv.page);
  await expectPicturesLoaded(alice.page);
  await expectPicturesLoaded(bystander.page);

  for (const person of [host, tv, ...phones]) expect(person.errors).toEqual([]);
});
