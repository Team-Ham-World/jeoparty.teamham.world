// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { validateQuestionPack, type QuestionPack } from "@/features/content";
import { ToastProvider } from "@/features/ui/toasts";
import { blankPack, fieldId, packForSave, updateClue, updateFinal } from "./pack-draft";
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
