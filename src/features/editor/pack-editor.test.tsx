// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateQuestionPack, type QuestionPack } from "@/features/content";
import { ToastProvider } from "@/features/ui/toasts";
import { packDraftKey } from "./pack-autosave";
import {
  blankPack,
  exportFileName,
  fieldId,
  packForSave,
  updateClue,
  updateFinal,
} from "./pack-draft";
import { PackEditor } from "./pack-editor";
import { FINAL_CLUE_FIELD, finalCluePath } from "./pack-fields";

function filledPack(): QuestionPack {
  let pack = { ...blankPack(), title: "Test pack" };
  pack = { ...pack, categories: [{ ...pack.categories[0], title: "Things" }] };
  pack.categories[0].clues.forEach((_, k) => {
    pack = updateClue(pack, 0, k, { prompt: `Prompt ${k}`, answer: `Answer ${k}` });
  });
  return updateFinal(pack, 0, { prompt: "Final prompt", answer: "Final answer" });
}

describe("pack drafts", () => {
  it("a filled blank pack passes the shared validator", () => {
    const result = validateQuestionPack(packForSave(filledPack()));
    expect(result.ok).toBe(true);
  });

  it("keeps dimensions in sync with the content", () => {
    const pack = filledPack();
    const saved = packForSave({
      ...pack,
      categories: [...pack.categories, pack.categories[0]],
      dimensions: { categories: 9, cluesPerCategory: 9 },
    });
    expect(saved.dimensions).toEqual({ categories: 2, cluesPerCategory: 5 });
  });

  it("falls back to a default export name when a title slugs to nothing", () => {
    expect(exportFileName("Friday Night: Brain Melt!")).toBe("friday-night-brain-melt.json");
    expect(exportFileName("日本語クイズ")).toBe("ham-quiz-pack.json");
    expect(exportFileName("???")).toBe("ham-quiz-pack.json");
    expect(exportFileName("   ")).toBe("ham-quiz-pack.json");
  });

  it("names the final clue field in one place", () => {
    expect(finalCluePath(2)).toBe(`categories[2].${FINAL_CLUE_FIELD}`);
  });
});

/** The editor's save-state live region (the toast region is a status too). */
function saveStatus() {
  const region = screen.getAllByRole("status").find((el) => el.closest(".ed-bar"));
  if (!region) throw new Error("No save status in the editor bar");
  return region;
}

