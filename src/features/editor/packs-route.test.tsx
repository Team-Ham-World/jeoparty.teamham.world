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
import type { PackSummary } from "@/features/network/protocol";
import { SESSION_SIGNED_IN } from "@/features/preview/fixtures";
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
    await act(async () => {
      render(<PackEditorRoute id="p1" />);
    });
    await saveTitle("First edit");
    expect(vi.mocked(updatePack).mock.calls[0][3]).toBe("version-1");
    await saveTitle("Second edit");
    expect(vi.mocked(updatePack).mock.calls[1][3]).toBe("version-2");
  });

  it("autosaves under the signed-in account and this pack", async () => {
    await act(async () => {
      render(<PackEditorRoute id="p1" />);
    });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved" } });
    const account = SESSION_SIGNED_IN.signedIn ? SESSION_SIGNED_IN.user.id : "";
    expect(sessionStorage.getItem(`ham-quiz:pack-draft:${account}:p1`)).toContain("Unsaved");
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
