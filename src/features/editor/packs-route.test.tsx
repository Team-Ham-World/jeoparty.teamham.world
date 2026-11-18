// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePack,
  duplicatePack,
  getPack,
  getSession,
  listPacks,
  updatePack,
} from "@/features/network/client/api";
import type { PackDocument, PackSummary } from "@/features/network/protocol";
import { SESSION_SIGNED_IN } from "@/features/preview/fixtures";
import { packDraftKey, readStoredDraft } from "./pack-autosave";
import { blankPack, updateClue, updateFinal } from "./pack-draft";
import { PackEditorRoute, PacksRoute } from "./packs-route";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/packs",
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/features/network/client/api", async (original) => ({
  ...(await original<typeof import("@/features/network/client/api")>()),
  getSession: vi.fn(),
  getPack: vi.fn(),
  updatePack: vi.fn(),
  listPacks: vi.fn(),
  deletePack: vi.fn(),
  duplicatePack: vi.fn(),
}));

function storedPack() {
  let pack = { ...blankPack(), title: "Stored pack" };
  pack = { ...pack, categories: [{ ...pack.categories[0], title: "Things" }] };
  pack.categories[0].clues.forEach((_, k) => {
    pack = updateClue(pack, 0, k, { prompt: `Prompt ${k}`, answer: `Answer ${k}` });
  });
  return updateFinal(pack, 0, { prompt: "Final prompt", answer: "Final answer" });
}

async function saveTitle(title: string) {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
  });
}

describe("pack editor route", () => {
  const accountId = SESSION_SIGNED_IN.signedIn ? SESSION_SIGNED_IN.user.id : "";
  const draftKey = packDraftKey(accountId, "p1");
  const openEditor = async () => act(async () => render(<PackEditorRoute id="p1" />));

  beforeEach(() => {
    const pack = storedPack();
    vi.mocked(getSession).mockResolvedValue(SESSION_SIGNED_IN);
    vi.mocked(getPack).mockResolvedValue({ id: "p1", pack, updatedAt: "version-1" });
    vi.mocked(updatePack).mockResolvedValue({ id: "p1", pack, updatedAt: "version-2" });
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("sends the loaded version, then the version from each successful save", async () => {
    await openEditor();
    await saveTitle("First edit");
    expect(vi.mocked(updatePack).mock.calls[0][3]).toBe("version-1");
    await saveTitle("Second edit");
    expect(vi.mocked(updatePack).mock.calls[1][3]).toBe("version-2");
  });

  it("autosaves under the signed-in account and this pack", async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved" } });
    expect(readStoredDraft(draftKey)).toMatchObject({
      pack: { title: "Unsaved" },
      baseUpdatedAt: "version-1",
    });
  });

  it("stores edits made during a successful save against the revision it returns", async () => {
    const { promise, resolve } = Promise.withResolvers<PackDocument>();
    vi.mocked(updatePack).mockReturnValueOnce(promise);
    await openEditor();
    await saveTitle("Sent edit");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Later edit" } });
    await act(async () => resolve({ id: "p1", pack: storedPack(), updatedAt: "version-2" }));
    expect(readStoredDraft(draftKey)).toMatchObject({
      pack: { title: "Later edit" },
      baseUpdatedAt: "version-2",
    });
  });

  it("keeps a recovered draft tied to the revision it was edited from", async () => {
    const { unmount } = await openEditor();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My draft" } });
    unmount();

    vi.mocked(getPack).mockResolvedValue({
      id: "p1",
      pack: { ...storedPack(), title: "Edited elsewhere" },
      updatedAt: "version-2",
    });
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await saveTitle("My recovered draft");
    expect(updatePack).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("changed");
    expect(screen.getByLabelText("Title")).toHaveValue("My recovered draft");
    expect(sessionStorage.getItem(draftKey)).toContain("version-1");
    expect(
      within(screen.getByRole("alert")).getByRole("button", { name: "Export JSON" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    const confirm = screen.getByRole("dialog", { name: "Discard your unsaved draft?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Discard draft" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Edited elsewhere");
    expect(sessionStorage.getItem(draftKey)).toBeNull();
    await saveTitle("Fresh edit");
    expect(updatePack).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      "p1",
      expect.objectContaining({ title: "Fresh edit" }),
      "version-2",
    );
  });

  it("recovers a legacy draft for export without saving over the loaded pack", async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ ...storedPack(), title: "Legacy draft" }));
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Legacy draft");
    await saveTitle("Edited legacy draft");
    expect(updatePack).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("saved version");
    expect(sessionStorage.getItem(draftKey)).toContain("Edited legacy draft");
  });

  it("saves a recovered draft when its revision still matches", async () => {
    const { unmount } = await openEditor();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My draft" } });
    unmount();

    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await saveTitle("My recovered draft");
    expect(updatePack).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      "p1",
      expect.objectContaining({ title: "My recovered draft" }),
      "version-1",
    );
    expect(sessionStorage.getItem(draftKey)).toBeNull();
  });
});

describe("pack library route", () => {
  const editing: PackSummary = {
    id: "p1",
    title: "Owner's pack",
    source: "mine",
    categories: 1,
    cluesPerCategory: 5,
    updatedAt: "2026-11-18T00:00:00.000Z",
    description: null,
  };
  const builtIn: PackSummary = {
    ...editing,
    id: "built-in",
    title: "Built-in sample",
    source: "builtIn",
    updatedAt: null,
  };

  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(SESSION_SIGNED_IN);
    vi.mocked(listPacks).mockResolvedValue([builtIn, editing]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("links the author's pack to the editor and opens a server-made copy of a built-in", async () => {
    vi.mocked(duplicatePack).mockResolvedValue({
      id: "copy",
      pack: { ...storedPack(), title: "Built-in sample (copy)" },
      updatedAt: "version-1",
    });
    await act(async () => {
      render(<PacksRoute />);
    });
    const mine = screen.getByRole("region", { name: "My packs" });
    expect(within(mine).getByRole("link", { name: "+ New pack" })).toHaveAttribute(
      "href",
      "/packs/new",
    );
    expect(within(mine).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/packs/p1");
    const builtIns = screen.getByRole("region", { name: "Built-in packs" });
    expect(within(builtIns).queryByRole("link", { name: "Edit" })).toBeNull();
    expect(within(builtIns).queryByRole("button", { name: "Delete" })).toBeNull();
    await act(async () => {
      fireEvent.click(within(builtIns).getByRole("button", { name: "Copy to my packs" }));
    });
    expect(duplicatePack).toHaveBeenCalledWith(
      SESSION_SIGNED_IN.signedIn && SESSION_SIGNED_IN.csrfToken,
      builtIn.id,
    );
    expect(push).toHaveBeenCalledWith("/packs/copy");
  });

  it("removes an owned pack from the shelf after confirmation and a successful API response", async () => {
    vi.mocked(deletePack).mockResolvedValue(undefined);
    await act(async () => {
      render(<PacksRoute />);
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete “Owner's pack”?" });
    expect(deletePack).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete pack" }));
    });
    expect(deletePack).toHaveBeenCalledWith(
      SESSION_SIGNED_IN.signedIn && SESSION_SIGNED_IN.csrfToken,
      editing.id,
    );
    expect(screen.getByText("No packs yet.")).toBeVisible();
    expect(screen.getByRole("heading", { name: builtIn.title })).toBeVisible();
  });
});