describe("pack editor", () => {
  it("maps server validation errors to their fields by path", async () => {
    const onSave = vi.fn(async () => {
      throw Object.assign(new Error("Fix the pack."), {
        validationErrors: [
          { path: "title", message: "Title is already used by another pack." },
          { path: `${finalCluePath(0)}.answer`, message: "Answer is too long." },
        ],
      });
    });
    render(
      <ToastProvider>
        <PackEditor initial={filledPack()} isNew onSave={onSave} onNavigate={() => {}} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save pack" })[0]);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    const title = screen.getByLabelText("Title");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription("Title is already used by another pack.");
    const finalAnswer = document.getElementById(fieldId(`${finalCluePath(0)}.answer`));
    expect(finalAnswer).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("2 problems to fix")).toBeVisible();
  });

  it("never says Saved while problems are listed", () => {
    render(
      <ToastProvider>
        <PackEditor
          initial={filledPack()}
          isNew={false}
          onSave={async () => {}}
          onNavigate={() => {}}
          initialErrors={[{ path: "title", message: "Title is already used by another pack." }]}
        />
      </ToastProvider>,
    );
    expect(saveStatus()).toHaveTextContent("Needs fixes");
    expect(screen.getByText("1 problem to fix")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed pack" } });
    expect(saveStatus()).toHaveTextContent("Unsaved changes");
  });

  it("says Saved for a stored pack with no problems", () => {
    render(
      <ToastProvider>
        <PackEditor
          initial={filledPack()}
          isNew={false}
          onSave={async () => {}}
          onNavigate={() => {}}
        />
      </ToastProvider>,
    );
    expect(saveStatus()).toHaveTextContent(/^Saved$/);
  });

  it("validates locally before calling the server", async () => {
    const onSave = vi.fn(async () => {});
    render(
      <ToastProvider>
        <PackEditor initial={blankPack()} isNew onSave={onSave} onNavigate={() => {}} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save pack" })[0]);
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  });
});

function editor(props: Partial<Parameters<typeof PackEditor>[0]> & { initial: QuestionPack }) {
  return (
    <ToastProvider>
      <PackEditor isNew={false} onSave={async () => {}} onNavigate={() => {}} {...props} />
    </ToastProvider>
  );
}

function rename(title: string) {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
}

describe("unsaved draft recovery", () => {
  const key = packDraftKey("account-1", "pack-1");

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  /** Edit, then leave the page without any guard running (browser Back, Sign out). */
  function leaveWithEdit(initial: QuestionPack) {
    const { unmount } = render(editor({ initial, draftKey: key }));
    rename("Edited title");
    unmount();
  }

  it("offers to restore edits after leaving without a save", () => {
    const initial = filledPack();
    leaveWithEdit(initial);
    render(editor({ initial, draftKey: key }));
    expect(screen.getByRole("dialog", { name: "Restore your unsaved edits?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Title")).toHaveValue("Edited title");
    expect(saveStatus()).toHaveTextContent("Unsaved changes");
  });

  it("puts Restore first, because a dialog focuses its first button", () => {
    const initial = filledPack();
    leaveWithEdit(initial);
    render(editor({ initial, draftKey: key }));
    const dialog = screen.getByRole("dialog", { name: "Restore your unsaved edits?" });
    expect(dialog.querySelector("button")).toHaveTextContent("Restore");
  });

  it("discard keeps the loaded pack and forgets the draft", () => {
    const initial = filledPack();
    leaveWithEdit(initial);
    render(editor({ initial, draftKey: key }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Test pack");
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("keeps the stored draft while the offer is unanswered", () => {
    const initial = filledPack();
    leaveWithEdit(initial);
    const before = sessionStorage.getItem(key);
    render(editor({ initial, draftKey: key }));
    expect(sessionStorage.getItem(key)).toBe(before);
  });

  it("does not offer a draft that matches what was loaded, or another account's", () => {
    const initial = filledPack();
    sessionStorage.setItem(key, JSON.stringify(initial));
    const { unmount } = render(editor({ initial, draftKey: key }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
    unmount();

    leaveWithEdit(initial);
    render(editor({ initial, draftKey: packDraftKey("account-2", "pack-1") }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores a stored draft it can't render", () => {
    sessionStorage.setItem(key, JSON.stringify({ title: "Old format" }));
    render(editor({ initial: filledPack(), draftKey: key }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears the stored draft after a successful save", async () => {
    render(editor({ initial: filledPack(), draftKey: key }));
    rename("Edited title");
    expect(sessionStorage.getItem(key)).toContain("Edited title");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    });
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("keeps the stored draft when a save fails", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("Nope.");
    });
    render(editor({ initial: filledPack(), draftKey: key, onSave }));
    rename("Edited title");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    });
    expect(sessionStorage.getItem(key)).toContain("Edited title");
  });

  it("keeps working when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    render(editor({ initial: filledPack(), draftKey: key }));
    rename("Edited title");
    expect(screen.getByLabelText("Title")).toHaveValue("Edited title");
    expect(saveStatus()).toHaveTextContent("Unsaved changes");
  });
});

describe("saving a new pack", () => {
  function saveButtons() {
    return screen.getAllByRole("button", { name: "Save pack" });
  }

  it("keeps Save off after the pack is created, so a second click can't copy it", async () => {
    // Stays on this page, as the editor does while the redirect is still in progress.
    const onSave = vi.fn(async () => {});
    render(editor({ initial: filledPack(), isNew: true, onSave }));
    await act(async () => {
      fireEvent.click(saveButtons()[0]);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(saveStatus()).toHaveTextContent(/^Saved$/);
    for (const button of saveButtons()) expect(button).toBeDisabled();
    await act(async () => {
      fireEvent.click(saveButtons()[0]);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("offers Save again when creating the pack fails", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("Nope.");
    });
    render(editor({ initial: filledPack(), isNew: true, onSave }));
    await act(async () => {
      fireEvent.click(saveButtons()[0]);
    });
    for (const button of saveButtons()) expect(button).toBeEnabled();
    expect(saveStatus()).toHaveTextContent("Not saved yet");
  });

  it("lets an existing pack save again after more edits", async () => {
    const onSave = vi.fn(async () => {});
    render(editor({ initial: filledPack(), onSave }));
    rename("First edit");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    });
    rename("Second edit");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    });
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});

describe("save conflicts", () => {
  it("shows the server's message and keeps the author's work", async () => {
    const onSave = vi.fn(async () => {
      throw Object.assign(new Error("This pack changed in another tab."), { code: "conflict" });
    });
    render(editor({ initial: filledPack(), onSave }));
    rename("My version");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("This pack changed in another tab.");
    expect(screen.getByLabelText("Title")).toHaveValue("My version");
    expect(saveStatus()).toHaveTextContent("Unsaved changes");
  });
});

describe("importing over unsaved edits", () => {
  async function importPack(title: string) {
    const json = JSON.stringify({ ...packForSave(filledPack()), title });
    const file = Object.assign(new File([json], "other.json", { type: "application/json" }), {
      text: async () => json,
    });
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error("No file input");
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
  }

  it("asks first when the draft is dirty, and Keep editing changes nothing", async () => {
    render(editor({ initial: filledPack() }));
    rename("My edits");
    await importPack("Imported title");
    expect(screen.getByRole("dialog", { name: "Replace your unsaved changes?" })).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue("My edits");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Title")).toHaveValue("My edits");
  });

  it("replaces the draft once confirmed", async () => {
    render(editor({ initial: filledPack() }));
    rename("My edits");
    await importPack("Imported title");
    fireEvent.click(screen.getByRole("button", { name: "Import and replace" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Imported title");
  });

  it("imports straight away when there is nothing to lose", async () => {
    render(editor({ initial: filledPack() }));
    await importPack("Imported title");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Title")).toHaveValue("Imported title");
  });
});
