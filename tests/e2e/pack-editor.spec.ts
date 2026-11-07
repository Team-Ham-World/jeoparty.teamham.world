/**
 * The pack editor against the real API: create with validation errors,
 * save, edit, leave-guard, export/import JSON, duplicate, delete, copy a
 * built-in pack, and use the new pack in a game.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { LAPTOP, device, signIn } from "./helpers";

const SAMPLE = path.join(process.cwd(), "src/features/content/samples/sample-pack-3x3.json");

test("write a pack, fix validation errors, save, export, import, duplicate, delete and play it", async ({ browser }, testInfo) => {
  // A fresh account per repeat/retry, so "No packs yet" holds on a shared server.
  const author = await device(browser, `e-author-${testInfo.repeatEachIndex}-${testInfo.retry}`, LAPTOP);
  const P = author.page;
  await signIn(P, author.name, "/packs");
  await expect(P.getByText("No packs yet.")).toBeVisible();

  // --- New pack: saving a blank pack maps every error to its field --------
  await P.getByRole("link", { name: "+ New pack" }).click();
  await expect(P.getByRole("heading", { name: "New pack" })).toBeVisible();
  await P.getByRole("button", { name: "Save pack" }).first().click();
  const summary = P.locator(".ed-errors");
  await expect(summary).toContainText("problems to fix");
  await expect(summary).toContainText("Pack title: Can't be empty.");
  await summary.getByRole("link", { name: "Pack title" }).click();
  await expect(P.getByLabel("Title", { exact: true })).toBeFocused();
  await expect(P.getByLabel("Title", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(P.locator("#f-title-error")).toHaveText("Can't be empty.");

  // --- Fill a small valid pack (1 category × 2 clues) and save it -----------
  await P.getByLabel("Title", { exact: true }).fill("Kitchen Lab");
  await P.getByLabel("Category title").fill("Kitchen Science");
  for (const n of [5, 4, 3]) await P.getByRole("button", { name: `Remove clue ${n}` }).click();
  await P.getByLabel("Clue 1", { exact: true }).fill("Water boils at this many degrees Celsius at sea level.");
  await P.getByLabel("Answer", { exact: true }).nth(0).fill("What is 100?");
  await P.getByLabel("Clue 2", { exact: true }).fill("Sodium bicarbonate is better known as this.");
  await P.getByLabel("Answer", { exact: true }).nth(1).fill("What is baking soda?");
  await P.getByLabel("Final clue", { exact: true }).fill("This scale measures the heat of chili peppers.");
  await P.getByLabel("Final answer", { exact: true }).fill("What is the Scoville scale?");
  await P.getByRole("button", { name: "Save pack" }).first().click();
  await P.waitForURL(/\/packs\/(?!new$)[^/]+$/);
  await expect(P.locator(".ed-bar__status")).toHaveText("Saved");
  await expect(P.locator(".ed-errors")).toHaveCount(0);

  // --- Edit, try to leave, stay, save ---------------------------------------
  await P.getByLabel("Description (optional)").fill("Science you can eat.");
  await expect(P.locator(".ed-bar__status")).toHaveText("Unsaved changes");
  await P.getByRole("link", { name: "← My packs" }).click();
  const leave = P.getByRole("dialog", { name: "Leave without saving?" });
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "Stay and save" }).click();
  await P.getByRole("button", { name: "Save changes" }).first().click();
  await expect(P.locator(".ed-bar__status")).toHaveText("Saved");

  // --- Export JSON ------------------------------------------------------------
  const [download] = await Promise.all([P.waitForEvent("download"), P.getByRole("button", { name: "Export JSON" }).click()]);
  expect(download.suggestedFilename()).toBe("kitchen-lab.json");
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported).toMatchObject({ title: "Kitchen Lab", description: "Science you can eat.", dimensions: { categories: 1, cluesPerCategory: 2 } });

  // --- Import: a broken file changes nothing, a good one fills a new pack ---
  await P.goto("/packs/new");
  const broken = testInfo.outputPath("broken.json");
  await writeFile(broken, JSON.stringify({ title: "" }));
  let chooser = Promise.all([P.waitForEvent("filechooser"), P.getByRole("button", { name: "Import JSON" }).click()]);
  await (await chooser)[0].setFiles(broken);
  await expect(P.locator(".toast")).toContainText("Couldn't import broken.json.");
  await expect(P.locator(".toast")).toContainText("Nothing was changed.");
  await expect(P.getByLabel("Title", { exact: true })).toHaveValue("");

  const good = testInfo.outputPath("imported.json");
  const sample = JSON.parse(await readFile(SAMPLE, "utf8"));
  await writeFile(good, JSON.stringify({ ...sample, title: "Imported Snack" }));
  chooser = Promise.all([P.waitForEvent("filechooser"), P.getByRole("button", { name: "Import JSON" }).click()]);
  await (await chooser)[0].setFiles(good);
  await expect(P.getByLabel("Title", { exact: true })).toHaveValue("Imported Snack");
  await expect(P.getByRole("heading", { name: "Categories (3)" })).toBeVisible();
  await P.getByRole("button", { name: "Save pack" }).first().click();
  await P.waitForURL(/\/packs\/(?!new$)[^/]+$/);
  await expect(P.locator(".ed-bar__status")).toHaveText("Saved");

  // --- List: duplicate, delete, copy a built-in -------------------------------
  await P.goto("/packs");
  const mine = P.locator("section", { has: P.getByRole("heading", { name: "My packs" }) }).locator(".pack-card");
  await expect(mine).toHaveCount(2);
  await expect(mine.filter({ hasText: "Kitchen Lab" })).toContainText("1 category × 2 clues");
  await mine.filter({ hasText: "Imported Snack" }).getByRole("button", { name: "Duplicate" }).click();
  await P.waitForURL(/\/packs\/(?!new$)[^/]+$/);
  await P.goto("/packs");
  await expect(mine).toHaveCount(3);
  await mine.filter({ hasText: "Imported Snack" }).first().getByRole("button", { name: "Delete" }).click();
  const confirm = P.getByRole("dialog", { name: /^Delete “Imported Snack”\?$/ });
  await expect(confirm.getByRole("button", { name: "Keep it" })).toBeFocused(); // The safe choice is focused first.
  await confirm.getByRole("button", { name: "Delete pack" }).click();
  await expect(mine).toHaveCount(2);
  await P.locator(".pack-card", { hasText: "Ham Snack" }).getByRole("button", { name: "Copy to my packs" }).click();
  await P.waitForURL(/\/packs\/(?!new$)[^/]+$/);
  await expect(P.getByLabel("Title", { exact: true })).toHaveValue("Ham Snack");

  // --- Use the new pack in a game ------------------------------------------------
  await P.goto("/");
  const select = P.getByLabel("Question pack");
  await expect(select.locator("option", { hasText: "Kitchen Lab" })).toBeAttached();
  const label = (await select.locator("option").allInnerTexts()).find((text) => text.startsWith("Kitchen Lab"))!;
  await select.selectOption({ label });
  await P.getByRole("button", { name: "Create game" }).click();
  await P.waitForURL(/\/host\/[A-Z]{5}$/);
  await expect(P.getByText("In use:")).toContainText("Kitchen Lab");
  await expect(P.locator(".host-top__pack")).toHaveText("Kitchen Lab");

  expect(author.errors).toEqual([]);
});
