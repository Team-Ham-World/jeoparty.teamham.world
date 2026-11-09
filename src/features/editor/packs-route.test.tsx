// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPack, getSession, updatePack } from "@/features/network/client/api";
import { SESSION_SIGNED_IN } from "@/features/preview/fixtures";
import { blankPack, updateClue, updateFinal } from "./pack-draft";
import { PackEditorRoute } from "./packs-route";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/features/network/client/api", async (original) => ({
  ...(await original<typeof import("@/features/network/client/api")>()),
  getSession: vi.fn(),
  getPack: vi.fn(),
  updatePack: vi.fn(),
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
